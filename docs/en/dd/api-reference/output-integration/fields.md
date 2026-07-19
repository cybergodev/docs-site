---
sidebar_label: "Fields"
title: "Structured Fields - CyberGo DD | Field Constructors & Validation"
description: "CyberGo DD structured field API: 20 type-safe field constructors (String/Int/Float/Bool/Time/Duration/Err, etc.), the Field type, and optional field-key validation (naming conventions and Log4Shell security detection) with custom validation modes and preset configs."
sidebar_position: 3
---

# Structured Fields

DD provides 20 type-safe field constructors, a unified `Field` type, and an optional field-key validation mechanism for structured log output.

## Field Type

`Field` is the structured-log field type, exposed as a **type alias** of `internal.Field`:

```go
type Field = internal.Field

// Actual struct (internal/fields.go)
type Field struct {
    Key   string  // Field key
    Value any     // Field value (any type)
}
```

All field constructors return a `Field` value; the formatter (`internal.FormatFields`) outputs them as `Key=Value`. Primitive types (string / numeric / bool / `time.Duration` / `time.Time` / nil) take a fast path; "complex types" such as slices, arrays, maps, and structs fall back to JSON serialization (decided by `internal.IsComplexValue`); other types (such as values implementing the `fmt.Stringer` or `error` interface) go through `fmt.Fprint`.

## Basic Fields

| Constructor | Signature | Description |
|-------------|-----------|-------------|
| `Any` | `(key string, value any) Field` | Any type |
| `String` | `(key, value string) Field` | String |
| `Bool` | `(key string, value bool) Field` | Boolean |
| `Err` | `(err error) Field` | Error (key is fixed to `"error"`; when `err == nil` Value is `nil`, otherwise `err.Error()`) |
| `ErrWithKey` | `(key string, err error) Field` | Error with custom key (same as `Err`; when `err == nil` Value is `nil`) |
| `ErrWithStack` | `(err error) Field` | Error with call stack (key is `"error"`; when `err == nil` Value is `nil`; stack frames filter out runtime/ and dd-package frames; capture has a small cost) |

## Numeric Fields

| Constructor | Type | Example |
|-------------|------|---------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## Time Fields

| Constructor | Signature | Description |
|-------------|-----------|-------------|
| `Time` | `(key string, value time.Time) Field` | Timestamp (formatted as RFC3339) |
| `Duration` | `(key string, value time.Duration) Field` | Duration (calls `Duration.String()`) |

## Error Fields

<!-- check-code: skip -->
```go
// Standard error field (key is fixed to "error"; nil error -> Value is nil)
dd.Err(err)

// Custom key
dd.ErrWithKey("db_error", err)

// With stack info (stack frames filter out runtime/ and dd-package frames)
dd.ErrWithStack(err)
```

## Usage

### With InfoWith

<!-- check-code: skip -->
```go
dd.InfoWith("user login",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### With WithFields Chaining

<!-- check-code: skip -->
```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("service started")
```

### Appending to an Entry

<!-- check-code: skip -->
```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("response",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## Field Validation

DD provides a field-key validation mechanism supporting naming-convention checks and security validation (Log4Shell injection, homograph attacks, overlong UTF-8). The validation config `FieldValidationConfig` can be attached to [`Config.FieldValidation`](../core/config) to take effect at construction time, or dynamically replaced at runtime via [`Logger.SetFieldValidation`](../core/logger). Each `*With` call invokes `ValidateFieldKey` on each field's Key; in Strict mode, failures are reported as log errors (the log method itself does not return an error).

### FieldValidationMode

Validation mode, deciding how validation failures are handled.

```go
type FieldValidationMode int

const (
    FieldValidationNone   FieldValidationMode = iota // Disable validation (default, short-circuits all checks)
    FieldValidationWarn                              // Log a warning entry on naming mismatch
    FieldValidationStrict                            // Log an error entry on naming mismatch
)
```

The `String()` method of `FieldValidationMode` returns: `"none"` / `"warn"` / `"strict"` (unknown values return `"unknown"`).

### FieldNamingConvention

Naming convention.

```go
type FieldNamingConvention int

const (
    NamingConventionAny         FieldNamingConvention = iota // Accept any valid key (default)
    NamingConventionSnakeCase                                // snake_case: user_id
    NamingConventionCamelCase                                // camelCase: userId
    NamingConventionPascalCase                               // PascalCase: UserId
    NamingConventionKebabCase                                // kebab-case: user-id
)
```

The `String()` method of `FieldNamingConvention` returns: `"any"` / `"snake_case"` / `"camelCase"` / `"PascalCase"` / `"kebab-case"` (unknown values return `"unknown"`).

### FieldValidationConfig

Field validation configuration.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode    // Validation mode
    Convention               FieldNamingConvention  // Naming convention
    AllowCommonAbbreviations bool                   // Allow common abbreviations (ID, URL, HTTP, JSON, etc.)
    EnableSecurityValidation bool                   // Enable security validation (Log4Shell / homograph / overlong UTF-8)
}
```

:::warning Zero-value pitfall
A literal `FieldValidationConfig{}` sets `EnableSecurityValidation=false`, **silently disabling security validation** — prefer the [`DefaultFieldValidationConfig`](#preset-configs) constructor (which sets it to `true`). Additionally, when `Mode == FieldValidationNone`, validation short-circuits before security checks; even with `EnableSecurityValidation` enabled, security validation will not run.
:::

### Preset Configs

```go
// Default config: disable naming validation but enable security validation
func DefaultFieldValidationConfig() *FieldValidationConfig

// Strict snake_case
func StrictSnakeCaseConfig() *FieldValidationConfig

// Strict camelCase
func StrictCamelCaseConfig() *FieldValidationConfig
```

All three presets set `AllowCommonAbbreviations=true` and `EnableSecurityValidation=true`; the latter two set `Mode=FieldValidationStrict`.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

Validates whether a field key matches the configuration. Returns an error describing the reason on failure, `nil` on success. Returns `nil` directly when the receiver is `nil` or `Mode == FieldValidationNone`. Validation order:

1. Empty key -> returns `"field key cannot be empty"`
2. When `EnableSecurityValidation` is enabled, runs `internal.ValidateFieldKeyStrict` (Log4Shell / homograph / overlong UTF-8)
3. `Convention == NamingConventionAny` -> skip naming check
4. If `AllowCommonAbbreviations` is on and the key hits the common-abbreviation table (`id`/`url`/`http`/`json`/`jwt`, etc., or ends with `_id`/`_url`/`_uri`/`_ip`/`_api`) -> pass
5. Per-convention checks: snake_case / camelCase / PascalCase / kebab-case

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // Strict snake_case preset
    cfg := dd.StrictSnakeCaseConfig()

    if err := cfg.ValidateFieldKey("user_id"); err != nil {
        fmt.Println("user_id:", err)
    } else {
        fmt.Println("user_id OK")
        // Output: user_id OK
    }

    if err := cfg.ValidateFieldKey("userId"); err != nil {
        fmt.Println("userId:", err)
        // Output: userId: field key "userId" does not match snake_case convention
    }

    // Common-abbreviation exemption: URL is not snake_case but hits the abbreviation table, so it passes
    if err := cfg.ValidateFieldKey("URL"); err != nil {
        fmt.Println("URL:", err)
    } else {
        fmt.Println("URL OK (abbreviation exemption)")
        // Output: URL OK (abbreviation exemption)
    }

    // Default config Mode=None, no naming validation
    defaultCfg := dd.DefaultFieldValidationConfig()
    if err := defaultCfg.ValidateFieldKey("anyKey"); err != nil {
        fmt.Println("anyKey:", err)
    } else {
        fmt.Println("anyKey OK (Mode=None)")
        // Output: anyKey OK (Mode=None)
    }
}
```

## Next Steps

- [Logger](../core/logger) -- `WithFields` / `InfoWith` / `SetFieldValidation`
- [LoggerEntry](../core/entry) -- Preset-field chaining
- [Context Integration](./context) -- `ContextExtractor` field extraction
- [Config](../core/config) -- `Config.FieldValidation`
