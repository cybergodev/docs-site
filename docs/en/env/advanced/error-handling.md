---
title: Error Handling - CyberGo env | Sentinel Errors & Recovery
description: Error handling patterns for the env library including sentinel error checking, structured error extraction, and recovery strategies
---

# Error Handling

The env library provides structured error handling with support for `errors.Is` and `errors.As` patterns.

## Sentinel Errors

### File Errors

```go
var (
    ErrFileNotFound  = errors.New("file not found")
    ErrFileTooLarge  = errors.New("file exceeds maximum size limit")
)
```

**Usage:**

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
    ErrNullByte          = errors.New("null byte detected in input")
    ErrControlChar       = errors.New("control character detected in input")
    ErrInvalidValue      = errors.New("invalid value content")
)
```

**Forbidden key check:**

```go
err := loader.Set("PATH", "/malicious")
if errors.Is(err, env.ErrForbiddenKey) {
    log.Println("Attempted to set a forbidden key")
}
```

### Expansion Errors

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### State Errors

```go
var (
    ErrClosed             = errors.New("loader has been closed")
    ErrInvalidConfig      = errors.New("invalid configuration")
    ErrAlreadyInitialized = errors.New("default loader already initialized")
    ErrMissingRequired    = errors.New("required key is missing")
)
```

## Structured Error Types

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

**Usage:**

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

**Usage:**

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
    Action  string  // Action
    Reason  string  // Reason
    Key     string  // Key name
    Details string  // Additional details
}
```

**Usage:**

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

**Usage:**

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
    Key   string  // Key name
    Depth int     // Current depth
    Limit int     // Limit
    Chain string  // Expansion chain
}
```

**Usage:**

```go
var expErr *env.ExpansionError
if errors.As(err, &expErr) {
    log.Printf("Expansion depth exceeded: %s (chain: %s)\n", expErr.Key, expErr.Chain)
}
```

### Format Errors

```go
type JSONError struct {
    Path    string
    Message string
    Err     error
}

type YAMLError struct {
    Path    string
    Line    int
    Column  int
    Message string
    Err     error
}

type MarshalError struct {
    Field   string
    Message string
}
```

## Error Handling Patterns

### errors.Is Pattern

Checking sentinel errors:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // File not found
    log.Println("Configuration file not found, using defaults")

case errors.Is(err, env.ErrFileTooLarge):
    // File too large
    log.Fatal("Configuration file too large")

case errors.Is(err, env.ErrForbiddenKey):
    // Forbidden key
    log.Fatal("Forbidden key detected")

case errors.Is(err, env.ErrInvalidKey):
    // Invalid key format
    log.Fatal("Invalid key detected")

case err != nil:
    // Other errors
    log.Fatalf("Load failed: %v", err)
}
```

### errors.As Pattern

Extracting detailed error information:

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
        log.Println("Warning: Configuration file not found")
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
        log.Printf("Configuration error: %v, using defaults", err)
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
    "fmt"
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

    case errors.Is(err, env.ErrForbiddenKey):
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
        log.Fatalf("Validation failed: %s - %s", valErr.Field, valErr.Message)
    }

    if errors.Is(err, env.ErrMissingRequired) {
        log.Fatal("Missing required key")
    }

    log.Fatalf("Validation failed: %v", err)
}
```

## Related Documentation

- [Constants & Errors](/en/env/api-reference/constants) - Complete error list
- [Config API](/en/env/api-reference/config) - Configuration limit settings
- [Security Overview](/en/env/security/) - Security error handling
