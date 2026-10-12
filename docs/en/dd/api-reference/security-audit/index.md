---
sidebar_label: "Overview"
title: "Security & Audit - CyberGo DD | API Overview"
description: "CyberGo DD security and audit API overview covering SensitiveDataFilter, AuditLogger, and IntegritySigner — their roles, relationships, and use cases."
sidebar_position: 1
---

# Security & Audit

DD's security stack consists of three independent but complementary components, covering the full chain from data redaction to audit traceability.

## Components

| Component | Responsibility | Typical Use Case |
|-----------|---------------|-----------------|
| [SensitiveDataFilter](./security) | Auto-detect and redact sensitive data in logs | Prevent passwords, API keys, credit card numbers from leaking |
| [AuditLogger](./audit) | Asynchronously log security-related events | Compliance audit, security analysis, intrusion detection |
| [IntegritySigner](./integrity) | HMAC signing to prevent log tampering | Tamper detection, forensic evidence, compliance storage |

## How They Relate

```text
Log write pipeline:

  Logger.InfoWith(...)
       │
       ├─→ SensitiveDataFilter ──→ Redact field values (password → [REDACTED])
       │         │
       │         └─→ AuditLogger ──→ Async record redaction events
       │
       └─→ Format output

  AuditLogger (optional IntegritySigner) ──→ HMAC-sign audit events (tamper protection)
```

- **SensitiveDataFilter** intercepts sensitive data **before** logs are written
- **AuditLogger** records security events asynchronously without impacting log performance
- **IntegritySigner** is **not wired into the regular log write path**: it signs only **audit events** (via `AuditConfig.IntegritySigner`) or content you sign manually with `Sign`/`SignFields`

## Quick Selection

| Need | Recommended |
|------|------------|
| Prevent password/key leakage | [SensitiveDataFilter](./security) |
| Prevent log flooding (DoS) | `SecurityConfig.RateLimitConfig` — see [Security Filtering](./security) |
| Record who did what and when | [AuditLogger](./audit) |
| Ensure logs haven't been tampered | [IntegritySigner](./integrity) |
| Meet HIPAA/PCI-DSS compliance | All three together — see [Compliance](../../guides/security/compliance) |

## Related Guides

- [Sensitive Data Filtering](../../guides/security/sensitive-filtering) -- Auto-redaction tutorial
- [Audit Logging](../../guides/security/audit-logging) -- Security audit guide
- [HMAC Signing in Practice](../../guides/security/integrity) -- Integrity signing deep dive
- [Compliance Configuration](../../guides/security/compliance) -- HIPAA/PCI-DSS presets
- [Production Checklist](../../guides/security/production-checklist) -- Pre-launch security checks

## Next Steps

- [Security Filtering](./security) -- SensitiveDataFilter full API
- [Audit Logging](./audit) -- AuditLogger full API
- [Integrity Signing](./integrity) -- IntegritySigner full API
