---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo html | Defaults & Error Types"
description: "CyberGo html constants and error types: default value constants, sentinel errors, plus InputError, ConfigError, FileError structured errors for errors.Is/As."
sidebar_position: 3
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
func (e *InputError) Unwrap() error // → InputErr (if non-nil) or ErrInputTooLarge
```

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
func (e *FileError) MarshalJSON() ([]byte, error) // also truncates the path during JSON marshalling (prevents leakage via API responses)
```

:::tip Safe Paths
Both `FileError.Error()` and `SafePath()` return truncated paths (filename only) to prevent path leakage. Access the `Path` field directly for internal debugging when the full path is needed.
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
