---
sidebar_label: "Security"
title: "Security - CyberGo html | Multi-layer Security API"
description: "CyberGo html security API: content cleaning, MaxInputSize and MaxDepth limits, path traversal, AllowedBaseDir sandbox, HighSecurityConfig, panic recovery."
sidebar_position: 50
---

# Security

The html library ships multiple layers of security, all configured through the security fields of [Config](../core/config). This page collects the API behind those fields; for how the layers work see [Security Overview](../../guides/security/).

## Security Configuration Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `EnableSanitization` | `bool` | `true` | Content cleaning: removes dangerous tags, event attributes, and dangerous schemes |
| `MaxInputSize` | `int` | `52428800` (50 MB) | Input size cap, prevents memory exhaustion |
| `MaxDepth` | `int` | `500` | DOM nesting cap, prevents recursion bombs |
| `ProcessingTimeout` | `time.Duration` | `30s` | Per-document processing timeout |
| `AllowedBaseDir` | `string` | `""` | Directory sandbox for file operations, prevents path traversal |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Audit configuration (see [Audit System](./audit)) |

:::warning The precondition for disabling EnableSanitization
`EnableSanitization` is on by default. Disable it only for **fully trusted input**: the HTML is then parsed as-is, and dangerous tags and event attributes reach the output.
:::

## Content Cleaning

When enabled (the default) the following cleaning runs:

| Layer | Behavior |
|-------|----------|
| Dangerous tags | Removes ten tags outright: `<script>`, `<style>`, `<noscript>`, `<iframe>`, `<embed>`, `<object>`, `<input>`, `<button>`, `<svg>`, `<math>`; the `<form>` container itself is kept (server-side frameworks often wrap the whole page in a form). Reader mode (`ReadPage`) instead keeps the button's text label and removes only the `<button>` element |
| Event attributes | Removes every `on*` attribute (`onclick`, `onerror`, etc.), plus `formaction` and `autofocus` |
| Dangerous schemes | Blocks `javascript:`, `vbscript:`, and `file:`, including the protocol-relative `//` form (`//data:` is blocked too) |
| style attribute | When the value contains `expression(`, `javascript:`, or `vbscript:`, or declares `behavior` / `-moz-binding`, the entire `style` attribute is removed (an empty `style=""` is kept as safe); details in [Security Overview](../../guides/security/#dangerous-css-patterns) |
| Data URLs | Only explicit MIME types in the whitelist: images (excluding `image/svg+xml`), fonts, and `application/pdf`; the full list is in [Security Overview](../../guides/security/#data-url-whitelist) |

Blocked content is recorded through the audit system (audit must be enabled).

## Path Security

### AllowedBaseDir Sandbox

Restricts file operations (`ExtractFromFile` and friends) to a directory and its subdirectories:

```go
cfg := html.DefaultConfig()
cfg.AllowedBaseDir = "/var/www/html"

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

// ✅ Allowed: a file inside the directory
_, err = p.ExtractFromFile("/var/www/html/page.html")

// ❌ Rejected: a file outside the directory
_, err = p.ExtractFromFile("/etc/passwd")
```

Once set, only paths inside `AllowedBaseDir` can be read. Platform behavior:

- **Unix**: symbolic links are resolved, so a link cannot escape the sandbox
- **Windows**: junctions and symbolic links are resolved

Leaving it empty (the default) applies no restriction, which suits trusted input. When the target file exists but sits outside the directory, the returned `*FileError` has `FileErr` set to `path outside allowed directory`; this is the only file-error type that **matches no sentinel**, so inspect the message in `FileErr`.

### Path Traversal Detection

A path that still contains a `..` component after cleaning counts as path traversal and returns an error wrapped in a `*FileError`:

```go
_, err := html.ExtractFromFile("../../../etc/passwd")
// err.Error() ≈ html: ReadFile "passwd": path traversal detected
```

In that case `FileErr` has the form `path traversal detected: <cleanPath>: html: invalid file path` (on Windows the path looks like `..\..\..\etc\passwd`), and it **wraps `ErrInvalidFilePath`**, so `errors.Is(err, html.ErrInvalidFilePath)` is `true` and you can decide by sentinel directly.

### FileError Path Redaction

File errors are redacted automatically, so the filesystem layout does not leak:

```go
type FileError struct {
	Op      string
	Path    string
	FileErr error
}

func (e *FileError) Error() string                // Filename plus a redacted reason only
func (e *FileError) SafePath() string             // Filename only
func (e *FileError) MarshalJSON() ([]byte, error) // Redacts automatically on JSON serialization
```

```go
_, err := html.ExtractFromFile("/var/www/secret/secret.html")
if err != nil {
	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Println(fileErr.SafePath()) // Output: secret.html
	}
}
```

When the file is missing in the example above (`Path = "/var/www/secret/secret.html"`), the three methods return:

| Call | Result |
|------|--------|
| `Error()` | `html: ReadFile "secret.html": file not found` |
| `SafePath()` | `secret.html` |
| `MarshalJSON()` | `{"op":"ReadFile","path":"secret.html","message":"file not found"}` |

The full path stays in `Path` for internal debugging.

## Security Preset

### HighSecurityConfig

`HighSecurityConfig` is a preset for high-security environments, tightening every limit and enabling full audit:

```go
func HighSecurityConfig() Config
```

Overrides relative to `DefaultConfig()`:

| Field | Default | High security |
|-------|---------|---------------|
| `MaxInputSize` | `52428800` (50 MB) | `10485760` (10 MB) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

The preset already sets `Audit`; do not assign it again.

```go
cfg := html.HighSecurityConfig()
p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

## Security Errors

| Error | Trigger |
|-------|---------|
| `ErrInputTooLarge` | Input exceeds `MaxInputSize` |
| `ErrMaxDepthExceeded` | DOM depth exceeds `MaxDepth` (when the parser has not rejected it first) |
| `ErrProcessingTimeout` | The library's own `ProcessingTimeout` fires |
| `ErrInvalidFilePath` | Basic path validation fails, such as an empty path; path traversal denials wrap it too (so `errors.Is` matches) |
| `ErrInternalPanic` | An internal panic was recovered |

:::info User context deadlines are not normalized
When the deadline on `ExtractWithContext` fires before the library's `ProcessingTimeout`, you get `context.DeadlineExceeded` unchanged, not `ErrProcessingTimeout`. An explicit `cancel()` returns `context.Canceled`.
:::

### Structured Error Types

The sentinel errors above travel wrapped in three structured types that carry diagnostic context:

| Type | Fields | Methods | `Unwrap()` target |
|------|--------|---------|-------------------|
| `*InputError` | `Op` / `Size` / `MaxSize` / `InputErr` | `Error` | `[]error{InputErr, ErrInputTooLarge}` (only the latter when `InputErr` is nil) |
| `*ConfigError` | `Field` / `Value` / `Message` | `Error` | `ErrInvalidConfig` |
| `*FileError` | `Op` / `Path` / `FileErr` | `Error` / `SafePath` / `MarshalJSON` | `ErrFileNotFound` when `FileErr` is that sentinel, otherwise `FileErr`; `ErrInvalidFilePath` when both are nil |

Use `errors.Is(err, html.ErrXxx)` for the sentinel category and `errors.As(err, &typedErr)` for the structured context (`InputError.Size`/`MaxSize`, `ConfigError.Field`).

:::info Full error type definitions
For the definitions of the three error types and `errors.Is`/`errors.As` usage, see [Constants & Errors](../types/constants).
:::

## Panic Recovery

Every extraction operation recovers panics: an unexpected panic during processing returns `ErrInternalPanic` instead of crashing the process.

```go
_, err := html.Extract(maliciousData)
if err != nil {
	if errors.Is(err, html.ErrInternalPanic) {
		// The input may have triggered an internal bug
		log.Printf("panic recovered: %v", err)
	}
}
```

## Related Documentation

- [Security Overview](../../guides/security/) — Security concepts and best practices
- [Audit System](./audit) — Audit pipeline, event types, and sinks
- [Config](../core/config) — Complete Config field reference
- [Constants & Errors](../types/constants) — Sentinel errors and error types
- [Production Checklist](../../guides/security/production-checklist) — Pre-launch security checks
