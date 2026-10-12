---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo DD | LogLevel & SentinelErrors"
description: "CyberGo DD constants and error types reference: LogLevel log-level constants, Format output formats, and SentinelErrors definitions."
sidebar_position: 8
---

# Constants & Errors

> 🔧 **API Reference** · For a hands-on tutorial see [Error Handling](../../guides/operations/error-handling)

DD defines a rich set of constants and error types for log-level control, formatting, and error handling.

## Log Levels

```go
type LogLevel int8 // Log level type
```

| Constant | Value | Description |
|----------|-------|-------------|
| `LevelDebug` | 0 | Debug level |
| `LevelInfo` | 1 | Info level (default) |
| `LevelWarn` | 2 | Warn level |
| `LevelError` | 3 | Error level |
| `LevelFatal` | 4 | Fatal level |

`LogLevel` implements `String() string` (returns `"DEBUG"`/`"INFO"`/`"WARN"`/`"ERROR"`/`"FATAL"`; unknown values return `"UNKNOWN"`) and `IsValid() bool` (whether the level is within the valid range `LevelDebug`~`LevelFatal`).

## Log Formats

```go
type LogFormat int8 // Output format type
```

| Constant | Value | Description |
|----------|-------|-------------|
| `FormatText` | 0 | Text format |
| `FormatJSON` | 1 | JSON format |

`LogFormat` implements `String() string` (returns `"text"`/`"json"`; unknown values return `"unknown"`).

## Field Validation Modes

```go
type FieldValidationMode int // Field key validation mode
```

| Constant | Value | Description |
|----------|-------|-------------|
| `FieldValidationNone` | 0 | Disable validation (default) |
| `FieldValidationWarn` | 1 | Emit a stderr warning diagnostic on failure (field is still accepted and logged) |
| `FieldValidationStrict` | 2 | Strict mode; emit a stderr error diagnostic on failure (the log entry is still written normally, not rejected) |

## Field Naming Conventions

```go
type FieldNamingConvention int // Field key naming convention
```

| Constant | Value | Description |
|----------|-------|-------------|
| `NamingConventionAny` | 0 | Accept any format (default) |
| `NamingConventionSnakeCase` | 1 | snake_case (e.g. user_id) |
| `NamingConventionCamelCase` | 2 | camelCase (e.g. userId) |
| `NamingConventionPascalCase` | 3 | PascalCase (e.g. UserId) |
| `NamingConventionKebabCase` | 4 | kebab-case (e.g. user-id) |

## Hash Algorithms

```go
type HashAlgorithm int // Integrity signing hash algorithm
```

| Constant | Value | Description |
|----------|-------|-------------|
| `HashAlgorithmSHA256` | 0 | SHA-256 algorithm (used by [integrity signing](../security-audit/integrity)) |

`HashAlgorithm` implements `String() string` (returns `"SHA256"`; unknown values return `"Unknown"`).

## Default Values

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultTimeFormat` | `"2006-01-02T15:04:05Z07:00"` | ISO 8601 time format |
| `DefaultLogPath` | `"logs/app.log"` | Default log file path |
| `DefaultMaxSizeMB` | `100` | Default file size limit (MB) |
| `DefaultMaxBackups` | `10` | Default backup count |
| `DefaultMaxAge` | `30 * 24 * time.Hour` | Default retention period (30 days) |

## Context Keys

| Constant | Type | Value |
|----------|------|-------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Error Codes

The `LoggerError.Code` field contains a machine-readable error-code string, used for fine-grained error-type matching. Error codes are internal implementation details; prefer matching against sentinel errors.

## Sentinel Errors

Each error code corresponds to a sentinel error variable:

```go
var (
    ErrNilConfig          = errors.New("config cannot be nil")
    ErrNilWriter          = errors.New("writer cannot be nil")
    ErrNilFilter          = errors.New("filter cannot be nil")
    ErrNilHook            = errors.New("hook cannot be nil")
    ErrNilExtractor       = errors.New("context extractor cannot be nil")
    ErrLoggerClosed       = errors.New("logger is closed")
    ErrWriterNotFound     = errors.New("writer not found")
    ErrInvalidLevel       = errors.New("invalid log level")
    ErrInvalidFormat      = errors.New("invalid log format")
    ErrMaxWritersExceeded = errors.New("maximum writer count exceeded")
    ErrEmptyFilePath      = errors.New("file path cannot be empty")
    ErrPathTooLong        = errors.New("file path too long")
    ErrPathTraversal      = errors.New("path traversal detected")
    ErrNullByte           = errors.New("null byte in input")
    ErrInvalidPath        = errors.New("invalid file path")
    ErrSymlinkNotAllowed  = errors.New("symlinks not allowed")
    ErrHardlinkNotAllowed = errors.New("hardlinks not allowed")
    ErrOverlongEncoding   = errors.New("UTF-8 overlong encoding detected")
    ErrMaxSizeExceeded    = errors.New("maximum size exceeded")
    ErrMaxBackupsExceeded = errors.New("maximum backup count exceeded")
    ErrBufferSizeTooLarge = errors.New("buffer size too large")
    ErrInvalidPattern     = errors.New("invalid regex pattern")
    ErrEmptyPattern       = errors.New("pattern cannot be empty")
    ErrPatternTooLong     = errors.New("pattern length exceeds maximum")
    ErrReDoSPattern       = errors.New("pattern contains dangerous nested quantifiers that may cause ReDoS")
    ErrPatternFailed      = errors.New("failed to add pattern")
    ErrConfigValidation   = errors.New("configuration validation failed")
    ErrWriterAdd          = errors.New("failed to add writer")
    ErrMultipleConfigs    = errors.New("multiple configs provided, expected 0 or 1")
    ErrNilMultiWriter     = errors.New("multiwriter is nil")
)
```

### Error Checking

```go
if errors.Is(err, dd.ErrLoggerClosed) {
    // Logger is closed
}

if errors.Is(err, dd.ErrPathTraversal) {
    // Path-traversal attack detected
}
```

## Error Types

### LoggerError

```go
type LoggerError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}
```

Methods: `Error()`, `Unwrap()`, `Is(target)`, `WithContext(key, value)`, `WithField(key, value)`

```go
// LoggerError contains error code, message, cause, and context
// Check sentinel errors via errors.Is
if errors.Is(err, dd.ErrLoggerClosed) {
    // Logger is closed
}
```

### WriterError

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

Methods: `Error()`, `Unwrap()`

### MultiWriterError

```go
type MultiWriterError struct {
    Errors []WriterError
}
```

Methods: `Error()`, `Unwrap()`, `HasErrors()`, `ErrorCount()`, `FirstError()`

## Next Steps

- [Package Functions](./functions) -- Error-handling functions
- [Security Filtering](../security-audit/security) -- Path-safety validation
- [Hook System](../core/hooks) -- OnError hook
