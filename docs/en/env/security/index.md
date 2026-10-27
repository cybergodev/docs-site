---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo env | Security Architecture"
description: "CyberGo env security architecture: SecureValue memory locking and zeroing, key/value validation, forbidden keys, sensitive-key detection, and audit tracking."
sidebar_position: 1
---

# Security Overview

Environment variables hold credentials, so env defends them at three layers: the parser, the loader, and the in-memory value. The defaults below apply without configuration.

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
| **SecureValue** | Memory protection and auto-zeroing for sensitive values | [SecureValue API](../api-reference/secure-value) |
| **Forbidden keys** | Blocks modification of system-critical variables | [Constants & Errors](../api-reference/constants#defaultforbiddenkeys) |
| **Sensitive key detection** | Identifies sensitive config keys and provides log masking tools | [Data Masking](./data-masking) |
| **Value validation** | Detects control characters, null bytes, and similar | [Config API](../api-reference/config) |
| **Audit logging** | Records every write and security event | [Component Factory](../api-reference/factory#audit-handler-factories) |

## SecureValue Overview

For sensitive data, use `GetSecure` instead of `GetString`:

```go
// Not recommended
plainPassword := env.GetString("DB_PASSWORD")

// Recommended
secret := env.GetSecure("DB_PASSWORD")
defer secret.Release()        // Zeroes the value and returns it to the pool
password := secret.Reveal()   // Only call when plaintext is needed
```

**Core features:**
- **Memory locking** - prevents swapping to disk on Linux, macOS, and Windows; on other platforms `IsMemoryLockSupported()` returns false, the locking attempt fails and the error is stored on the value (`Masked()` reports `lock-failed`), and the `SecureValue` remains usable
- **Auto-zeroing** - erases memory on `Release()` and `Close()`
- **Masked display** - `Masked()` for log output
- **Thread safety** - concurrent reads and releases are safe

:::tip Full API
See [SecureValue API](../api-reference/secure-value).
:::

## Log Security

`SecureValue` protects values **in memory**, but logs, error messages, and debug output can leak the same values. env provides standalone masking functions that work without a Loader:

- `IsSensitiveKey` detects sensitive key names such as passwords, keys, and tokens
- `MaskValue` / `MaskKey` mask values and key names before output
- `SanitizeForLog` scans a log string for `key=value` pairs and masks their values

```go
// Safely output configuration in logs, avoiding plaintext leakage
log.Printf("Loading config: %s", env.MaskValue("DB_PASSWORD", password))
// Output: Loading config: [MASKED]

log.Printf("Connection params: %s", env.SanitizeForLog("user=admin password=s3cret"))
// Output: Connection params: user=admin password=[MASKED]
```

:::tip Full guide
For complete masking-tool usage, see [Data Masking](./data-masking).
:::

## Key/Value Validation

### Key Validation

The default key-name pattern is `^[A-Za-z][A-Za-z0-9_]*$`:

- Starts with a letter
- Contains only letters, digits, and underscores
- Is no longer than `MaxKeyLength`

### Forbidden Keys

Built-in forbidden keys block modification of system-critical variables:

| Category | Examples | Risk |
|----------|----------|------|
| System path | `PATH`, `LD_LIBRARY_PATH` | Command/library hijacking |
| Dynamic linking | `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES` | Malicious library injection |
| Shell | `SHELL`, `IFS`, `BASH_ENV` | Shell hijacking |
| Language runtimes | `PYTHONPATH`, `NODE_PATH` | Module hijacking |
| Windows system | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` | Command interpreter / system path hijacking |

:::tip Full list
See [DefaultForbiddenKeys](../api-reference/constants#defaultforbiddenkeys) for the complete list.
:::

### Value Validation

Value validation has two layers. The first is the baseline the built-in validator **always** enforces (length ceiling, control-character and null-byte rejection, and the UTF-8 check when `ValidateUTF8` is on); no write path bypasses it. The second is the `ValidateValues` switch, which only matters for custom validators that lack the baseline capability — those skip value validation entirely when it is off.

```go
cfg := env.ProductionConfig()
cfg.ValidateValues = true // only relevant when your custom validator lacks the baseline capability
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
| `DevelopmentConfig()` | Development | `OverwriteExisting=true`, YAML syntax allowed, file-size limit raised to 10 MB |
| `TestingConfig()` | Testing | `OverwriteExisting=true`, `FailOnMissingFile=false`, 64 KB file limit and 50 variables |
| `ProductionConfig()` | Production | `FailOnMissingFile=true`, `OverwriteExisting=false`, value validation and audit logging enabled |

```go
// Recommended production configuration
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT", "DB_HOST", "API_KEY"}
```

## Expansion Scope Isolation

`DefaultConfig()` sets the expansion scope to `ExpansionFileOnly`, so `${VAR}` resolves only file-local references. That blocks an untrusted config file from capturing process secrets such as cloud credentials and tokens (SEC-03). Switch to `ExpansionFileThenProcess` only when you need the traditional dotenv file-first, process-second fallback and the file is trusted. Configuration details and attack scenarios are covered in [Variable Expansion · Expansion Scope](../guides/variable-expansion).

## Related Documentation

- [SecureValue API](../api-reference/secure-value) - complete secure value API
- [Memory Locking](./memory-locking) - mlock memory protection
- [Constants & Errors](../api-reference/constants) - forbidden keys list and sensitive key patterns
- [Production Checklist](./production-checklist) - pre-launch security checks
