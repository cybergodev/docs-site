---
sidebar_label: "Field Validation"
title: "Field Validation - CyberGo DD | Key Naming Conventions and Security Checks"
description: "CyberGo DD field validation guide: snake_case, camelCase, PascalCase, kebab-case naming convention checks, three validation modes (off/warn/strict), built-in Log4Shell injection protection and homograph detection."
sidebar_position: 3
---

# Field Validation

DD's field validation subsystem validates the **key names** of structured fields before log write, enforcing naming conventions and providing security protection. It prevents log parsing difficulties from inconsistent keys and intercepts malicious content injected via field keys.

## Validation Modes

| Mode | Constant | Behavior |
|------|----------|----------|
| Off (default) | `FieldValidationNone` | No validation; all keys accepted |
| Warn | `FieldValidationWarn` | Non-conforming keys emit stderr warning; log still written |
| Strict | `FieldValidationStrict` | Non-conforming keys emit stderr error; log still written |

:::warning Logging methods don't return errors
Since logging methods (`InfoWith`, etc.) don't return error, validation failures can only be reported via stderr. Strict mode **does not prevent the log from being written** but clearly reports errors to stderr.
:::

## Naming Conventions

| Convention | Constant | Examples |
|------------|----------|----------|
| Any (default) | `NamingConventionAny` | No style check |
| snake_case | `NamingConventionSnakeCase` | `user_id`, `created_at` |
| camelCase | `NamingConventionCamelCase` | `userId`, `createdAt` |
| PascalCase | `NamingConventionPascalCase` | `UserId`, `CreatedAt` |
| kebab-case | `NamingConventionKebabCase` | `user-id`, `created-at` |

## Quick Start

### Option A: Preset Config

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.FieldValidation = dd.StrictSnakeCaseConfig()
    // Equivalent to:
    // &dd.FieldValidationConfig{
    //     Mode:                     dd.FieldValidationStrict,
    //     Convention:               dd.NamingConventionSnakeCase,
    //     AllowCommonAbbreviations: true,
    //     EnableSecurityValidation: true,
    // }

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.InfoWith("user action",
        dd.String("user_id", "123"),    // ✅ valid snake_case
        dd.String("userName", "alice"), // ⚠️ invalid, stderr error
    )
}
```

### Option B: Custom Config

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = &dd.FieldValidationConfig{
    Mode:                     dd.FieldValidationWarn,
    Convention:               dd.NamingConventionCamelCase,
    AllowCommonAbbreviations: true,
    EnableSecurityValidation: true,
}
```

### Option C: Runtime Toggle

```go
// Enable strict snake_case
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// Disable validation
logger.SetFieldValidation(nil)

// Query current config
fv := logger.GetFieldValidation()
```

## Common Abbreviation Exemptions

With `AllowCommonAbbreviations: true` (preset default), the following abbreviations are allowed even if they don't strictly match the naming convention:

| Abbreviation | Description |
|--------------|-------------|
| `id`, `url`, `uri`, `ip` | Basic identifiers |
| `http`, `https`, `api` | Protocols & interfaces |
| `json`, `xml`, `html`, `sql` | Data formats |
| `tcp`, `udp`, `ssl`, `tls` | Network protocols |
| `jwt`, `oauth` | Authentication |
| `*_id`, `*_url`, `*_api`, etc. | Suffix combinations (e.g., `user_id`) |

## Security Validation

`EnableSecurityValidation: true` (preset default) executes the following security checks before naming convention validation:

| Check | Intercepted Content | Description |
|-------|---------------------|-------------|
| Log4Shell detection | `${jndi:ldap://...}` | Prevents JNDI injection via log keys |
| Homograph detection | Cyrillic `а` replacing Latin `a` | Prevents visual spoofing attacks |
| Overlong UTF-8 encoding | Non-shortest-form encoding | Prevents bypassing security filters |

:::danger Zero-value pitfall
Using `&dd.FieldValidationConfig{Mode: dd.FieldValidationStrict}` without setting `EnableSecurityValidation` leaves it `false` (zero value), **silently skipping** security checks. Always use `DefaultFieldValidationConfig()` or preset functions (`StrictSnakeCaseConfig()`, etc.) which set this field to `true`.
:::

## Multi-Convention Projects

If your project has both a Go backend (snake_case) and JavaScript frontend (camelCase) logging, use different Loggers with different conventions:

```go
// Backend Logger: snake_case
backendCfg := dd.DefaultConfig()
backendCfg.FieldValidation = dd.StrictSnakeCaseConfig()
backendLogger, _ := dd.New(backendCfg)

// Frontend log aggregation Logger: camelCase
frontendCfg := dd.DefaultConfig()
frontendCfg.FieldValidation = dd.StrictCamelCaseConfig()
frontendLogger, _ := dd.New(frontendCfg)
```

## Validation Rules

Specific rules for each naming convention:

| Convention | Rules |
|------------|-------|
| snake_case | lowercase + digits + underscores; **first char must be a lowercase letter** (not a digit or `_`); no trailing `_`; no consecutive `__` |
| camelCase | letters + digits; first char is lowercase letter |
| PascalCase | letters + digits; first char is uppercase letter |
| kebab-case | lowercase + digits + hyphens; **first char must be a lowercase letter** (not a digit or `-`); no trailing `-`; no consecutive `--` |

## Next Steps

- [Structured Logging](../basics/structured-logging) -- Field constructors and chaining
- [Configuration](../basics/configuration) -- Full Config field reference
- [Security Overview](../security/) -- Complete security feature overview
