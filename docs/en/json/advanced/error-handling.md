---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo JSON | Best Practices"
description: "CyberGo JSON error handling: JsonsError type checking, errors.Is/As matching, SafeError safe output and RedactedPath redacted logging to build a robust exception mechanism."
sidebar_position: 2
---

# Error Handling

Properly handling errors in JSON operations.

## Error Types

### Standard Errors

```go
var (
    ErrPathNotFound       = errors.New("path not found")
    ErrInvalidPath        = errors.New("invalid path format")
    ErrTypeMismatch       = errors.New("type mismatch")
    ErrInvalidJSON        = errors.New("invalid JSON format")
    ErrDepthLimit         = errors.New("depth limit exceeded")
    ErrSizeLimit          = errors.New("size limit exceeded")
    ErrSecurityViolation  = errors.New("security violation detected")
    ErrProcessorClosed    = errors.New("processor is closed")
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded")
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrOperationTimeout   = errors.New("operation timeout")           // Deprecated
    ErrResourceExhausted  = errors.New("system resources exhausted")  // Deprecated
)
```

### Error Checking

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Path not found
        return defaultName
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // Type mismatch
        return "", fmt.Errorf("field type error: %w", err)
    }
    return "", err
}
```

## JsonsError

### Structure

`JsonsError` is the library's primary error type, containing operation context information:

```go
type JsonsError struct {
    Op      string `json:"op"`      // Operation type: "get", "set", "delete", "marshal", etc.
    Path    string `json:"path"`    // JSON path (if any)
    Message string `json:"message"` // Human-readable error message
    Err     error  `json:"err"`     // Underlying error
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### Usage

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // Use errors.Is to check error type
    if errors.Is(err, json.ErrPathNotFound) {
        // Path not found
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // Type mismatch
    }

    // Use errors.As to get detailed context
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("Operation: %s\n", jsonErr.Op)
        fmt.Printf("Path: %s\n", jsonErr.Path)
        fmt.Printf("Message: %s\n", jsonErr.Message)
    }
}
```

## Error Handling Patterns

### Provide Default Values

```go
// Type-safe getter functions have built-in default value support
name := json.GetString(data, "user.name", "anonymous")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### Collect Multiple Errors

```go
type MultiError struct {
    Errors []error
}

func (e *MultiError) Add(err error) {
    e.Errors = append(e.Errors, err)
}

func (e *MultiError) HasError() bool {
    return len(e.Errors) > 0
}

func (e *MultiError) Error() string {
    msgs := make([]string, len(e.Errors))
    for i, err := range e.Errors {
        msgs[i] = err.Error()
    }
    return strings.Join(msgs, "; ")
}

// Usage
var multiErr MultiError
for _, path := range requiredPaths {
    if _, err := json.Get(data, path); err != nil {
        multiErr.Add(fmt.Errorf("%s: %w", path, err))
    }
}
if multiErr.HasError() {
    return multiErr.Error()
}
```

### Error Wrapping

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("failed to read API key: %w", err)
}
```

## Custom Errors

### Business Errors

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed %s: %s", e.Field, e.Message)
}

// Usage
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "required"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "must be at least 2 characters"}
    }
    return nil
}
```

## Logging

### Structured Logging

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("JSON operation failed",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### Audit Logging

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("Operation failed",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("Operation succeeded",
            "operation", op,
            "path", path,
        )
    }
}
```

## Recovery Strategies

### SafeError Safe Output

`SafeError` returns a client-safe error message, stripping internal context information:

```go
// Signature: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // SafeError strips internal details like paths and operation context
    safeMsg := json.SafeError(err)
    http.Error(w, safeMsg, http.StatusBadRequest)
    return
}
```

### Retry

```go
func withRetry(fn func() error, maxRetries int) error {
    var err error
    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }
        time.Sleep(time.Second * time.Duration(i+1))
    }
    return err
}

// Usage
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### Degradation

```go
func getConfig(data string) Config {
    cfg := json.DefaultConfig()

    // Use type-safe getter functions with built-in default values
    cfg.StrictMode = json.GetBool(data, "config.strict", true)

    return cfg
}
```

## Error Classification

### User Input Errors

Caused by user-provided JSON data or paths:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // JSON format error
        return fmt.Errorf("data format error: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // Path not found
        return fmt.Errorf("field not found: %w", err)
    case errors.Is(err, json.ErrTypeMismatch):
        // Type mismatch
        return fmt.Errorf("type error: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // Path syntax error
        return fmt.Errorf("path syntax error: %w", err)
    case errors.Is(err, json.ErrUnsupportedPath):
        // Unsupported path operation
        return fmt.Errorf("unsupported operation: %w", err)
    }
}
```

### Security-Related Errors

Potential security threats detected:

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // Security violation, log and reject
        log.Warn("Security violation", "error", err)
        return errors.New("invalid input")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("data exceeds size limit: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("nesting depth exceeded: %w", err)
    }
    return err
}
```

### System Errors

System-level transient errors:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // Operation timeout, retryable <Badge type="danger" text="Deprecated" />
        return fmt.Errorf("transient error, please retry: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // Concurrency limit (returned when MaxConcurrency is reached, retryable)
        return fmt.Errorf("system busy, please try later: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // Resource exhausted <Badge type="danger" text="Deprecated" />
        return fmt.Errorf("insufficient system resources: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // Processor is closed
        return fmt.Errorf("processor unavailable: %w", err)
    }
    return err
}
```

## Error Handling Best Practices

### 1. Distinguish Error Types

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // Use errors.Is to distinguish error types
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrTypeMismatch),
            errors.Is(err, json.ErrInvalidPath):
            // User input error, return friendly message
            return fmt.Errorf("data format error: %w", err)
        case errors.Is(err, json.ErrSecurityViolation):
            // Security error, log and reject
            log.Warn("Security violation", "error", err)
            return errors.New("invalid input")
        case errors.Is(err, json.ErrConcurrencyLimit):
            // Concurrency limit, can retry later
            return fmt.Errorf("system busy, please retry later: %w", err)
        case errors.Is(err, json.ErrOperationTimeout): // Deprecated (not returned currently, kept for compatibility)
            return fmt.Errorf("transient error, please retry: %w", err)
        default:
            // System error
            log.Error("System error", "error", err)
            return errors.New("internal error")
        }
    }
    return nil
}
```

### 2. Use errors.As for Context

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("operation %s failed (path: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("operation failed: %w", err)
    }
    return nil
}
```

### 3. Error Chain Tracing

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("deep processing failed: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("level 1 failed (path data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// Error chain example:
// Deep processing failed: level 1 failed (path data.field): path not found
```

## See Also

- [Constants and Errors](../api-reference/constants)
- [Security Overview](../security/)
- [Performance Optimization](./performance)
