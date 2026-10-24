---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo env | Sentinel Errors"
description: "Constants and errors for CyberGo env: DefaultMaxFileSize limits, ErrFileNotFound sentinels, ParseError, DefaultForbiddenKeys, and IsSensitiveKey/MaskValue."
sidebar_position: 7
---

# Constants & Errors

`env` exports limit constants, sentinel errors, structured error types, and the key lists and patterns behind key validation and masking.

## Security Limit Constants

### Default Limits

```go
const (
    // DefaultMaxFileSize - max bytes per file
    DefaultMaxFileSize int64 = 8 * 1024 * 1024  // 8 MB

    // DefaultMaxLineLength - max single line length
    DefaultMaxLineLength int = 8192  // 8 KB

    // DefaultMaxKeyLength - max key name length
    DefaultMaxKeyLength int = 128

    // DefaultMaxValueLength - max value length
    DefaultMaxValueLength int = 8192  // 8 KB

    // DefaultMaxVariables - max variables per file
    DefaultMaxVariables int = 1000

    // DefaultMaxExpansionDepth - max variable expansion depth
    DefaultMaxExpansionDepth int = 5
)
```

The six default limit constants map one-to-one onto `Config` fields of the same name, and each can be overridden there:

| Constant | Bound |
|----------|-------|
| `DefaultMaxFileSize` | bytes per file |
| `DefaultMaxLineLength` | single-line length |
| `DefaultMaxKeyLength` | key-name length |
| `DefaultMaxValueLength` | value length |
| `DefaultMaxVariables` | variables per file |
| `DefaultMaxExpansionDepth` | expansion depth |

### Hard Limits

:::warning
`Config.Validate()` checks these limits for you. The constants themselves are not exported, so you cannot reference them directly, but `cfg.Validate()` rejects any configuration that exceeds one of them.
:::

| Constant | Value | Description |
|----------|-------|-------------|
| HardMaxFileSize | 100 MB | Hard limit on file size |
| HardMaxLineLength | 64 KB | Hard limit on line length |
| HardMaxKeyLength | 1024 | Hard limit on key length |
| HardMaxValueLength | 1 MB | Hard limit on value length |
| HardMaxVariables | 10000 | Hard limit on variable count |
| HardMaxExpansionDepth | 20 | Hard limit on expansion depth |

`Config.Validate()` rejects any configuration that exceeds a hard limit:

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // Exceeds 100MB limit

if err := cfg.Validate(); err != nil {
    // Returns error: MaxFileSize exceeds hard limit
}
```

## Sentinel Errors

:::tip How matching works
Match every sentinel below with `errors.Is`. `*ValidationError` and `*SecurityError` implement an internal `Is()` that maps Rule/Action to sentinels: `ErrInvalidKey`, `ErrMissingRequired`, `ErrMaxVariables`, `ErrInvalidValue`, `ErrForbiddenKey`, and `ErrSecurityViolation`.

When you need file, line, or field details, use `errors.As` to extract the structured error. The two approaches complement each other rather than replace each other. See each error type section below.
:::

### File Errors

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

How to check:

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // file not found
}
if errors.Is(err, env.ErrFileTooLarge) {
    // file too large
}
```

### Parse Errors

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

:::tip Trigger conditions
`ErrDuplicateKey` is returned in two cases:

- `DuplicateKeyPolicy = DuplicateKeyError` and a single .env/YAML/JSON document (including inline JSON inside YAML) repeats a key.
- YAML/JSON flattening produces a flat-key collision.

Both match via `errors.Is`. Under the default (`DuplicateKeyInherit`), duplicates are skipped or overwritten instead of raising an error.
:::

### Security Errors

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrInvalidValue = errors.New("invalid value content")
```

Check forbidden keys:

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrSecurityViolation) {
    // Attempting to set a forbidden key returns *SecurityError
}
```

### Expansion Errors

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### Limit Errors

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### State Errors

```go
var ErrClosed = errors.New("loader has been closed")
var ErrInvalidConfig = errors.New("invalid configuration")
var ErrAlreadyInitialized = errors.New("default loader already initialized")
var ErrNotInitialized = errors.New("default loader not initialized; call Load() first")
var ErrMissingRequired = errors.New("required key is missing")
var ErrAuditFailed = errors.New("audit logging failed") // audit event lost while fail-closed auditing was enabled
```

`ErrAuditFailed` is returned only when fail-closed auditing is on (`Config.AuditFailClosed = true`). A handler error, a handler panic, or a dropped channel event makes the emitting operation return this error. See [Config API](./config#auditfailclosed-bool).

**How to check:**

```go
// Check if the loader has been closed
if errors.Is(err, env.ErrClosed) {
    // loader has been closed
}

// Check if the default loader has been initialized
if errors.Is(err, env.ErrAlreadyInitialized) {
    // Default loader already exists, cannot call Load() again
}

// Check if the default loader has not been initialized
if errors.Is(err, env.ErrNotInitialized) {
    // Need to call env.Load() or env.LoadWithConfig() first
}

// Check for invalid key format (*ValidationError matches the sentinel via Is() wiring)
if errors.Is(err, env.ErrInvalidKey) {
    // Invalid key format
}

// Check if required keys are missing
if errors.Is(err, env.ErrMissingRequired) {
    // Missing required keys
}

// Optional: use errors.As when you need field/rule details
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    // valErr.Field / valErr.Rule provide precise context
}
```

### Adapter Errors

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

When a custom validator implements `KeyValidator` but not the full `Validator` interface, calling `ValidateRequired` returns this error.

**How to check:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // Custom validator does not support required key validation
    // Need to implement the full Validator interface
}
```

:::tip Solution
Implement the full `Validator` interface, which embeds `KeyValidator`, `ValueValidator`, and `RequiredValidator`, instead of `KeyValidator` alone.
:::

## Error Types

The types below are public aliases of same-named internal types. Every type implements `Error`.

- Types carrying an underlying error (`ParseError`, `FileError`, `JSONError`, `YAMLError`) also implement `Unwrap`.
- Types that participate in sentinel mapping (`ValidationError`, `SecurityError`, `ExpansionError`) also implement `Is`.

Members are indexed by qualified name (e.g. `ParseError.File`).

### ParseError

A parse failure, carrying its location:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `ParseError.File` | `string` | File being parsed |
| `ParseError.Line` | `int` | Line number |
| `ParseError.Content` | `string` | Error content (masked) |
| `ParseError.Err` | `error` | Original error |
| `ParseError.Error` | `func (e *ParseError) Error() string` | Implements the `error` interface. The output includes the file name and line number; the file part is omitted when there is no file name. |
| `ParseError.Unwrap` | `func (e *ParseError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

Usage example:

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("Parse error %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

Validation error:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `ValidationError.Field` | `string` | The configuration field or key field that failed |
| `ValidationError.Value` | `string` | Value (masked) |
| `ValidationError.Rule` | `string` | The violated rule |
| `ValidationError.Message` | `string` | Human-readable explanation |
| `ValidationError.Error` | `func (e *ValidationError) Error() string` | Implements the `error` interface. Includes the field name and message |
| `ValidationError.Is` | `func (e *ValidationError) Is(target error) bool` | Maps sentinels by `Rule`: value rules (`value`, `null_byte`, `control_char`, `utf8`) → `ErrInvalidValue`; key rules with `Field == "key"` (`non_empty`, `max_length`, `ascii_only`, `pattern`) → `ErrInvalidKey`; `required` → `ErrMissingRequired`; `max_variables` → `ErrMaxVariables` |

### SecurityError

A blocked operation, with the reason it was blocked:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `SecurityError.Action` | `string` | The blocked operation |
| `SecurityError.Reason` | `string` | Why the operation was blocked |
| `SecurityError.Key` | `string` | Key involved (masked) |
| `SecurityError.Details` | `string` | Additional sanitized details |
| `SecurityError.Error` | `func (e *SecurityError) Error() string` | Implements the `error` interface. Includes the blocked action and reason. |
| `SecurityError.Is` | `func (e *SecurityError) Is(target error) bool` | Matches `ErrSecurityViolation`. Forbidden-key and allowlist rejections (`Action == "key_access"`) additionally match `ErrForbiddenKey`. |

Usage example:

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Security error: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

A failed file operation:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `FileError.Path` | `string` | File path |
| `FileError.Op` | `string` | The operation that failed (`open`, `stat`, `size_check`, `parse`) |
| `FileError.Err` | `error` | Original error |
| `FileError.Size` | `int64` | File size, during size checks |
| `FileError.Limit` | `int64` | The limit exceeded, during size checks |
| `FileError.Error` | `func (e *FileError) Error() string` | Implements the `error` interface. Appends the `(size N exceeds limit M)` detail when both `Size` and `Limit` are positive. |
| `FileError.Unwrap` | `func (e *FileError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

Usage example:

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("File %s size %d exceeds limit %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

A failed `${VAR}` expansion:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `ExpansionError.Key` | `string` | Key being expanded (masked in output) |
| `ExpansionError.Depth` | `int` | Current expansion depth |
| `ExpansionError.Limit` | `int` | Depth limit |
| `ExpansionError.Chain` | `string` | Expansion chain (sanitized) |
| `ExpansionError.Kind` | `ExpansionErrorKind` | Error reason category; the zero value means depth overflow or a cycle |
| `ExpansionError.Error` | `func (e *ExpansionError) Error() string` | Implements the `error` interface. Key names in the output are masked: only the first 2 characters are kept, followed by `***`. |
| `ExpansionError.Is` | `func (e *ExpansionError) Is(target error) bool` | Matches `ErrExpansionDepth` only when `Kind != ExpansionRequiredKind` (see "`errors.Is` behavior" below) |

**Error classification (Kind field):**

```go
type ExpansionErrorKind int

const (
    // ExpansionDepthKind indicates the expansion hit the recursion depth limit
    // or detected a variable cycle.
    // This is the zero value, so common depth/cycle errors don't need explicit classification.
    // errors.Is(err, ErrExpansionDepth) matches this kind of error.
    ExpansionDepthKind ExpansionErrorKind = iota

    // ExpansionRequiredKind indicates a required variable (${VAR:?message}) was not set or empty.
    // This is not a depth overflow, so it does not match ErrExpansionDepth.
    ExpansionRequiredKind
)
```

**`errors.Is` behavior:** `*ExpansionError` matches `ErrExpansionDepth` only when `Kind != ExpansionRequiredKind`. A missing required variable is a separate failure mode, so `ErrExpansionDepth` does not match it.

Usage example:

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    switch expErr.Kind {
    case env.ExpansionDepthKind:
        // Depth overflow or cycle: errors.Is(err, env.ErrExpansionDepth) == true
        fmt.Printf("Depth %d/%d, chain: %s\n", expErr.Depth, expErr.Limit, expErr.Chain)
    case env.ExpansionRequiredKind:
        // Required variable not set: errors.Is(err, env.ErrExpansionDepth) == false
        fmt.Printf("Required variable %s not set\n", expErr.Key)
    }
}
```

### JSONError

A JSON parse failure:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `JSONError.Path` | `string` | Path inside the JSON document, not a file path |
| `JSONError.Message` | `string` | Error message |
| `JSONError.Err` | `error` | Original error |
| `JSONError.Error` | `func (e *JSONError) Error() string` | Implements the `error` interface. Includes the in-document path. |
| `JSONError.Unwrap` | `func (e *JSONError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

### YAMLError

A YAML parse failure:

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `YAMLError.Path` | `string` | Path inside the YAML document, not a file path |
| `YAMLError.Line` | `int` | Line number |
| `YAMLError.Column` | `int` | Column number |
| `YAMLError.Message` | `string` | Error message |
| `YAMLError.Err` | `error` | Original error |
| `YAMLError.Error` | `func (e *YAMLError) Error() string` | Implements the `error` interface. Includes the in-document path with line and column numbers. |
| `YAMLError.Unwrap` | `func (e *YAMLError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

### MarshalError

A serialization failure. Test for it with `IsMarshalError(err error) bool`.

| Member | Type/Signature | Description |
|--------|----------------|-------------|
| `MarshalError.Field` | `string` | Field name that failed |
| `MarshalError.Message` | `string` | Error message |
| `MarshalError.Error` | `func (e *MarshalError) Error() string` | Implements the `error` interface. Includes the field name and message. |

`MarshalError` holds plain-value fields only and has no `Unwrap` method, because there is no underlying error to unwrap.

## Predefined Variables

### DefaultForbiddenKeys

The built-in forbidden keys list, which blocks modification of system-critical variables:

:::warning
`defaultForbiddenKeysSlice` is internal and not exported, so you cannot reach it as `env.DefaultForbiddenKeys`. The list below is what the library uses internally, given here for reference.
:::

| Category | Forbidden Keys |
|----------|----------------|
| System path | `PATH` |
| Dynamic linker (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS`, `PS4`, `SHELLOPTS`, `BASHOPTS` |
| Python | `PYTHONPATH`, `PYTHONSTARTUP`, `PYTHONINSPECT` |
| Node.js | `NODE_PATH`, `NODE_OPTIONS` |
| Ruby | `RUBYLIB`, `RUBYOPT`, `GEM_PATH`, `GEM_HOME` |
| Perl | `PERL5OPT`, `PERL5LIB` |
| JVM | `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `_JAVA_OPTIONS`, `CLASSPATH` |
| Rust | `RUSTFLAGS` |
| Git | `GIT_CONFIG_COUNT`, `GIT_PROXY_COMMAND` |

**Risk description:** what each key would let an attacker do if it were writable.

| Key | Risk Type | Description |
|----|-----------|-------------|
| `PATH` | Command hijacking | Changes the command search path |
| `LD_PRELOAD` | Library injection | Preloads a malicious dynamic library |
| `LD_LIBRARY_PATH` | Library hijacking | Changes the library search path |
| `DYLD_INSERT_LIBRARIES` | Library injection | macOS library injection |
| `COMSPEC` | Command hijacking | Overrides the Windows command interpreter path |
| `PATHEXT` | Command hijacking | Alters recognized Windows executable extensions |
| `SYSTEMROOT` | System corruption | Substitutes the Windows system root directory |
| `WINDIR` | System corruption | Substitutes the Windows directory |
| `PYTHONPATH` | Module hijacking | Changes the Python module search path |
| `IFS` | Parsing attack | Changes the shell field separator |

**Usage example:**

```go
// Setting a forbidden key returns *SecurityError
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrSecurityViolation) {
    // key is forbidden
}

// Add additional forbidden keys
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

The patterns behind sensitive-key detection. A key name that contains one of them (case-insensitive) is treated as sensitive:

:::warning
The list is the library-internal variable `internal.Patterns`, which is not exported from the `env` package. Reach it indirectly through `IsSensitiveKey()`. The categories below are the main ones, for reference.
:::

**Main sensitive pattern categories:**

| Category | Example Patterns |
|----------|------------------|
| Authentication & Authorization | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API & Keys | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| Encryption & Security | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| Financial & PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| Cryptocurrency | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| Database | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| Cloud Services | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**Matching rules:**

- Matching is case-insensitive.
- A key name that contains any pattern is sensitive.
- Exception (SEC-006): `AUTH`, `PAN`, `PWD`, and `USERNAME` match only at identifier boundaries, so benign keys such as `AUTHOR`, `COMPANY`, or `MONKEY` stay non-sensitive.

**Usage example:**

```go
// Check if a key is sensitive
if env.IsSensitiveKey("DB_PASSWORD") {
    // Read it through GetSecure and release the copy when done
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

The exported default value for `Config.KeyPattern`. It is `nil`, which selects byte-level validation:

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

:::tip Performance
`nil` selects fast byte-level validation, roughly 10x faster than a regexp. The built-in rule accepts keys that start with a letter and contain only letters, digits, and underscores.
:::

**Custom pattern:**

```go
import "regexp"

cfg := env.DefaultConfig()
// Only allow uppercase letter prefix
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## Security Utility Functions

Signatures, parameters, and examples for all six functions are in the ["Security Utility Functions" section of the SecureValue API](./secure-value#security-utility-functions): `IsSensitiveKey`, `MaskValue`, `MaskKey`, `MaskSensitiveInString`, `SanitizeForLog`, and `ClearBytes`.

At a glance:

| Function | Purpose |
|----------|---------|
| `IsSensitiveKey` | Decide whether a key name is sensitive |
| `MaskValue` | Mask a value according to key sensitivity |
| `MaskKey` | Mask a key name (always `[MASKED]`) |
| `SanitizeForLog` | Sanitize log text, masking sensitive values in `key=value` and `key: value` |
| `MaskSensitiveInString` | Truncate long strings, then sanitize for logs |
| `ClearBytes` | Zero a byte slice |

## FileFormat Constants

File format types:

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // Auto-detect
    FormatEnv                      // .env format
    FormatJSON                     // JSON format
    FormatYAML                     // YAML format
)
```

Usage example:

```go
// Detect format
format := env.DetectFormat("config.json")  // FormatJSON

// Serialize with specified format
data, _ := env.Marshal(cfg, env.FormatJSON)

// Format string
fmt.Println(format.String())  // "json"
```

## Error Checking Patterns

### errors.Is Pattern

Match a loaded error against the sentinels:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // file not found
case errors.Is(err, env.ErrFileTooLarge):
    // file too large
case errors.Is(err, env.ErrSecurityViolation):
    // forbidden key
case errors.Is(err, env.ErrClosed):
    // loader has been closed
}
```

### errors.As Pattern

Extract the structured detail from the error:

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("Parse error at %s line %d\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("File %s size %d exceeds limit %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Security error: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## Complete Error Handling Example

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.ProductionConfig()
	cfg.FailOnMissingFile = true

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	err = loader.LoadFiles(".env")
	if err != nil {
		switch {
		case errors.Is(err, env.ErrFileNotFound):
			log.Fatal("Configuration file not found")

		case errors.Is(err, env.ErrFileTooLarge):
			log.Fatal("Configuration file too large")

		case errors.Is(err, env.ErrClosed):
			log.Fatal("Loader has been closed")

		default:
			var parseErr *env.ParseError
			if errors.As(err, &parseErr) {
				log.Fatalf("Parse error %s:%d - %v",
					parseErr.File, parseErr.Line, parseErr.Err)
			}

			var fileErr *env.FileError
			if errors.As(err, &fileErr) {
				log.Fatalf("File error %s - %v", fileErr.Path, fileErr.Err)
			}

			var secErr *env.SecurityError
			if errors.As(err, &secErr) {
				log.Fatalf("Security error: %s - %s", secErr.Action, secErr.Reason)
			}

			var jsonErr *env.JSONError
			if errors.As(err, &jsonErr) {
				log.Fatalf("JSON error %s: %s", jsonErr.Path, jsonErr.Message)
			}

			var yamlErr *env.YAMLError
			if errors.As(err, &yamlErr) {
				log.Fatalf("YAML error %s:%d:%d - %s",
					yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
			}

			log.Fatal(err)
		}
	}

	// Validate required keys
	if err := loader.Validate(); err != nil {
		var valErr *env.ValidationError
		if errors.As(err, &valErr) {
			log.Fatalf("Validation failed: %s - %s", valErr.Field, valErr.Message)
		}
		log.Fatal(err)
	}
}
```

## Related Documentation

- [SecureValue API](./secure-value) - Full API for the security utility functions
- [Config API](./config) - Configuration options and limit settings
- [Security Overview](../security/) - Security architecture and core features
- [Production Checklist](../security/production-checklist) - Pre-launch security checks
