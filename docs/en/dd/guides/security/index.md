---
sidebar_label: "Overview"
title: "Security Overview - CyberGo DD | Log Security"
description: "CyberGo DD security overview: sensitive-data redaction, file-path safety validation, audit events, HMAC integrity signing, compliance, and rate limiting."
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

### Which Page to Read First

- Just want automatic redaction in logs → [Sensitive Data Filtering](./sensitive-filtering)
- Need to meet HIPAA / PCI-DSS or similar requirements → [Industry Compliance](./compliance)
- Need tamper-proof logs → [Integrity](./integrity)
- Preparing for production launch → [Production Checklist](./production-checklist)

## Sensitive-Data Filtering

DD has built-in automatic sensitive-data detection and redaction:

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.DefaultSecurityConfig() // Basic filtering (already the DefaultConfig default)
logger, _ := dd.New(cfg)

// The password field is auto-redacted
logger.InfoWith("login",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // Output: [REDACTED]
)
```

Supported custom patterns:

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,
    `(?i)api[_-]?key\s*[:=]\s*\S+`,
    `\b\d{16,19}\b`,  // Credit card number
)
if err != nil {
    log.Fatal(err) // Regex safety validation failed
}
```

See [Security Filtering API](../../api-reference/security-audit/security).

## Path Security

FileWriter has multi-layered path-safety validation built in:

| Protection | Description |
|------------|-------------|
| Path traversal | Reject `../` and similar traversal |
| Null bytes | Reject null-byte injection |
| Overlong encoding | Detect UTF-8 overlong encoding |
| Symlinks | Unconditional symlink rejection |
| Hardlinks | Unconditional hardlink rejection |
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
cfg := dd.DefaultConfig()
cfg.Security = dd.HealthcareConfig()
logger, _ := dd.New(cfg)
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

See [Audit Logging API](../../api-reference/security-audit/audit).

## Log Integrity

HMAC signing ensures logs cannot be tampered with:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
signature := signer.Sign(logMessage)
// On verification: signer.Verify(signedEntry)
```

See [Integrity Signing API](../../api-reference/security-audit/integrity).

## Rate Limiting

`SecurityConfig.RateLimitConfig` protects against log flooding (DoS). It is **off by default** — none of the preset security configs populate this field, so it must be enabled explicitly:

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
cfg.Security.RateLimitConfig = dd.DefaultRateLimitConfig() // 10,000 msg/s, 10MB/s, burst 1000, RateLimitStrategyDrop strategy
logger, _ := dd.New(cfg)
```

Three over-limit strategies: `RateLimitStrategyDrop` discards messages (default); `RateLimitStrategySample` keeps a fraction when over limit (e.g. 1 in 100); `RateLimitStrategyThrottle` is kept for API completeness and currently behaves like `RateLimitStrategyDrop` (the Logger never blocks).

:::tip Two Independent Mechanisms
`Config.Sampling` ([Log Sampling](../operations/sampling)) and `SecurityConfig.RateLimitConfig` (rate limiting) are independent mechanisms: sampling reduces volume periodically via counters, rate limiting caps the rate to prevent flooding; both can be enabled at the same time. See the [Security API](../../api-reference/security-audit/security) for rate-limit fields.
:::

## Next Steps

- [Production Checklist](./production-checklist) -- Pre-launch security checks
- [Security Filtering API](../../api-reference/security-audit/security) -- SensitiveDataFilter in depth
- [Audit Logging API](../../api-reference/security-audit/audit) -- AuditLogger in depth
