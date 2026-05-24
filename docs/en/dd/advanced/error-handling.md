---
title: "Error Handling - CyberGo DD | Log Error Management"
description: "CyberGo DD error handling guide: structured error types, sentinel errors, errors.Is/As wrapping, custom strategies, recovery, and error hook callbacks."
---

# Error Handling

DD defines a structured error system for precise identification and handling of various errors.

## Error Types

### LoggerError

A structured error containing error code, message, cause, and context:

```go
type LoggerError struct { ... }

// Create (using LoggerError struct fields directly)
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "error description",
}

// Wrap (using LoggerError struct fields)
err := &dd.LoggerError{
    Code:    "WRAP_CODE",
    Message: "wrap description",
    Cause:   originalErr,
}
```

Methods:

| Method | Description |
|--------|-------------|
| `Error() string` | Error message |
| `Unwrap() error` | Get inner error |
| `Is(target error) bool` | Error comparison |
| `WithContext(key, value)` | Add context information |
| `WithField(key, value)` | Add field information |

```go
err := &dd.LoggerError{
    Code:    "DB_ERROR",
    Message: "query failed",
    Cause:   dbErr,
}
err = err.WithContext("query", "SELECT * FROM users")
err = err.WithField("retry_count", 3)
```

### WriterError

Writer error containing Writer index and original error.

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

Multi-writer aggregated error.

```go
type MultiWriterError struct { ... }
```

Methods: `HasErrors()`, `ErrorCount()`, `FirstError()`

## Error Handling Patterns

### errors.Is Matching

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // Handle invalid level
    }
    if errors.Is(err, dd.ErrInvalidFormat) {
        // Handle invalid format
    }
    if errors.Is(err, dd.ErrMaxWritersExceeded) {
        // Handle too many writers
    }
}
```

### Write Error Handling

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // Custom write error handling
    if errors.Is(err, dd.ErrWriterNotFound) {
        // Writer has been removed
        return
    }
    // Record error metrics
    metrics.WriteErrors.Inc()
})
```

### Runtime Error Handling

```go
// Add Writer
if err := logger.AddWriter(w); err != nil {
    if errors.Is(err, dd.ErrLoggerClosed) {
        // Logger is closed
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer is nil
        return
    }
}

// Set level
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // Invalid level
    }
}
```

### Security Errors

```go
fw, err := dd.NewFileWriter(userPath, dd.DefaultFileWriterConfig())
if err != nil {
    if errors.Is(err, dd.ErrPathTraversal) {
        // Path traversal attack
        log.Fatal("Path traversal attack detected")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Null byte injection
        log.Fatal("Null byte injection detected")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // Symlinks not allowed
    }
}
```

### Pattern Errors

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // ReDoS risk pattern
        log.Fatal("Regex pattern has ReDoS risk")
    }
    if errors.Is(err, dd.ErrInvalidPattern) {
        // Invalid regex
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // Pattern too long
    }
}
```

## Hook Errors

When using hooks, you can capture and handle errors during hook execution via the `OnError` callback in the hook configuration:

```go
// Configure hook error handling via HooksConfig
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // Custom hook error handling
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## Global Logger Errors

```go
// Check during initialization
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// Runtime check
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("Global logger initialization error:", err)
}
```

## Next Steps

- [Constants & Errors](../api-reference/constants) -- Complete error code list
- [Hook System](../api-reference/hooks) -- HookRegistry
- [Security Filtering](../api-reference/security) -- Security-related errors
