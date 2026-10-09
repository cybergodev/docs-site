---
sidebar_label: "Configuration"
title: "Configuration Guide - CyberGo html | Config Field Selection"
description: "CyberGo html configuration: DefaultConfig, HighSecurityConfig, TextOnlyConfig, MarkdownConfig presets, six field categories, combinations, and Validate checks."
sidebar_position: 6
---

# Configuration Guide

The `Config` struct has 30+ fields, but daily use only requires understanding a few key groups. This guide helps you quickly choose the right configuration for your scenario. For complete field descriptions, see the [API Reference — Config](../../api-reference/core/config).

## Four Preset Configurations

The library provides four presets that cover most scenarios:

| Preset | Use Case | Key Difference |
|--------|----------|----------------|
| `DefaultConfig()` | General extraction | Full features enabled, safe defaults |
| `HighSecurityConfig()` | Untrusted input | Tighter limits, audit enabled, lower depth cap |
| `TextOnlyConfig()` | Plain text only | Disables all media retention, max performance |
| `MarkdownConfig()` | Markdown output | Inline images/links converted to Markdown format |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><h1>Title</h1><p>Body content</p></body></html>`)

	// Most scenarios: use the default config directly
	p1, _ := html.New()
	defer p1.Close()
	r1, _ := p1.Extract(data)
	fmt.Println(r1.Title)

	// Only need plain text (e.g., search engine indexing)
	p2, _ := html.New(html.TextOnlyConfig())
	defer p2.Close()

	// Output Markdown (e.g., CMS migration)
	p3, _ := html.New(html.MarkdownConfig())
	defer p3.Close()
	md, _ := p3.ExtractToMarkdown(data)
	fmt.Println(md)
}
```

:::tip Start from a preset
When unsure, start with `DefaultConfig()` and adjust individual fields as needed. Presets can be combined — take one preset, then override fields:
:::

<!-- check-code: skip -->
```go
cfg := html.HighSecurityConfig()
cfg.PreserveImages = false // Additionally disable images on top of high security
processor, _ := html.New(cfg)
```

## Tour of Six Field Categories

### Resource Management

Controls memory usage and performance. Typically no adjustment is needed in daily development.

| Field | Default | Description |
|-------|---------|-------------|
| `MaxInputSize` | 50 MB | Maximum input size; prevents memory exhaustion |
| `MaxCacheEntries` | 2000 | Cache entry limit; set 0 to disable cache |
| `CacheTTL` | 1 hour | Cache time-to-live |
| `CacheCleanup` | 5 minutes | Background cleanup interval for expired cache |
| `WorkerPoolSize` | 4 | Batch processing concurrency (1–256) |
| `ProcessingTimeout` | 30 seconds | Per-document timeout; set 0 for no limit |

:::warning Cache applies only to Processor instances
Package-level functions (e.g., `html.Extract`) use a pooled Processor and clear the cache after each call. For caching, create a standalone Processor with `html.New()`. See [Processor Reuse & Cache](../performance/processor-cache).
:::

### Security

Security configuration is critical for production environments. For a complete overview of security features, see [Security Overview](../security/).

| Field | Default | Description |
|-------|---------|-------------|
| `EnableSanitization` | `true` | HTML sanitization (removes dangerous tags/attributes) |
| `MaxDepth` | 500 | DOM nesting depth limit; prevents stack overflow |
| `AllowedBaseDir` | `""` | Sandbox directory for file operations; empty = no restriction |
| `Audit` | Disabled | Security audit log configuration |

:::warning AllowedBaseDir
When processing user-provided file paths, always set `AllowedBaseDir`. It resolves real paths via OS file handles (preventing symlink and Windows junction bypasses).
:::

### Content Extraction

Controls what content is extracted from the HTML.

| Field | Default | Description |
|-------|---------|-------------|
| `ExtractArticle` | `true` | Smart article detection (auto-locates main content) |
| `PreserveImages` | `true` | Preserve image information |
| `PreserveLinks` | `true` | Preserve link information |
| `PreserveVideos` | `true` | Extract videos |
| `PreserveAudios` | `true` | Extract audios |

Disabling unneeded media types can improve performance:

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
// Extract only text, images, and links
```

### Output Format

Controls how images and links are rendered in text output. See [Output Formats](./output-formats).

| Field | Default | Options |
|-------|---------|---------|
| `InlineImageFormat` | `"none"` | `"none"`, `"markdown"`, `"html"`, `"placeholder"` |
| `InlineLinkFormat` | `"none"` | `"none"`, `"markdown"`, `"html"` |
| `TableFormat` | `"markdown"` | `"markdown"`, `"html"` |
| `Encoding` | `""` (auto) | `"utf-8"`, `"gbk"`, `"shift_jis"`, `"windows-1252"`, etc. |

When `Encoding` is empty, encoding is auto-detected. Specifying it manually skips the detection step and improves performance, but only use this when the encoding is known. See [Encoding Detection](./encoding-detection).

### Link Extraction

The following fields take effect only in `ExtractAllLinks`, controlling which types of resource links are extracted. See [Link Extraction](./link-extraction).

| Field | Default | Description |
|-------|---------|-------------|
| `ResolveRelativeURLs` | `true` | Resolves relative URLs to absolute URLs |
| `BaseURL` | `""` | Resolution base; auto-detected from HTML when empty |
| `IncludeImages` | `true` | Include `<img>` links |
| `IncludeVideos` | `true` | Include `<video>`/`<iframe>` links |
| `IncludeAudios` | `true` | Include `<audio>` links |
| `IncludeCSS` | `true` | Include `<link rel="stylesheet">` |
| `IncludeJS` | `true` | Include `<script src>` |
| `IncludeContentLinks` | `true` | Include internal `<a href>` links |
| `IncludeExternalLinks` | `true` | Include external links |
| `IncludeIcons` | `true` | Include favicon/icon |

:::tip Link Extraction vs Content Extraction
The `Include*` fields affect only `ExtractAllLinks`. Link retention in content extraction (`Extract`) is controlled by `PreserveLinks`.
:::

### Extensions

| Field | Description |
|-------|-------------|
| `Scorer` | Custom content scorer; when nil, the built-in default scorer (internal implementation) is used |

A custom Scorer can optimize article detection for specific websites. See [Testing & Custom Extensions](../integration/testing-custom).

## Common Configuration Combinations

### Web Crawler

For high-frequency batch crawling, increase concurrency and shorten the timeout:

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.WorkerPoolSize = 8                   // Increase batch concurrency
	cfg.ProcessingTimeout = 10 * time.Second // Shorten timeout
	cfg.PreserveVideos = false               // Crawler doesn't need videos
	cfg.PreserveAudios = false

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// Batch extraction
	pages := [][]byte{[]byte("<html><body>Page 1</body></html>")}
	batch := processor.ExtractBatch(pages)
	log.Printf("Success %d, Failed %d", batch.Success, batch.Failed)
}
```

### API Backend Service

For processing user-submitted HTML, use the high-security config and restrict the file directory:

```go
package main

import (
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()
	cfg.AllowedBaseDir = "/var/www/uploads" // Restrict file directory

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// Process user-uploaded HTML files
	result, err := processor.ExtractFromFile("/var/www/uploads/user.html")
	if err != nil {
		log.Fatal(err)
	}
	log.Println(result.Title)
}
```

### Content Migration Tool

To convert legacy site HTML to Markdown, preserving links and resolving relative URLs:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.MarkdownConfig()
	cfg.ResolveRelativeURLs = true
	cfg.BaseURL = "https://old-site.example.com"

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	data := []byte(`<html><body><article><h1>Old Article</h1><a href="/post/123">Link</a></article></body></html>`)
	md, err := processor.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
}
```

## Validate

All configurations are automatically validated when passed to `html.New()`. You can also call `Validate()` manually to check in advance:

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1 // Intentionally invalid
if err := cfg.Validate(); err != nil {
    log.Fatal(err) // html: invalid config: MaxInputSize=-1, must be positive
}
```

Validation rules include field range checks and format string validation. An invalid configuration returns `*ConfigError`, which you can check with `errors.Is(err, html.ErrInvalidConfig)`. For complete field constraints, see [API Reference — Config](../../api-reference/core/config).
