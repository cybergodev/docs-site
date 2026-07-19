---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo DD | Logging Error Management"
description: "A complete error-handling guide for the CyberGo DD logging library, covering structured error types and the hierarchy, error-code design, sentinel-error definitions and matching, errors.Is/As wrapping and unwrapping, custom error-handling strategies, error-recovery mechanisms, and error-hook callback configuration to help you precisely identify and handle all kinds of logging-related errors."
sidebar_position: 2
---

# Error Handling

DD defines a structured error system for precisely identifying and handling various errors.

## Error Types

### LoggerError

Structured error containing an error code, message, cause, and context:

```go
type LoggerError struct { ... }

// Create (use LoggerError struct fields directly)
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "error description",
}

// Wrap (use LoggerError struct fields)
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
| `Unwrap() error` | Get the inner error |
| `Is(target error) bool` | Error comparison |
| `WithContext(key, value)` | Add context info |
| `WithField(key, value)` | Add field info |

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

Writer error containing the Writer index and the original error.

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

Aggregated multi-writer error.

```go
type MultiWriterError struct { ... }
```

Methods: `HasErrors()`, `ErrorCount()`, `FirstError()`

## Error-Handling Patterns

### errors.Is Matching

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrNilConfig) {
        // Handle nil config
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // Handle invalid level
    }
}
```

### Write-Error Handling

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // Custom write-error handling
    // Note: this callback fires only when writer.Write() fails and is passed the writer's own error;
    // dd.ErrWriterNotFound is returned by RemoveWriter directly to its caller and is never delivered via this callback.
    if errors.Is(err, io.ErrShortWrite) {
        // Fewer bytes written than requested
        return
    }
    // Record error metrics
    metrics.WriteErrors.Inc()
})
```

### Runtime Error Handling

```go
// Add a Writer
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

// Set the level
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
        // Path-traversal attack
        log.Fatal("path traversal attack detected")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Null-byte injection
        log.Fatal("null byte injection detected")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // Symlink not allowed
    }
}
```

### Pattern Errors

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // ReDoS-risk pattern
        log.Fatal("regex pattern carries ReDoS risk")
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

When using hooks, you can capture and handle errors from hook execution via the `ErrorHandler` callback in the hook configuration:

```go
// Configure hook-error handling via HooksConfig
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // Custom hook-error handling
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## Global Logger Errors

```go
// Check at initialization
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// Check at runtime
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("global logger initialization error:", err)
}
```

## Next Steps

- [Constants & Errors](../api-reference/dev-tools/constants) -- Full error-code list
- [Hook System](../api-reference/security-audit/hooks) -- HookRegistry
- [Security Filtering](../api-reference/security-audit/security) -- Security-related errors
