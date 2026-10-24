---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo html | Get Started in 5 Minutes"
description: "CyberGo html quick start: install, extract from bytes or files, choose a Config preset, know encoding detection limits, and output text, Markdown or JSON."
sidebar_position: 10
---

# Quick Start

Install the library, run a first extraction, then pick a configuration preset and output format for your case.

## Installation

```bash
go get github.com/cybergodev/html
```

Requires Go 1.26+.

## Basic Extraction

Extract content from HTML bytes:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html>
        <head><title>Go Tutorial</title></head>
        <body>
            <article>
                <h1>Getting Started with Go</h1>
                <p>Go is a statically typed compiled language.</p>
                <img src="gopher.png" alt="Gopher" />
                <a href="https://go.dev">Go Official Site</a>
            </article>
        </body>
    </html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Title:", result.Title)
	fmt.Println("Text:", result.Text)
	fmt.Println("Images:", len(result.Images))
	fmt.Println("Links:", len(result.Links))
	fmt.Println("Words:", result.WordCount)
}
```

Output:

```text
Title: Go Tutorial
Text: Getting Started with Go

Go is a statically typed compiled language.

Go Official Site
Images: 1
Links: 1
Words: 14
```

`WordCount` splits on whitespace and counts each CJK character as one additional word.

## Extract from File

```go
result, err := html.ExtractFromFile("page.html")
if err != nil {
    log.Fatal(err)
}
```

## Using Configuration

Customize extraction behavior with `Config`:

```go
cfg := html.MarkdownConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

result, err := p.Extract(data)
```

### Configuration Presets

| Preset | Function | Description |
|--------|----------|-------------|
| Default | `DefaultConfig()` | Balanced configuration for general use |
| Text | `TextOnlyConfig()` | Keeps no images, links, videos, or audio; the `Include*` switches of `ExtractAllLinks` are unaffected |
| Markdown | `MarkdownConfig()` | Sets `InlineImageFormat` and `InlineLinkFormat` to `markdown`; `ExtractToMarkdown` always emits Markdown and does not need it |
| High Security | `HighSecurityConfig()` | Tightens input size, depth, and timeout limits and enables full audit |

## Output Formats

```go
// Plain text
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

`ExtractText` calls `Extract` internally and returns `.Text`, so its performance path is the same as `Extract`.

## Context Support

Extraction functions have variants with the `*WithContext` suffix (for example `ExtractWithContext`, `ExtractTextWithContext`) that support cancellation and timeouts:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

When the library's own `ProcessingTimeout` expires you get `ErrProcessingTimeout`; when the caller's context expires the original `context.DeadlineExceeded` is returned unchanged. See [the FAQ](../faq/#what-s-the-difference-between-processingtimeout-and-user-context-timeout) for the full table.

## Usage Notes

### Concurrency Safety

`Processor` instances are concurrency-safe and can be shared across goroutines:

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// Safe to call from multiple goroutines
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        result, err := p.Extract(fetchHTML(u))
        // ...
    }(url)
}
wg.Wait()
```

Package-level functions are also concurrency-safe: they take a Processor from an internal pool and clear its cache on return, so a pooled instance gains nothing from caching. Use `html.New(cfg)` for a long-lived Processor when you need cache hits.

### Encoding Detection

The library decides the encoding from a BOM, a `<meta charset>` declaration, and byte statistics:

```go
// Auto-detection works when the encoding is declared or the bytes are conclusive
result, err := html.Extract(pageData)

// When the source encoding is known, set it explicitly — the most reliable option
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

Supported encodings include UTF-8, GBK, Shift_JIS, EUC-JP, Windows-1252, and 15+ others. A GBK or Shift_JIS page without `<meta charset>` is decoded as windows-1252, producing mojibake with no error — set `Config.Encoding` explicitly in production. See [Encoding Detection](../guides/core-features/encoding-detection).

## Next Steps

- [Content Extraction](../guides/core-features/content-extraction) - Extraction pipeline and article detection
- [Output Formats](../guides/core-features/output-formats) - Choose the right output format for your case
- [Processor Cache & Reuse](../guides/performance/processor-cache) - Performance tuning for high-frequency calls
- [Cheat Sheet](./cheatsheet) - Common API quick reference
