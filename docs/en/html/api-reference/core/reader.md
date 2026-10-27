---
sidebar_label: "Reader Mode"
title: "Reader Mode - CyberGo html | ReadPage & ReadResult"
description: "CyberGo html reader-mode API: 12 ReadPage functions and methods, ReadResult with Render and RenderText, PageSection fields, and SectionKind values."
sidebar_position: 15
---

# Reader Mode

Reader mode (`ReadPage*`) returns a **whole-page** structured reading view instead of a single selected article: the page is split into `header` / `navigation` / `main` / `aside` / `footer` sections, each carrying text, links, and images, with inline hyperlinks always preserved. It targets pipelines that feed web content to LLMs, RAG, or text analysis.

Choosing between the two: use [Extract](./functions#extract) for "article only", this page's API for "readable whole-page text plus structural labels". Concepts and worked examples are in the [Reader Mode guide](../../guides/core-features/reader-mode).

| Aspect | `Extract` | `ReadPage` |
|--------|-----------|-----------|
| Output | Selected article plus metadata (`*Result`) | Whole page as sections (`*ReadResult`) |
| Navigation, footer | Removed | Kept and labeled by kind |
| Inline links | Controlled by `InlineLinkFormat`, omitted by default | Always preserved |
| Cache | Used | Not used |

## Package Functions

Twelve entry points; `cfg ...Config` follows the [package-function resolution rules](./functions#config-parameter-resolution) (omitted uses `DefaultConfig()`; two or more return `ErrMultipleConfigs`).

| Function | Signature |
|----------|-----------|
| `ReadPage` | `(htmlBytes []byte, cfg ...Config) (*ReadResult, error)` |
| `ReadPageWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*ReadResult, error)` |
| `ReadPageFromFile` | `(filePath string, cfg ...Config) (*ReadResult, error)` |
| `ReadPageFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*ReadResult, error)` |
| `ReadPageToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownText` | `(htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdown` | `(filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownText` | `(filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownTextWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

## Processor Methods

The same twelve methods with identical signatures, minus the `cfg ...Config` parameter (they use the instance's own configuration).

| Method | Signature |
|--------|-----------|
| `Processor.ReadPage` | `(htmlBytes []byte) (*ReadResult, error)` |
| `Processor.ReadPageWithContext` | `(ctx context.Context, htmlBytes []byte) (*ReadResult, error)` |
| `Processor.ReadPageFromFile` | `(filePath string) (*ReadResult, error)` |
| `Processor.ReadPageFromFileWithContext` | `(ctx context.Context, filePath string) (*ReadResult, error)` |
| `Processor.ReadPageToMarkdown` | `(htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownText` | `(htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownTextWithContext` | `(ctx context.Context, htmlBytes []byte) (string, error)` |
| `Processor.ReadPageFromFileToMarkdown` | `(filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownWithContext` | `(ctx context.Context, filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownText` | `(filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownTextWithContext` | `(ctx context.Context, filePath string) (string, error)` |

See the [Processor method overview](./processor#method-overview) for the total method count and the other groups.

## ReadResult

```go
type ReadResult struct {
	Title          string        `json:"title"`
	Author         string        `json:"author,omitempty"`
	PublishedTime  time.Time     `json:"published_time,omitzero"`
	Description    string        `json:"description,omitempty"`
	SiteName       string        `json:"site_name,omitempty"`
	CanonicalURL   string        `json:"canonical_url,omitempty"`
	Sections       []PageSection `json:"sections"`
	ProcessingTime time.Duration `json:"-"`
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Title` | `string` | Document title, same priority as [`Result.Title`](../types/type-defs#result) |
| `Author` | `string` | Author (JSON-LD `author` > `<meta name="author">`) |
| `PublishedTime` | `time.Time` | Publication time; the zero time means unknown |
| `Description` | `string` | Page summary |
| `SiteName` | `string` | Publishing site name |
| `CanonicalURL` | `string` | Canonical URL |
| `Sections` | `[]PageSection` | Sections in document order; adjacent same-kind sections merge, empty ones drop; never `nil` |
| `ProcessingTime` | `time.Duration` | Wall-clock time for this extraction (excluded from JSON) |

The metadata fields (`Author` through `CanonicalURL`) are filled only when `Config.ExtractMetadata=true` (the default); source priority is in [Structured Metadata](#structured-metadata).

### Render

```go
func (r *ReadResult) Render() string
```

Flattens the sections into one Markdown document **with inline links**: the non-empty `Title` first as `# <Title>`, then each section under a `# <Kind label>` heading with its `PageSection.Text`. Kind labels are fixed as `Header` / `Navigation` / `Main Content` / `Aside` / `Footer`. When there is nothing to emit (no title and every section skipped), an empty string is returned.

### RenderText

```go
func (r *ReadResult) RenderText() string
```

`ReadResult.RenderText` produces the same structure as `Render` but **without link or image markup**, using `PageSection.PlainText`: link labels stay as plain words and image placeholders are dropped. An icon-only navigation with no words appears in `Render` but is omitted in `RenderText`.

```go
page, err := html.ReadPage(data)
if err != nil {
	log.Fatal(err)
}
fmt.Println(page.Render())     // Whole-page Markdown with inline links
fmt.Println(page.RenderText()) // Link-free plain text
```

When you want the output directly, `ReadPageToMarkdown` / `ReadPageToMarkdownText` wrap the two in a single step (internally, each runs the corresponding Render method on a temporary Processor with the inline formats overridden to `markdown` / `none`).

## PageSection

```go
type PageSection struct {
	Kind      SectionKind `json:"kind"`
	Text      string      `json:"text"`
	PlainText string      `json:"plain_text,omitempty"`
	Links     []LinkInfo  `json:"links,omitempty"`
	Images    []ImageInfo `json:"images,omitempty"`
	WordCount int         `json:"word_count"`
}
```

| Field | Type | Description |
|-------|------|-------------|
| `Kind` | `SectionKind` | Section kind |
| `Text` | `string` | Section body; inline links follow `InlineLinkFormat`, images follow `InlineImageFormat` |
| `PlainText` | `string` | Same text without link and image markup; used by `RenderText` |
| `Links` | `[]LinkInfo` | `<a>` elements in document order; empty when `PreserveLinks=false` |
| `Images` | `[]ImageInfo` | `<img>` elements in document order; empty when `PreserveImages=false` (images already inlined in `Text` still render) |
| `WordCount` | `int` | Word count of `PlainText` (CJK characters count one each); link URLs and image placeholders are already stripped when `PlainText` is produced, so they do not count |

`Links`/`Images` `Position` is relative to the **contributing region**, not an offset into the merged `Text`.

## SectionKind

```go
type SectionKind string

const (
	SectionHeader     SectionKind = "header"
	SectionNavigation SectionKind = "navigation"
	SectionMain       SectionKind = "main"
	SectionAside      SectionKind = "aside"
	SectionFooter     SectionKind = "footer"
)
```

| Constant | Value | Heading in `Render` | Recognized by |
|----------|-------|--------------------|----------------|
| `SectionHeader` | `header` | `Header` | `<header>`, `role=banner`, or class/id containing `header`/`masthead`; a `<nav>` nested inside the header joins the header section, and unmarked residual blocks before the first `main` are classified as header too |
| `SectionNavigation` | `navigation` | `Navigation` | `<nav>`, `role=navigation`, link-dense residual blocks (tag clouds, "popular links") |
| `SectionMain` | `main` | `Main Content` | `<main>`/`<article>` and similar main-content landmarks; the scorer-selected body node when no landmark exists |
| `SectionAside` | `aside` | `Aside` | `<aside>`, `role=complementary`, or secondary content regions whose class/id contains `aside` |
| `SectionFooter` | `footer` | `Footer` | `<footer>`, `role=contentinfo`, or class/id containing `footer`; unmarked residual blocks after the last `main` are classified as footer too |

There can be several `main` sections (for example an article followed by a comment block that is also classified as main content).

## Key Semantics

:::tip Links and images
- **Links are always preserved.** In reader mode `InlineLinkFormat` selects the **style** only — the value is `markdown` (`[text](URL)`) or `html` (`<a href>`); the default value `none` is handled as `markdown`, so `ReadPage`'s flat output never silently drops links.
- **`PreserveLinks=false`** empties only the `PageSection.Links` slice; `Text` still carries `[text](URL)`. Use `RenderText()` or `ReadPageToMarkdownText` when you need genuinely link-free text.
- **`PreserveImages=false`** empties `PageSection.Images`; images already inlined into `Text` (`InlineImageFormat` of `markdown`/`html`) stay. With `InlineImageFormat="none"` as well, images appear in neither `Text` nor `Images`.
:::

:::info Cache, instances, and deduplication
- **No caching.** `ReadPage`'s result type differs from `Result`, so it neither reads nor writes the extraction cache; repeated calls reprocess the input. Cache whole-page results in the caller if needed.
- **Statistics.** `ReadPage` counts toward `TotalProcessed`, `ErrorCount`, and `AverageProcessTime`, but never increments `CacheHits`/`CacheMisses` (the cache is not involved).
- **`ReadPage*ToMarkdown*` uses a temporary Processor**: it copies the parent instance's config and overrides the two inline formats as required, with the cache disabled. It therefore never pollutes the parent cache, while statistics and audit still count toward the parent instance (visible through `GetStatistics`/`GetAuditLog`).
- **Section deduplication**: a later **same-kind chrome section** (`main` excluded) whose whitespace-insensitive text is exactly identical to an earlier one is dropped entirely, removing duplicate menus from responsive layouts; **main sections never take part in deduplication**. A section whose root node is itself hidden is dropped entirely.
:::

Cleaning is kind-aware: `main` sections get the same content cleaning as article extraction (ads, hidden nodes, and nested navigation removed); chrome sections keep their menus and links and drop only hidden nodes.

## Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	page := []byte(`<html>
<head><title>Quarterly Results</title></head>
<body>
  <header><nav><a href="/">Home</a> <a href="/tech">Tech</a></nav></header>
  <main><article>
    <h1>Quarterly Results Announced</h1>
    <p>The company posted strong quarterly results. <a href="/analysis">Full analysis</a> is available.</p>
  </article></main>
  <aside><p>Sidebar: market data summary.</p></aside>
  <footer><p>© 2026 Example News</p></footer>
</body></html>`)

	md, err := html.ReadPageToMarkdown(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)

	result, err := html.ReadPage(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: Quarterly Results
	for _, sec := range result.Sections {
		fmt.Println(sec.Kind, sec.WordCount)
	}
	// Output:
	// header 2
	// main 13
	// aside 4
	// footer 4
}
```

## Structured Metadata

With `ExtractMetadata` (default `true`), the five `ReadResult` metadata fields fill by this priority; when it is off, those fields stay empty and the title also falls back to DOM sources.

| Field | Source priority |
|------|-----------------|
| `Author` | JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished` |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name` |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

With `ExtractMetadata` off, those five fields stay empty and `Title` falls back to the DOM layer: `<title>` (with a length-heuristic site-name suffix strip when the trailing segment is ≤30 characters and the leading segment is ≥3 characters) → h1 inside the body → first h1 in the document → first h2.

## Errors

The errors are the same as [`Extract`](./processor#error-returns): `ErrProcessorClosed`, `ErrInputTooLarge`, `ErrInvalidHTML`, `ErrMaxDepthExceeded`, `ErrProcessingTimeout`, `ErrInternalPanic`, `ErrTooManyConcurrentOps`.

The `*WithContext` variants also return `context.Canceled` / `context.DeadlineExceeded` unchanged.

Package functions add two more errors: `ErrMultipleConfigs` (two or more `Config` values) and `ErrInvalidConfig` wrapped in `*ConfigError`.

`*FromFile` variants additionally return a `*FileError` whose `FileErr` wraps `ErrFileNotFound` or `ErrInvalidFilePath` (path traversal denials wrap the latter too, so `errors.Is` matches); on an `AllowedBaseDir` escape, `FileErr` is `path outside allowed directory`, which matches no sentinel.

## Related Documentation

- [Reader Mode guide](../../guides/core-features/reader-mode) — Trade-offs against `Extract`, output samples, and configuration
- [Package Functions](./functions) — The `Extract` family entries
- [Processor](./processor) — Instance lifecycle and statistics
- [Type Definitions](../types/type-defs) — `Result`, `LinkInfo`, `ImageInfo`
- [Config](./config) — Fields such as `InlineLinkFormat` and `ExtractMetadata`
