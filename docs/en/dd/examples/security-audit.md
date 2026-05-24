---
title: "Security & Audit - CyberGo DD | Logging Examples"
description: "CyberGo DD security filtering and audit logging examples: sensitive data redaction, HMAC signing, audit events, and HIPAA/PCI-DSS compliance setups."
---

# Security & Audit in Practice

This example demonstrates how to configure DD's security filtering, audit logging, and integrity signing to build a production-grade secure logging solution.

## Sensitive Data Filtering

### Basic Filtering

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

    // Password automatically redacted
    logger.InfoWith("User login",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // → password=[REDACTED]
    )

    // API Key automatically redacted
    logger.InfoWith("API call",
        dd.String("endpoint", "/api/data"),
        dd.String("api_key", "sk-abc123xyz"),   // → api_key=[REDACTED]
    )
}
```

### Industry Compliance Configuration

```go
// HIPAA healthcare compliance
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("Patient visit",
    dd.String("patient_mrn", "MRN-123456"),   // → [REDACTED]
    dd.String("diagnosis", "routine check"),   // Normal output
)

// PCI-DSS financial compliance
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("Payment processing",
    dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    dd.String("amount", "99.99"),                  // Normal output
)
```

## Audit Logging

### Complete Audit System

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Audit log file
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // HMAC signer (tamper prevention)
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Audit logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // Business logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // Normal business operations
    logger.InfoWith("Transaction processed",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // → [REDACTED]
    )
}
```

## Integrity Verification

### Sign and Verify Flow

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // Create signer
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // Sign log entry
    logEntry := `{"level":"info","message":"Critical operation","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // Verify log integrity
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("Verify error: %v\n", err)
    } else if result.Valid {
        fmt.Printf("Valid - Timestamp: %s, Sequence: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("Invalid: Log may have been tampered with\n")
    }
}
```

### Batch Audit Log Verification

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

## Production Security Configuration

```go
func NewSecureLogger() (*dd.Logger, *dd.AuditLogger, error) {
    // Audit signer
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Audit logger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // Business logger
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

## Next Steps

- [API Reference - Security](../api-reference/security) -- Security filtering complete API
- [API Reference - Audit](../api-reference/audit) -- Audit logging complete API
- [API Reference - Integrity](../api-reference/integrity) -- Integrity signing API
- [Production Checklist](../security/production-checklist) -- Pre-launch security check
