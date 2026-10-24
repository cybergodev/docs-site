---
sidebar_label: "Overview"
title: "HTML Library - CyberGo html | Go HTML Extraction & Cleaning"
description: "Go HTML extraction and cleaning library: article detection, 15+ encodings, Markdown/JSON output, media and links, batch concurrency, audit, layered security."
---

# HTML

CyberGo html is a Go library for extracting and cleaning HTML content: it reads body text, titles, images, links, videos, and audio from HTML bytes, with 15+ encoding detection and multiple output formats.

## Features

- **Article Detection** - Locates the page's main content and removes navigation, ads, and other noise
- **Content Cleaning** - Removes dangerous tags, event attributes, and dangerous protocols to reduce XSS risk
- **Metadata Extraction** - Produces structured titles, images, links, videos, and audio
- **Multi-Format Output** - Plain text, Markdown, and JSON
- **Encoding Detection** - UTF-8, GBK, Shift_JIS, Windows-1252, and 15+ encodings
- **Batch Processing** - Concurrent batch extraction reusing a Processor object pool
- **Link Extraction** - Standalone link extraction API with type-based grouping
- **Audit System** - Pluggable audit pipeline with multiple sinks and event filtering
- **Security Protection** - Input size limits, depth limits, path traversal prevention, and panic recovery

## Installation

```bash
go get github.com/cybergodev/html
```

## Quick Start

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Example</title></head>
        <body><h1>Title</h1><p>Body content</p></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.Title) // Output: Example
	fmt.Println(result.Text)  // Output: Title\n\nBody content
}
```

## Architecture Overview

The library is built around three core types:

```text
                Config
                  │
                  ▼
             Processor ──→ Result
              │    │         │
              │    │         ├── Text / Title
              │    │         ├── Images / Videos / Audios
              │    │         ├── Links
              │    │         └── WordCount / ReadingTime
              │    │
              │    ├── Cache
              │    ├── Statistics
              │    └── AuditLog
              │
              ├── Scorer (custom scoring ── extensible)
              └── AuditSink (audit output ── extensible)
```

| Type | Responsibility | Description |
|------|---------------|-------------|
| `Config` | Configuration | Controls all behavior; provides 4 presets |
| `Processor` | Engine | Stateful processing engine managing cache, statistics, and audit |
| `Result` | Result | Structured output containing text and all metadata |

### Package Functions vs Processor

| | Package Functions | Processor |
|---|---|---|
| Usage | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| Cache | None (the pooled instance clears its cache on return) | Yes, configurable TTL and capacity |
| Statistics | None | Yes, query hit rate and other metrics |
| Audit | None | Yes, configurable audit pipeline |
| Lifecycle | No management needed | Requires `defer p.Close()` |
| Concurrency-safe | Yes | Yes |

:::tip When to use each calling mode
- **One-time extraction** (CLI tools, scripts) → Package functions
- **High-frequency server calls** (web services, crawlers) → Processor
- **Audit or monitoring required** → Processor
:::

| Stage | Page | Content |
|--------|------|---------|
| Getting Started | [Quick Start](./getting-started/) | Installation, basic usage, two calling modes |
| Core | [Content Extraction](./guides/core-features/content-extraction) | Extract family, Config, Result interpretation |
| Media | [Media Extraction](./guides/core-features/media-extraction) | Video, audio, and embedded content extraction |
| Formats | [Output Formats](./guides/core-features/output-formats) | Markdown / JSON output, format configuration |
| Links | [Link Extraction](./guides/core-features/link-extraction) | Link extraction, grouping, resource discovery |
| Encoding | [Encoding Detection](./guides/core-features/encoding-detection) | Auto-detection, manual override, 15+ encodings |
| Configuration | [Configuration Guide](./guides/core-features/configuration) | Four presets, six field categories, common combinations |
| Errors | [Error Handling](./guides/performance/error-handling) | Five error types, errors.Is/As, context cancellation |
| Performance | [Cache & Reuse](./guides/performance/processor-cache) | Processor lifecycle, cache tuning |
| Batch | [Batch Processing](./guides/performance/batch-processing) | Concurrent batch extraction, WorkerPool tuning |
| Security | [Security Overview](./guides/security/) | Security features, audit system, production checklist |
| Advanced | [Testing & Custom](./guides/integration/testing-custom) | Custom Scorer, ContentNode, test mode |
| Reference | [Cheat Sheet](./getting-started/cheatsheet) | Common API quick reference |

## Next Steps

- [Quick Start](./getting-started/) - 5-minute tutorial
- [Cheat Sheet](./getting-started/cheatsheet) - Common operations reference
- [API Reference](./api-reference/) - Complete API documentation
