---
sidebar_label: "Overview"
title: "Security Overview - CyberGo DD | Log Security"
description: "A comprehensive overview of CyberGo DD's security features, including automatic sensitive-data detection and redaction filtering, file-path safety validation and protection, asynchronous audit-event recording and chain-tracking capabilities, HMAC integrity-signing tamper protection, and compliance-configuration best practices — fully safeguarding the logging system from data filtering to audit tracing."
sidebar_position: 1
---

# Security Overview

DD has multi-layered security built in, fully safeguarding log security from data filtering to audit tracing.

## Security Layers

| Layer | Mechanism | Description |
|-------|-----------|-------------|
| Data | Sensitive-data filtering | Auto-redact passwords, keys, etc. |
| Path | Path-safety validation | Prevent path-traversal and symlink attacks |
| Pattern | ReDoS protection | Detect dangerous regex patterns |
| Audit | Audit logging | Record key security events (redaction, rate-limit, violations, etc.) |
| Integrity | HMAC signing | Ensure logs are tamper-evident |

## Sensitive-Data Filtering

DD has built-in automatic sensitive-data detection and redaction:

```go
logger, _ := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})

// The password field is auto-redacted
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
    `\b\d{16,19}\b`,  // Credit card number
)
```

See [Security Filtering API](../api-reference/security-audit/security).

## Path Security

FileWriter has multi-layered path-safety validation built in:

| Protection | Description |
|------------|-------------|
| Path traversal | Reject `../` and similar traversal |
| Null bytes | Reject null-byte injection |
| Overlong encoding | Detect UTF-8 overlong encoding |
| Symlinks | Configurable symlink rejection |
| Hardlinks | Configurable hardlink rejection |
| Path length | Cap maximum path length |

```go
// Path-traversal attack auto-rejected
fw, err := dd.NewFileWriter("../../../etc/passwd", dd.DefaultFileWriterConfig())
// err.Error(): "path traversal detected"
```

## Compliance Configuration

DD provides industry-compliance presets:

| Preset | Compliance Standard | Industry |
|--------|---------------------|----------|
| `HealthcareConfig()` | HIPAA | Medical |
| `FinancialConfig()` | PCI-DSS | Financial |
| `GovernmentConfig()` | Government standard | Public sector |

```go
// HIPAA compliance
logger, _ := dd.New(dd.Config{
    Security: dd.HealthcareConfig(),
})
```

## Audit Logging

All security events can be tracked via audit logging:

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

audit.LogSecurityViolation("sql_injection", "SQL injection", map[string]any{
    "input": "' OR 1=1 --",
})
```

See [Audit Logging API](../api-reference/security-audit/audit).

## Log Integrity

HMAC signing ensures logs cannot be tampered with:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// On verification: signer.Verify(signedEntry)
```

See [Integrity Signing API](../api-reference/security-audit/integrity).

## Next Steps

- [Production Checklist](./production-checklist) -- Pre-launch security checks
- [Security Filtering API](../api-reference/security-audit/security) -- SensitiveDataFilter in depth
- [Audit Logging API](../api-reference/security-audit/audit) -- AuditLogger in depth
