---
sidebar_label: "Content Extraction"
title: "Content Extraction - CyberGo html | Workflow Guide"
description: "CyberGo html content extraction: the Extract pipeline, Result fields, metadata and confidence, listing detection, custom Scorer, tables, and timeouts."
sidebar_position: 10
---

# Content Extraction

`Extract` pulls body text, title, images, links, and media from HTML bytes. This page covers the processing pipeline, `Result` fields, the article detection algorithm, listing detection, and extraction quality signals.

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
	// Text: # Getting Started with Go
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

Heading tags are written into `Text` with Markdown ATX markers (`# ` through `###### `); the markers themselves are not counted in `WordCount`.

## Result Fields

`Result` carries the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `Title` | `string` | Page title; priority is described in [Title Priority](#title-priority) |
| `Text` | `string` | Body text (sanitized; tags and excess whitespace removed) |
| `Images` | `[]ImageInfo` | Extracted images |
| `Links` | `[]LinkInfo` | Extracted links |
| `Videos` | `[]VideoInfo` | Extracted videos |
| `Audios` | `[]AudioInfo` | Extracted audio |
| `WordCount` | `int` | Body word count |
| `ReadingTime` | `time.Duration` | Estimated reading time |
| `ProcessingTime` | `time.Duration` | Processing duration |
| `Author` | `string` | Author; JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `time.Time` | Publication time; `article:published_time` > JSON-LD `datePublished`; the zero time means unknown |
| `Description` | `string` | Page summary; `og:description` > JSON-LD > `<meta name="description">` |
| `SiteName` | `string` | Site name; `og:site_name` > JSON-LD `publisher` |
| `CanonicalURL` | `string` | Canonical URL; `<link rel="canonical">` > `og:url` |
| `Confidence` | `float64` | Extraction confidence, `0`–`1`; tiers in [Quality Signals](#quality-signals) |
| `ExtractionMethod` | `string` | `article` / `listing` / `body`; see [Quality Signals](#quality-signals) |

`WordCount` splits on whitespace and counts each CJK character individually. `ReadingTime` is folded per script: space-separated languages at 200 words per minute, CJK characters at 350 characters per minute. The result is an estimate only.

The five metadata fields from `Author` through `CanonicalURL` are controlled by `Config.ExtractMetadata` (default `true`); with it disabled they are left empty.

### Title Priority

`Result.Title` is resolved in two layers:

1. **Metadata layer** (`ExtractMetadata = true`, the default): JSON-LD `headline` > `og:title`. These titles are curated by the content producer and usually already lack a site-name suffix; the suffix is stripped only when the trailing segment exactly equals the declared site name. The length heuristic does **not** apply to this layer — a headline with a subtitle such as `GDP Falls 0.3% - Worst Quarter Since 2020` is kept in full.
2. **DOM layer** (metadata title absent, or `ExtractMetadata` disabled): `<title>` → the h1 inside the article → the first document h1 → the first h2. The `<title>` site-name suffix is stripped by a length heuristic: the trailing segment after the last separator such as ` - ` / ` | ` / ` · ` is dropped only when it is at most 30 characters and the preceding part is at least 3 characters.

So `Post Title - Example News` becomes `Post Title`; in `Post Title - Worst Quarter Since 2020 Was Rough` the trailing segment exceeds 30 characters, so the title is kept as is.

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
2. **Best candidate**: the highest-scoring node becomes the article container. The built-in scorer also walks the winner up to its wrapping container under score guardrails, so an article split into separate heading, body, and byline blocks is still kept whole.
3. **Fallback**: fall back to `<body>` when no candidate qualifies.

### Default Scorer Signals

The built-in scorer (internal, not exported) combines several signals and picks the highest-scoring container:

| Dimension | Positive signals | Negative signals |
|-----------|-----------------|------------------|
| **Tag semantics** | `<article>`(+1000), `<main>`(+900), `<section>`(+300), `<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style`/`noscript` return 0 directly |
| **class/id patterns** | `content`/`article`/`main`/`post`/`entry`/`text`/`body`/`story` (strong positive); `blog`/`news`/`detail`/`page` (moderate positive) | `comment`/`sidebar`/`nav`/`navigation`/`footer`/`header`/`menu`/`ad`/`advertisement` (strong negative); `related`/`share`/`social`/`meta`/`tag`/`category` (moderate negative); `promo`/`banner`/`sponsor` (weak negative) |
| **Paragraph density** | `<p>` count in the subtree scores: with 3 or more paragraphs each adds +150, with 1–2 each adds +80 | — |
| **Text length** | Long text scores in tiers by length (>100, >200, >500 bytes, each tier scoring higher; the excess beyond 500 counts at 1/10) | Text under 50 bytes loses 300 points |
| **Content density** | Block-average text density above 0.7 multiplies the total score by 1.2 | Density below 0.3 multiplies it by 0.7 |
| **Link density** | — | When link text exceeds 15% of the text and looks navigational (average link text under 25 bytes) or the total text is under 500 bytes, the score is scaled ×0.2–×0.75 by share (navbars and sitemaps are pushed down) |
| **Punctuation** | More than 5 commas (including the CJK comma `，`) add +10 each; more than 3 sentence-final marks (including `。！？`) add +15 each | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **Hidden elements** | — | Nodes with `style="display:none"`/`visibility:hidden`, the `hidden` attribute, `aria-hidden="true"`, or a hidden-class token in class/id (`hidden`/`hide`/`is-hidden`/`sr-only`/`visually-hidden`/`d-none`/`invisible`) are removed |

When the same pattern matches an `id` attribute, the score doubles: an `id` is unique across the document and characterizes the node more strongly than a `class` (`id="content"` outweighs `class="content-utility-text"`).

:::tip Layout wrapper exemption
When class/id carries both a content signal (`content`/`article`) and a removal signal (e.g. `sidebar`) — a layout class like `content-sidebar` is typical — the scorer keeps the node because it wraps the main content. Semantic tags `<article>`/`<main>` (or `role="main"`/`role="article"`) are always exempt from class/id removal heuristics, so `<article class="post-with-sidebar">` is never dropped.
:::

:::warning Where article detection applies
Article detection fits news, blogs, documentation, and other pages with a clear body area. Card-style listing pages are handled separately by [Listing Detection](#listing-detection); navigation pages and galleries, which have neither a body container nor a card list, may come out off-target. Set `ExtractArticle` to `false` and the library extracts the whole `<body>` instead.
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
    // Not called by the library under a custom scorer (kept to satisfy the interface)
    return node.Data() == "nav" || node.Data() == "footer"
}
```

`ShouldRemove` is only consulted while the library uses its built-in default scorer; with a custom `Scorer` configured, node removal still follows the built-in rules, so the return value has no effect.

To influence selection, return a low or negative score from `Score`, or implement `ArticleFinder` from the next section. For a complete runnable example, see [Testing & Custom Extensions](../integration/testing-custom).

### Single-Pass Selection: ArticleFinder

Calling `Score` per element enumerates every non-inline element in the document. A custom scorer that re-walks a subtree inside `Score` degrades the whole extraction to O(N²). Implementing the `ArticleFinder` interface as well takes over selection: the library calls `FindArticleNode` once instead of enumerating and scoring.

`FindArticleNode` receives the document root and returns the article root element or `nil`. Returning `nil` means "no article": the library falls back to the whole `<body>` accordingly, matching the built-in scorer's semantics. The interface constraints (the return value must come from one of `root`'s traversal methods) and a complete runnable example are covered in [Testing & Custom Extensions](../integration/testing-custom).

### Listing Detection

Card-style listing pages (blog indexes, news feeds, search results) mark each card as its own `<article>`, and every card carries the +1000 tag score. Under ordinary candidate selection the scorer would pick just one card.

Before article selection, the library checks the page shape: if a container holds **at least 3 direct-child `<article>` elements**, the cards' combined link-text density exceeds 0.3, and the cards' total text is at least half the page's visible text, the container is treated as a listing container. When the page is classified as a listing, `ExtractionMethod` is `listing` and `Text` is the whole card list.

The listing container itself must not be a removable shell (such as the wrapper of a `related` recommendation block); otherwise the page still takes the article path. An article page that carries only a single card section is not misclassified as a listing.

:::tip Telling listings from article pages
`ExtractionMethod` exists for exactly this: downstream code routes `listing` separately, neither treating it as a single article nor turning off `ExtractArticle`.
:::

### Quality Signals

`Result.Confidence` is a coarse extraction-quality signal in the range `0`–`1`. It is meant for routing, not as a probability (text lengths in the table below are measured in UTF-8 bytes):

| Confidence | Trigger |
|------------|---------|
| `0` | No text extracted |
| `0.2` | `<body>` fallback with under 50 bytes of text |
| `0.4` | `<body>` fallback with 50–199 bytes of text; an article node with under 50 bytes; or text under 600 bytes whose opening matches paywall/consent-wall wording (listings included) |
| `0.6` | A listing page; `<body>` fallback with at least 200 bytes; or an article node with 50–199 bytes |
| `0.8` | An article node with at least 200 bytes but under 5% of the page's visible text |
| `1.0` | An article node with at least 200 bytes and at least 5% of the page's visible text |

`Result.ExtractionMethod` states where `Text` came from: `article` (the scorer selected a content node), `listing` (recognized as a card list), or `body` (whole-`<body>` fallback, or `ExtractArticle = false`).

:::tip Routing by confidence
A common pattern is to send results below `1.0` for review or a fallback strategy: `body` + `0.2` often means the page is JS-rendered; `article` + `0.4` may mean a paywall truncated it.
:::

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
| `"markdown"` | Markdown table with a header separator row; `colspan` expands into empty placeholder columns (columns that are placeholders throughout are filtered out), `rowspan` repeats the original cell text at each spanned row; structure-only rows holding width definitions are skipped | Human reading, Markdown consumption |
| `"html"` | Re-emits the `<table>` tags (`colspan`/`rowspan` kept as attributes, alignment and width rewritten into `style`, cell text HTML-escaped); structure rows kept | Downstream processing that needs the exact table structure |

Two cases are not rendered as data tables:

- **Layout shells**: a `<table>` with `role="presentation"` or `role="none"` (case-insensitive) is flattened into a plain layout container and its cell text is joined as paragraphs; a nested table whose own direct text is under 25 bytes is flattened the same way.
- **Legacy presentational attributes**: `border="0"`, `cellpadding`, and `cellspacing` do not take part in the decision — modern data tables commonly have zero borders, and those attributes cannot tell layout from data.

Two body-format conventions apply outside tables: h1–h6 are written with Markdown ATX heading markers (`# ` through `###### `); `<pre>`/`<code>` keep their internal line breaks, so code blocks and ASCII art are not collapsed onto one line.

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
	// # Price List
	//
	// | Product | Price |
	// | --- | --- |
	// | Basic | Free |
	// | Pro | $99/mo |
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
When a GBK or Shift_JIS page has no `<meta charset>`, basic detection falls back to windows-1252 and the decoded result is mojibake — **no error is returned**, so the caller cannot tell from `err`. Set `cfg.Encoding` whenever the source encoding is known. See [Encoding Detection](./encoding-detection).
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

- [Reader Mode](./reader-mode) - Sectioned whole-page output that keeps navigation and footers
- [Output Formats](./output-formats) - Differences and trade-offs between the three output formats
- [Processor Cache & Reuse](../performance/processor-cache) - Performance optimization for high-frequency calls
- [API Reference: Functions](../../api-reference/core/functions) - Complete function signatures
