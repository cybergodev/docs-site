---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo env | Sentinel Errors"
description: "Constants and errors reference for CyberGo env: DefaultMaxFileSize/MaxVariables limits, ErrFileNotFound sentinel errors, ParseError, and forbidden keys."
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

:::warning
The following sentinels are predefined symbols, but in the current implementation some scenarios **do not match these sentinels via `errors.Is`**: forbidden keys return `*SecurityError` (match with `errors.Is(err, ErrSecurityViolation)`), invalid key format and missing required keys return `*ValidationError` (extract with `errors.As`). See each error type section for details.
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

// Check if required keys are missing (actually returns *ValidationError{Rule:"required"})
var valErr *env.ValidationError
if errors.As(err, &valErr) && valErr.Rule == "required" {
    // Missing required keys
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

:::tip
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
    Op    string  // Operation (open, stat, size_check)
    Err   error   // Original error
    Size  int64   // File size (during Size check)
    Limit int64   // Limit (during Size check)
}
```

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
    Path    string  // File path
    Message string  // Error message
    Err     error   // Original error
}
```

### YAMLError

YAML parse error:

```go
type YAMLError struct {
    Path    string  // File path
    Line    int     // Line number
    Column  int     // Column number
    Message string  // Error message
    Err     error   // Original error
}
```

### MarshalError

Serialization error:

```go
type MarshalError struct {
    Field   string  // Field name
    Message string  // Error message
}

func IsMarshalError(err error) bool  // Check function
```

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
`sensitiveKeyPatterns` is an internal library variable (not exported), accessed indirectly through the `IsSensitiveKey()` function. The following are the main sensitive pattern categories, for reference.
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

:::tip
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

:::tip
Complete documentation for `IsSensitiveKey`, `MaskValue`, `SanitizeForLog` and other security utility functions is also available in [SecureValue API](./secure-value#security-utility-functions).
:::

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Checks whether a key name matches sensitive patterns.

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Sensitive key, handle securely
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

Returns a masked value based on the key's sensitivity.

```go
// Sensitive key - returns [MASKED:N chars] format
masked := env.MaskValue("API_KEY", "secret123")
// Returns: [MASKED:9 chars]

// Non-sensitive key - returns original value (truncated if over 20 chars)
masked := env.MaskValue("APP_NAME", "myapp")
// Returns: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// Returns: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

Masks a key name for logging.

```go
masked := env.MaskKey("DB_PASSWORD")
// Returns: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Masks potential sensitive content in a string. Truncates strings longer than 50 characters.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - masked string

```go
// Long strings are truncated
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// Returns: "This is a very long log message that exceeds 50..."

// Short strings remain unchanged
short := "Short message"
clean := env.MaskSensitiveInString(short)
// Returns: "Short message"
```

:::warning
This function is primarily used for truncating long strings. To auto-mask sensitive key-value pairs, use `SanitizeForLog`.
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Cleans sensitive key-value pair information from a string. Auto-detects and masks sensitive values in `key=value` format.

**Parameters:**
- `s` - original string

**Returns:**
- `string` - cleaned string

**Detected sensitive key patterns:**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// Auto-mask sensitive key-value pairs
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// Returns: "Connected with password=[MASKED] api_key=[MASKED]"

// Non-sensitive key-value pairs remain unchanged
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// Returns: "Config loaded: app_name=myapp port=8080"
```

:::tip
Suitable for log output, error messages, debug information, and other scenarios requiring automatic filtering of sensitive key-value pairs.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

Securely zeros a byte slice.

```go
sensitive := []byte("secret-data")
// Use...
env.ClearBytes(sensitive)
// sensitive is now all zeros
```

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

## Default Forbidden Keys and Key Pattern

### Complete DefaultForbiddenKeys list

The library refuses to write the following system-critical variables by default, grouped by attack surface:

| Category | Keys | Defends against |
|----------|------|-----------------|
| Path injection | `PATH` | Executable lookup hijacking |
| Dynamic linker (Linux/macOS) | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` | Library preloading attacks |
| Shell escapes | `SHELL`, `ENV`, `BASH_ENV`, `IFS` | Shell injection |
| Interpreter injection | `PYTHONPATH`, `PERL5OPT`, `RUBYLIB`, `NODE_PATH` | Language-runtime code injection |
| Windows-specific | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` | Windows system variable hijacking |

Append your own with `ValidationConfig.ForbiddenKeys`; lifting the built-in restrictions requires supplying a replacement validator.

### DefaultKeyPattern

`DefaultKeyPattern` is exported as `nil` — default key validation takes the **byte-level fast path** (equivalent to the regex `^[A-Za-z][A-Za-z0-9_]*$`), roughly an order of magnitude faster than regex. Setting a custom `KeyPattern` switches to regex validation and subjects it to the four security probes documented in [KeyPattern probes](/en/env/api-reference/config).

### ExpansionErrorKind

The two values of `ExpansionError.Kind`: `ExpansionDepthKind` (depth exceeded/cycle detected) and `ExpansionRequiredKind` (`${VAR:?}` required variable unset). See the [error handling guide](/en/env/guides/error-handling).

## Related Documentation

- [SecureValue API](/en/env/api-reference/secure-value) - Complete API for security utility functions
- [Config API](/en/env/api-reference/config) - Configuration options and limit settings
- [Security Overview](/en/env/security/) - Security architecture and core features
- [Production Checklist](/en/env/security/production-checklist) - Pre-launch security checks
