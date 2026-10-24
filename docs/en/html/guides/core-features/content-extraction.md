---
sidebar_label: "Content Extraction"
title: "Content Extraction - CyberGo html | Workflow Guide"
description: "CyberGo html content extraction: the Extract pipeline, Result fields, article detection signals, custom Scorer, table rendering, and encoding handling."
sidebar_position: 10
---

# Content Extraction

`Extract` pulls body text, title, images, links, and media from HTML bytes. This page covers the processing pipeline, `Result` fields, and the article-detection algorithm.

## Extraction Pipeline

The steps `Extract` performs:

```text
HTML input → input validation → encoding detection (convert to UTF-8) → DOM parsing → depth validation
    → sanitization (optional) → article detection (optional) → content extraction → formatting → Result
```

Depth validation runs **before** sanitization. It checks DOM depth iteratively first, so recursive traversal cannot overflow the stack; sanitization then runs on the parsed tree. Both operate on parsed nodes, so DOM parsing always comes first.

Every step can be customized via [Configuration](../../api-reference/core/config).

## Basic Text Extraction

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
	// Reading Time: 9s

	fmt.Println("Images:", len(result.Images))
	// Images: 1

	fmt.Println("Links:", len(result.Links))
	// Links: 1
}
```

## Result Fields

`Result` carries the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `Title` | `string` | Page title: the first `<title>`, else the first `<h1>` or `<h2>` |
| `Text` | `string` | Body text (sanitized; tags and excess whitespace removed) |
| `Images` | `[]ImageInfo` | Extracted images |
| `Links` | `[]LinkInfo` | Extracted links |
| `Videos` | `[]VideoInfo` | Extracted videos |
| `Audios` | `[]AudioInfo` | Extracted audio |
| `WordCount` | `int` | Body word count |
| `ReadingTime` | `time.Duration` | Estimated reading time |
| `ProcessingTime` | `time.Duration` | Processing duration |

`WordCount` splits on whitespace and counts each CJK character as one word. `ReadingTime` divides by 200 words per minute and is an estimate only.

## Extracting from Files

Use `ExtractFromFile` for local HTML files:

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("Title:", result.Title)
```

File access performs three checks:

- Path traversal detection (e.g. `../../../etc/passwd`)
- File size limited by `MaxInputSize`
- Error messages pass through `SafePath()`, which hides the full path

## Article Detection

With `ExtractArticle` set to `true` (the default), the library locates the page's main content area.

### How It Works

1. **Candidate scoring**: walk the DOM, score non-inline element nodes for content relevance, and keep those scoring above 0.
2. **Best candidate**: the highest-scoring node becomes the article container.
3. **Fallback**: fall back to `<body>` when no candidate qualifies.

### Default Scorer Signals

The built-in scorer (internal, not exported) combines several signals and picks the highest-scoring container:

| Dimension | Positive signals | Negative signals |
|-----------|-----------------|------------------|
| **Tag semantics** | `<article>`(+1000), `<main>`(+900), `<section>`(+300), `<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style` return 0 directly |
| **class/id patterns** | `content`/`article`/`post`/`main`/`entry`/`story` etc. (strong positive); `blog`/`news`/`detail`/`page` etc. (moderate positive) | `comment`/`sidebar`/`nav`/`ad`/`menu` etc. (strong negative); `widget`/`share`/`social`/`related` etc. (moderate negative); `promo`/`banner`/`sponsor` etc. (weak negative) |
| **Paragraph density** | `<p>` count in the subtree multiplied by a rate bonus | — |
| **Text length** | Long text above a threshold scores higher; short text below it is penalized | — |
| **Content density** | High text/tag ratio gets a multiplier boost | Low ratio gets a decay factor |
| **Link density** | — | Short text with dense links is penalized (likely navigation or a sitemap) |
| **Punctuation** | Dense commas (including the CJK comma `，`) indicate prose and score higher | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **Hidden elements** | — | Nodes with `style="display:none"`/`visibility:hidden` or a `hidden` attribute are removed |

:::tip Layout wrapper exemption
When class/id carries both a content signal (`content`/`article`) and a removal signal (e.g. `sidebar`) — a layout class like `content-sidebar` is typical — the scorer keeps the node because it wraps the main content. Semantic tags `<article>`/`<main>` (or `role="main"`/`role="article"`) are always exempt from class/id removal heuristics, so `<article class="post-with-sidebar">` is never dropped.
:::

:::warning Where article detection applies
Article detection fits news, blogs, documentation, and other pages with a clear body area. Navigation pages, list pages, and image galleries usually have no such container, and the result may drift. Set `ExtractArticle` to `false` to extract the whole `<body>` instead.
:::

### Custom Scoring

Implement the `Scorer` interface to replace the scoring logic:

```go
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    // Return a score based on node characteristics
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
    // Reserved: not called by the library in the current version (implemented to satisfy the interface)
    return node.Data() == "nav" || node.Data() == "footer"
}
```

`strings.Contains` comes from the standard `strings` package. `ShouldRemove` is required by the interface, but the library currently calls only `Score`. For a complete runnable example, see [Testing & Custom Extensions](../integration/testing-custom).

## Text-Only Extraction

When you need plain text without image or link metadata:

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

`ExtractText` calls `Extract` internally and returns `.Text`. It saves the field access; the processing pipeline is identical.

## Table Rendering

HTML `<table>` elements are rendered into the text according to `TableFormat`. The value is case-insensitive (`"Markdown"` equals `"markdown"`), and an empty value falls back to `"markdown"`:

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "markdown" // default; or "html"
```

| Format | Rendering | Use case |
|--------|-----------|----------|
| `"markdown"` | Markdown table with a header separator row; `colspan` expands into repeated cells; structure-only rows with width definitions are skipped | Human reading, Markdown consumption |
| `"html"` | Keeps the original `<table>` tags (`colspan`/`rowspan` preserved as-is); structure rows preserved | Downstream processing that needs the exact table structure |

Example — extracting HTML that contains a table:

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
	// Output (with TableFormat = "markdown"):
	// Price List
	//
	// | Product | Price   |
	// |---------|---------|
	// | Basic   | Free    |
	// | Pro     | $99/mo  |
}
```

## Non-UTF-8 Input

Encoding order: `Config.Encoding` → BOM → pure ASCII (meta declaration if present) → valid UTF-8 → meta declaration → windows-1252 fallback.

```go
// data holds GBK bytes; extraction works as-is when the meta tag declares charset=gbk
result, err := html.Extract(gbkEncodedData)

// No declaration, or a known encoding: specify it and skip detection
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

:::warning Pages without a declared charset decode to mojibake
When a GBK or Shift_JIS page has no `<meta charset>`, basic detection falls back to windows-1252 and the measured result is mojibake with **no error returned**. Set `cfg.Encoding` whenever the source encoding is known. See [Encoding Detection](./encoding-detection).
:::

## Context and Timeouts

Use the context-aware variant for large files or untrusted HTML:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, context.DeadlineExceeded) {
    log.Println("processing timed out")
}
```

A user-context deadline returns `context.DeadlineExceeded` unchanged; `ErrProcessingTimeout` is returned only when the library's own `ProcessingTimeout` fires.

## Next Steps

- [Output Formats](./output-formats) - Differences and trade-offs between the three output formats
- [Processor Cache & Reuse](../performance/processor-cache) - Performance optimization for high-frequency calls
- [API Reference: Functions](../../api-reference/core/functions) - Complete function signatures
