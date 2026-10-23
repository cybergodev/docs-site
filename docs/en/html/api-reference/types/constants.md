---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo html | Defaults & Error Types"
description: "CyberGo html constants and errors: MaxInputSize/CacheTTL defaults, audit event constants, sentinel errors, InputError/ConfigError/FileError for errors.Is/As."
sidebar_position: 30
---

# Constants & Errors

## Default Configuration Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `DefaultMaxInputSize` | `int` | `52428800` | Maximum input size (50MB) |
| `DefaultMaxCacheEntries` | `int` | `2000` | Maximum cache entries |
| `DefaultWorkerPoolSize` | `int` | `4` | Worker pool size |
| `DefaultCacheTTL` | `time.Duration` | `1h` | Cache expiration time |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | Cache cleanup interval |
| `DefaultMaxAuditEntries` | `int` | `10000` | Default in-memory audit entry limit (used when `AuditConfig.MaxEntries` is 0) |
| `DefaultMaxDepth` | `int` | `500` | Maximum DOM depth |
| `DefaultProcessingTimeout` | `time.Duration` | `30s` | Processing timeout |

## Audit Constants

### Audit Event Types

| Constant | Value | Description |
|----------|-------|-------------|
| `AuditEventBlockedTag` | `"blocked_tag"` | Blocked tag |
| `AuditEventBlockedAttr` | `"blocked_attr"` | Blocked attribute |
| `AuditEventBlockedURL` | `"blocked_url"` | Blocked URL |
| `AuditEventInputViolation` | `"input_violation"` | Input violation |
| `AuditEventDepthViolation` | `"depth_violation"` | Depth violation |
| `AuditEventTimeout` | `"timeout"` | Processing timeout |
| `AuditEventEncodingIssue` | `"encoding_issue"` | Encoding issue |
| `AuditEventPathTraversal` | `"path_traversal"` | Path traversal attempt |

### Audit Levels

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `AuditLevelInfo` | `AuditLevel` | `"info"` | Information level |
| `AuditLevelWarning` | `AuditLevel` | `"warning"` | Warning level |
| `AuditLevelCritical` | `AuditLevel` | `"critical"` | Critical level |

:::info
For detailed audit system usage and Sink types, see [Audit System](../modules/audit).
:::

## Sentinel Errors

| Error | Message | Description |
|-------|---------|-------------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | Input exceeds size limit |
| `ErrInvalidHTML` | `html: invalid HTML` | Invalid HTML content |
| `ErrProcessorClosed` | `html: processor closed` | Processor is closed |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | Maximum depth exceeded |
| `ErrInvalidConfig` | `html: invalid config` | Invalid configuration |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | Processing timeout |
| `ErrFileNotFound` | `html: file not found` | File not found |
| `ErrInvalidFilePath` | `html: invalid file path` | Invalid file path |
| `ErrInternalPanic` | `html: internal panic recovered` | Internal panic recovered |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | At most one Config |

## Error Types

### InputError

Input-related error carrying size information.

```go
type InputError struct {
    Op       string // Operation name
    Size     int    // Actual size
    MaxSize  int    // Maximum limit
    InputErr error  // Original error
}

func (e *InputError) Error() string
func (e *InputError) Unwrap() []error // [InputErr, ErrInputTooLarge] if InputErr is non-nil, otherwise [ErrInputTooLarge]
```

| Member | Type | Description |
|--------|------|-------------|
| `InputError.Op` | `string` | Name of the failed operation (e.g. `"Extract"`, `"ExtractFromFile"`) |
| `InputError.Size` | `int` | Actual input size |
| `InputError.MaxSize` | `int` | Configured size limit |
| `InputError.InputErr` | `error` | Underlying error (may be `nil`) |

| Method | Description |
|--------|-------------|
| `InputError.Error` | Formats the error message (including actual/limit sizes) |
| `InputError.Unwrap` | `[InputErr, ErrInputTooLarge]` when `InputErr` is non-nil, otherwise `[ErrInputTooLarge]` |

`Unwrap` returns a **slice of errors** rather than a single error: whether or not an underlying error is carried, `ErrInputTooLarge` is always in the list — `errors.Is(err, ErrInputTooLarge)` holds for any `*InputError`.

### ConfigError

Configuration validation error carrying field information.

```go
type ConfigError struct {
    Field   string // Field name
    Value   any    // Invalid value
    Message string // Error description
}

func (e *ConfigError) Error() string
func (e *ConfigError) Unwrap() error // → ErrInvalidConfig
```

| Member | Type | Description |
|--------|------|-------------|
| `ConfigError.Field` | `string` | Name of the invalid config field (e.g. `"MaxInputSize"`) |
| `ConfigError.Value` | `any` | The rejected field value |
| `ConfigError.Message` | `string` | Error description (e.g. `"must be positive"`) |

| Method | Description |
|--------|-------------|
| `ConfigError.Error` | Formats as `html: invalid config: field=value, description` |
| `ConfigError.Unwrap` | Returns `ErrInvalidConfig` |

### FileError

File operation error with automatic path truncation to prevent leakage.

```go
type FileError struct {
    Op      string // Operation name
    Path    string // File path
    FileErr error  // Original error
}

func (e *FileError) Error() string        // Safe output (truncated path)
func (e *FileError) SafePath() string     // Returns filename only
func (e *FileError) Unwrap() error        // → ErrFileNotFound | original error | ErrInvalidFilePath
func (e *FileError) MarshalJSON() ([]byte, error) // designed for HTTP API responses: truncates Path via SafePath() when serialized to clients, preventing filesystem path leakage
```

| Member | Type | Description |
|--------|------|-------------|
| `FileError.Op` | `string` | Name of the failed operation (e.g. `"ExtractFromFile"`, `"ReadFile"`) |
| `FileError.Path` | `string` | Full file path (internal debugging only; do not output directly) |
| `FileError.FileErr` | `error` | Underlying filesystem error |

| Method | Description |
|--------|-------------|
| `FileError.Error` | Safe output (path truncated to the filename; the underlying error message is sanitized as well) |
| `FileError.SafePath` | Returns the filename only (returned as-is when there is no separator) |
| `FileError.Unwrap` | → `ErrFileNotFound` \| the original error \| `ErrInvalidFilePath` |
| `FileError.MarshalJSON` | Serializes as `{op, path, message}` with `path` truncated via `SafePath()`, preventing filesystem path leakage |

:::tip Safe Paths
Both `FileError.Error()` and `SafePath()` return truncated paths (filename only) to prevent path leakage. Access the `Path` field directly for internal debugging when the full path is needed.
:::

## Internal Limit Constants

The following constants define the library's runtime hard limits. They are **unexported** (lowercase) and cannot be referenced directly, but they affect runtime behavior — understanding these values helps you reason about the library's boundary conditions and error scenarios.

### Configuration Upper Bounds

| Constant | Value | Description |
|----------|-------|-------------|
| `maxConfigInputSize` | `52428800` (50MB) | Upper bound for `MaxInputSize`; even if a larger value is set, `Validate()` rejects it |
| `maxConfigWorkerSize` | `256` | Upper bound for `WorkerPoolSize` |
| `maxConfigDepth` | `500` | Upper bound for `MaxDepth` |
| `maxConfigCacheEntries` | `100000` | Upper bound for `MaxCacheEntries` (~100MB, estimated at 1KB per entry) |
| `maxConfigAuditEntries` | `100000` | Upper bound for `Audit.MaxEntries` (maximum entries retained in memory by `GetAuditLog`) |

### Processing Limits

| Constant | Value | Description |
|----------|-------|-------------|
| `maxBatchSize` | `10000` | Maximum items per batch; exceeding this fails the entire batch (not a panic) |
| `maxTimeoutGoroutines` | `1000` | Global concurrent timeout goroutine limit; exceeding it causes new requests to immediately return `ErrProcessingTimeout` |
| `maxHTMLForRegex` | `1000000` (1MB) | Upper bound on HTML size for media-URL regex scanning; above this the regex fallback is skipped (ReDoS prevention) |
| `maxRegexMatches` | `1000` | Maximum matches per regex scan; prevents excessive allocations on media-dense pages |

### Cache Key Generation

| Constant | Value | Description |
|----------|-------|-------------|
| `maxCacheKeySize` | `65536` (64KB) | Content size threshold for full hashing; above this, switches to 5-point sampling |
| `cacheKeySample` | `4096` | Total byte budget for large-document sampling (5 points x ~819 bytes/point) |

:::tip
These constants explain some "whys": why HTML over 1MB stops extracting bare video links (ReDoS protection), why batches over 10000 items fail entirely (OOM protection), and why 64KB is the cache-key strategy boundary (hash cost vs collision risk).
:::

## Error Handling Patterns

```go
result, err := html.Extract(data)
if err != nil {
    var inputErr *html.InputError
    var configErr *html.ConfigError
    var fileErr *html.FileError

    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // Input too large
    case errors.Is(err, html.ErrInvalidHTML):
        // Invalid HTML
    case errors.Is(err, html.ErrFileNotFound):
        // File not found
    case errors.As(err, &inputErr):
        fmt.Printf("Size %d exceeds limit %d\n", inputErr.Size, inputErr.MaxSize)
    case errors.As(err, &configErr):
        fmt.Printf("Config field %s invalid: %s\n", configErr.Field, configErr.Message)
    case errors.As(err, &fileErr):
        fmt.Printf("File: %s\n", fileErr.SafePath())
    }
}
```
