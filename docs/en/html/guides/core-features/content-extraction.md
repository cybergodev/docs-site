---
sidebar_label: "Content Extraction"
title: "Content Extraction - CyberGo html | Workflow Guide"
description: "CyberGo html content extraction in practice: extraction workflow, smart article recognition, Result fields, custom Scorer, and encoding detection handling."
sidebar_position: 1
---

# Content Extraction Guide

This guide helps you understand how HTML content extraction works and best practices through practical scenarios.

## Extraction Flow Overview

When you call `Extract`, the library performs the following steps:

```text
HTML input → input validation → encoding detection (auto-convert to UTF-8) → DOM parsing → depth validation
    → safe sanitization (optional) → article detection (optional) → content extraction → formatting → return Result
```

Depth validation runs **before** sanitization: it first validates the DOM depth iteratively (avoiding stack overflow from recursive traversal), then performs safe sanitization on the parsed DOM tree. Both operate on the parsed node tree, so DOM parsing always precedes both of them.

Each step can be customized via [Configuration](../../api-reference/core/config).

## Basic Text Extraction

The simplest usage is extracting content from HTML bytes:

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
                <p>Go is a statically typed compiled language with built-in concurrency support.</p>
                <p>It compiles quickly, deploys easily, and is ideal for building high-performance services.</p>
                <img src="gopher.png" alt="Gopher mascot" />
                <a href="https://go.dev">Go Official Site</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Title:", result.Title)
    // Title: Go Tutorial

    fmt.Println("Text:", result.Text)
    // Text: Getting Started with Go
    //       Go is a statically typed compiled language with built-in concurrency support.
    //       It compiles quickly, deploys easily, and is ideal for building high-performance services.
    //       Go Official Site

    fmt.Println("Words:", result.WordCount)
    // Words: 30

    fmt.Println("Reading Time:", result.ReadingTime)
    // Reading Time: 9s (calculated at 200 words/minute)

    fmt.Println("Images:", len(result.Images))
    // Images: 1

    fmt.Println("Links:", len(result.Links))
    // Links: 1
}
```

## Understanding Extraction Results

`Result` contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `Title` | `string` | Page title, prefers `<title>`, then `<h1>`, `<h2>` |
| `Text` | `string` | Body content (sanitized, tags and excess whitespace removed) |
| `Images` | `[]ImageInfo` | Extracted image list |
| `Links` | `[]LinkInfo` | Extracted link list |
| `Videos` | `[]VideoInfo` | Extracted video list |
| `Audios` | `[]AudioInfo` | Extracted audio list |
| `WordCount` | `int` | Body word count |
| `ReadingTime` | `time.Duration` | Estimated reading time (200 words/minute) |
| `ProcessingTime` | `time.Duration` | Processing duration |

## Extracting from Files

Use `ExtractFromFile` when processing local HTML files:

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("Title:", result.Title)
```

File operations include built-in safety checks:
- Automatic path traversal attack detection (e.g., `../../../etc/passwd`)
- File size limited by `MaxInputSize`
- Error messages use `SafePath()` to hide full paths

## Article Recognition Algorithm

When `ExtractArticle` is `true` (default), the library automatically identifies the "main content area" on the page.

### How It Works

1. **Candidate Node Scoring**: Traverses the DOM tree, scoring each element node for content relevance
2. **Best Candidate Selection**: Selects the highest-scoring node as the article container
3. **Fallback Mechanism**: Falls back to the `<body>` node if no suitable candidate is found

:::tip Use Cases
Article recognition works best for news, blogs, documentation, and other pages with a clear "body area." For navigation pages and list pages, it may not accurately locate the body content.
:::

### Custom Scoring

Implement the `Scorer` interface for custom scoring logic:

```go
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    // Return score based on node characteristics
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    // Return true to remove the node
    return node.Data() == "nav" || node.Data() == "footer"
}
```

:::tip Note
`strings.Contains` in this example is from the standard library `strings` package. For a complete runnable example, see [Testing & Custom Extensions](../integration/testing-custom).
:::

## Text-Only Extraction

When you only need plain text without metadata like images and links:

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

This is useful for text analysis, search index building, and similar scenarios.

## Handling Non-UTF-8 Encoding

The library automatically detects 15+ character encodings (including UTF-8, GBK, Shift_JIS, Windows-1252, etc.) and converts to UTF-8.

```go
// Auto-detect encoding
result, err := html.Extract(gbkEncodedData)

// Manually specify encoding
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

## Context & Timeout

For large files or untrusted HTML sources, use the context-aware versions:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, html.ErrProcessingTimeout) {
    log.Println("Processing timed out")
}
```

## Next Steps

- [Output Formats](./output-formats) - Choose the right output format
- [Processor Cache & Reuse](../advanced-patterns/processor-cache) - Performance optimization for high-frequency calls
- [API Reference: Functions](../../api-reference/core/functions) - Complete function signatures
