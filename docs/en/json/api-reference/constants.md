---
sidebar_label: "Constants and Errors"
title: "Constants and Errors - CyberGo JSON | Error Vars & Defaults"
description: "CyberGo JSON error sentinels: ErrPathNotFound, ErrTypeMismatch and their trigger scenarios, the JsonsError type, plus DefaultConfig constants."
sidebar_position: 80
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
    ErrDuplicateKey      = errors.New("duplicate object key")
    ErrUnsupportedPath   = errors.New("unsupported path operation") // Deprecated: not returned by any operation today, reserved

    // Resource and performance errors (both Deprecated: not returned by any operation today, kept for future use)
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### Trigger Scenarios at a Glance

Typical trigger scenarios for each sentinel error; use the table when writing recovery logic per error branch:

| Error | Typical trigger | Suggested handling |
|-------|-----------------|--------------------|
| `ErrInvalidJSON` | Input is not valid JSON (trailing characters, unclosed brackets, etc.) | Reject the input; check the source |
| `ErrPathNotFound` | The path of a `Get` does not exist; a missing object key and an out-of-range array index both return this sentinel. Typed getters (`GetString`, `GetInt`, and so on) return no error and fall back to the zero value or default | Use a typed getter or `SafeGet` for defaults; do not fall back through the `err` branch of `Get` |
| `ErrTypeMismatch` | `SafeGet(...).AsString()` on a non-string value; `GetCompiled` hitting a type mismatch mid-navigation; `EncodeFields` given a non-object; `ForeachFileChunked` on a root that is not an array. The other `As*` methods (`AsInt`/`AsFloat64`/`AsBool`) return a plain error, not this sentinel; `[0]` on a string path via `Get` and `Set` over a scalar also do not match it. `GetTyped[T]` builds a `JsonsError` wrapping this sentinel internally when the fallback conversion fails, but the function only returns the value, so callers never see the error | Check your data-structure assumptions; use `errors.Is` only for the observable cases listed |
| `ErrInvalidPath` | Path syntax validation fails, or validation is on (`SkipValidation` false) and the path string exceeds 5000 bytes. A `CompilePath` parse failure returns a plain error (message such as `path too deep`), not this sentinel | Fix the path expression |
| `ErrProcessorClosed` | Methods called after `Close()` (or while closing) | Check the lifecycle; pre-check with `IsClosed` |
| `ErrSizeLimit` | Input exceeds `MaxJSONSize`; `ProcessBatch` operation count exceeds `MaxBatchSize`; object key count exceeds `MaxObjectKeys` or array element count exceeds `MaxArrayElements` | Raise the limit or reject oversized input |
| `ErrDepthLimit` | Nesting exceeds `MaxNestingDepthSecurity` | Reject deeply nested input (possibly an attack) |
| `ErrConcurrencyLimit` | Controlled-operation concurrency exceeds `MaxConcurrency` | Reduce concurrency or raise the limit |
| `ErrSecurityViolation` | Dangerous pattern hit (e.g. `__proto__`, `<script`) | Write an audit log and reject |
| `ErrDuplicateKey` | Duplicate keys present in an input object while `Config.DetectDuplicateKeys` is enabled | Reject the input (when off by default, the last duplicate key wins, consistent with `encoding/json`) |
| `ErrUnsupportedPath` | Reserved, no operation currently returns it (deprecated; unsupported segments surface as `ErrInvalidPath` or `ErrTypeMismatch`) | No handling needed in error branches |
| `ErrOperationTimeout` | Reserved, no operation currently returns it (deprecated) | No handling needed in error branches |
| `ErrResourceExhausted` | Reserved, no operation currently returns it (deprecated) | No handling needed in error branches |

:::tip Three deprecated sentinels
No operation currently returns `ErrOperationTimeout`, `ErrResourceExhausted`, or `ErrUnsupportedPath`; they are kept for future releases only — no need to handle them in error branches.
:::

### Error Checking

The error branch of `Get` commonly covers a missing path and malformed JSON; a type mismatch is not among the sentinels `Get` returns, so branch on type with a conversion method of `SafeGet` (see the `ErrTypeMismatch` row above):

```go
_, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Path does not exist (including an out-of-range array index)
        fmt.Println("Path not found")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // Malformed JSON
        fmt.Println("Invalid JSON")
    }
}

// AsString wraps ErrTypeMismatch for non-string values
if _, err := json.SafeGet(data, "user.age").AsString(); errors.Is(err, json.ErrTypeMismatch) {
    fmt.Println("Type mismatch")
}
```

## The JsonsError Type

### Struct Definition

```go
type JsonsError struct {
    Op      string `json:"op"`      // Operation name
    Path    string `json:"path"`    // Path where the error occurred
    Message string `json:"message"` // Human-readable error message
    Err     error  `json:"err"`     // Underlying error
}
```

**Field Reference**

| Field | Type | Description |
|-------|------|-------------|
| `Op` | `string` | Name of the operation that failed |
| `Path` | `string` | JSON path where the error occurred |
| `Message` | `string` | Human-readable error message |
| `Err` | `error` | Underlying error (may be `nil`); `Unwrap` supports `errors.Is` / `errors.As` chain traversal |

### Methods

```go
func (e *JsonsError) Error() string   // "JSON <op> failed at path '<path>': <msg> (caused by: ...)"
func (e *JsonsError) Unwrap() error   // Returns the underlying error (supports errors.As/Is chains)
func (e *JsonsError) Is(target error) bool
```

Matching rules of `Is`:

- When the target is a `*JsonsError`, the three fields `Op`, `Path`, and `Err` are compared field by field (`Message` is derived information and **deliberately excluded** from comparison)
- When the target is another error (e.g. a sentinel), it degrades to `errors.Is` on the underlying `Err` — so `errors.Is(err, json.ErrPathNotFound)` still holds for a wrapped `JsonsError`

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

Beyond the error types above, the library provides two error-handling helpers (full description in [Helper Functions](./helpers#safeerror)):

| Function | Signature | Description |
|----------|-----------|-------------|
| `SafeError` | `func SafeError(err error) string` | Returns a client-safe error message, omitting internal details such as path names (CWE-209) |
| `RedactedPath` | `func RedactedPath(path string) string` | Returns a redacted path (non-empty paths masked as `"***"`), for logs and error responses |

## Configuration Presets

### Default Value Constants

```go
const (
    // Size limits
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxDepth        = 100                 // Default encode/decode nesting depth (Config.MaxDepth)
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

### Constants vs Config Fields

| Constant | Default | Config field | Description |
|----------|---------|--------------|-------------|
| `DefaultMaxJSONSize` | 100MB | `MaxJSONSize` | Size cap for a single JSON input |
| `DefaultMaxNestingDepth` | 200 | `MaxNestingDepthSecurity` | JSON nesting depth cap |
| `DefaultMaxPathDepth` | 50 | `MaxPathDepth` | Default of a reserved field; does not change behavior today (only feeds the config cache key and the `Validate` clamp 10–200) |
| `DefaultMaxDepth` | 100 | `MaxDepth` | Default nesting depth for encode/decode (Marshal/Unmarshal) |
| `DefaultMaxConcurrency` | 50 | `MaxConcurrency` | Cap on concurrent operations |
| `DefaultMaxSecuritySize` | 10MB | `MaxSecurityValidationSize` | Default of a reserved field; does not change behavior today (only feeds the config cache key and the `Validate` clamp 1MB–100MB) |
| `DefaultMaxObjectKeys` | 100000 | `MaxObjectKeys` | Object key count cap |
| `DefaultMaxArrayElements` | 100000 | `MaxArrayElements` | Array element count cap |
| `DefaultMaxBatchSize` | 2000 | `MaxBatchSize` | Cap on operations per `ProcessBatch` / `SetMultiple` call; exceeding it returns `ErrSizeLimit` |
| `DefaultParallelThreshold` | 10 | `ParallelThreshold` | Parallel processing threshold: below this operation count, processing is sequential |
| `DefaultCacheTTL` | 5 minutes | `CacheTTL` | Cache entry lifetime |

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

Returns the security configuration, suitable for handling untrusted input.

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

**Security configuration characteristics**:

- `FullSecurityScan` set to `true`, so every input gets a single full scan
- Conservative limits: `MaxJSONSize` 10MB, `MaxNestingDepthSecurity` 30, `MaxObjectKeys`/`MaxArrayElements` 5000
- Cache enabled with `MaxCacheSize` 256 and `CacheTTL` 3 minutes
- `StrictMode` and `EnableValidation` are also set to `true`, but both are deprecated and not read, so they have no effect

### PrettyConfig

Signature: `func PrettyConfig() Config`

Returns the pretty-print configuration.

```go
result, err := json.Encode(data, json.PrettyConfig())
```

## Merge Mode Constants

```go
// MergeMode is the merge mode type (exported from the internal package)
type MergeMode = internal.MergeMode

const (
    // MergeUnion - union merge (default)
    // Objects: merge all keys; conflicting values take the overriding value
    // Arrays: merge all elements and deduplicate
    MergeUnion = internal.MergeUnion

    // MergeIntersection - intersection merge
    // Objects: keep only shared keys
    // Arrays: keep only shared elements
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - difference merge
    // Objects: keep only keys present in the base but absent from the override
    // Arrays: keep only elements present in the base but absent from the override
    MergeDifference = internal.MergeDifference
)
```

## The PathSegment Type

`PathSegment` is the path-segment type exported from the `internal` package, representing the components of a parsed path.

```go
type PathSegment = internal.PathSegment
```

::: warning An alias over an internal type
`PathSegment` is a type alias of `internal.PathSegment`. Its fields, field types (PathSegmentType, PathSegmentFlags), and methods belong to the `internal` package, are **not exported as public API**, and may change between versions — do not depend on its internals in business code.

- When implementing custom path syntax, return `[]PathSegment` from the `ParsePath` method of the [`PathParser`](./interfaces#pathparser) interface.
- For pre-compiled paths, use [`Processor.CompilePath`](./processor/query#compilepath), which returns `*CompiledPath`.
:::

## Security Pattern Levels

```go
type PatternLevel int

const (
    // PatternLevelCritical - critical risk, always blocks the operation
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - warning level, blocked in strict mode
    PatternLevelWarning

    // PatternLevelInfo - informational level, logged only
    PatternLevelInfo
)
```

### The DangerousPattern Struct

```go
type DangerousPattern struct {
    Pattern string       // Substring to detect
    Name    string       // Human-readable description of the security risk
    Level   PatternLevel // Handling level
}
```

## Error-Handling Best Practices

### Check types with errors.Is

Branch on the sentinels a `Get` failure can carry; the full list is in [Trigger Scenarios at a Glance](#trigger-scenarios-at-a-glance):

```go
_, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrInvalidPath) {
    return defaultValue
}
```

For a type mismatch, go through a conversion method of `SafeGet`: only `AsString` wraps `ErrTypeMismatch`, the other `As*` methods return a plain error. See [Error Checking](#error-checking) for the complete example.

### Get details with errors.As

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("Operation %s failed at path %s: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### Error wrapping

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("getting config %s returned an empty value", path)
}
```

## See Also

- [Error Handling](../advanced/error-handling) - Advanced error-handling guide
- [Config](./config) - Configuration options
- [Security Overview](../security/) - Security best practices
