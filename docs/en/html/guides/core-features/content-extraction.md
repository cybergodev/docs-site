---
sidebar_label: "Content Extraction"
title: "Content Extraction - CyberGo html | Workflow Guide"
description: "CyberGo html content extraction: full pipeline of validation, encoding detection, DOM parsing, sanitization, article recognition, Result fields, custom Scorer."
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

### Default Scorer Signal Dimensions

The built-in default scorer (internal implementation, not exported) scores based on multiple signals, selecting the highest-scoring container:

| Dimension | Positive signals | Negative signals |
|-----------|-----------------|------------------|
| **Tag semantics** | `<article>`(+1000), `<main>`(+900), `<section>`(+300), `<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style` return 0 directly |
| **class/id patterns** | `content`/`article`/`post`/`main`/`entry`/`story` etc. (strong positive); `blog`/`news`/`detail`/`page` etc. (moderate positive) | `comment`/`sidebar`/`nav`/`ad`/`menu` etc. (strong negative); `widget`/`share`/`social`/`related` etc. (moderate negative); `promo`/`banner`/`sponsor` etc. (weak negative) |
| **Paragraph density** | `<p>` count in subtree multiplied by a rate bonus (more paragraphs = more likely body content) | — |
| **Text length** | Long text above a threshold gets bonus; short text below threshold gets penalized | — |
| **Content density** | High text/tag ratio gets a multiplier boost | Low ratio gets a decay factor |
| **Link density** | — | Short text with dense links gets penalized (likely navigation or sitemap) |
| **Punctuation features** | Dense commas (including CJK comma `，`) indicate prose, gets bonus | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **Hidden elements** | — | Nodes with `style="display:none"`/`visibility:hidden` or `hidden` attribute are removed |

:::tip Layout wrapper exemption
When class/id contains both content signals (`content`/`article`) and removal signals (e.g. `sidebar`) — typically seen with CSS layout classes like `content-sidebar` — the scorer does **not** remove the node, because it wraps the main content. Semantic tags `<article>`/`<main>` (or `role="main"`/`role="article"`) are always exempt from class/id removal heuristics, ensuring `<article class="post-with-sidebar">` is not mistakenly deleted.
:::

:::warning Article recognition is not infallible
Article recognition works best for news, blogs, documentation, and other pages with a clear "body area." For navigation pages, list pages, image galleries, and other non-article pages, it may not accurately locate the body — in that case, set `ExtractArticle = false` to extract the entire `<body>` content.
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

## Table Rendering

HTML `<table>` elements are rendered into the extracted text according to the `TableFormat` config:

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "markdown" // default; or "html"
```

| Format | Rendering | Use case |
|--------|-----------|----------|
| `"markdown"` | Markdown table (with header separator row); `colspan` expanded into repeated cells; structure-only rows with width definitions are skipped | Human reading, Markdown consumption |
| `"html"` | Preserves the original HTML `<table>` tags (`colspan`/`rowspan` kept as-is); structure rows preserved | Downstream processing that needs exact table structure |

:::tip Format is case-insensitive
The `TableFormat` value is case-insensitive (`"Markdown"` and `"markdown"` are equivalent); an empty value falls back to `"markdown"`.
:::

Example — extracting HTML containing a table:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article>
        <h1>Price List</h1>
        <table>
            <tr><th>Product</th><th>Price</th></tr>
            <tr><td>Basic</td><td>Free</td></tr>
            <tr><td>Pro</td><td>$99/mo</td></tr>
        </table>
    </article></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text)
	// Output (when TableFormat = "markdown"):
	// Price List
	//
	// | Product | Price   |
	// |---------|---------|
	// | Basic   | Free    |
	// | Pro     | $99/mo  |
}
```

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
- [Processor Cache & Reuse](../performance/processor-cache) - Performance optimization for high-frequency calls
- [API Reference: Functions](../../api-reference/core/functions) - Complete function signatures
