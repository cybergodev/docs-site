---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo env | Sentinel Errors and Recovery"
description: "CyberGo env error handling guide: errors.Is for sentinel errors, errors.As context from ParseError and SecurityError, Unwrap tracing, recovery strategies."
sidebar_position: 5
---

# Error Handling

env returns sentinel errors for common failures and structured error types for context. Match sentinels with `errors.Is`; extract details with `errors.As`.

## Sentinel Errors

### File Errors

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**Usage example:**

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    log.Println("Configuration file not found")
}
if errors.Is(err, env.ErrFileTooLarge) {
    log.Println("Configuration file too large")
}
```

### Parse Errors

```go
var (
    ErrLineTooLong  = errors.New("line exceeds maximum length limit")
    ErrInvalidKey   = errors.New("invalid key format")
    ErrDuplicateKey = errors.New("duplicate key encountered")
)
```

### Security Errors

```go
var (
    ErrForbiddenKey      = errors.New("key is forbidden for security reasons")
    ErrSecurityViolation = errors.New("security policy violation")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**Forbidden key check (actually returns `*SecurityError`, matching both `ErrSecurityViolation` and the more specific `ErrForbiddenKey`):**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrSecurityViolation) {
    log.Println("Attempted to set a forbidden key")
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
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrNotInitialized     = errors.New("default loader not initialized; call Load() first")
    ErrMissingRequired    = errors.New("required key is missing")
)
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

// Check if required keys are missing (actually returns *ValidationError, Rule=="required")
var valErr *env.ValidationError
if errors.As(err, &valErr) && valErr.Rule == "required" {
    // Missing required keys: valErr.Message contains the list of missing keys
}
```

### Adapter Errors

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

When a custom validator implements only the `KeyValidator` interface and not the full `Validator` interface, calling `ValidateRequired` returns this error.

**How to check:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // Custom validator does not support required key validation
    // Need to implement the full Validator interface
}
```

:::tip Solution
Implement the `Validator` interface (ValidateKey, ValidateValue, and ValidateRequired) instead of only `KeyValidator`.
:::

## Structured Error Types

### ParseError

A parse error that carries its location:

```go
type ParseError struct {
    File    string  // File name
    Line    int     // Line number
    Content string  // Error content
    Err     error   // Original error
}
```

**Usage example:**

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Printf("Parse error %s:%d - %s\n",
        parseErr.File, parseErr.Line, parseErr.Err)
    // Output: Parse error .env:15 - invalid key format
}
```

### FileError

A file operation error:

```go
type FileError struct {
    Path  string  // File path
    Op    string  // Operation
    Err   error   // Original error
    Size  int64   // File size
    Limit int64   // Limit
}
```

**Usage example:**

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    if fileErr.Size > 0 {
        log.Printf("File %s size %d exceeds limit %d\n",
            fileErr.Path, fileErr.Size, fileErr.Limit)
    }
}
```

### SecurityError

A security policy violation:

```go
type SecurityError struct {
    Action  string  // Operation
    Reason  string  // Reason
    Key     string  // Key name
    Details string  // Details
}
```

**Usage example:**

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Printf("Security error: %s - %s (key: %s)\n",
        secErr.Action, secErr.Reason, secErr.Key)
}
```

### ValidationError

A config, key, or value validation failure:

```go
type ValidationError struct {
    Field   string  // Field name
    Value   string  // Value
    Rule    string  // Rule
    Message string  // Message
}
```

**Usage example:**

```go
var valErr *env.ValidationError
if errors.As(err, &valErr) {
    log.Printf("Validation failed: field %s - %s\n", valErr.Field, valErr.Message)
}
```

### ExpansionError

A variable expansion failure:

```go
type ExpansionError struct {
    Key   string             // Key name
    Depth int                // Current depth
    Limit int                // Limit
    Chain string             // Expansion chain
    Kind  ExpansionErrorKind // Error reason category (zero value = depth/cycle)
}
```

**Usage example:**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("Expansion depth exceeded: %s (chain: %s)\n", expErr.Key, expErr.Chain)
}
```

### JSONError

A JSON parse error:

```go
type JSONError struct {
    Path    string  // Path within the JSON document (error location)
    Message string  // Error message
    Err     error   // Original error
}
```

**Usage example:**

```go
var jsonErr *env.JSONError
if errors.As(err, &jsonErr) {
    log.Printf("JSON error %s: %s\n", jsonErr.Path, jsonErr.Message)
}
```

### YAMLError

A YAML parse error:

```go
type YAMLError struct {
    Path    string  // Path within the YAML document (error location)
    Line    int     // Line number
    Column  int     // Column number
    Message string  // Error message
    Err     error   // Original error
}
```

**Usage example:**

```go
var yamlErr *env.YAMLError
if errors.As(err, &yamlErr) {
    log.Printf("YAML error %s:%d:%d - %s\n",
        yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
}
```

### MarshalError

A serialization or deserialization error:

```go
type MarshalError struct {
    Field   string  // Field name
    Message string  // Error message
}
```

**Usage example:**

```go
_, err := env.MarshalStruct(invalidData)
if err != nil && env.IsMarshalError(err) {
    var marshalErr *env.MarshalError
    if errors.As(err, &marshalErr) {
        log.Printf("Serialization error: field %s - %s\n", marshalErr.Field, marshalErr.Message)
    }
}
```

## Error Handling Patterns

### errors.Is Pattern

`errors.Is` classifies errors without exposing details, so it works as the dispatch condition in a `switch` over `ErrFileNotFound`, `ErrFileTooLarge`, `ErrSecurityViolation`, and other sentinels. The full branch set is in [Combined Handling](#combined-handling).

### errors.As Pattern

`errors.As` tries each type in turn; once one matches, read its fields (`*ParseError` gives file and line, `*FileError` gives path and size, `*SecurityError` gives action and reason). The combined form with sentinel branches is in [Combined Handling](#combined-handling); the full field list per type is in [Complete Error Type Reference](#complete-error-type-reference).

### Combined Handling

```go
func handleLoadError(err error) {
    if err == nil {
        return
    }

    // Check sentinel errors first
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        log.Println("Warning: configuration file not found")
        return

    case errors.Is(err, env.ErrFileTooLarge):
        var fileErr *env.FileError
        errors.As(err, &fileErr)
        log.Fatalf("File %s too large (%d > %d)",
            fileErr.Path, fileErr.Size, fileErr.Limit)

    case errors.Is(err, env.ErrSecurityViolation):
        log.Fatal("Forbidden key detected")
    }

    // Then check structured errors
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("Parse error %s:%d - %v",
            parseErr.File, parseErr.Line, parseErr.Err)
    }

    var secErr *env.SecurityError
    if errors.As(err, &secErr) {
        log.Fatalf("Security error: %s", secErr.Reason)
    }

    // Invalid key format (actually returns *ValidationError, Field=="key")
    var valErr *env.ValidationError
    if errors.As(err, &valErr) && valErr.Field == "key" {
        log.Fatalf("Invalid key detected: %s", valErr.Message)
    }

    // Unknown error
    log.Fatalf("Error: %v", err)
}
```

## Recovery Patterns

### Graceful Degradation

When the configuration file is missing, fall back to built-in defaults and treat every other error as fatal. The example below disables `Filenames` auto-loading, loads explicitly via `LoadFiles`, and handles `ErrFileNotFound` on its own:

```go
func loadConfig() *Config {
    cfg := env.ProductionConfig()
    cfg.Filenames = nil
    loader, err := env.New(cfg)
    if err != nil {
        log.Printf("Config error: %v, using default config", err)
        return defaultConfig()
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Println("Configuration file not found, using defaults")
            return defaultConfig()
        }
        log.Fatalf("Load failed: %v", err)
    }

    if err := loader.Validate(); err != nil {
        log.Fatalf("Validation failed: %v", err)
    }

    return parseConfig(loader)
}
```

:::tip ProductionConfig audit behavior
`ProductionConfig` sets `AuditEnabled=true`. With no `AuditHandler` configured, events go to stderr with an `[AUDIT]` prefix. To persist them, set `cfg.AuditHandler` explicitly — see [Audit Logging](./audit-logging) for the setup and [Production Checklist](../security/production-checklist) for verifying the file actually grows.
:::

### Retry Pattern

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
    cfg.FailOnMissingFile = true // missing files return ErrFileNotFound instead of being silently skipped
    loader, err := env.New(cfg)
    if err != nil {
        return err
    }
    defer loader.Close()

    for i := 0; i < maxRetries; i++ {
        err := loader.LoadFiles(filenames...)
        if err == nil {
            return nil
        }

        if errors.Is(err, env.ErrFileNotFound) {
            time.Sleep(time.Second * time.Duration(i+1))
            continue
        }

        return err
    }

    return errors.New("max retries exceeded")
}
```

Trigger condition: by default (`FailOnMissingFile=false`), `LoadFiles` **silently skips** missing files, so the `ErrFileNotFound` branch above is reachable only with `FailOnMissingFile=true` (the `ProductionConfig` preset sets it). The backoff in the example is linear (retry `i` waits `i+1` seconds) and only `ErrFileNotFound` is retried; oversized files, parse failures, and other errors return immediately.

## Complete Example

The program below assembles the earlier snippets; `handleLoadError` keeps only the branches this program needs to compile, and the full dispatch is in [Combined Handling](#combined-handling).

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.ProductionConfig()
	cfg.Filenames = nil
	cfg.FailOnMissingFile = true
	cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	err = loader.LoadFiles(".env")
	if err != nil {
		handleLoadError(err)
	}

	if err := loader.Validate(); err != nil {
		handleValidationError(err)
	}

	log.Println("Configuration loaded successfully")
}

// The full dispatch is in "Combined Handling"; only the branches
// this program needs are kept here.
func handleLoadError(err error) {
	switch {
	case errors.Is(err, env.ErrFileNotFound):
		log.Fatal("Configuration file not found")

	case errors.Is(err, env.ErrFileTooLarge):
		var fileErr *env.FileError
		errors.As(err, &fileErr)
		log.Fatalf("File too large: %s (%d bytes)", fileErr.Path, fileErr.Size)
	}

	log.Fatalf("Load failed: %v", err)
}

func handleValidationError(err error) {
	var valErr *env.ValidationError
	if errors.As(err, &valErr) {
		if valErr.Rule == "required" {
			// Missing required keys: valErr.Message contains the list of missing keys
			log.Fatalf("Missing required keys: %s", valErr.Message)
		}
		log.Fatalf("Validation failed: %s - %s", valErr.Field, valErr.Message)
	}

	log.Fatalf("Validation failed: %v", err)
}
```

## Complete Error Type Reference

Every structured error type supports `errors.As` for context extraction:

| Type | Scenario | Key information |
|------|----------|-----------------|
| `ParseError` | File parsing failure | File, line, content (sanitized) |
| `ValidationError` | Config/key/value validation failure | Field, rule, message |
| `SecurityError` | Security policy violation (forbidden keys, path checks) | Violation details |
| `FileError` | File operation failure | Path, operation, size/limit |
| `ExpansionError` | Variable expansion failure | `Kind` (failure category) |
| `JSONError` | JSON parsing failure | Position information |
| `YAMLError` | YAML parsing failure | Position information |
| `MarshalError` | Marshaling/unmarshaling failure | Operation and cause |

### ExpansionErrorKind

`ExpansionError` distinguishes two failure classes via its `Kind` field for precise handling:

| Constant | Meaning |
|----------|---------|
| `ExpansionDepthKind` | Recursion depth exceeded or cycle detected |
| `ExpansionRequiredKind` | Variable referenced by `${VAR:?message}` is unset |

### Additional Sentinel Errors

Beyond the common items listed in the [sentinel errors](#sentinel-errors) section:

| Sentinel | Meaning |
|----------|---------|
| `ErrClosed` | Operating on a closed (or nil) Loader |
| `ErrInvalidConfig` | Invalid configuration; `New()` wraps the specific validation error |
| `ErrNotInitialized` | A package-level function was called before the default loader was initialized (`Set`/`Delete`/`Validate`/`ParseInto`) |
| `ErrAlreadyInitialized` | Calling `Load()` again after the default loader is initialized |
| `ErrDuplicateKey` | A duplicate key inside one document (`DuplicateKeyPolicy = DuplicateKeyError`), or two different YAML/JSON paths that flatten to the same key name |
| `ErrAuditFailed` | An audit event was lost while fail-closed auditing (`AuditFailClosed`) was enabled — the handler errored, panicked, or the channel was full; the operation that lost its audit trail returns this error instead of succeeding silently |

### Helper Predicates

`IsMarshalError(err)` uses `errors.As` to test whether an error is a `*MarshalError` — no manual assertion needed.

## Related Documentation

- [Constants & Errors](../api-reference/constants) - complete error list
- [Config API](../api-reference/config) - configuration limit settings
- [Security Overview](../security/) - security error handling
