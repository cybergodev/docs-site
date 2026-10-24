---
sidebar_label: "Configuration"
title: "Configuration Guide - CyberGo html | Config Field Selection"
description: "CyberGo html configuration: DefaultConfig, HighSecurityConfig, TextOnlyConfig, and MarkdownConfig compared, the six field groups, and Validate checks."
sidebar_position: 60
---

# Configuration Guide

`Config` is the library's single configuration struct, with 30 fields. Most scenarios need one preset plus a few overrides; the full field reference is in [API Reference — Config](../../api-reference/core/config).

## Four Presets

| Preset | Use case | Key difference |
|--------|----------|----------------|
| `DefaultConfig()` | General extraction | All features on, safe defaults |
| `HighSecurityConfig()` | Untrusted input | Tighter limits, audit enabled, lower depth cap |
| `TextOnlyConfig()` | Plain text only | All media preservation off |
| `MarkdownConfig()` | Inline Markdown output | Images and links rendered as Markdown |

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

	// Plain text only (e.g. search engine indexing)
	p2, _ := html.New(html.TextOnlyConfig())
	defer p2.Close()

	// Images and links appear in Text as Markdown inline syntax (e.g. CMS migration)
	p3, _ := html.New(html.MarkdownConfig())
	defer p3.Close()
	r3, _ := p3.Extract(data)
	fmt.Println(r3.Text)
}
```

:::warning A zero-value Config is unusable
`Config{}` fails `Validate()` (`MaxInputSize` and others must be positive), so never start from the zero value. Take a preset, then override fields.
:::

<!-- check-code: skip -->
```go
cfg := html.HighSecurityConfig()
cfg.PreserveImages = false // additionally disable images on top of high security
processor, _ := html.New(cfg)
```

`TextOnlyConfig()` only sets `PreserveImages`/`PreserveLinks`/`PreserveVideos`/`PreserveAudios` to `false`; it does not touch the `Include*` filters used by `ExtractAllLinks`. `MarkdownConfig()` only sets `InlineImageFormat` and `InlineLinkFormat`; `ExtractToMarkdown` always uses Markdown formatting, so it does not need that preset.

## Six Field Groups

### Resource Management

These affect memory and throughput. Defaults suit most workloads; adjust for your load.

| Field | Default | Description |
|-------|---------|-------------|
| `MaxInputSize` | 50 MB | Maximum input size; prevents memory exhaustion |
| `MaxCacheEntries` | 2000 | Cache entry limit; 0 disables the cache |
| `CacheTTL` | 1 hour | Cache time-to-live |
| `CacheCleanup` | 5 minutes | Background interval for clearing expired entries |
| `WorkerPoolSize` | 4 | Batch concurrency (1–256) |
| `ProcessingTimeout` | 30 seconds | Per-document timeout; 0 means no limit |

:::warning Caching applies only to Processor instances
Package-level functions (e.g. `html.Extract`) use a pooled or temporary Processor per call, so the cache never survives across calls. For caching, create a standalone Processor with `html.New()`. See [Processor Reuse & Cache](../performance/processor-cache).
:::

### Security

This group matters in production. See [Security Overview](../security/) for the full picture.

| Field | Default | Description |
|-------|---------|-------------|
| `EnableSanitization` | `true` | HTML sanitization (removes dangerous tags and attributes) |
| `MaxDepth` | 500 | DOM nesting limit; prevents stack overflow |
| `AllowedBaseDir` | `""` | Sandbox directory for file operations; empty means no restriction |
| `Audit` | Disabled | Security audit log configuration |

:::warning AllowedBaseDir and user-supplied paths
Set `AllowedBaseDir` whenever a file path comes from user input. It resolves the real path through an OS file handle, which defeats symlink and Windows junction escapes.
:::

### Content Extraction

Controls what is extracted from the HTML.

| Field | Default | Description |
|-------|---------|-------------|
| `ExtractArticle` | `true` | Article detection (locates the main content) |
| `PreserveImages` | `true` | Keep image information |
| `PreserveLinks` | `true` | Keep link information |
| `PreserveVideos` | `true` | Extract videos |
| `PreserveAudios` | `true` | Extract audio |

Turning off unneeded media types cuts processing work:

```go
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
// Extract only text, images, and links
```

### Output Formats

Controls how images and links appear in the text output. See [Output Formats](./output-formats).

| Field | Default | Options |
|-------|---------|---------|
| `InlineImageFormat` | `"none"` | `"none"`, `"markdown"`, `"html"`, `"placeholder"` |
| `InlineLinkFormat` | `"none"` | `"none"`, `"markdown"`, `"html"` |
| `TableFormat` | `"markdown"` | `"markdown"`, `"html"` |
| `Encoding` | `""` (auto) | `"utf-8"`, `"gbk"`, `"shift_jis"`, `"windows-1252"`, etc. |

An empty `Encoding` goes through auto-detection. Setting it skips the detection step, but only do so when the encoding is known — a wrong value yields mojibake or an `encoding detection failed` error. See [Encoding Detection](./encoding-detection).

### Link Extraction

These fields apply only to `ExtractAllLinks`. See [Link Extraction](./link-extraction).

| Field | Default | Description |
|-------|---------|-------------|
| `ResolveRelativeURLs` | `true` | Resolve relative URLs to absolute URLs |
| `BaseURL` | `""` | Resolution base; auto-detected from the HTML when empty |
| `IncludeImages` | `true` | Include `<img>` links |
| `IncludeVideos` | `true` | Include `<video>` and `<iframe>`/`<embed>`/`<object>` embed links |
| `IncludeAudios` | `true` | Include `<audio>` links |
| `IncludeCSS` | `true` | Include `<link rel="stylesheet">` |
| `IncludeJS` | `true` | Include `<script src>` |
| `IncludeContentLinks` | `true` | Include `<a>` links with a relative href |
| `IncludeExternalLinks` | `true` | Include `<a>` links with an absolute or protocol-relative href |
| `IncludeIcons` | `true` | Include favicon/icon |

:::tip Link extraction and content extraction are independent
The `Include*` fields affect only `ExtractAllLinks`. Link retention in `Extract` is controlled by `PreserveLinks`.
:::

### Extensions

| Field | Description |
|-------|-------------|
| `Scorer` | Custom content scorer; when nil, the built-in scorer (internal) is used |

A custom Scorer can tune article detection for a specific site. See [Testing & Custom Extensions](../integration/testing-custom).

## Common Combinations

### Web Crawler

Raise concurrency and shorten the timeout for batch crawling:

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.WorkerPoolSize = 8                   // Raise batch concurrency
	cfg.ProcessingTimeout = 10 * time.Second // Shorten the timeout
	cfg.PreserveVideos = false               // Crawlers don't need video
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

For user-submitted HTML, use the high-security config and restrict the file directory:

```go
package main

import (
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()
	cfg.AllowedBaseDir = "/var/www/uploads" // Restrict the file directory

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// Process a user-uploaded HTML file
	result, err := processor.ExtractFromFile("/var/www/uploads/user.html")
	if err != nil {
		log.Fatal(err)
	}
	log.Println(result.Title)
}
```

### Content Migration Tool

Convert legacy site HTML to Markdown:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	processor, err := html.New() // DefaultConfig
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

`ExtractToMarkdown` always uses Markdown formatting, independent of `InlineImageFormat`/`InlineLinkFormat`, so `MarkdownConfig()` is not needed here. `BaseURL` and `ResolveRelativeURLs` apply only to `ExtractAllLinks` and do not rewrite links in an `Extract` result.

## Validate

Configs passed to `html.New()` are validated automatically. You can also call `Validate()` first:

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1 // Intentionally invalid
if err := cfg.Validate(); err != nil {
    log.Fatal(err) // html: invalid config: MaxInputSize=-1, must be positive
}
```

Validation covers field ranges and format strings. An invalid config returns `*ConfigError`, which you can test with `errors.Is(err, html.ErrInvalidConfig)`. Full constraints are in [API Reference — Config](../../api-reference/core/config).

## Next Steps

- [Processor Reuse & Caching](../performance/processor-cache) - Performance optimization for high-frequency calls
- [Security Overview](../security/) - Security features and production practice
- [API Reference: Config](../../api-reference/core/config) - Complete field reference and constraints
