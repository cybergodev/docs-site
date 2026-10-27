---
sidebar_label: "Constants & Errors"
title: "Constants & Errors - CyberGo html | Defaults & Error Types"
description: "CyberGo html constants and errors: default constants, format constants, 8 audit events, 3 audit levels, 12 sentinel errors, and the InputError, ConfigError, FileError types."
sidebar_position: 30
---

# Constants & Errors

This page collects the exported constants of CyberGo html (default configuration, format values, audit events and levels), the 12 sentinel errors, and the three structured error types, together with the `errors.Is`/`errors.As` decision patterns.

## Default Configuration Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `DefaultMaxInputSize` | `int` | `52428800` | Maximum input size (50 MB) |
| `DefaultMaxCacheEntries` | `int` | `2000` | Cache entry limit |
| `DefaultWorkerPoolSize` | `int` | `4` | Concurrent worker goroutines for batch extraction |
| `DefaultCacheTTL` | `time.Duration` | `1h` | Cache entry lifetime |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | Background sweep interval for expired cache entries |
| `DefaultMaxAuditEntries` | `int` | `10000` | In-memory audit entry limit (used when `AuditConfig.MaxEntries` is 0) |
| `DefaultMaxRawValueLength` | `int` | `200` | Maximum length of the audit `RawValue` string |
| `DefaultMaxDepth` | `int` | `500` | Maximum HTML nesting depth (stack-overflow guard) |
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

For audit usage and Sink types see [Audit System](../modules/audit).

## Format Constants

Value constants for the `InlineImageFormat`, `InlineLinkFormat`, and `TableFormat` fields; assign them instead of magic strings (e.g. `cfg.InlineImageFormat = html.FormatMarkdown`):

| Constant | Value | Applicable fields | Description |
|----------|-------|-------------------|-------------|
| `FormatNone` | `"none"` | `InlineImageFormat` / `InlineLinkFormat` | Not inlined into `Text`; not valid for `TableFormat` |
| `FormatMarkdown` | `"markdown"` | `InlineImageFormat` / `InlineLinkFormat` / `TableFormat` | Inlines with Markdown syntax; the `MarkdownConfig()` preset assigns this constant internally |
| `FormatHTML` | `"html"` | `InlineImageFormat` / `InlineLinkFormat` / `TableFormat` | Keeps inline HTML tags |
| `FormatPlaceholder` | `"placeholder"` | `InlineImageFormat` only | Emits an `[IMAGE:N]` positional placeholder |

`InlineImageFormat` / `InlineLinkFormat` default to `FormatNone` and `TableFormat` defaults to `FormatMarkdown`; validation is case-insensitive, ignores leading and trailing whitespace, and treats an empty string as the field default — the full option lists per field are in [Config](../core/config#output-formats). Reader mode (`ReadPage*`) always preserves links and treats `InlineLinkFormat`'s `FormatNone` as `FormatMarkdown`; see [Reader Mode](../core/reader#key-semantics).

## Sentinel Errors

| Error | Message | Description |
|-------|---------|-------------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | Input exceeds the size limit |
| `ErrInvalidHTML` | `html: invalid HTML` | Invalid HTML content |
| `ErrProcessorClosed` | `html: processor closed` | Processor is closed |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | Maximum depth exceeded |
| `ErrInvalidConfig` | `html: invalid config` | Invalid configuration |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | The library's processing timeout elapsed |
| `ErrFileNotFound` | `html: file not found` | File not found |
| `ErrInvalidFilePath` | `html: invalid file path` | Invalid file path |
| `ErrInternalPanic` | `html: internal panic recovered` | Internal panic recovered (a library defect; report it to the maintainers) |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | More than one Config passed |
| `ErrBatchTooLarge` | `html: batch size exceeds maximum` | Batch item count exceeds the per-batch limit (10000) |
| `ErrTooManyConcurrentOps` | `html: too many concurrent operations` | Timeout watchdog reached its process-wide limit (1000); no timeout occurred |

When the user's context deadline expires, the call returns `context.DeadlineExceeded`, which is not normalized to `ErrProcessingTimeout`.

## Error Types

### InputError

`InputError` is the error type for input problems, carrying size information.

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
| `InputError.Error` | Formats the message, including actual and limit sizes |
| `InputError.Unwrap` | `[InputErr, ErrInputTooLarge]` when `InputErr` is non-nil, otherwise `[ErrInputTooLarge]` |

`Unwrap` returns a **slice of errors**, not a single error. `ErrInputTooLarge` is always in the list, whether or not an underlying error is carried, so `errors.Is(err, ErrInputTooLarge)` holds for any `*InputError`.

### ConfigError

`ConfigError` is the error type for configuration validation, carrying field information.

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

`FileError` is the error type for file operations; it truncates paths on output.

```go
type FileError struct {
	Op      string // Operation name
	Path    string // File path
	FileErr error  // Original error
}

func (e *FileError) Error() string                // Safe output (truncated path)
func (e *FileError) SafePath() string             // Filename only
func (e *FileError) Unwrap() error                // → ErrFileNotFound | original error (including path traversal denials wrapping ErrInvalidFilePath) | ErrInvalidFilePath
func (e *FileError) MarshalJSON() ([]byte, error) // Truncates Path via SafePath() when serialized
```

| Member | Type | Description |
|--------|------|-------------|
| `FileError.Op` | `string` | Name of the failed operation (e.g. `"ExtractFromFile"`, `"ReadFile"`) |
| `FileError.Path` | `string` | Full file path (debugging only; do not output directly) |
| `FileError.FileErr` | `error` | Underlying filesystem error |

| Method | Description |
|--------|-------------|
| `FileError.Error` | Safe output (path truncated to the filename; the underlying message is redacted too) |
| `FileError.SafePath` | Returns the filename only (returned as-is when there is no separator) |
| `FileError.Unwrap` | → `ErrFileNotFound` \| the original error \| `ErrInvalidFilePath` (path traversal denials wrap `ErrInvalidFilePath`, so `errors.Is` matches) |
| `FileError.MarshalJSON` | Serializes as `{op, path, message}` with `path` truncated via `SafePath()` |

:::tip A safe default when emitting paths
`FileError.Error()` and `SafePath()` both return only the filename, so they are safe to put in HTTP responses or logs. Read the `Path` field for the full path, and only for internal debugging.
:::

:::info Which file error matches no sentinel
Path traversal (a `..` component that survives cleaning) returns a `*FileError` wrapping `ErrInvalidFilePath`, so `errors.Is(err, ErrInvalidFilePath)` is `true`. The single exception is an `AllowedBaseDir` sandbox escape: `FileErr` is `path outside allowed directory`, which **matches no sentinel error**, so inspect the message in `FileError.FileErr`.
:::

## Internal Limit Constants

The constants below define runtime hard limits. They are **unexported** (lowercase) and cannot be referenced directly, but they determine boundary behavior.

### Configuration Upper Bounds

| Constant | Value | Description |
|----------|-------|-------------|
| `maxConfigInputSize` | `52428800` (50 MB) | Upper bound for `MaxInputSize`; larger values are rejected by `Validate()` |
| `maxConfigWorkerSize` | `256` | Upper bound for `WorkerPoolSize` |
| `maxConfigDepth` | `500` | Upper bound for `MaxDepth` |
| `maxConfigCacheEntries` | `100000` | Upper bound for `MaxCacheEntries` (about 100 MB at 1 KB per entry) |
| `maxConfigAuditEntries` | `100000` | Upper bound for `Audit.MaxEntries`; the in-memory limit of `GetAuditLog` |

### Processing Limits

| Constant | Value | Description |
|----------|-------|-------------|
| `maxBatchSize` | `10000` | Maximum items per batch; exceeding it fails the whole batch |
| `maxTimeoutGoroutines` | `1000` | Process-wide limit on concurrent timeout goroutines; new requests beyond it return `ErrTooManyConcurrentOps` |
| `maxHTMLForRegex` | `1000000` (1 MB) | Size limit for the raw-HTML media scan; above it the whole scan is skipped (ReDoS prevention) |
| `maxRegexMatches` | `1000` | Maximum media-URL matches per scan; prevents excessive allocation on media-dense pages |

How these limits play out:

- For HTML over 1 MB, the raw-HTML scan (`<iframe>`/`<embed>`/`<object>` tag attributes and bare media URLs) does not run; the DOM walk still extracts `<video>`/`<audio>`.
- A batch over 10000 items fails as a whole (returning `ErrBatchTooLarge`, not a panic); it does not process the first 10000 only.
- When more than 1000 timed calls are running concurrently within the process, new calls return `ErrTooManyConcurrentOps` immediately; retry after in-flight operations drain.

## Error Handling Patterns

```go
result, err := html.Extract(data)
if err != nil {
	var inputErr *html.InputError
	var configErr *html.ConfigError
	var fileErr *html.FileError

	switch {
	case errors.Is(err, html.ErrInvalidConfig):
		// Config error: errors.As yields the offending field and reason
		if errors.As(err, &configErr) {
			fmt.Printf("Config field %s invalid: %s\n", configErr.Field, configErr.Message)
		}
	case errors.Is(err, html.ErrInputTooLarge):
		// Input too large: errors.As yields the actual size and limit
		if errors.As(err, &inputErr) {
			fmt.Printf("Size %d exceeds limit %d\n", inputErr.Size, inputErr.MaxSize)
		}
	case errors.Is(err, html.ErrInvalidHTML):
		// Invalid HTML
	case errors.Is(err, html.ErrFileNotFound):
		// File not found
	case errors.Is(err, html.ErrInvalidFilePath):
		// Invalid path; path traversal denials match this sentinel too
	case errors.As(err, &fileErr):
		// Other file errors (e.g. an AllowedBaseDir escape, which matches no sentinel)
		fmt.Println("File:", fileErr.SafePath())
	}
}
```
