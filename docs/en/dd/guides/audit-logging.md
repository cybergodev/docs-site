---
sidebar_label: "Audit Logging"
title: "Audit Logging - CyberGo DD | Security Audit Guide"
description: "CyberGo DD audit-logging practical guide, covering the AuditLogger asynchronous event-recording mechanism, 11 built-in audit event types, severity-level filtering and tiering, HMAC integrity-signing integration, audit statistics and real-time monitoring, and log verification and tamper-protection strategies to help you build a compliant enterprise-grade security audit system."
sidebar_position: 5
---

# Audit Logging

Audit logs are separate from business logs and specifically record security-related events (such as sensitive-data redaction, ReDoS attack attempts, etc.); they are suitable for compliance auditing and security analysis.

## Overview

```text
Business logs (Logger)        Audit logs (AuditLogger)
    │                             │
    ├─ Info/Debug/Warn...         ├─ SensitiveDataRedacted
    ├─ Structured fields          ├─ RateLimitExceeded
    └─ File/console output        ├─ ReDoSAttempt
                                  ├─ SecurityViolation
                                  └─ IntegrityViolation
```

Audit logs are written asynchronously through a buffered channel and do not block business flows.

## Creating an AuditLogger

### Basic Usage

```go
auditLogger, err := dd.NewAuditLogger(dd.DefaultAuditConfig())
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()

// The AuditLogger can be created standalone (as in this example) or auto-integrated with a Logger via Config.Audit
// Here we demonstrate standalone usage: build a separate logger without setting Config.Audit
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
    Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Custom Configuration

```go
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           os.Stderr,               // Output target (*os.File)
    BufferSize:       2000,                    // Buffer channel size
    IncludeTimestamp: true,                    // Include timestamp
    JSONFormat:       true,                    // JSON format
    MinimumSeverity:  dd.AuditSeverityWarning, // Minimum severity
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

## Audit Event Types

AuditLogger records 11 security events:

| Event Type | Description | Default Severity |
|------------|-------------|------------------|
| `AuditEventSensitiveDataRedacted` | Sensitive data redacted | Info |
| `AuditEventRateLimitExceeded` | Rate limit triggered | Warning |
| `AuditEventReDoSAttempt` | ReDoS attack attempt | Critical |
| `AuditEventSecurityViolation` | Security violation | Error |
| `AuditEventIntegrityViolation` | Log integrity broken | Critical |
| `AuditEventInputSanitized` | Input sanitized | <Badge type="info" text="caller-specified" /> |
| `AuditEventPathTraversalAttempt` | Path-traversal attempt | Critical |
| `AuditEventLog4ShellAttempt` | Log4Shell attack attempt | <Badge type="info" text="caller-specified" /> |
| `AuditEventNullByteInjection` | Null-byte injection attempt | <Badge type="info" text="caller-specified" /> |
| `AuditEventOverlongEncoding` | Overlong-encoding attack | <Badge type="info" text="caller-specified" /> |
| `AuditEventHomographAttack` | Homograph attack | <Badge type="info" text="caller-specified" /> |

## Integrating with HMAC Signing

Combining audit logging with integrity signing prevents logs from being tampered with:

```go
// Create the signer
integrityCfg, err := dd.DefaultIntegrityConfigSafe()
if err != nil {
    log.Fatal(err)
}
signer, err := dd.NewIntegritySigner(integrityCfg)
if err != nil {
    log.Fatal(err)
}

// Create a signing AuditLogger
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    Enabled:          true,
    Output:           auditFile,
    JSONFormat:       true,
    BufferSize:       1000,
    MinimumSeverity:  dd.AuditSeverityInfo,
    IntegritySigner:  signer, // HMAC signing
})
```

## Audit Statistics

```go
stats := auditLogger.Stats()
fmt.Printf("total events: %d\n", stats.TotalEvents)
fmt.Printf("dropped events: %d\n", stats.Dropped)
fmt.Printf("buffer usage: %.1f%%\n",
    float64(stats.BufferUsage)/float64(stats.BufferSize)*100)

// Per-type statistics
for eventType, count := range stats.ByType {
    fmt.Printf("  %s: %d\n", eventType, count)
}
```

:::tip Monitoring Recommendation
Check the `Dropped` count periodically. If dropped events keep growing, the buffer is too small — increase `BufferSize` or speed up consumption.
:::

## Log Verification

Verify the integrity of audit log entries:

```go
// Verify a single audit log line
result := dd.VerifyAuditEvent(logLine, signer)
if result.Valid {
    fmt.Printf("verified: %s\n", result.RawEvent)
    if result.Event != nil {
        fmt.Printf("  type: %s, message: %s\n", result.Event.Type, result.Event.Message)
    }
} else {
    fmt.Printf("verification failed: %s\n", result.Error)
}
```

## Severity-Level Filtering

Audit events are filtered by severity; events below `MinimumSeverity` are ignored:

```go
// Only record Warning and above
auditLogger, err := dd.NewAuditLogger(dd.AuditConfig{
    MinimumSeverity: dd.AuditSeverityWarning,
})
if err != nil {
    log.Fatal(err)
}
defer auditLogger.Close()
```

| Level | Value | Use Case |
|-------|-------|----------|
| `AuditSeverityInfo` | 0 | Record all events (dev/debug) |
| `AuditSeverityWarning` | 1 | Recommended for production |
| `AuditSeverityError` | 2 | High-security requirements |
| `AuditSeverityCritical` | 3 | Record critical events only |

## Complete Example

```go
package main

import (
    "log"
    "os"

    "github.com/cybergodev/dd"
)

func main() {
    // Create the audit file
    auditFile, err := os.Create("logs/audit.json")
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // Create the signer
    integrityCfg, err := dd.DefaultIntegrityConfigSafe()
    if err != nil {
        log.Fatal(err)
    }
    signer, err := dd.NewIntegritySigner(integrityCfg)
    if err != nil {
        log.Fatal(err)
    }

    // Create the AuditLogger
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

    // Create the business Logger (with security filtering)
    logger, err := dd.New(dd.Config{
        Format:   dd.FormatJSON,
        Security: dd.DefaultSecureConfig(),
        Targets:  []dd.OutputTarget{dd.ConsoleOutput()},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    // Normal business log (sensitive data auto-redacted)
    logger.InfoWith("user action",
        dd.String("username", "alice"),
        dd.String("password", "secret123"), // -> [REDACTED]
    )

    // Note: this example does not set Config.Audit on the Logger, so redaction and other
    // security events are NOT automatically written to the audit log.
    // To have the business logger's security events auto-forwarded to the AuditLogger,
    // configure Config.Audit on that logger (when Enabled it automatically routes
    // redaction, rate-limit, and similar events into the audit stream).
}
```

:::info Auto-integration vs Standalone Use
AuditLogger **can be created standalone** (`dd.NewAuditLogger`, as in this section's examples) **or auto-integrated with a Logger via `Config.Audit`**. The latter, when the `Enabled` field of `Config.Audit` (type `AuditConfig`) is true, automatically forwards sensitive-data redaction events, rate-limit events, etc. to the AuditLogger — no manual hook wiring required.
:::

## Next Steps

- [HMAC Signing In Practice](../advanced/integrity) -- Integrity signing in depth
- [Industry Compliance Configuration](../security/compliance) -- HIPAA/PCI-DSS audit requirements
- [API Reference - Audit](../api-reference/security-audit/audit) -- Complete AuditLogger API
- [API Reference - Integrity](../api-reference/security-audit/integrity) -- IntegritySigner API
