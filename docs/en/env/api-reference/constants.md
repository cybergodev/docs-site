---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo env | Sentinel Errors"
description: "Constants and errors for CyberGo env: DefaultMaxFileSize limits, ErrFileNotFound sentinels, ParseError, DefaultForbiddenKeys, and IsSensitiveKey/MaskValue."
sidebar_position: 7
---

# Constants & Errors

Constants, error types, sentinel errors, and predefined variables defined by the library.

## Security Limit Constants

### Default Limits

```go
const (
    // DefaultMaxFileSize - max bytes per file
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - max single line length
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - max key name length
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - max value length
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - max variables per file
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - max variable expansion depth
    DefaultMaxExpansionDepth int = 5
)
```

The six default limit constants — `DefaultMaxFileSize`, `DefaultMaxLineLength`, `DefaultMaxKeyLength`, `DefaultMaxValueLength`, `DefaultMaxVariables`, and `DefaultMaxExpansionDepth` — cover per-file size, single-line length, key-name length, value length, variables per file, and expansion depth respectively; each can be overridden via the same-named field on `Config`.

### Hard Limits

:::warning
The following are internal hard limits (not exported), used by `Config.Validate()` for internal checks. Users cannot reference these constants directly, but `cfg.Validate()` will automatically check whether the configuration exceeds these limits.
:::

| Constant | Value | Description |
|----------|-------|-------------|
| HardMaxFileSize | 100 MB | Hard limit on file size |
| HardMaxLineLength | 64 KB | Hard limit on line length |
| HardMaxKeyLength | 1024 | Hard limit on key length |
| HardMaxValueLength | 1 MB | Hard limit on value length |
| HardMaxVariables | 10000 | Hard limit on variable count |
| HardMaxExpansionDepth | 20 | Hard limit on expansion depth |

Configuration validation checks whether hard limits are exceeded:

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // Exceeds 100MB limit

if err := cfg.Validate(); err != nil {
    // Returns error: MaxFileSize exceeds hard limit
}
```

## Sentinel Errors

:::tip How matching works
All the sentinels above can be matched via `errors.Is` — `*ValidationError` and `*SecurityError` implement internal `Is()` wiring that maps Rule/Action to sentinels such as `ErrInvalidKey`, `ErrMissingRequired`, `ErrMaxVariables`, `ErrInvalidValue`, `ErrForbiddenKey`, and `ErrSecurityViolation`. When you need details such as file, line, or field, use `errors.As` to extract the structured error; the two approaches are complementary rather than mutually exclusive. See each error type section for details.
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

:::tip Retained sentinels
`ErrDuplicateKey` is a reserved sentinel: duplicate keys are currently skipped rather than treated as errors, and no code path returns this error yet.
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
```

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

When a custom validator only implements the `KeyValidator` interface but not the full `Validator` interface, calling `ValidateRequired` returns this error.

**How to check:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // Custom validator does not support required key validation
    // Need to implement the full Validator interface
}
```

:::tip Solution
Implement the `Validator` interface (which includes ValidateKey, ValidateValue, and ValidateRequired methods) instead of just `KeyValidator`.
:::

## Error Types

### ParseError

Parse error with location information:

```go
type ParseError struct {
    File    string  // File name
    Line    int     // Line number
    Content string  // Error content (masked)
    Err     error   // Original error
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *ParseError) Error() string` | Implements the `error` interface; the output includes the file name and line number (the file part is omitted when there is no file name) |
| `Unwrap` | `func (e *ParseError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

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

```go
type ValidationError struct {
    Field   string  // Field name
    Value   string  // Value (masked)
    Rule    string  // Rule
    Message string  // Message
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *ValidationError) Error() string` | Implements the `error` interface; includes the field name and message |
| `Is` | `func (e *ValidationError) Is(target error) bool` | Maps sentinels by `Rule`: value rules (`value`/`null_byte`/`control_char`/`utf8`) → `ErrInvalidValue`; key rules (Field is `key`: `non_empty`/`max_length`/`ascii_only`/`pattern`) → `ErrInvalidKey`; `required` → `ErrMissingRequired`; `max_variables` → `ErrMaxVariables` |

### SecurityError

Security error:

```go
type SecurityError struct {
    Action  string  // Operation
    Reason  string  // Reason
    Key     string  // Key name (masked)
    Details string  // Additional details
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *SecurityError) Error() string` | Implements the `error` interface; includes the blocked action and reason |
| `Is` | `func (e *SecurityError) Is(target error) bool` | Matches `ErrSecurityViolation`; forbidden-key/allowlist rejections (Action is `key_access`) additionally match `ErrForbiddenKey` |

Usage example:

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Security error: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

File operation error:

```go
type FileError struct {
    Path  string  // File path
    Op    string  // The operation that failed (open, stat, size_check, parse)
    Err   error   // Original error
    Size  int64   // File size (during Size check)
    Limit int64   // Limit (during Size check)
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *FileError) Error() string` | Implements the `error` interface; appends the `(size N exceeds limit M)` detail when both `Size` and `Limit` are positive |
| `Unwrap` | `func (e *FileError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

Usage example:

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("File %s size %d exceeds limit %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

Variable expansion error:

```go
type ExpansionError struct {
    Key   string             // Key name
    Depth int                // Current depth
    Limit int                // Limit
    Chain string             // Expansion chain (sanitized)
    Kind  ExpansionErrorKind // Error reason category (zero value = depth/cycle)
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *ExpansionError) Error() string` | Implements the `error` interface; key names in the output are masked (only the first 2 characters kept, followed by `***`) |
| `Is` | `func (e *ExpansionError) Is(target error) bool` | Matches `ErrExpansionDepth` only when `Kind != ExpansionRequiredKind` (semantics in "`errors.Is` behavior" below) |

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

**`errors.Is` behavior:** `*ExpansionError` matches `ErrExpansionDepth` only when `Kind != ExpansionRequiredKind`. Required variable errors are a separate failure mode not matched by `ErrExpansionDepth`.

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

JSON parse error:

```go
type JSONError struct {
    Path    string  // Path inside the JSON document (not a file path)
    Message string  // Error message
    Err     error   // Original error
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *JSONError) Error() string` | Implements the `error` interface; includes the in-document path |
| `Unwrap` | `func (e *JSONError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

### YAMLError

YAML parse error:

```go
type YAMLError struct {
    Path    string  // Path inside the YAML document (not a file path)
    Line    int     // Line number
    Column  int     // Column number
    Message string  // Error message
    Err     error   // Original error
}
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *YAMLError) Error() string` | Implements the `error` interface; includes the in-document path with line and column numbers |
| `Unwrap` | `func (e *YAMLError) Unwrap() error` | Returns the underlying `Err`, letting `errors.Is` / `errors.As` pass through |

### MarshalError

Serialization error:

```go
type MarshalError struct {
    Field   string  // Field name
    Message string  // Error message
}

func IsMarshalError(err error) bool  // Check function
```

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *MarshalError) Error() string` | Implements the `error` interface; includes the field name and message |

`MarshalError` holds only plain-value fields and has no `Unwrap` method — there is no underlying error to unwrap.

## Predefined Variables

### DefaultForbiddenKeys

Built-in forbidden keys list, preventing modification of system-critical variables:

:::warning
`defaultForbiddenKeys` is an internal library variable (not exported) and cannot be accessed directly via `env.DefaultForbiddenKeys`. The following is the complete list used internally, for reference.
:::

| Category | Forbidden Keys |
|----------|----------------|
| System path | `PATH` |
| Dynamic linker (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Language runtimes | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**Risk description:**

| Key | Risk Type | Description |
|----|-----------|-------------|
| `PATH` | Command hijacking | Modifies command search path |
| `LD_PRELOAD` | Library injection | Preloads malicious dynamic libraries |
| `LD_LIBRARY_PATH` | Library hijacking | Modifies library search path |
| `DYLD_INSERT_LIBRARIES` | Library injection | macOS library injection |
| `COMSPEC` | Command hijacking | Windows command interpreter path override |
| `PATHEXT` | Command hijacking | Windows executable extension tampering |
| `SYSTEMROOT` | System corruption | Windows system root directory tampering |
| `WINDIR` | System corruption | Windows directory tampering |
| `PYTHONPATH` | Module hijacking | Python module search path |
| `IFS` | Parsing attack | Modifies field separator |

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

Sensitive key pattern list for auto-detecting sensitive configuration. Key names containing these patterns (case-insensitive) are identified as sensitive:

:::warning
The sensitive pattern list is the library-internal variable `internal.Patterns` (not exported from the env package), accessed indirectly through the `IsSensitiveKey()` function. The following are the main sensitive pattern categories, for reference.
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
- Case-insensitive
- A key name containing any pattern is identified as sensitive

**Usage example:**

```go
// Check if a key is sensitive
if env.IsSensitiveKey("DB_PASSWORD") {
    // Handle securely
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

Default key name validation pattern:

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

:::tip Performance
`nil` enables fast byte-level validation (about 10x performance improvement).
Default validation rule: starts with a letter, contains only letters, numbers, and underscores.
:::

**Custom pattern:**

```go
import "regexp"

cfg := env.DefaultConfig()
// Only allow uppercase letter prefix
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## Security Utility Functions

The six security utility functions — `IsSensitiveKey`, `MaskValue`, `MaskKey`, `MaskSensitiveInString`, `SanitizeForLog`, and `ClearBytes` — are documented in full (signatures, parameters, and examples) in the ["Security Utility Functions" section of the SecureValue API](./secure-value#security-utility-functions). In brief: `IsSensitiveKey` tests whether a key name is sensitive; `MaskValue` and `MaskKey` mask values and key names based on key sensitivity; `SanitizeForLog` and `MaskSensitiveInString` handle log sanitization and long-string truncation; `ClearBytes` securely zeroes byte slices.

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

Check sentinel errors:

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

Extract detailed error information:

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

- [SecureValue API](./secure-value) - Complete API for security utility functions
- [Config API](./config) - Configuration options and limit settings
- [Security Overview](../security/) - Security architecture and core features
- [Production Checklist](../security/production-checklist) - Pre-launch security checks
