---
sidebar_label: "Config"
title: "Config - CyberGo html | Config Field Reference"
description: "CyberGo html Config reference: 30 fields grouped by resource, security, extraction, output, and links, plus four presets, zero-value rules, and Validate."
sidebar_position: 30
---

# Configuration

## Config Struct

`Config` is the unified configuration struct for the HTML library, covering resource management, security, content extraction, output formats, and link filtering. It has 30 fields:

| Field | Type | Group | Default |
|-------|------|-------|---------|
| `Config.MaxInputSize` | `int` | Resource management | `52428800` (50MB) |
| `Config.MaxCacheEntries` | `int` | Resource management | `2000` |
| `Config.CacheTTL` | `time.Duration` | Resource management | `1h` |
| `Config.CacheCleanup` | `time.Duration` | Resource management | `5m` |
| `Config.WorkerPoolSize` | `int` | Resource management | `4` |
| `Config.ProcessingTimeout` | `time.Duration` | Resource management | `30s` |
| `Config.EnableSanitization` | `bool` | Security | `true` |
| `Config.MaxDepth` | `int` | Security | `500` |
| `Config.AllowedBaseDir` | `string` | Security | `""` |
| `Config.Audit` | `AuditConfig` | Security | `DefaultAuditConfig()` |
| `Config.ExtractArticle` | `bool` | Content extraction | `true` |
| `Config.PreserveImages` | `bool` | Content extraction | `true` |
| `Config.PreserveLinks` | `bool` | Content extraction | `true` |
| `Config.PreserveVideos` | `bool` | Content extraction | `true` |
| `Config.PreserveAudios` | `bool` | Content extraction | `true` |
| `Config.InlineImageFormat` | `string` | Output format | `none` |
| `Config.InlineLinkFormat` | `string` | Output format | `none` |
| `Config.TableFormat` | `string` | Output format | `markdown` |
| `Config.Encoding` | `string` | Output format | `""` (auto-detect) |
| `Config.ResolveRelativeURLs` | `bool` | Link extraction | `true` |
| `Config.BaseURL` | `string` | Link extraction | `""` |
| `Config.IncludeImages` | `bool` | Link extraction | `true` |
| `Config.IncludeVideos` | `bool` | Link extraction | `true` |
| `Config.IncludeAudios` | `bool` | Link extraction | `true` |
| `Config.IncludeCSS` | `bool` | Link extraction | `true` |
| `Config.IncludeJS` | `bool` | Link extraction | `true` |
| `Config.IncludeContentLinks` | `bool` | Link extraction | `true` |
| `Config.IncludeExternalLinks` | `bool` | Link extraction | `true` |
| `Config.IncludeIcons` | `bool` | Link extraction | `true` |
| `Config.Scorer` | `Scorer` | Extension | `nil` (built-in default scorer) |

### Resource Management

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `MaxInputSize` | `int` | `52428800` (50MB) | Maximum input in bytes; range `1`–`52428800` |
| `MaxCacheEntries` | `int` | `2000` | Cache entry limit; `0` disables the cache (upper bound `100000`) |
| `CacheTTL` | `time.Duration` | `1h` | Cache expiration time; cannot be negative |
| `CacheCleanup` | `time.Duration` | `5m` | Interval for sweeping expired entries; `0` disables background cleanup |
| `WorkerPoolSize` | `int` | `4` | Worker pool size for batch processing; range `1`–`256` |
| `ProcessingTimeout` | `time.Duration` | `30s` | Per-document processing timeout; `0` means unlimited |

:::tip Zero-value semantics and where to start
`MaxCacheEntries`, `CacheCleanup`, and `ProcessingTimeout` accept `0` with a defined meaning: disable the cache, disable background cleanup, and no timeout. `MaxInputSize`, `WorkerPoolSize`, and `MaxDepth` must be positive, otherwise a `*ConfigError` is returned.

Therefore **the zero value `Config{}` does not pass `Validate()` and must not be used directly**. Start from `DefaultConfig()` or another preset, then override fields. `html.New()` with no arguments uses `DefaultConfig()` internally and calls `Validate()` before returning, so it is always safe.
:::

### Security

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `EnableSanitization` | `bool` | `true` | Enable content sanitization; disable only for trusted input |
| `MaxDepth` | `int` | `500` | Maximum DOM depth, range `1`–`500` |
| `AllowedBaseDir` | `string` | `""` | Restrict file operations to this directory; empty means no restriction |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Audit configuration |

Set `AllowedBaseDir` whenever file paths come from untrusted input.

### Content Extraction

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ExtractArticle` | `bool` | `true` | Enable article recognition |
| `PreserveImages` | `bool` | `true` | Preserve image information |
| `PreserveLinks` | `bool` | `true` | Preserve link information |
| `PreserveVideos` | `bool` | `true` | Preserve video information |
| `PreserveAudios` | `bool` | `true` | Preserve audio information |

### Output Formats

| Field | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | Inline image format |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | Inline link format |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | Table format |
| `Encoding` | `string` | `""` | - | Forced encoding; auto-detect when empty |

### Link Extraction

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ResolveRelativeURLs` | `bool` | `true` | Resolve relative URLs; when `BaseURL` is empty, the base is inferred from the document |
| `BaseURL` | `string` | `""` | Base URL for resolving relative paths |
| `IncludeImages` | `bool` | `true` | Include image links |
| `IncludeVideos` | `bool` | `true` | Include video links |
| `IncludeAudios` | `bool` | `true` | Include audio links |
| `IncludeCSS` | `bool` | `true` | Include CSS links |
| `IncludeJS` | `bool` | `true` | Include JS links |
| `IncludeContentLinks` | `bool` | `true` | Include content links |
| `IncludeExternalLinks` | `bool` | `true` | Include external links |
| `IncludeIcons` | `bool` | `true` | Include icon links |

### Extensions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `Scorer` | `Scorer` | `nil` | Custom content scorer; the built-in scorer is used when nil |

## Configuration Presets

### DefaultConfig

Returns a balanced configuration — the starting point for most applications.

```go
func DefaultConfig() Config
```

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

Sets `PreserveImages`, `PreserveLinks`, `PreserveVideos`, and `PreserveAudios` to `false`, so no media or link information is retained. The `Include*` filters of `ExtractAllLinks` are unaffected by this preset.

```go
func TextOnlyConfig() Config
```

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

Sets `InlineImageFormat` and `InlineLinkFormat` to `markdown`, for rendering inline images and links in the body as Markdown. `ExtractToMarkdown` always emits Markdown and does not need this preset.

```go
func MarkdownConfig() Config
```

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

Tighter limits, shorter timeouts, full audit.

```go
func HighSecurityConfig() Config
```

```go
cfg := html.HighSecurityConfig()
```

Differences from `DefaultConfig()`:

| Field | Default | High Security |
|-------|---------|---------------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

## Validate

Checks the configuration for validity (value receiver, callable as `cfg.Validate()`). When invalid it returns a `*ConfigError` wrapping `ErrInvalidConfig`.

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // Returns ConfigError
```

### Validation Constraints

`Config.Validate` enforces these bounds on numeric fields and format strings; violations return a `ConfigError` (check with `errors.Is(err, html.ErrInvalidConfig)`):

| Field | Constraint | Invalid example |
|-------|------------|-----------------|
| `MaxInputSize` | Positive and ≤ `52428800` (50MB) | `0`, `-1`, `100000000` |
| `MaxCacheEntries` | ≥ `0` and ≤ `100000` | `-1`, `200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | Positive and ≤ `256` | `0`, `512` |
| `MaxDepth` | Positive and ≤ `500` | `0`, `1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `Audit.MaxEntries` | ≥ `0` and ≤ `100000` (`0` means the default of 10000) | `-1`, `200000` |
| `Audit.MaxRawValueLength` | ≥ `0` (`0` means the default of 200) | `-1` |
| `InlineImageFormat` | Empty / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | Empty / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | Empty / `markdown` / `html` | `"csv"` |

Format strings are case-insensitive, and an empty value means the default (`InlineImageFormat`/`InlineLinkFormat` → `none`, `TableFormat` → `markdown`). `New()` calls `Validate()` before returning, so an invalid config never yields a usable `Processor`.

## Related Documentation

- [Configuration Guide](../../guides/core-features/configuration) — Preset selection and common recipes
- [Package Functions](./functions) — Package-level convenience functions
- [Processor](./processor) — Where configs are consumed, plus concurrency semantics
- [Constants & Errors](../types/constants) — Sentinel errors and error types
