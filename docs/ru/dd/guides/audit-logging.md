---
title: "Аудитные логи - CyberGo DD | Практическое руководство по аудиту безопасности"
description: "Практическое руководство по аудитным логам CyberGo DD, охватывающее механизм асинхронной записи событий AuditLogger, 11 встроенных типов аудитных событий, фильтрацию по уровню серьёзности, интеграцию с HMAC-подписями целостности, статистику аудита и мониторинг в реальном времени, проверку логов и стратегии защиты от подделки, помогающее разработчикам создать корпоративную систему аудита безопасности, соответствующую требованиям соответствия."
---

# Аудитные логи

Аудитные логи независимы от бизнес-логов и специально записывают события, связанные с безопасностью (такие как маскирование конфиденциальных данных, попытки атак ReDoS и т.д.), подходящие для аудита соответствия и анализа безопасности.

## Обзор

```text
Бизнес-логи (Logger)          Аудитные логи (AuditLogger)
    │                               │
    ├─ Info/Debug/Warn...           ├─ SensitiveDataRedacted
    ├─ Структурированные поля       ├─ RateLimitExceeded
    └─ Вывод в файл/консоль         ├─ ReDoSAttempt
                                    ├─ SecurityViolation
                                    └─ IntegrityViolation
```

Аудитные логи записываются асинхронно через буферизованный канал, не блокируя бизнес-процесс.

## Создание AuditLogger

### Базовое использование

```go
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer auditLogger.Close()

// Примечание: AuditLogger и Logger — независимые компоненты
// Они не интегрируются автоматически, нужно подключать вручную через хуки или другие механизмы
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets: []dd.OutputTarget{dd.ConsoleOutput()},
})
```

### Пользовательская конфигурация

```go
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,           // Цель вывода (*os.File)
    BufferSize:       2000,                // Размер буферизованного канала
    IncludeTimestamp: true,                // Включать временную метку
    JSONFormat:       true,                // Формат JSON
    MinimumSeverity:  dd.AuditSeverityWarning, // Минимальный уровень серьёзности
})
```

## Типы аудитных событий

AuditLogger записывает 11 типов событий безопасности:

| Тип события | Описание | Уровень серьёзности по умолчанию |
|-------------|----------|--------------------------------|
| `SensitiveDataRedacted` | Конфиденциальные данные замаскированы | Info |
| `RateLimitExceeded` | Срабатывание ограничения скорости | Warning |
| `ReDoSAttempt` | Попытка атаки ReDoS | Critical |
| `SecurityViolation` | Нарушение безопасности | Error |
| `IntegrityViolation` | Нарушение целостности логов | Critical |
| `InputSanitized` | Входные данные очищены | Info |
| `PathTraversalAttempt` | Попытка обхода пути | Critical |
| `Log4ShellAttempt` | Попытка атаки Log4Shell | <Badge type="info" text="Указывается вызывающим" /> |
| `NullByteInjection` | Попытка инъекции null-байта | <Badge type="info" text="Указывается вызывающим" /> |
| `OverlongEncoding` | Атака сверхдлинной кодировкой | <Badge type="info" text="Указывается вызывающим" /> |
| `HomographAttack` | Атака гомоглифами | <Badge type="info" text="Указывается вызывающим" /> |

## Интеграция с HMAC-подписями

Аудитные логи в сочетании с подписями целостности предотвращают подделку логов:

```go
// Создание подписывающего устройства
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

// Создание аудитного Logger с подписями
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,    // HMAC-подпись
})
```

## Статистика аудита

```go
stats := auditLogger.Stats()
fmt.Printf("Всего событий: %d\n", stats.TotalEvents)
fmt.Printf("Отброшено событий: %d\n", stats.Dropped)
fmt.Printf("Использование буфера: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// Статистика по типам
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip Рекомендация по мониторингу
Регулярно проверяйте счётчик `Dropped`. Если количество отброшенных событий растёт, это указывает на недостаточный размер буфера — увеличьте `BufferSize` или повысьте скорость потребления.
:::

## Проверка логов

Проверка целостности записей аудитных логов:

```go
// Проверка одной записи аудитного лога
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("Проверено: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  Тип: %s, Сообщение: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("Проверка не пройдена: %s\n", result.Error)
}
```

## Фильтрация по уровню серьёзности

Аудитные события фильтруются по уровню серьёзности, события ниже `MinimumSeverity` игнорируются:

```go
// Записывать только Warning и выше
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
```

| Уровень | Значение | Сценарий применения |
|---------|----------|-------------------|
| `AuditSeverityInfo` | 0 | Запись всех событий (разработка/отладка) |
| `AuditSeverityWarning` | 1 | Рекомендуется для производственных сред |
| `AuditSeverityError` | 2 | Высокие требования к безопасности |
| `AuditSeverityCritical` | 3 | Только критические события |

## Полный пример

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Создание файла аудита
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // Создание подписывающего устройства
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Создание аудитного Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // Создание бизнес-Logger (с фильтрацией безопасности)
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // Нормальные бизнес-логи (конфиденциальные данные автоматически маскируются)
    logger.InfoWith("Пользовательская операция",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // Примечание: AuditLogger и Logger — независимые компоненты
    // Нужно подключать события безопасности Logger к AuditLogger через хуки
}
```

## Следующие шаги

- [Практика HMAC-подписей](../advanced/integrity) -- подробное описание подписей целостности
- [Конфигурация отраслевого соответствия](../security/compliance) -- требования аудита HIPAA/PCI-DSS
- [Справочник API - Audit](../api-reference/audit) -- полный API AuditLogger
- [Справочник API - Integrity](../api-reference/integrity) -- API IntegritySigner
