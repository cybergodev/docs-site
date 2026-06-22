---
title: "Security Overview - CyberGo env | Security Architecture"
description: "CyberGo env security overview: SecureValue memory locking, key validation, forbidden keys, IsSensitiveKey auto-detection, presets and audit tracing."
---

# Security Overview

Environment variables often store sensitive information, making secure handling critical. This document provides an overview of the env library's security architecture and core features.

## Security Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                        Application Layer                     │
├──────────────────────────────────────────────────────────────┤
│   SecureValue   │   Masking   │   Zeroing   │  Memory Lock  │
├──────────────────────────────────────────────────────────────┤
│                          Loader Layer                        │
├──────────────────────────────────────────────────────────────┤
│   Key Validation │  Value Validation │  Forbidden Keys │ Size Limits │
├──────────────────────────────────────────────────────────────┤
│                         Parsing Layer                        │
├──────────────────────────────────────────────────────────────┤
│  Format Detection │  Expansion Check │    Path Validation   │
└──────────────────────────────────────────────────────────────┘
```

## Core Security Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **SecureValue** | Sensitive value memory protection, auto-zeroing | [SecureValue API](/en/env/api-reference/secure-value) |
| **Forbidden Keys** | Prevent modification of critical system variables | [Constants & Errors](/en/env/api-reference/constants#defaultforbiddenkeys) |
| **Sensitive Key Detection** | Automatic identification of sensitive config keys | [Constants & Errors](/en/env/api-reference/constants#sensitivekeypatterns) |
| **Value Validation** | Detect control characters, null bytes, etc. | [Config API](/en/env/api-reference/config) |
| **Audit Logging** | Complete operation tracking | [Component Factory](/en/env/api-reference/factory#audit-handler-factory) |

## SecureValue Overview

For sensitive data, use `GetSecure` instead of `GetString`:

```go
// Not recommended
password := env.GetString("DB_PASSWORD")

// Recommended
secret := env.GetSecure("DB_PASSWORD")
defer secret.Close()
password := secret.Reveal()  // Call only when plaintext is needed
```

**Core capabilities:**
- **Memory Locking** - Prevents swapping to disk (Linux/macOS/FreeBSD)
- **Auto-Zeroing** - Securely erases memory on `Close()`
- **Masked Display** - `Masked()` for log output
- **Thread Safety** - Supports concurrent reads

:::tip Full API
See [SecureValue API](/en/env/api-reference/secure-value) for details.
:::

## Key/Value Validation

### Key Validation

Default key name rule: `^[A-Za-z][A-Za-z0-9_]*$`

- Must start with a letter
- Only letters, digits, and underscores
- Maximum length of `MaxKeyLength`

### Forbidden Keys

Built-in forbidden keys prevent modification of critical system variables:

| Category | Examples | Risk |
|----------|----------|------|
| System Paths | `PATH`, `LD_LIBRARY_PATH` | Command/library hijacking |
| Dynamic Linking | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | Malicious library injection |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell hijacking |
| Language Runtimes | `PYTHONPATH`, `NODE_PATH` | Module hijacking |

:::tip Full List
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
# Read/write for owner only
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

| Preset | Use Case | Characteristics |
|--------|----------|-----------------|
| `DevelopmentConfig()` | Development | Relaxed restrictions, YAML syntax support |
| `TestingConfig()` | Testing | Override existing variables, test isolation |
| `ProductionConfig()` | Production | Strict validation + audit logging, no override of existing variables |

```go
// Recommended production configuration
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## Related Documentation

- [SecureValue API](/en/env/api-reference/secure-value) - Complete API for secure value handling
- [Constants & Errors](/en/env/api-reference/constants) - Forbidden keys list, sensitive key patterns
- [Production Checklist](/en/env/security/production-checklist) - Pre-deployment security checks
