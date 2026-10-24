---
sidebar_label: "Security"
title: "Security - CyberGo html | Multi-layer Security API"
description: "CyberGo html security API: sanitization, MaxInputSize, MaxDepth, path traversal detection, AllowedBaseDir sandbox, HighSecurityConfig, and panic recovery."
sidebar_position: 50
---

# Security

The html library ships several independent security layers, all configured through the security fields of [Config](../core/config). This page lists the related API; see [Security Overview](../../guides/security/) for how the layers work.

## Security Configuration Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `EnableSanitization` | `bool` | `true` | Sanitization: removes dangerous tags, event attributes, and dangerous schemes |
| `MaxInputSize` | `int` | `52428800` (50MB) | Input size cap, prevents memory exhaustion |
| `MaxDepth` | `int` | `500` | DOM nesting cap, prevents recursion bombs |
| `ProcessingTimeout` | `time.Duration` | `30s` | Per-document processing timeout |
| `AllowedBaseDir` | `string` | `""` | Directory sandbox for file operations, prevents path traversal |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Audit configuration (see [Audit System](./audit)) |

:::warning Before you disable EnableSanitization
`EnableSanitization` is on by default. Disable it only for **fully trusted input**: the HTML is then parsed as-is, and dangerous tags and event attributes reach the output.
:::

## Content Sanitization

When enabled (the default) the following cleaning runs:

| Layer | Behavior |
|-------|----------|
| Dangerous tags | Removes `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, and similar |
| Event attributes | Removes every `on*` attribute (`onclick`, `onerror`, etc.) |
| Dangerous schemes | Blocks `javascript:`, `vbscript:`, and `file:`, including the protocol-relative `//` form |
| Data URLs | Allows only `data:image/*` (except `image/svg+xml`), `data:font/*`, and `data:application/pdf` |

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

Leaving it empty (the default) applies no restriction, which suits trusted input. When the target file exists but sits outside the directory, the returned `*FileError` has `FileErr` set to `path outside allowed directory`; like traversal, it matches no sentinel.

### Path Traversal Detection

A path that still contains a `..` component after cleaning counts as traversal and returns an error wrapped in `*FileError`:

```go
_, err := html.ExtractFromFile("../../../etc/passwd")
// err.Error() ≈ html: ReadFile "passwd": path traversal detected
```

Here `FileErr` is the raw error, e.g. `path traversal detected: ..\..\..\etc\passwd`, and it **matches no sentinel** — `errors.Is(err, html.ErrInvalidFilePath)` is `false`. To tell traversal apart, inspect the message in `FileError.FileErr`.

### FileError Path Sanitization

File errors sanitize paths automatically, so filesystem layout does not leak:

```go
type FileError struct {
	Op      string
	Path    string
	FileErr error
}

func (e *FileError) Error() string                // Filename plus a sanitized reason only
func (e *FileError) SafePath() string             // Filename only
func (e *FileError) MarshalJSON() ([]byte, error) // Sanitizes on JSON serialization
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

When the file is missing (`Path = "/var/www/secret/secret.html"`), the three methods return:

| Call | Result |
|------|--------|
| `Error()` | `html: ReadFile "secret.html": file not found` |
| `SafePath()` | `secret.html` |
| `MarshalJSON()` | `{"op":"ReadFile","path":"secret.html","message":"file not found"}` |

The full path stays in `Path` for internal debugging.

## Security Preset

### HighSecurityConfig

A preset for high-security environments: tighter limits plus full audit.

```go
func HighSecurityConfig() Config
```

Overrides relative to `DefaultConfig()`:

| Field | Default | High security |
|-------|---------|---------------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxDepth` | `500` | `100` |
| `ProcessingTimeout` | `30s` | `10s` |
| `WorkerPoolSize` | `4` | `2` |
| `MaxCacheEntries` | `2000` | `500` |
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
| `ErrInvalidFilePath` | Basic path validation fails, such as an empty path |
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
For the three error types and `errors.Is`/`errors.As` usage, see [Constants & Errors](../types/constants).
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
