---
sidebar_label: "Config"
title: "Config - CyberGo html | Config Field Reference"
description: "CyberGo html Config reference: all 30 fields in six categories, four presets, value constraints, zero-value semantics, and the Validate method."
sidebar_position: 30
---

# Configuration

## Config Struct

`Config` is the unified configuration struct for the HTML library, covering resource management, security, content extraction, output formats, and link filtering.

All 30 fields at a glance (detailed constraints and descriptions in the grouped sections below):

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
| `MaxInputSize` | `int` | `52428800` (50MB) | Maximum input size in bytes; range `1`–`52428800` |
| `MaxCacheEntries` | `int` | `2000` | Maximum cache entries; `0` disables the cache (upper bound `100000`) |
| `CacheTTL` | `time.Duration` | `1h` | Cache expiration time; cannot be negative |
| `CacheCleanup` | `time.Duration` | `5m` | Background cleanup interval for expired cache entries; `0` disables background cleanup |
| `WorkerPoolSize` | `int` | `4` | Worker pool size for batch processing; range `1`–`256` |
| `ProcessingTimeout` | `time.Duration` | `30s` | Per-document processing timeout; `0` means unlimited |

:::tip
Setting `MaxCacheEntries`, `CacheCleanup`, or `ProcessingTimeout` to `0` is not an error — each has a well-defined meaning (disable cache, disable background cleanup, and no timeout respectively). `MaxInputSize`, `WorkerPoolSize`, and `MaxDepth` must be positive, otherwise a `ConfigError` is returned.

Therefore **the zero value `Config{}` does not pass `Validate()` and must not be used directly** — always start from `DefaultConfig()` (or another preset) and override fields as needed.
:::

### Security

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `EnableSanitization` | `bool` | `true` | Enable content sanitization; can be disabled only for trusted input |
| `MaxDepth` | `int` | `500` | Maximum DOM depth, range `1`–`500` |
| `AllowedBaseDir` | `string` | `""` | Restricts file operations to this directory; empty (default) means no restriction. Use it when accepting untrusted file-path input |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Audit configuration |

### Content Extraction

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ExtractArticle` | `bool` | `true` | Enable intelligent article recognition |
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
| `Encoding` | `string` | `""` | - | Specify encoding (auto-detect if empty) |

### Link Extraction

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ResolveRelativeURLs` | `bool` | `true` | Resolve relative URLs (requires BaseURL) |
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
| `Scorer` | `Scorer` | `nil` | Custom content scorer; uses default scorer when nil |

## Configuration Presets

### DefaultConfig

`DefaultConfig` returns a balanced configuration suited to general scenarios — the starting point for most applications.

```go
func DefaultConfig() Config
```

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

Extract plain text only, disabling all media and link preservation (`PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios` all set to `false`).

```go
func TextOnlyConfig() Config
```

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

`MarkdownConfig` builds on the default configuration and sets both `InlineImageFormat` and `InlineLinkFormat` to `markdown`, suited for output whose inline images and links use Markdown format.

```go
func MarkdownConfig() Config
```

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

High-security configuration: reduced limits, shorter timeouts, full audit.

```go
func HighSecurityConfig() Config
```

```go
cfg := html.HighSecurityConfig()
```

Overrides compared to `DefaultConfig()`:

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

`Validate` checks the configuration for validity (value receiver, callable directly as `cfg.Validate()`); when invalid it returns a `*ConfigError` wrapping `ErrInvalidConfig`.

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // Returns ConfigError
```

### Validation Constraints

`Config.Validate` enforces the following value ranges on numeric fields (violations return a `ConfigError`, which can be checked via `errors.Is(err, html.ErrInvalidConfig)`):

| Field | Constraint | Invalid example |
|-------|------------|-----------------|
| `MaxInputSize` | Positive and ≤ `52428800` (50MB) | `0`, `-1`, `100000000` |
| `MaxCacheEntries` | ≥ `0` and ≤ `100000` | `-1`, `200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | Positive and ≤ `256` | `0`, `512` |
| `MaxDepth` | Positive and ≤ `500` | `0`, `1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `Audit.MaxEntries` | ≥ `0` and ≤ `100000` (`0` means using the default of 10000) | `-1`, `200000` |
| `InlineImageFormat` | Empty / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | Empty / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | Empty / `markdown` / `html` | `"csv"` |

## Related Documentation

- [Configuration Guide](../../guides/core-features/configuration) — Preset selection and common configuration recipes
- [Package Functions](./functions) — Package-level convenience functions
- [Processor](./processor) — Where configs are consumed, plus concurrency semantics
- [Constants & Errors](../types/constants) — Sentinel errors and error types

Format strings are case-insensitive, and an empty value is treated as the default (`InlineImageFormat`/`InlineLinkFormat` → `none`, `TableFormat` → `markdown`). `New()` calls `Validate()` before creating the Processor, so an invalid configuration never produces a usable Processor.
