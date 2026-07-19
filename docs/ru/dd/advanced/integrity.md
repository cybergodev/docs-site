---
sidebar_label: "HMAC-подписи"
title: "HMAC-подписи - CyberGo DD | Защита целостности"
description: "Руководство по практике HMAC-SHA256 подписей целостности логов CyberGo DD, охватывающее создание и инициализацию конфигурации IntegritySigner, полный процесс подписи и проверки, механизм временных меток и инкрементных серийных номеров, стратегии обнаружения подделки, схемы интеграции с системой аудитных логов и лучшие практики развёртывания в производственной среде, гарантируя целостность и отслеживаемость всей цепочки логов."
sidebar_position: 3
---

# Практика HMAC-подписей

`IntegritySigner` DD использует HMAC-SHA256 для подписи записей логов, гарантируя, что логи не будут подделаны при хранении и передаче.

## Основные концепции

```text
Процесс подписи:
  Исходный лог → HMAC-SHA256(ключ + временная метка + серийный номер) → Подписанный лог

Процесс проверки:
  Подписанный лог → Извлечение подписи → Пересчёт HMAC → Сравнение подписей → Оценка целостности
```

## Создание подписывающего устройства

### Конфигурация безопасного ключа

```go
// Способ 1: Автоматическая генерация безопасного ключа (рекомендуется)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
// cfg.SecretKey заполнен 32-байтным случайным ключом

signer, _ := dd.NewIntegritySigner(cfg)
```

### Пользовательская конфигурация

```go
cfg := dd.IntegrityConfig{
    SecretKey:       []byte("your-32-byte-minimum-secret-key!!"),  // Минимум 32 байта
    HashAlgorithm:   dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,    // Подпись включает временную метку
    IncludeSequence:  true,    // Подпись включает серийный номер
    SignaturePrefix:  "[SIG:",  // Префикс подписи
}
```

:::danger Управление ключами
- Ключ должен быть не менее 32 байт
- Не встраивайте ключ в исходный код, используйте переменные окружения или сервисы управления ключами
- Регулярно меняйте ключи
- При утечке ключа немедленно смените его и перепроверьте все логи
:::

## Процесс подписи

```go
// Создание подписывающего устройства
signer, _ := dd.NewIntegritySigner(cfg)

// Подписание одного лога
logEntry := `{"level":"info","message":"Пользователь вошёл","user":"admin"}`
signature := signer.Sign(logEntry)
signedEntry := logEntry + signature

fmt.Println(signedEntry)
// Вывод: {"level":"info","message":"Пользователь вошёл","user":"admin"}[SIG:1713456789000000000:1:base64sig...]
```

### Статистика подписей

```go
stats := signer.Stats()
fmt.Printf("Текущий серийный номер: %d\n", stats.Sequence)
fmt.Printf("Алгоритм: %s\n", stats.Algorithm)
fmt.Printf("Включена временная метка: %v\n", stats.IncludeTimestamp)
fmt.Printf("Включён серийный номер: %v\n", stats.IncludeSequence)
```

## Процесс проверки

### Проверка одного лога

```go
result, err := signer.Verify(signedEntry)
if err != nil {
    fmt.Printf("✗ Ошибка проверки: %v\n", err)
    return
}

if result.Valid {
    fmt.Printf("✓ Лог целостен - время: %s, серийный номер: %d\n",
        result.Timestamp, result.Sequence)
    fmt.Printf("Сообщение: %s\n", result.Message)
} else {
    fmt.Printf("✗ Лог возможно подделан\n")
}
```

### Массовая проверка файла логов

```go
func VerifyLogFile(path string, signer *dd.IntegritySigner) (valid, invalid int, err error) {
    file, err := os.Open(path)
    if err != nil {
        return 0, 0, err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        result, err := signer.Verify(scanner.Text())
        if err != nil || !result.Valid {
            invalid++
        } else {
            valid++
        }
    }

    return valid, invalid, scanner.Err()
}
```

### Проверка аудитных событий

```go
result := dd.VerifyAuditEvent(auditLogLine, signer)
if result.Valid && result.Event != nil {
    fmt.Printf("Аудитное событие: %s\n", result.Event.Message)
} else {
    fmt.Printf("Проверка не пройдена: %s\n", result.Error)
}
```

## Интеграция с аудитными логами

```go
// Полное решение: подписи + аудит
func NewSignedAuditSystem() (*dd.AuditLogger, *dd.IntegritySigner, error) {
    // Подписывающее устройство
    cfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(cfg)

    // Файл аудита
    auditFile, _ := os.OpenFile(
        "logs/audit-signed.json",
        os.O_CREATE|os.O_WRONLY|os.O_APPEND,
        0600,
    )

    // Аудитный Logger (с подписями)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        IncludeTimestamp: true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    return auditLogger, signer, nil
}
```

## Временные метки и серийные номера

Подписывающее устройство поддерживает встраивание временных меток и серийных номеров в подписи:

```go
cfg := dd.IntegrityConfig{
    SecretKey:       secretKey,
    IncludeTimestamp: true,    // Подпись содержит временную метку
    IncludeSequence:  true,    // Подпись содержит инкрементный серийный номер
}

// После включения, результат Verify содержит дополнительную информацию
result, _ := signer.Verify(signedEntry)
result.Timestamp  // Временная метка подписи
result.Sequence   // Серийный номер подписи
```

:::tip Обнаружение через серийные номера
После включения серийных номеров можно обнаружить удаление или перестановку логов. Если серийные номера не непрерывны, логи возможно были подделаны. Обратите внимание: сам по себе серийный номер не предотвращает повтор (replay) — для этого проверяющая сторона должна отслеживать уже наблюдённые номера и выявлять дубликаты.
:::

## Лучшие практики для продакшена

### Управление ключами

```go
// Чтение ключа из переменной окружения
func loadSecretKey() ([]byte, error) {
    key := os.Getenv("DD_INTEGRITY_SECRET")
    if len(key) < 32 {
        return nil, fmt.Errorf("secret key must be at least 32 bytes")
    }
    return []byte(key), nil
}
```

### Регулярная проверка

```go
// Проверка целостности аудитных логов каждый час
func startIntegrityChecker(signer *dd.IntegritySigner, logPath string) {
    ticker := time.NewTicker(time.Hour)
    go func() {
        for range ticker.C {
            valid, invalid, err := VerifyLogFile(logPath, signer)
            if err != nil {
                dd.Errorf("Ошибка проверки целостности: %v", err)
                continue
            }
            dd.InfoWith("Проверка целостности завершена",
                dd.Int("valid", valid),
                dd.Int("invalid", invalid),
            )
            if invalid > 0 {
                dd.Error("Обнаружена подделка логов")
            }
        }
    }()
}
```

## Следующие шаги

- [Аудитные логи](../guides/audit-logging) -- интеграция аудита безопасности
- [Конфигурация отраслевого соответствия](../security/compliance) -- требования к подписям HIPAA/PCI-DSS
- [Справочник API - Integrity](../api-reference/security-audit/integrity) -- полный API IntegritySigner
