---
sidebar_label: "Security & Audit"
title: "Security & Audit in Practice - CyberGo DD | Security Logging Example"
description: "A complete set of practical examples for CyberGo DD security filtering and audit logging, covering sensitive-data filtering rule configuration, HMAC integrity signing and verification, audit-event recording and batch verification, industry-compliance configuration (HIPAA/PCI-DSS), and best practices and caveats for designing and deploying production-grade secure logging architectures."
sidebar_position: 3
---

# Security & Audit in Practice

This example shows how to configure DD's security filtering, audit logging, and integrity signing to build a production-grade secure logging solution.

## Sensitive-Data Filtering

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

    // Password auto-redacted
    logger.InfoWith("user login",
        dd.String("username", "alice"),
        dd.String("password", "s3cr3t123"),    // -> password=[REDACTED]
    )

    // API Key auto-redacted (note: endpoint is also a sensitive key name and is redacted)
    logger.InfoWith("API call",
        dd.String("endpoint", "/api/data"),      // -> endpoint=[REDACTED] ("endpoint" is also a sensitive key name)
        dd.String("api_key", "sk-abc123xyz"),   // -> api_key=[REDACTED]
    )
}
```

### Industry-Compliance Configuration

```go
// HIPAA medical compliance
medicalLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/medical.json")},
})

medicalLogger.InfoWith("patient visit",
    dd.String("password", "s3cr3t123"),        // -> [REDACTED] (sensitive key name)
    dd.String("diagnosis", "routine check"),   // Normal output
)

// PCI-DSS financial compliance
paymentLogger, _ := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.FinancialConfig(),
    Targets:  []dd.OutputTarget{dd.FileOutput("logs/payment.json")},
})

paymentLogger.InfoWith("payment processing",
    dd.String("card_number", "4111111111111111"),  // -> [REDACTED]
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

    // HMAC signer (tamper protection)
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // AuditLogger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // Business Logger
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
        // Note: Audit is not configured here, so the business logger's redaction/security
        // events do NOT automatically flow into the auditLogger above.
        // To have security events auto-routed to audit, configure the Audit field here
        // (e.g. pass the AuditConfig of the auditLogger above via Audit: &auditCfg),
        // or call auditLogger.LogX(...) explicitly to record events.
    })
    defer logger.Close()

    // Normal business operations (redaction handled by Security, but not auto-written to the audit log)
    logger.InfoWith("transaction processed",
        dd.String("transaction_id", "TXN-001"),
        dd.String("amount", "1500.00"),
        dd.String("card_number", "4111111111111111"),  // -> [REDACTED]
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
    // Create the signer
    signer, err := dd.NewIntegritySigner(dd.IntegrityConfig{
        SecretKey:       []byte("your-32-byte-secret-key-here-1234"),
        IncludeTimestamp: true,
        IncludeSequence:  true,
    })
    if err != nil {
        panic(err)
    }

    // Sign a log entry
    logEntry := `{"level":"info","message":"important action","user":"admin"}`
    signature := signer.Sign(logEntry)
    signedEntry := logEntry + signature

    // Verify log integrity
    result, err := signer.Verify(signedEntry)
    if err != nil {
        fmt.Printf("verification error: %v\n", err)
    } else if result.Valid {
        fmt.Printf("verified - timestamp: %s, sequence: %d\n",
            result.Timestamp, result.Sequence)
    } else {
        fmt.Printf("verification failed: log may have been tampered with\n")
    }
}
```

### Batch-verifying Audit Logs

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

    // AuditLogger
    auditFile, _ := os.OpenFile("logs/audit.json", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       2000,
        MinimumSeverity:  dd.AuditSeverityWarning,
        IntegritySigner:  signer,
    })

    // Business Logger
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

- [API Reference - Security](../api-reference/security-audit/security) -- Complete security-filtering API
- [API Reference - Audit](../api-reference/security-audit/audit) -- Complete audit-logging API
- [API Reference - Integrity](../api-reference/security-audit/integrity) -- Integrity-signing API
- [Production Checklist](../security/production-checklist) -- Pre-launch security checks
