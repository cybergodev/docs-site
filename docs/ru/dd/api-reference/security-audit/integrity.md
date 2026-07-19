---
sidebar_label: "Подписи целостности"
title: "Подписи целостности - CyberGo DD | IntegritySigner"
description: "Полная документация API подписей целостности CyberGo DD: алгоритм HMAC-SHA256 и механизм отслеживания инкрементных серийных номеров, гарантирующие, что каждая запись лога не была подделана, предоставляя подписывающее IntegritySigner и верификатор Verify, удовлетворяя требованиям к комплаенс-аудиту безопасности и защите логов от подделки."
sidebar_position: 4
---

# Подписи целостности

DD предоставляет механизм подписи целостности логов на основе HMAC, позволяющий проверить, что записи логов не были подделаны.

## IntegritySigner

Подписывающее устройство записей логов: поддерживает HMAC-подпись и монотонное отслеживание серийных номеров (независимо для каждой записи, без прямой связи между ними; для последующего выявления потери/повтора записей вызывающая сторона должна сама сверять серийные номера).

### Создание

```go
func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)
```

Создаёт подписывающее устройство с переданной `IntegrityConfig`. Можно использовать `DefaultIntegrityConfigSafe()` для генерации криптографически безопасного случайного ключа.

Случаи возврата ошибки: `SecretKey` короче 32 байт или неподдерживаемый `HashAlgorithm`.

:::warning Безопасность ключа
`NewIntegritySigner` **копирует** переданный `SecretKey` и немедленно обнуляет исходный `cfg.SecretKey` (чтобы избежать остатков ключевого материала в двух областях памяти). Вызывающей стороне по-прежнему следует избегать раскрытия исходного ключа в логах или сериализации.
:::

```go
// Безопасное создание (рекомендуется для продакшена)
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// Пользовательская конфигурация
cfg := dd.IntegrityConfig{
    SecretKey:      []byte("my-secret-key-that-is-at-least-32b!"),
    HashAlgorithm:  dd.HashAlgorithmSHA256,
    IncludeTimestamp: true,
    IncludeSequence:  true,
}
signer, err = dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

### Методы подписи

#### Sign

```go
func (s *IntegritySigner) Sign(message string) string
```

Генерирует HMAC-подпись для лог-сообщения. Потокобезопасный, поддерживает конкурентные вызовы.

```go
sig := signer.Sign("Пользователь вошёл admin 192.168.1.1")
// → "[SIG:1713456789000000000:1:base64signature...]"
```

#### SignFields

```go
func (s *IntegritySigner) SignFields(message string, fields []Field) string
```

Генерирует подпись для сообщения с полями, подпись включает сообщение и все значения полей. Потокобезопасный, поддерживает конкурентные вызовы.

```go
sig := signer.SignFields("Пользователь вошёл", []dd.Field{
    dd.String("user", "admin"),
    dd.String("ip", "192.168.1.1"),
})
```

### Методы проверки

#### Verify

```go
func (s *IntegritySigner) Verify(entry string) (*LogIntegrity, error)
```

Проверяет целостность записи лога. Потокобезопасный, поддерживает конкурентные вызовы.

```go
integrity, err := signer.Verify(signedEntry)
if err != nil {
    // Ошибка проверки (например, signer равен nil)
}
if !integrity.Valid {
    // Подпись недействительна: несовпадение подписи или ошибка формата
}
if integrity.Sequence != expectedSeq {
    // Серийный номер не непрерывный: возможно, записи были удалены
}
```

### Другие методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `GetSequence` | `() uint64` | Текущий серийный номер |
| `ResetSequence` | `()` | Сброс серийного номера |
| `Stats` | `() IntegrityStats` | Статистика подписей |

## IntegrityConfig

Конфигурация подписей.

```go
type IntegrityConfig struct {
    SecretKey        []byte        // HMAC-ключ (SHA-256 требует ≥ 32 байт; обязательно храните надёжно и периодически ротатируйте)
    HashAlgorithm    HashAlgorithm // Алгоритм хеширования (по умолчанию SHA256)
    IncludeTimestamp bool          // Подпись включает временную метку
    IncludeSequence  bool          // Подпись включает монотонно возрастающий серийный номер (результат Verify несёт этот номер; вызывающая сторона должна сама отслеживать его, чтобы выявлять повтор/переупорядочивание)
    SignaturePrefix  string        // Префикс подписи (по умолчанию "[SIG:"; при пустом значении NewIntegritySigner заполняет значением по умолчанию)
}
```

### Безопасное создание

```go
func DefaultIntegrityConfigSafe() (IntegrityConfig, error)
```

Безопасное создание конфигурации по умолчанию (автоматическая генерация ключа). Рекомендуется для продакшена.

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Validate` | `() error` | Проверить корректность конфигурации (`SecretKey` должен быть ≥ 32 байт; `HashAlgorithm` должен быть поддерживаемым алгоритмом) |
| `Clone` | `() IntegrityConfig` | Глубокое копирование конфигурации (`SecretKey` копируется в новый срез) |
| `MarshalJSON` | `() ([]byte, error)` | JSON-сериализация (сам ключ **не** сериализуется, выводится только `secretKeyLength`) |

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}
```

## LogIntegrity

Результат проверки целостности лога.

```go
type LogIntegrity struct {
    Valid     bool       // Действительна ли подпись
    Timestamp time.Time  // Временная метка подписи
    Sequence  uint64     // Серийный номер
    Message   string     // Оригинальное сообщение
}
```

## IntegrityStats

Статистика подписей.

```go
type IntegrityStats struct {
    Sequence         uint64 // Текущий серийный номер
    Algorithm        string // Имя алгоритма
    IncludeTimestamp bool   // Включена ли временная метка
    IncludeSequence  bool   // Включён ли серийный номер
}
```

## HashAlgorithm

| Константа | Описание |
|-----------|----------|
| `HashAlgorithmSHA256` | Алгоритм SHA-256 |

Реализует метод `String()`, возвращающий имя алгоритма.

## Полный пример

### Процесс подписи логов

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

// Подписание лога
message := "Пользователь вошёл"
signature := signer.Sign(message)

// Хранение подписанной записи лога
logEntry := message + signature

// Проверка лога
result, err := signer.Verify(logEntry)
if err != nil {
    fmt.Println("Ошибка проверки целостности:", err)
} else if result.Valid {
    fmt.Printf("Проверка пройдена - серийный номер: %d\n", result.Sequence)
}
```

### Интеграция с аудитом

```go
cfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(cfg)
if err != nil {
    log.Fatal(err)
}

auditCfg := dd.DefaultAuditConfig()
auditCfg.IntegritySigner = signer
audit, _ := dd.NewAuditLogger(auditCfg)
defer audit.Close()

// Аудитные логи автоматически подписываются
audit.Log(dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Message:  "Попытка SQL-инъекции",
    Severity: dd.AuditSeverityCritical,
    Metadata: map[string]any{"input": "' OR 1=1"},
})

// Проверка аудитных логов
stats := signer.Stats()
fmt.Printf("Алгоритм: %s, серийный номер: %d\n", stats.Algorithm, stats.Sequence)
```

## Следующие шаги

- [Аудитные логи](./audit) -- подробное описание AuditLogger
- [Фильтрация безопасности](./security) -- фильтрация конфиденциальных данных
- [Константы и ошибки](../dev-tools/constants) -- коды ошибок
