---
title: Constants & Errors - CyberGo env | Error Handling
description: Reference for env library security limit constants, sentinel errors, structured error types, and security utility functions
---

# Constants & Errors

Constants, error types, sentinel errors, and predefined variables defined by the library.

## Security Limit Constants

### Default Limits

```go
const (
    // DefaultMaxFileSize - Maximum bytes per file
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 MB

    // DefaultMaxLineLength - Maximum length per line
    DefaultMaxLineLength int = 1024  // 1 KB

    // DefaultMaxKeyLength - Maximum key name length
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - Maximum value length
    DefaultMaxValueLength int = 4096  // 4 KB

    // DefaultMaxVariables - Maximum variables per file
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - Maximum variable expansion depth
    DefaultMaxExpansionDepth int = 5
)
```

### Hard Maximums

::: warning Note
The following are internal hard maximums (unexported), used internally by `Config.Validate()`. Users cannot reference these constants directly, but `cfg.Validate()` automatically checks if configuration exceeds these limits.
:::

| Constant | Value | Description |
|----------|-------|-------------|
| HardMaxFileSize | 100 MB | Hard maximum for file size |
| HardMaxLineLength | 64 KB | Hard maximum for line length |
| HardMaxKeyLength | 1024 | Hard maximum for key length |
| HardMaxValueLength | 1 MB | Hard maximum for value length |
| HardMaxVariables | 10000 | Hard maximum for variable count |
| HardMaxExpansionDepth | 20 | Hard maximum for expansion depth |

Configuration validation checks against hard limits:

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // Exceeds 100MB maximum

if err := cfg.Validate(); err != nil {
    // Returns error: MaxFileSize exceeds hard limit
}
```

## Sentinel Errors

### File Errors

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

Checking:

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // File does not exist
}
if errors.Is(err, env.ErrFileTooLarge) {
    // File too large
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
var ErrNullByte = errors.New("null byte detected in input")
var ErrControlChar = errors.New("control character detected in input")
var ErrInvalidValue = errors.New("invalid value content")
```

Checking forbidden keys:

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // Attempted to set a forbidden key
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
var ErrMissingRequired = errors.New("required key is missing")
```

**Checking:**

```go
// Check if loader is closed
if errors.Is(err, env.ErrClosed) {
    // Loader is closed
}

// Check if default loader is already initialized
if errors.Is(err, env.ErrAlreadyInitialized) {
    // Default loader already exists, cannot call Load() again
}

// Check if a required key is missing
if errors.Is(err, env.ErrMissingRequired) {
    // Missing required key
}
```

### Adapter Errors

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

Returned when a custom validator only implements the `KeyValidator` interface but not the full `Validator` interface, and `ValidateRequired` is called.

**Checking:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // Custom validator doesn't support required key validation
    // Need to implement the full Validator interface
}
```

::: tip Solution
Implement the `Validator` interface (with `ValidateKey`, `ValidateValue`, and `ValidateRequired` methods) instead of only implementing `KeyValidator`.
:::

## Error Types

### ParseError

Parse error with position information:

```go
type ParseError struct {
    File    string  // File name
    Line    int     // Line number
    Content string  // Error content (masked)
    Err     error   // Original error
}
```

Usage:

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
    Action  string  // Action
    Reason  string  // Reason
    Key     string  // Key name (masked)
    Details string  // Additional details
}
```

Usage:

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
    Size  int64   // File size (when Size check)
    Limit int64   // Limit (when Size check)
}
```

Usage:

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
    Key   string  // Key name
    Depth int     // Current depth
    Limit int     // Limit
    Chain string  // Expansion chain
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

Built-in forbidden keys list to prevent modification of critical system variables:

::: warning Note
`defaultForbiddenKeys` is an internal variable (unexported) and cannot be accessed directly via `env.DefaultForbiddenKeys`. The following is the complete list used internally, for reference.
:::

| Category | Forbidden Keys |
|----------|---------------|
| System path | `PATH` |
| Dynamic linker (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Language runtimes | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**Risk explanation:**

| Key | Risk Type | Description |
|-----|-----------|-------------|
| `PATH` | Command hijacking | Modifies command search path |
| `LD_PRELOAD` | Library injection | Preloads malicious dynamic library |
| `LD_LIBRARY_PATH` | Library hijacking | Modifies library search path |
| `DYLD_INSERT_LIBRARIES` | Library injection | macOS library injection |
| `PYTHONPATH` | Module hijacking | Python module search path |
| `IFS` | Parse attack | Modifies field separator |

**Usage:**

```go
// Attempting to set a forbidden key returns ErrForbiddenKey
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // Key is forbidden
}

// Add extra forbidden keys
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

Sensitive key pattern list for automatic detection of sensitive configuration. Keys containing these patterns (case-insensitive) are identified as sensitive:

::: warning Note
`sensitiveKeyPatterns` is an internal variable (unexported), accessed indirectly via `IsSensitiveKey()`. The following are the main sensitive pattern categories, for reference.
:::

**Main sensitive pattern categories:**

| Category | Pattern Examples |
|----------|-----------------|
| Authentication & Authorization | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API & Keys | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| Encryption & Security | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| Finance & PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| Cryptocurrency | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| Database | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| Cloud Services | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**Matching rules:**
- Case-insensitive
- Key name containing any pattern is identified as sensitive

**Usage:**

```go
// Check if key is sensitive
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

::: tip Performance
`nil` enables fast byte-level validation (~10x performance improvement).
Default validation rule: starts with a letter, contains only letters, digits, and underscores.
:::

**Custom pattern:**

```go
import "regexp"

cfg := env.DefaultConfig()
// Only allow uppercase letters starting
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## Security Utility Functions

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Checks if a key name matches sensitive patterns.

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

Returns a masked value based on key sensitivity.

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

Masks key name for logging.

```go
masked := env.MaskKey("DB_PASSWORD")
// Returns: DB***
```

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Masks potential sensitive content in strings. Truncates strings longer than 50 characters.

**Parameters:**
- `s` - Original string

**Returns:**
- `string` - Masked string

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

::: warning Note
This function primarily truncates long strings. To automatically mask sensitive key-value pairs, use `SanitizeForLog`.
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Sanitizes sensitive key-value pair information in strings. Automatically detects and masks sensitive values in `key=value` format.

**Parameters:**
- `s` - Original string

**Returns:**
- `string` - Sanitized string

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

::: tip Use Case
Suitable for log output, error messages, debug information, and other scenarios requiring automatic filtering of sensitive key-value pairs.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

Securely zeroes a byte slice.

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

Usage:

```go
// Detect format
format := env.DetectFormat("config.json")  // FormatJSON

// Serialize with specific format
data, _ := env.Marshal(cfg, env.FormatJSON)

// Format string
fmt.Println(format.String())  // "json"
```

## Error Checking Patterns

### errors.Is Pattern

Checking sentinel errors:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // File not found
case errors.Is(err, env.ErrFileTooLarge):
    // File too large
case errors.Is(err, env.ErrForbiddenKey):
    // Forbidden key
case errors.Is(err, env.ErrClosed):
    // Loader is closed
}
```

### errors.As Pattern

Extracting detailed error information:

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
    "fmt"
    "log"
    "os"

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
            log.Fatal("Loader is closed")

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

- [SecureValue API](/en/env/api-reference/secure-value) - Complete security utility functions API
- [Config API](/en/env/api-reference/config) - Configuration options and limit settings
- [Security Overview](/en/env/security/) - Security architecture and core features
- [Production Checklist](/en/env/security/production-checklist) - Pre-deployment security checks
