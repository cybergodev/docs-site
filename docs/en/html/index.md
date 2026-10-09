---
sidebar_label: "Overview"
title: "HTML Library - CyberGo html | Go HTML Extraction & Cleaning"
description: "High-performance Go HTML extraction and cleaning: article detection, 15+ encodings, Markdown/JSON output, links & media, batch concurrency, audit, security."
---

# HTML

Production-grade HTML content extraction library with automatic encoding detection (15+ encodings), intelligent article recognition, link/media extraction, and multi-format output.

## Features

- **Intelligent Article Recognition** - Automatically identifies and extracts page body content, removing navigation, ads, and other noise
- **Content Sanitization** - Automatically sanitizes HTML, removing dangerous tags and attributes to prevent XSS attacks
- **Metadata Extraction** - Automatically extracts titles, images, links, videos, audio, and other structured information
- **Multi-Format Output** - Plain text, Markdown, and JSON output formats
- **Automatic Encoding Detection** - Supports UTF-8, GBK, Shift_JIS, Windows-1252, and 15+ encodings
- **Batch Processing** - Concurrent batch extraction with built-in Processor object pool reuse
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

The HTML library is built around three core types:

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
| `Config` | Configuration | Control center for all behavior, provides 4 presets |
| `Processor` | Engine | Stateful processing engine managing cache, statistics, and audit |
| `Result` | Result | Structured output containing text and all metadata |

### Package Functions vs Processor

| | Package Functions | Processor |
|---|---|---|
| Usage | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| Cache | None (uses internal temporary pool) | Yes, configurable TTL and capacity |
| Statistics | None | Yes, query hit rate and other metrics |
| Audit | None | Yes, configurable audit pipeline |
| Lifecycle | No management needed | Requires `defer p.Close()` |
| Concurrent Safe | Yes | Yes |

:::tip Choosing the Right Approach
- **One-time extraction** (CLI tools, scripts) → Package functions
- **High-frequency server calls** (web services, crawlers) → Processor
- **Need audit/monitoring** → Processor
:::

| Stage | Page | What You'll Learn |
|--------|------|-------------------|
| Getting Started | [Quick Start](./getting-started/) | Installation, basic usage, two calling modes |
| Core | [Content Extraction](./guides/core-features/content-extraction) | Extract family, Config, Result interpretation |
| Media | [Media Extraction](./guides/core-features/media-extraction) | Video, audio, and embedded content extraction |
| Formats | [Output Formats](./guides/core-features/output-formats) | Markdown / JSON output, format configuration |
| Links | [Link Extraction](./guides/core-features/link-extraction) | Link extraction, grouping, resource discovery |
| Encoding | [Encoding Detection](./guides/core-features/encoding-detection) | Auto-detection, manual override, 15+ encodings |
| Configuration | [Configuration Guide](./guides/core-features/configuration) | Four presets, six field categories, common combos |
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
