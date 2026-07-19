---
sidebar_label: "Аудитные логи"
title: "Аудитные логи - CyberGo DD | Аудит и безопасность"
description: "Руководство по практике аудитных логов CyberGo DD, охватывающее механизм асинхронной записи событий AuditLogger, 11 встроенных типов аудитных событий, фильтрацию и градацию по уровням серьёзности, интеграцию HMAC-подписей целостности, статистику аудита и мониторинг в реальном времени, стратегии проверки логов и защиты от подделки, помогая разработчикам строить корпоративные системы аудита безопасности, соответствующие требованиям комплаенса."
sidebar_position: 5
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
auditLogger, err := dd.NewAuditLogger(dd.DefaultAuditConfig())
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()

// AuditLogger можно использовать как автономно (как в этом примере),
// так и интегрировать с Logger через Config.Audit
// Здесь демонстрируется автономный вариант: отдельный logger без Config.Audit
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Пользовательская конфигурация

```go
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,               // Цель вывода (*os.File)
    BufferSize:       2000,                    // Размер буферизованного канала
    IncludeTimestamp: true,                    // Включать временную метку
    JSONFormat:       true,                    // Формат JSON
    MinimumSeverity:  dd.AuditSeverityWarning, // Минимальный уровень серьёзности
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

## Типы аудитных событий

AuditLogger записывает 11 типов событий безопасности:

| Тип события | Описание | Уровень серьёзности по умолчанию |
|-------------|----------|--------------------------------|
| `AuditEventSensitiveDataRedacted` | Конфиденциальные данные замаскированы | Info |
| `AuditEventRateLimitExceeded` | Срабатывание ограничения скорости | Warning |
| `AuditEventReDoSAttempt` | Попытка атаки ReDoS | Critical |
| `AuditEventSecurityViolation` | Нарушение безопасности | Error |
| `AuditEventIntegrityViolation` | Нарушение целостности логов | Critical |
| `AuditEventInputSanitized` | Входные данные очищены | <Badge type="info" text="Указывается вызывающим" /> |
| `AuditEventPathTraversalAttempt` | Попытка обхода пути | Critical |
| `AuditEventLog4ShellAttempt` | Попытка атаки Log4Shell | <Badge type="info" text="Указывается вызывающим" /> |
| `AuditEventNullByteInjection` | Попытка инъекции null-байта | <Badge type="info" text="Указывается вызывающим" /> |
| `AuditEventOverlongEncoding` | Атака сверхдлинной кодировкой | <Badge type="info" text="Указывается вызывающим" /> |
| `AuditEventHomographAttack` | Атака гомоглифами | <Badge type="info" text="Указывается вызывающим" /> |

## Интеграция с HMAC-подписями

Аудитные логи в сочетании с подписями целостности предотвращают подделку логов:

```go
// Создание подписывающего устройства
integrityCfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(integrityCfg)
if err != nil {
    log.Fatal(err)
}

// Создание аудитного Logger с подписями
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer, // HMAC-подпись
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

:::tip Рекомендации по мониторингу
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
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
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
    "log"
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Создание файла аудита
    auditFile, err := os.Create("logs/audit.json")
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // Создание подписывающего устройства
    integrityCfg, err := dd.DefaultIntegrityConfigSafe()
    if err != nil {
        log.Fatal(err)
    }
    signer, err := dd.NewIntegritySigner(integrityCfg)
    if err != nil {
        log.Fatal(err)
    }

    // Создание аудитного Logger
    auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    if err != nil {
        log.Fatal(err)
    }
    defer auditLogger.Close()

    // Создание бизнес-Logger (с фильтрацией безопасности)
    logger, err := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    // Нормальные бизнес-логи (конфиденциальные данные автоматически маскируются)
    logger.InfoWith("Пользовательская операция",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // Примечание: в этом примере у Logger не задан Config.Audit, поэтому события
    // редукции и другие события безопасности не будут автоматически попадать в audit.
    // Чтобы события безопасности бизнес-логгера автоматически перенаправлялись в AuditLogger,
    // задайте Config.Audit у этого логгера (после включения события редукции, ограничения
    // скорости и т.п. будут автоматически перенаправлены в поток аудита).
}
```

:::info Информация
AuditLogger **можно использовать как автономно** (`dd.NewAuditLogger`, как в примерах этого раздела), **так и через `Config.Audit` для автоматической интеграции с Logger**. В последнем случае, при `Config.Audit.Enabled = true`, события маскирования конфиденциальных данных, события ограничения скорости и т.п. автоматически перенаправляются в AuditLogger без ручного подключения хуков.
:::

## Следующие шаги

- [Практика HMAC-подписей](../advanced/integrity) -- подробное описание подписей целостности
- [Конфигурация отраслевого соответствия](../security/compliance) -- требования аудита HIPAA/PCI-DSS
- [Справочник API - Audit](../api-reference/security-audit/audit) -- полный API AuditLogger
- [Справочник API - Integrity](../api-reference/security-audit/integrity) -- API IntegritySigner
