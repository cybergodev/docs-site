---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo env | Sentinel Errors and Recovery"
description: "Error handling guide for CyberGo env: errors.Is for 16 sentinel errors, errors.As for structured context, Unwrap tracing, and recovery strategies."
sidebar_position: 5
---

# Error Handling

The env library provides a structured error handling mechanism, supporting both `errors.Is` and `errors.As` patterns.

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

**Forbidden key check (actually returns `*SecurityError`, matches `ErrSecurityViolation`):**

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

## Structured Error Types

### ParseError

Parse error with location information:

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

File operation error:

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

Security error:

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

Validation error:

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

Variable expansion error:

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

JSON parse error:

```go
type JSONError struct {
    Path    string  // File path
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

**Usage example:**

```go
var yamlErr *env.YAMLError
if errors.As(err, &yamlErr) {
    log.Printf("YAML error %s:%d:%d - %s\n",
        yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
}
```

### MarshalError

Serialization/deserialization error:

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

Check sentinel errors:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // file not found
    log.Println("Configuration file not found, using defaults")

case errors.Is(err, env.ErrFileTooLarge):
    // file too large
    log.Fatal("Configuration file too large")

case errors.Is(err, env.ErrSecurityViolation):
    // forbidden key (actually returns *SecurityError)
    log.Fatal("Forbidden key detected")

case err != nil:
    // other errors
    log.Fatalf("Load failed: %v", err)
}

// Invalid key format (actually returns *ValidationError, Field=="key")
var valErr *env.ValidationError
if errors.As(err, &valErr) && valErr.Field == "key" {
    log.Fatalf("Invalid key detected: %s", valErr.Message)
}
```

### errors.As Pattern

Extract detailed error information:

```go
err := loader.LoadFiles(".env")
if err == nil {
    return
}

// Try to extract parse error
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    log.Fatalf("Parse error at %s line %d: %v",
        parseErr.File, parseErr.Line, parseErr.Err)
}

// Try to extract file error
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    log.Fatalf("File %s error: %v", fileErr.Path, fileErr.Err)
}

// Try to extract security error
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    log.Fatalf("Security error: %s - %s", secErr.Action, secErr.Reason)
}

// Other errors
log.Fatalf("Unknown error: %v", err)
```

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

    // Unknown error
    log.Fatalf("Error: %v", err)
}
```

## Recovery Patterns

### Graceful Degradation

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

### Retry Pattern

```go
func loadWithRetry(filenames []string, maxRetries int) error {
    cfg := env.DefaultConfig()
    cfg.Filenames = nil
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

## Complete Example

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

func handleLoadError(err error) {
	switch {
	case errors.Is(err, env.ErrFileNotFound):
		log.Fatal("Configuration file not found")

	case errors.Is(err, env.ErrFileTooLarge):
		var fileErr *env.FileError
		errors.As(err, &fileErr)
		log.Fatalf("File too large: %s (%d bytes)", fileErr.Path, fileErr.Size)

	case errors.Is(err, env.ErrSecurityViolation):
		log.Fatal("Forbidden key detected")
	}

	// Structured errors
	var parseErr *env.ParseError
	if errors.As(err, &parseErr) {
		log.Fatalf("Parse error %s:%d - %v",
			parseErr.File, parseErr.Line, parseErr.Err)
	}

	var secErr *env.SecurityError
	if errors.As(err, &secErr) {
		log.Fatalf("Security error: %s - %s", secErr.Action, secErr.Reason)
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

All structured error types can be unwrapped with `errors.As` for context:

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

### Additional sentinel errors

Beyond the common items listed in the [sentinel errors](#sentinel-errors) section:

| Sentinel | Meaning |
|----------|---------|
| `ErrClosed` | Operating on a closed (or nil) Loader |
| `ErrInvalidConfig` | Invalid configuration; `New()` wraps the specific validation error |
| `ErrNotInitialized` | Using write functions in global mode before calling `Load()` |
| `ErrAlreadyInitialized` | Calling `Load()` again after the default loader is initialized |
| `ErrDuplicateKey` | Reserved: duplicate keys are currently silently skipped when `OverwriteExisting=false`; no code path returns it yet |

### Helper predicates

`IsMarshalError(err)` uses `errors.As` to test whether an error is a `*MarshalError` — no manual assertion needed.

## Related Documentation

- [Constants & Errors](/en/env/api-reference/constants) - Complete error list
- [Config API](/en/env/api-reference/config) - Configuration limit settings
- [Security Overview](/en/env/security/) - Security error handling
