---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo html | 5-Minute Guide"
description: "Quick start with CyberGo html: install, basic content extraction, four Config presets, text/Markdown/JSON output, and start HTML extraction in 5 minutes."
sidebar_position: 2
---

# Quick Start

## Installation

```bash
go get github.com/cybergodev/html
```

Requires Go 1.25+.

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
| Text | `TextOnlyConfig()` | Extract plain text only, disable media |
| Markdown | `MarkdownConfig()` | Optimized for Markdown output |
| High Security | `HighSecurityConfig()` | Strict limits, full audit |

## Output Formats

```go
// Plain text
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

## Context Support

All functions have `ExtractWithContext` variants that support cancellation and timeout:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## Key Notes

### Concurrency Safety

`Processor` instances are concurrent-safe and can be shared across goroutines:

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

Package-level functions are also concurrent-safe (internally use a Processor pool).

### Encoding Detection

The library automatically detects HTML encoding — no manual handling needed:

```go
// GBK-encoded HTML is automatically detected and correctly extracted
result, err := html.Extract(gbkData)

// You can also manually specify encoding via Config.Encoding
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

Supports UTF-8, GBK, GB18030, Shift_JIS, EUC-JP, Windows-1252, and 15+ encodings.

## Next Steps

- [Content Extraction Guide](../guides/core-features/content-extraction) - Deep dive into extraction and article recognition
- [Output Formats](../guides/core-features/output-formats) - Choose the right output format for your use case
- [Processor Cache & Reuse](../guides/advanced-patterns/processor-cache) - Performance optimization for high-frequency calls
- [Cheat Sheet](./cheatsheet) - Common API quick reference
