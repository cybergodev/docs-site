---
title: Security - CyberGo env | Security Architecture
description: env library security architecture overview including SecureValue memory protection, key-value validation, forbidden keys, and configuration security levels
---

# Security Overview

Environment variables often store sensitive information, making secure handling critical. This document outlines the env library's security architecture and core features.

## Security Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Application Layer                      │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │   Masking   │   Zeroing   │  Memory Lock   │
├──────────────────────────────────────────────────────────────┤
│                          Loader Layer                         │
├──────────────────────────────────────────────────────────────┤
│    Key Validation  │  Value Validation  │  Forbidden Keys  │  Size Limits  │
├──────────────────────────────────────────────────────────────┤
│                          Parser Layer                         │
├──────────────────────────────────────────────────────────────┤
│    Format Detection  │  Expansion Check  │   Path Validation │
└──────────────────────────────────────────────────────────────┘
```

## Core Security Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **SecureValue** | Memory-protected sensitive values with auto-zeroing | [SecureValue API](/en/env/api-reference/secure-value) |
| **Forbidden Keys** | Prevents modification of critical system variables | [Constants & Errors](/en/env/api-reference/constants#defaultforbiddenkeys) |
| **Sensitive Key Detection** | Auto-identifies sensitive configuration keys | [Constants & Errors](/en/env/api-reference/constants#sensitivekeypatterns) |
| **Value Validation** | Detects control characters, null bytes, etc. | [Config API](/en/env/api-reference/config) |
| **Audit Logging** | Complete operation tracking | [Component Factory](/en/env/api-reference/factory#audit-handler-factories) |

## SecureValue Overview

For sensitive data, use `GetSecure` instead of `GetString`:

```go
// Not recommended
password := env.GetString("DB_PASSWORD")

// Recommended
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.String()
```

**Core capabilities:**
- **Memory Locking** - Prevents swapping to disk (Linux/macOS/FreeBSD)
- **Auto-Zeroing** - Securely erases memory on `Close()`
- **Masked Display** - `Masked()` for log output
- **Thread Safety** - Supports concurrent reads

::: tip Full API
See [SecureValue API](/en/env/api-reference/secure-value).
:::

## Key/Value Validation

### Key Validation

Default key name rule: `^[A-Za-z][A-Za-z0-9_]*$`

- Must start with a letter
- Only letters, digits, and underscores
- Length must not exceed `MaxKeyLength`

### Forbidden Keys

Built-in forbidden keys prevent modification of critical system variables:

| Category | Examples | Risk |
|----------|----------|------|
| System path | `PATH`, `LD_LIBRARY_PATH` | Command/library hijacking |
| Dynamic linking | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | Malicious library injection |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell hijacking |
| Language runtimes | `PYTHONPATH`, `NODE_PATH` | Module hijacking |

::: tip Full List
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
# Owner read/write only
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

| Preset | Use Case | Features |
|--------|----------|----------|
| `DevelopmentConfig()` | Development | Relaxed limits, YAML syntax support |
| `TestingConfig()` | Testing | Overwrite existing, test isolation |
| `ProductionConfig()` | Production | Strict validation + audit logging, no overwrite |

```go
// Recommended production configuration
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## Related Documentation

- [SecureValue API](/en/env/api-reference/secure-value) - Complete secure value handling API
- [Constants & Errors](/en/env/api-reference/constants) - Full forbidden keys list, sensitive key patterns
- [Production Checklist](/en/env/security/production-checklist) - Pre-deployment security checks
