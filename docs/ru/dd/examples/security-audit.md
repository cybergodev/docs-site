---
title: "Безопасность и аудит на практике - CyberGo DD | Примеры безопасных логов"
description: "Полная коллекция практических примеров фильтрации безопасности и аудитных логов CyberGo DD, охватывающая настройку правил фильтрации конфиденциальных данных, HMAC-подписи целостности и проверку, запись аудитных событий и массовую проверку, отраслевые конфигурации соответствия (HIPAA/PCI-DSS) и лучшие практики и рекомендации по проектированию и развёртыванию архитектуры безопасных логов в производственных средах."
---

# Безопасность и аудит на практике

В этом примере показано, как настроить фильтрацию безопасности, аудитные логи и подписи целостности DD для построения производственной системы безопасного логирования.

## Фильтрация конфиденциальных данных

### Базовая фильтрация

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    logger, _ := dd.New(dd.Config{
        Security: dd.DefaultSecurityConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // Пароль автоматически маскируется
    logger.InfoWith("Пользователь вошёл",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // → password=[REDACTED]
    )

    // API Key автоматически маскируется
    logger.InfoWith("API вызов",
        dd.String("endpoint", "/api/data"),
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### Отраслевые конфигурации соответствия

```go
// HIPAA медицинское соответствие
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("Приём пациента",
    dd.String("password", "s3cr3t123"),        // → [REDACTED] (имя ключа чувствительное)
    dd.String("diagnosis", "Обычный осмотр"),         // Нормальный вывод
)

// PCI-DSS финансовое соответствие
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("Обработка платежа",
    dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    dd.String("amount", "99.99"),                  // Нормальный вывод
)
```

## Аудитные логи

### Полная система аудита

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Файл аудитных логов
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // HMAC подписывающее устройство (защита от подделки)
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Аудитный Logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // Бизнес Logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // Обычная бизнес-операция
    logger.InfoWith("Обработка транзакции",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    )
}
```

## Проверка целостности

### Процесс подписи и проверки

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // Создание подписывающего устройства
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // Подписание записи лога
    logEntry := `{"level":"info","message":"Важная операция","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // Проверка целостности лога
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("Ошибка проверки: %v\n", err)
    } else if result.Valid {
        fmt.Printf("Проверка пройдена - временная метка: %s, серийный номер: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("Проверка не пройдена: лог возможно подделан\n")
    }
}
```

### Массовая проверка аудитных логов

```go
func VerifyAuditLog(path string, signer *dd.IntegritySigner) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    lineNum := 0
    for scanner.Scan() {
        lineNum++
        result := dd.VerifyAuditEvent(scanner.Text(), signer)
        if result == nil || !result.Valid {
            errMsg := "unknown error"
            if result != nil && result.Error != nil {
                errMsg = result.Error.Error()
            }
            return fmt.Errorf("line %d: integrity check failed - %s",
                lineNum, errMsg)
        }
    }
    return nil
}
```

## Конфигурация безопасности для производственной среды

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // Подписывающее устройство аудита
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Аудитный Logger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // Бизнес Logger
    fwCfg := dd.DefaultFileWriterConfig()
    fwCfg.MaxSizeMB = 50
    fwCfg.Compress = true
    fw, _ := dd.NewFileWriter("logs/app.json", fwCfg)

    logger, _ := dd.New(dd.Config{
        Level:    dd.LevelInfo,
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.CustomOutput(fw)},
    })

    return logger, auditLogger, nil
}
```

## Следующие шаги

- [Справочник API - Security](../api-reference/security) -- полный API фильтрации безопасности
- [Справочник API - Audit](../api-reference/audit) -- полный API аудитных логов
- [Справочник API - Integrity](../api-reference/integrity) -- API подписей целостности
- [Контрольный список для продакшена](../security/production-checklist) -- проверка безопасности перед развёртыванием
