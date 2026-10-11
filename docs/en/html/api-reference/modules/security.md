---
sidebar_label: "Security"
title: "Security - CyberGo html | Multi-layer Security API Reference"
description: "CyberGo html security API: sanitization, MaxInputSize, MaxDepth, path traversal protection, AllowedBaseDir sandbox, HighSecurityConfig, InputError types."
sidebar_position: 5
---

# Security

The HTML library has built-in multi-layer security protection. All configuration is centralized in the [Config](../core/config) security fields. This page covers security-related APIs; for a conceptual overview, see [Security Overview](../../guides/security/).

## Security Configuration Fields

| Field | Type | Default | Security Purpose |
|-------|------|---------|-----------------|
| `EnableSanitization` | `bool` | `true` | Content sanitization: removes dangerous tags, event attributes, and malicious protocols |
| `MaxInputSize` | `int` | `52428800` (50MB) | Input size limit, prevents memory exhaustion |
| `MaxDepth` | `int` | `500` | DOM nesting depth limit, prevents recursion bombs |
| `ProcessingTimeout` | `time.Duration` | `30s` | Per-document processing timeout, prevents infinite processing |
| `AllowedBaseDir` | `string` | `""` | File operation directory sandbox, prevents path traversal |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Security audit configuration (see [Audit System](./audit)) |

:::warning Risk of Disabling Sanitization
`EnableSanitization` is enabled by default. **Only disable for fully trusted input.** Disabling causes HTML to be parsed as-is, potentially leading to XSS risks.
:::

## Content Sanitization

When enabled (default), the following cleaning is applied automatically:

| Protection Layer | Behavior |
|-----------------|----------|
| Dangerous tags | Removes `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, etc. |
| Event attributes | Removes all `on*` attributes (`onclick`, `onerror`, etc.) |
| Dangerous protocols | Blocks `javascript:`, `vbscript:`, `file:` schemes (including dangerous protocols in protocol-relative `//` form) |
| Data URLs | Only allows `data:image/*` (except `image/svg+xml`), `data:font/*`, `data:application/pdf` |

Blocked content is recorded through the audit system (requires audit to be enabled).

## Path Security

### AllowedBaseDir Sandbox

Restricts file operations (`ExtractFromFile`, etc.) to a specified directory and its subdirectories:

```go
cfg := html.DefaultConfig()
cfg.AllowedBaseDir = "/var/www/html"

p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// ✅ Allowed: file inside directory
result, err := p.ExtractFromFile("/var/www/html/page.html")

// ❌ Rejected: file outside directory
_, err = p.ExtractFromFile("/etc/passwd")
```

Once set, file paths must be inside `AllowedBaseDir` to be readable. Cross-platform support:

- **Unix**: Resolves symbolic links (symlinks), preventing escape via links
- **Windows**: Resolves junctions and symbolic links

Empty (default) means no restriction — suitable for trusted input scenarios.

### Path Traversal Detection

Automatically detects and blocks path traversal attempts (e.g., `../../../etc/passwd`), returning a `*FileError`:

```go
_, err := html.ExtractFromFile("../../../etc/passwd")
// err contains "path traversal detected" information
```

### FileError.SafePath

File errors automatically sanitize path information to prevent filesystem structure leakage:

```go
type FileError struct {
    Op      string
    Path    string
    FileErr error
}

func (e *FileError) Error() string        // Outputs truncated path (filename only)
func (e *FileError) SafePath() string     // Returns filename only
func (e *FileError) MarshalJSON() ([]byte, error) // Automatically sanitizes on JSON serialization
```

```go
_, err := html.ExtractFromFile("/var/www/secret/config.html")
if err != nil {
    var fileErr *html.FileError
    if errors.As(err, &fileErr) {
        fmt.Println(fileErr.SafePath()) // Output: config.html (no path)
    }
}
```

:::tip
Both `FileError.Error()` and `SafePath()` return truncated safe paths (filename only), preventing path leakage. For internal debugging, access the `Path` field directly.
:::

## Security Preset

### HighSecurityConfig

A preset configuration for high-security environments, tightening all limits and enabling comprehensive audit:

```go
func HighSecurityConfig() Config
```

Security field overrides compared to `DefaultConfig()`:

| Field | Default | High Security |
|-------|---------|---------------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxDepth` | `500` | `100` |
| `ProcessingTimeout` | `30s` | `10s` |
| `WorkerPoolSize` | `4` | `2` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

```go
cfg := html.HighSecurityConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## Security-Related Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrInputTooLarge` | Input exceeds `MaxInputSize` |
| `ErrMaxDepthExceeded` | DOM depth exceeds `MaxDepth` |
| `ErrProcessingTimeout` | Processing exceeds `ProcessingTimeout` |
| `ErrInvalidFilePath` | File path validation failed (including path traversal) |
| `ErrInternalPanic` | Internal panic recovered |

### Structured Error Types

The sentinel errors above are actually returned wrapped in three structured error types carrying context fields for diagnosis:

| Type | Fields | Methods | `Unwrap()` target |
|------|--------|---------|------------------|
| `*InputError` | `Op` / `Size` / `MaxSize` / `InputErr` | `Error` | `Unwrap() []error`: `[InputErr, ErrInputTooLarge]` (or `[ErrInputTooLarge]` when `InputErr` is nil) |
| `*ConfigError` | `Field` / `Value` / `Message` | `Error` | `ErrInvalidConfig` |
| `*FileError` | `Op` / `Path` / `FileErr` | `Error` / `SafePath` / `MarshalJSON` | `ErrFileNotFound` / the original error / `ErrInvalidFilePath` |

Use `errors.Is(err, html.ErrXxx)` to check the sentinel category and `errors.As(err, &typedErr)` to retrieve the structured context (e.g. `InputError.Size`/`MaxSize`, `ConfigError.Field`).

:::info
For complete error type definitions (`InputError`, `ConfigError`, `FileError`) and `errors.Is`/`errors.As` usage, see [Constants & Errors](../types/constants).
:::

## Panic Recovery

All extraction operations have built-in panic recovery. Even if an unexpected panic occurs during processing, it returns `ErrInternalPanic` instead of crashing the service:

```go
result, err := html.Extract(maliciousData)
if err != nil {
    if errors.Is(err, html.ErrInternalPanic) {
        // Input may have triggered an internal bug
        log.Printf("panic recovered: %v", err)
    }
}
```

## Related Documentation

- [Security Overview](../../guides/security/) — Conceptual introduction and best practices
- [Audit System](./audit) — Audit pipeline, event types, and Sinks
- [Config](../core/config) — Complete Config field reference
- [Constants & Errors](../types/constants) — Sentinel errors and error types
- [Production Checklist](../../guides/security/production-checklist) — Pre-launch security checklist
