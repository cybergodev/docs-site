---
title: "HTML Library - CyberGo HTML | Production-Grade Go Library"
description: "Production-grade Go HTML extraction library: article recognition, 15+ encoding detection, links, batch processing, pluggable audit, and multi-format output."
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
| Getting Started | [Quick Start](./getting-started) | Installation, basic usage, two calling modes |
| Core | [Content Extraction](./guides/content-extraction) | Extract family, Config, Result interpretation |
| Formats | [Output Formats](./guides/output-formats) | Markdown / JSON output, custom templates |
| Performance | [Cache & Reuse](./guides/processor-cache) | Processor lifecycle, cache tuning, batch processing |
| Extensions | [Link Extraction](./guides/link-extraction) | Link extraction, grouping, resource discovery |
| Security | [Audit Pipeline](./guides/audit-pipeline) | Audit system, custom Sinks, security monitoring |
| Advanced | [Testing & Custom](./guides/testing-custom) | Custom Scorer, ContentNode, test mode |
| Reference | [Cheat Sheet](./cheatsheet) | Common API quick reference |

## Next Steps

- [Quick Start](./getting-started) - 5-minute tutorial
- [Cheat Sheet](./cheatsheet) - Common operations reference
- [API Reference](./api-reference/) - Complete API documentation
