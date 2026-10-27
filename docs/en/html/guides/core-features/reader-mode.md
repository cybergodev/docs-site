---
sidebar_label: "Reader Mode"
title: "Reader Mode - CyberGo html | Clean Pages for LLMs"
description: "CyberGo html reader mode: ReadPage splits a page into header, navigation, main, aside, and footer sections, keeps inline links, and emits LLM-ready Markdown."
sidebar_position: 15
---

# Reader Mode

Reader mode (the `ReadPage` family) keeps the whole page split into structural sections instead of selecting a single article. It targets pipelines that feed web content to LLMs, RAG, or text analysis: HTML/CSS/JS markup is removed, navigation and footers stay but are labeled as their own sections, and inline hyperlinks are preserved as `[text](URL)`.

## How It Differs from Extract

| Aspect | `Extract` | `ReadPage` |
|--------|-----------|-----------|
| Output | Selected article plus metadata | Whole page as sections (`[]PageSection`) |
| Navigation, footer | Removed | Kept and labeled |
| Ads, related posts | Removed | Removed |
| Inline links | Controlled by `InlineLinkFormat`, omitted by default | Always preserved |
| Result type | `Result` | `ReadResult` |
| Cache | Uses it | Does not (the result type differs) |

Use `Extract` when you want the article only; use `ReadPage` when you want a readable whole-page text with structural labels.

## One Call, Whole Page

The two most common entry points return a single Markdown document:

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

	// With links: for prompts that need citable sources
	md, err := html.ReadPageToMarkdown(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)

	// Without links: link labels stay as plain words
	plain, err := html.ReadPageToMarkdownText(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(plain)
}
```

`ReadPageToMarkdown` output (excerpt):

```text
# Quarterly Results

# Header

[Home](/) [Tech](/tech)

# Main Content

# Quarterly Results Announced

The company posted strong quarterly results. [Full analysis](/analysis) is available.

# Aside

Sidebar: market data summary.

# Footer

© 2026 Example News
```

`ReadPageToMarkdownText` produces the same structure, but `[Home](/)` becomes `Home`.

:::tip Section headings are always English
`Render`/`RenderText` use the fixed headings `Header` / `Navigation` / `Main Content` / `Aside` / `Footer`, matching the `SectionKind` values (`header`/`navigation`/`main`/`aside`/`footer`) one-to-one. The document title (`ReadResult.Title`) becomes the top-level `#` heading when available.
:::

## Structured Sections

Call `ReadPage` when you want to select sections yourself:

```go
page, err := html.ReadPage(htmlBytes)
if err != nil {
	log.Fatal(err)
}
for _, sec := range page.Sections {
	fmt.Println(sec.Kind, sec.WordCount)
}
```

Per-field documentation for `ReadResult` and `PageSection` is in [API Reference: ReadResult](../../api-reference/core/reader#readresult) and [PageSection](../../api-reference/core/reader#pagesection).

`SectionKind` values and how they are recognized:

| Constant | Value | Recognized by |
|----------|-------|---------------|
| `SectionHeader` | `header` | `<header>`, `role=banner`, or `header`/`masthead` in class/id |
| `SectionNavigation` | `navigation` | `<nav>`, `role=navigation`, a link-dense residual block, or `nav`/`menu`/`breadcrumb` in class/id |
| `SectionMain` | `main` | `<main>`/`<article>`, `role=main/article`, or the content node the scorer selects |
| `SectionAside` | `aside` | `<aside>`, `role=complementary`, or `sidebar`/`aside` in class/id |
| `SectionFooter` | `footer` | `<footer>`, `role=contentinfo`, or `footer`/`colophon` in class/id |

The same `Kind` can appear more than once: adjacent same-kind sections merge, and a comment section that follows the main content may also be classified as `main`.

### Keeping Only the Main Content

To drop page chrome, filter by `Kind` and reassemble:

```go
var main []html.PageSection
for _, sec := range page.Sections {
	if sec.Kind == html.SectionMain {
		main = append(main, sec)
	}
}
subset := html.ReadResult{Title: page.Title, Sections: main}
fmt.Println(subset.Render())     // with links
fmt.Println(subset.RenderText()) // without links
```

`Render` and `RenderText` differ only in links and images: `Render` uses `Text`, `RenderText` uses `PlainText`. Icon-only navigation with no words appears in `Render` but is omitted from `RenderText`.

## Cleaning Rules

Sections are cleaned by kind:

- **Main content sections** (`main`): the same cleaning as article extraction — ads, social widgets, related posts, and comment blocks are removed wholesale.
- **Page chrome** (header/navigation/aside/footer): menus and links are kept (navigation is the substance of the chrome); only hidden nodes are dropped.
- **Deduplication**: a later chrome section whose text (ignoring whitespace) is identical to an existing one is dropped, which removes responsive duplicate menus. Main sections never take part in deduplication.
- **Hidden sections**: a section whose root node is itself hidden (`display:none`, `hidden`) is dropped entirely.

## Configuration

| Setting | Behavior in reader mode |
|---------|------------------------|
| `InlineLinkFormat` | Takes `markdown` or `html`; the default value `none` is treated as `markdown` |
| `InlineImageFormat` | `none` keeps images in the `Images` list only, never in `Text`; `markdown`/`html` inline them into `Text` |
| `PreserveLinks` | `false` empties `PageSection.Links`, but `Text` still carries inline links |
| `PreserveImages` | `false` empties `PageSection.Images`; images already inlined (`InlineImageFormat` not `none`) stay |
| `BaseURL` / `ResolveRelativeURLs` | Same resolution rules as `ExtractAllLinks`: relative links become absolute |
| `ExtractMetadata` | Whether `ReadResult` fills Author / PublishedTime / Description / SiteName / CanonicalURL |
| `ExtractArticle` | Whether the scorer picks a content node as the `main` section when the page has no semantic regions |
| `MaxInputSize` / `MaxDepth` / `ProcessingTimeout` / `EnableSanitization` | Identical to `Extract` |

Reader mode **is not affected by the cache**: every `ReadPage` call reprocesses the input. Cache whole-page results yourself in the caller if you need to.

## Function Overview

Each package function has a matching `Processor` method; the only difference is the `cfg ...Config` parameter (for example, the package-level `ReadPageToMarkdown(htmlBytes, cfg...)` corresponds to the instance method `Processor.ReadPageToMarkdown(htmlBytes)`, which takes its configuration from the instance). The full mapping and per-function signatures are in [API Reference: Reader Mode](../../api-reference/core/reader#package-functions).

Errors match `Extract`; the `*FromFile` variants additionally return `*FileError` (`ErrFileNotFound`, `ErrInvalidFilePath`, or a path traversal rejection).

## Structured Metadata

Both `Extract` and `ReadPage` fill these fields, controlled by `Config.ExtractMetadata` (default `true`):

| Field | Source priority |
|-------|-----------------|
| `Author` | JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished` |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name` |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

Disabling metadata extraction also changes where `Title` comes from: it falls back to the DOM layer — `<title>` (site-name suffix stripped when the trailing segment is ≤30 characters and the preceding part is ≥3 characters; full rules in [Content Extraction](./content-extraction#title-priority)) → the h1 inside the article → the first document h1 → the first h2.

## Next Steps

- [Content Extraction](./content-extraction) - the `Extract` flow, `Result`, and article detection
- [Output Formats](./output-formats) - Markdown versus JSON output
- [API Reference: Package Functions](../../api-reference/core/functions) - full signatures
