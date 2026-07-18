---
sidebar_label: "Constants & Errors"
title: "Constants and Errors - CyberGo JSON | API Reference"
description: "CyberGo JSON constants and errors: DefaultMaxJSONSize, DefaultMaxNestingDepth, ErrPathNotFound variables, and MergeMode enums for Go error handling."
sidebar_position: 7
---

# Constants and Errors

## Error Variables

### Primary Errors

```go
var (
    // Basic errors
    ErrInvalidJSON     = errors.New("invalid JSON format")
    ErrPathNotFound    = errors.New("path not found")
    ErrTypeMismatch    = errors.New("type mismatch")
    ErrInvalidPath     = errors.New("invalid path format")
    ErrProcessorClosed = errors.New("processor is closed")

    // Limit errors
    ErrSizeLimit        = errors.New("size limit exceeded")
    ErrDepthLimit       = errors.New("depth limit exceeded")
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded") // Returned when controlled operations (Get/Set/Delete, etc.) reach MaxConcurrency

    // Security and validation errors
    ErrSecurityViolation = errors.New("security violation detected")
    ErrUnsupportedPath   = errors.New("unsupported path operation")

    // Resource and performance errors (both Deprecated: not returned by any operation currently, retained for future use)
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### Error Checking

Use `errors.Is` to check error types:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Path not found
        fmt.Println("Path not found")
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Type mismatch
        fmt.Println("Type mismatch")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // JSON format error
        fmt.Println("Invalid JSON")
    }
}
```

## JsonsError Type

### Struct Definition

```go
type JsonsError struct {
    Op      string `json:"op"`      // Operation name
    Path    string `json:"path"`    // Path where the error occurred
    Message string `json:"message"` // Human-readable error message
    Err     error  `json:"err"`     // Underlying error
}
```

### Methods

```go
func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### Usage Example

```go
val, err := json.Get(data, "complex.path[0]")
if err != nil {
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("Operation: %s\n", jsonErr.Op)
        fmt.Printf("Path: %s\n", jsonErr.Path)
        fmt.Printf("Message: %s\n", jsonErr.Message)
        if jsonErr.Err != nil {
            fmt.Printf("Cause: %v\n", jsonErr.Err)
        }
    }
}
```

## Error Helper Functions

In addition to the error types above, the library provides two error-handling helper functions (see [Helper Utilities](./helpers#safeerror) for full details):

| Function | Signature | Description |
|----------|-----------|-------------|
| `SafeError` | `func SafeError(err error) string` | Returns a client-safe error message, omitting internal details such as path names (CWE-209) |
| `RedactedPath` | `func RedactedPath(path string) string` | Returns a redacted path (non-empty paths are masked as `"***"`) for use in logs and error responses |

## Configuration Presets

### Default Value Constants

```go
const (
    // Size limits
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxDepth        = 100                 // Default encoding/decoding nesting depth (Config.MaxDepth)
    DefaultMaxConcurrency  = 50

    // Security limits
    DefaultMaxSecuritySize   = 10 * 1024 * 1024  // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultMaxBatchSize      = 2000
    DefaultParallelThreshold = 10

    // Cache
    DefaultCacheTTL = 5 * time.Minute
)
```

## Configuration Preset Functions

### DefaultConfig

Signature: `func DefaultConfig() Config`

Returns the default configuration.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### SecurityConfig

Signature: `func SecurityConfig() Config`

Returns a security configuration suitable for processing untrusted input.

```go
// Recommended for:
// - Public APIs and web services
// - User-submitted data
// - External webhooks
// - Authentication endpoints
// - Financial data processing
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Security Configuration Features:**

- Full security scanning
- Strict mode
- Conservative limit values
- Caching enabled

### PrettyConfig

Signature: `func PrettyConfig() Config`

Returns a formatted output configuration.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## Merge Mode Constants

```go
// MergeMode is the merge mode type (exported from internal package)
type MergeMode = internal.MergeMode

const (
    // MergeUnion - Union merge (default)
    // Objects: merge all keys, conflicting values take the override value
    // Arrays: merge all elements and deduplicate
    MergeUnion = internal.MergeUnion

    // MergeIntersection - Intersection merge
    // Objects: only keep common keys
    // Arrays: only keep common elements
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - Difference merge
    // Objects: only keep keys present in base but not in override
    // Arrays: only keep elements present in base but not in override
    MergeDifference = internal.MergeDifference
)
```

## Path Segment Type

`PathSegment` is a path segment type exported from the `internal` package, used to represent parsed path components.

```go
type PathSegment = internal.PathSegment
```

::: warning Internal implementation alias
`PathSegment` is a type alias for `internal.PathSegment`. Its specific fields, field types (such as PathSegmentType, PathSegmentFlags) and methods belong to the `internal` package, are **not exported as public API**, and may change between versions — do not rely on its internal structure directly in your business code.

- When implementing custom path syntax, return `[]PathSegment` via the `ParsePath` method of the [`PathParser`](./interfaces#pathparser) interface.
- For precompiled paths, use [`Processor.CompilePath`](./processor/query#compilepath), which returns `*CompiledPath`.
:::

## Security Pattern Level

```go
type PatternLevel int

const (
    // PatternLevelCritical - Critical risk, always blocks operation
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - Warning level, blocks in strict mode
    PatternLevelWarning

    // PatternLevelInfo - Info level, only logs
    PatternLevelInfo
)
```

### DangerousPattern Structure

```go
type DangerousPattern struct {
    Pattern string       // Substring to detect in input
    Name    string       // Human-readable security risk description
    Level   PatternLevel // Handling level
}
```

## Error Handling Best Practices

### Use errors.Is to Check Types

```go
result, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrTypeMismatch) {
    return defaultValue
}
```

### Use errors.As to Get Details

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("Operation %s failed at path %s: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### Error Wrapping

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("getting config %s returned empty value", path)
}
```

## See Also

- [Error Handling](../advanced/error-handling) - Advanced error handling guide
- [Config](./config) - Configuration options
- [Security Overview](../security/) - Security best practices
