---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo env | Security Architecture"
description: "Security architecture overview for CyberGo env: SecureValue memory locking and zeroing, key-value validation, sensitive-key detection, and audit tracking."
sidebar_position: 1
---

# Security Overview

Environment variables often store sensitive information, making secure handling critical. This document outlines the security architecture and core features of the env library.

## Security Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │   Masking   │  Zeroing  │  Memory Locking   │
├──────────────────────────────────────────────────────────────┤
│                        Loader Layer                          │
├──────────────────────────────────────────────────────────────┤
│   Key Validation │ Value Validation │ Forbidden Keys │ Size Limits │
├──────────────────────────────────────────────────────────────┤
│                       Parsing Layer                          │
├──────────────────────────────────────────────────────────────┤
│  Format Detection │ Expansion Check │   Path Validation       │
└──────────────────────────────────────────────────────────────┘
```

## Core Security Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **SecureValue** | Memory protection and auto-zeroing for sensitive values | [SecureValue API](/en/env/api-reference/secure-value) |
| **Forbidden keys** | Prevents modification of system-critical variables | [Constants & Errors](/en/env/api-reference/constants#defaultforbiddenkeys) |
| **Sensitive key detection** | Auto-identifies sensitive config keys, log masking tools | [Data Masking](/en/env/security/data-masking) |
| **Value validation** | Detects control characters, null bytes, etc. | [Config API](/en/env/api-reference/config) |
| **Audit logging** | Complete operation tracking | [Component Factory](/en/env/api-reference/factory#audit-handler-factories) |

## SecureValue Overview

For sensitive data, use `GetSecure` instead of `GetString`:

```go
// Not recommended
password := env.GetString("DB_PASSWORD")

// Recommended
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.Reveal()  // Only call when plaintext is needed
```

**Core features:**
- **Memory locking** - Prevents swapping to disk (Linux/macOS/Windows/FreeBSD)
- **Auto-zeroing** - Safely erases memory on `Close()`
- **Masked display** - `Masked()` for log output
- **Thread safety** - Supports concurrent reads

:::tip
See [SecureValue API](/en/env/api-reference/secure-value).
:::

## Log Security

SecureValue protects sensitive values **in memory**, but logs, error messages, and debug output are equally prone to leaking keys. env provides a set of standalone masking utility functions that can be used without a Loader:

- `IsSensitiveKey` auto-detects sensitive key names like passwords, keys, and tokens
- `MaskValue` / `MaskKey` mask values and key names before output
- `SanitizeForLog` scans log strings for `key=value` patterns and masks them

```go
// Safely output configuration in logs, avoiding plaintext leakage
log.Printf("Loading config: %s", env.MaskValue("DB_PASSWORD", password))
// Output: Loading config: [MASKED:12 chars]

log.Printf("Connection params: %s", env.SanitizeForLog("user=admin password=s3cret"))
// Output: Connection params: user=admin [MASKED]
```

:::tip
For complete usage of masking tools, see [Data Masking](/en/env/security/data-masking).
:::

## Key/Value Validation

### Key Validation

Default key name rules: `^[A-Za-z][A-Za-z0-9_]*$`

- Starts with a letter
- Contains only letters, numbers, and underscores
- Length does not exceed `MaxKeyLength`

### Forbidden Keys

Built-in forbidden keys prevent modification of system-critical variables:

| Category | Examples | Risk |
|----------|----------|------|
| System path | `PATH`, `LD_LIBRARY_PATH` | Command/library hijacking |
| Dynamic linking | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | Malicious library injection |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell hijacking |
| Language runtimes | `PYTHONPATH`, `NODE_PATH` | Module hijacking |

:::tip
See [DefaultForbiddenKeys](/en/env/api-reference/constants#defaultforbiddenkeys) for the complete forbidden keys list.
:::

### Value Validation

Enable value validation to detect potential dangers:

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true  // Detect control characters, null bytes, etc.
```

## File Security Basics

### File Permissions

```bash
# Readable/writable by owner only
chmod 600 .env

# Or stricter (read-only)
chmod 400 .env
```

### Git Ignore

```bash
.env
.env.local
.env.*.local
*.pem
*.key
```

## Configuration Security Levels

| Preset | Purpose | Characteristics |
|--------|---------|-----------------|
| `DevelopmentConfig()` | Development | Relaxed limits, YAML syntax support |
| `TestingConfig()` | Testing | Overwrites existing variables, test isolation |
| `ProductionConfig()` | Production | Strict validation + audit logging, no overwriting |

```go
// Recommended production configuration
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## Expansion Scope Isolation

Variable expansion resolves file-first, process-environment-second by default. For untrusted configuration sources, `ExpansionScope: ExpansionFileOnly` restricts references to inside the file, blocking a config file from probing and capturing process secrets (cloud credentials, tokens, etc.) (SEC-03). Configuration and attack scenarios are covered in [Variable Expansion · Expansion Scope](/en/env/guides/variable-expansion).

## Related Documentation

- [SecureValue API](/en/env/api-reference/secure-value) - Complete API for secure value handling
- [Memory Locking](/en/env/security/memory-locking) - Complete mlock memory protection guide
- [Constants & Errors](/en/env/api-reference/constants) - Complete forbidden keys list, sensitive key patterns
- [Production Checklist](/en/env/security/production-checklist) - Pre-launch security checks
