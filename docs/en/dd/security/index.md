---
title: "Security Overview - CyberGo DD | Log Security"
description: "CyberGo DD security features overview: sensitive data filtering, audit logging, HMAC integrity signing, and compliance best practices for Go logging."
---

# Security Overview

The DD logging library features built-in multi-layer security mechanisms, providing comprehensive log security from data filtering to audit tracing.

## Security Layers

| Layer | Mechanism | Description |
|-------|-----------|-------------|
| Data Layer | Sensitive Data Filtering | Automatic redaction of passwords, keys, etc. |
| Path Layer | Path Security Validation | Prevents path traversal, symlink attacks |
| Pattern Layer | ReDoS Protection | Detects dangerous regex patterns |
| Audit Layer | Audit Logging | Records all security events |
| Integrity Layer | HMAC Signing | Ensures logs cannot be tampered with |

## Sensitive Data Filtering

DD has built-in automatic sensitive data detection and redaction:

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// Password field automatically redacted
logger.InfoWith("login",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // Output: [REDACTED]
)
```

Supported custom patterns:

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // Credit card numbers
)
```

See [Security Filtering API](../api-reference/security).

## Path Security

FileWriter includes multi-layer path security validation:

| Protection | Description |
|------------|-------------|
| Path Traversal | Rejects `../` and similar path traversal |
| Null Bytes | Rejects null byte injection |
| Overlong Encoding | Detects UTF-8 overlong encoding |
| Symlinks | Configurable symlink prohibition |
| Hard Links | Configurable hard link prohibition |
| Path Length | Limits maximum path length |

```go
// Path traversal attack automatically rejected
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err: PATH_TRAVERSAL
```

## Compliance Configuration

DD provides industry compliance presets:

| Preset | Compliance Standard | Applicable Industry |
|--------|---------------------|---------------------|
| `HealthcareConfig()` | HIPAA | Healthcare |
| `FinancialConfig()` | PCI-DSS | Finance |
| `GovernmentConfig()` | Government Standards | Public Sector |

```go
// HIPAA compliance
logger, _ := dd.New(dd.Config{
    Security: dd.HealthcareConfig(),
})
```

## Audit Logging

All security events can be tracked through audit logging:

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

audit.LogSecurityViolation("sql_injection", "SQL injection", map[string]any{
    "input": "' OR 1=1 --",
})
```

See [Audit Logging API](../api-reference/audit).

## Log Integrity

Ensure logs cannot be tampered with through HMAC signing:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// For verification: signer.Verify(signedEntry)
```

See [Integrity Signing API](../api-reference/integrity).

## Next Steps

- [Production Checklist](./production-checklist) -- Pre-launch security checks
- [Security Filtering API](../api-reference/security) -- SensitiveDataFilter details
- [Audit Logging API](../api-reference/audit) -- AuditLogger details
