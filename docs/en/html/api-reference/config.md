---
title: "Configuration - HTML"
description: "Config reference for CyberGo HTML, covering resource management, security settings, content extraction, output formats, link filtering, and validation."
---

# Configuration

## Config Struct

`Config` is the unified configuration struct for the HTML library, covering resource management, security, content extraction, output formats, and link filtering.

### Resource Management

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `MaxInputSize` | `int` | `52428800` (50MB) | Maximum input size in bytes |
| `MaxCacheEntries` | `int` | `2000` | Maximum cache entries |
| `CacheTTL` | `time.Duration` | `1h` | Cache expiration time |
| `CacheCleanup` | `time.Duration` | `5m` | Cache cleanup interval |
| `WorkerPoolSize` | `int` | `4` | Worker pool size |
| `ProcessingTimeout` | `time.Duration` | `30s` | Processing timeout |

### Security

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `EnableSanitization` | `bool` | `true` | Enable content sanitization; can be disabled only for trusted input |
| `MaxDepth` | `int` | `500` | Maximum DOM depth |
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

Balanced configuration for general use.

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

Extract plain text only, disabling all media and link preservation (`PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios` all set to `false`).

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

Optimized for Markdown output, with inline images and links using Markdown format.

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

High-security configuration: reduced limits, shorter timeouts, full audit.

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

Validate the configuration.

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // Returns ConfigError
```
