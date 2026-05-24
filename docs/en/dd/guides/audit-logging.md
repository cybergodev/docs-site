---
title: "Audit Logging - CyberGo DD | Security Audit Practical Guide"
description: "CyberGo DD audit logging guide: AuditLogger async events, 11 event types, severity filtering, HMAC signing, monitoring, and compliance strategies."
---

# Audit Logging

Audit logging operates independently from business logging, specifically recording security-related events (such as sensitive data redaction, ReDoS attack attempts, etc.), making it suitable for compliance auditing and security analysis.

## Overview

```text
Business Logger               Audit Logger (AuditLogger)
    │                               │
    ├─ Info/Debug/Warn...           ├─ SensitiveDataRedacted
    ├─ Structured fields            ├─ RateLimitExceeded
    └─ File/Console output          ├─ ReDoSAttempt
                                    ├─ SecurityViolation
                                    └─ IntegrityViolation
```

Audit logs are written asynchronously through a buffered channel without blocking business flows.

## Creating an AuditLogger

### Basic Usage

```go
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer auditLogger.Close()

// Note: AuditLogger and Logger are independent components.
// They do not auto-integrate; connection requires hooks or other mechanisms.
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets: []dd.OutputTarget{dd.ConsoleOutput()},
})
```

### Custom Configuration

```go
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,           // Output target (*os.File)
    BufferSize:       2000,                // Buffered channel size
    IncludeTimestamp: true,                // Include timestamp
    JSONFormat:       true,                // JSON format
    MinimumSeverity:  dd.AuditSeverityWarning, // Minimum severity level
})
```

## Audit Event Types

AuditLogger records 11 types of security events:

| Event Type | Description | Default Severity |
|------------|-------------|-----------------|
| `SensitiveDataRedacted` | Sensitive data was redacted | Info |
| `RateLimitExceeded` | Rate limit triggered | Warning |
| `ReDoSAttempt` | ReDoS attack attempt | Critical |
| `SecurityViolation` | Security violation | Error |
| `IntegrityViolation` | Log integrity compromised | Critical |
| `InputSanitized` | Input was sanitized | Info |
| `PathTraversalAttempt` | Path traversal attempt | Critical |
| `Log4ShellAttempt` | Log4Shell attack attempt | <Badge type="info" text="Caller-specified" /> |
| `NullByteInjection` | Null byte injection attempt | <Badge type="info" text="Caller-specified" /> |
| `OverlongEncoding` | Overlong encoding attack | <Badge type="info" text="Caller-specified" /> |
| `HomographAttack` | Homograph attack | <Badge type="info" text="Caller-specified" /> |

## Integrating with HMAC Signatures

Audit logging combined with integrity signatures can prevent log tampering:

```go
// Create a signer
integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(integrityCfg)

// Create an audit logger with signing
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer,    // HMAC signature
})
```

## Audit Statistics

```go
stats := auditLogger.Stats()
fmt.Printf("Total events: %d\n", stats.TotalEvents)
fmt.Printf("Dropped events: %d\n", stats.Dropped)
fmt.Printf("Buffer usage: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// Statistics by type
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip Monitoring Recommendation
Regularly check the `Dropped` count. If the number of dropped events is growing, it indicates insufficient buffer capacity — you need to increase `BufferSize` or improve consumption speed.
:::

## Log Verification

Verify the integrity of audit log entries:

```go
// Verify a single audit log entry
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("Verified: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  Type: %s, Message: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("Verification failed: %s\n", result.Error)
}
```

## Severity Level Filtering

Audit events are filtered by severity level. Events below `MinimumSeverity` are ignored:

```go
// Only record Warning and above
auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
```

| Level | Value | Use Case |
|-------|-------|----------|
| `AuditSeverityInfo` | 0 | Record all events (development/debugging) |
| `AuditSeverityWarning` | 1 | Recommended for production |
| `AuditSeverityError` | 2 | High-security requirements |
| `AuditSeverityCritical` | 3 | Only record critical events |

## Complete Example

```go
package main

import (
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Create audit file
    auditFile, _ := os.Create("logs/audit.json")
    defer auditFile.Close()

    // Create signer
    integrityCfg, _ := dd.DefaultIntegrityConfigSafe()
    signer, _ := dd.NewIntegritySigner(integrityCfg)

    // Create audit logger
    auditLogger, _ := dd.NewAuditLogger(dd.AuditConfig{
        Enabled:          true,
        Output:           auditFile,
        JSONFormat:       true,
        BufferSize:       1000,
        MinimumSeverity:  dd.AuditSeverityInfo,
        IntegritySigner:  signer,
    })
    defer auditLogger.Close()

    // Create business logger (with security filtering)
    logger, _ := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    defer logger.Close()

    // Normal business logging (sensitive data automatically redacted)
    logger.InfoWith("User action",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // → [REDACTED]
    )

    // Note: AuditLogger and Logger are independent components.
    // Use hooks or other mechanisms to forward Logger security events to AuditLogger.
}
```

## Next Steps

- [HMAC Signatures in Practice](../advanced/integrity) -- Integrity signature details
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS audit requirements
- [API Reference - Audit](../api-reference/audit) -- AuditLogger complete API
- [API Reference - Integrity](../api-reference/integrity) -- IntegritySigner API
