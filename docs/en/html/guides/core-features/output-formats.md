---
sidebar_label: "Output Formats"
title: "Output Format Guide - CyberGo html | Format Comparison"
description: "CyberGo html output format guide: comparing the features and use cases of plain text, Markdown, and JSON output, including format option configuration."
sidebar_position: 2
---

# Output Formats

This guide helps you choose the right format among plain text, Markdown, and JSON outputs.

## Format Comparison

| Feature | Plain Text | Markdown | JSON |
|---------|-----------|----------|------|
| Readability | High | High | Low (machine-friendly) |
| Structure Preservation | None | Headings/lists/links/images | Full metadata |
| Image Handling | Removed | `![alt](url)` | ImageInfo list |
| Link Handling | Text only | `[text](url)` | LinkInfo list |
| Table Support | None | Markdown tables | Raw data |
| Use Cases | Search indexing/text analysis | Blogs/docs/readers | API transport/data storage |

## Plain Text

The lightest output format, keeping only text content and removing all HTML tags and formatting.

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### Use Cases

- Building search indexes
- Text analysis and NLP processing
- Generating summaries and previews
- Word count and reading time statistics

### Characteristics

- Image alt text is removed; link visible text is retained (only the URL and Markdown syntax are stripped)
- Line breaks preserved between headings and paragraphs
- List content displayed as plain text
- Tables are rendered per `TableFormat` (Markdown tables by default)

## Markdown

Preserves document structure while maintaining readability. Ideal for content migration and reading scenarios.

```go
// Option 1: Package-level function
md, err := html.ExtractToMarkdown(data)

// Option 2: Use Processor
p, _ := html.New()
defer p.Close()
md2, err := p.ExtractToMarkdown(data)
```

### Output Example

Input HTML:

```html
<article>
    <h1>Getting Started with Go</h1>
    <p>Go is a compiled language.</p>
    <img src="gopher.png" alt="Gopher" />
    <a href="https://go.dev">Go Official Site</a>
</article>
```

Output Markdown:

```markdown
Getting Started with Go

Go is a compiled language.

![Gopher](gopher.png)
[Go Official Site](https://go.dev)
```

### Format Options

Markdown format is controlled by two config fields:

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| Format Value | Image Output (InlineImageFormat) | Link Output (InlineLinkFormat) |
|-------------|------------------|------------------|
| `none` | Removed | Text only |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | - (not supported) |

:::tip Use MarkdownConfig()
The `MarkdownConfig()` preset already sets image and link formats to `markdown`. Just use it directly without manual configuration.
:::

:::info Placeholder Format
`placeholder` only applies to `InlineImageFormat`, inserting `[IMAGE:N]` placeholders in text. `InlineLinkFormat` does not support this value — only `none`, `markdown`, `html`.
:::

### Use Cases

- Content migration to Markdown blogs/static sites
- Email body generation
- Document format conversion
- RSS / Newsletter content generation

## JSON

Structured output preserving complete metadata. Ideal for inter-program transmission and persistent storage.

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### Output Structure

```json
{
  "text": "Getting Started with Go\n\nGo is a compiled language.\n\nGo Official Site",
  "title": "Getting Started with Go",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Go Official Site", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 12,
  "reading_time_ms": 3600
}
```

:::tip Time Fields
In JSON output, `ProcessingTime` and `ReadingTime` are automatically converted to milliseconds (`processing_time_ms`, `reading_time_ms`) for frontend and API consumption.
:::

### Use Cases

- API response data
- Database storage
- Microservice communication
- Frontend application integration

## Extracting All Formats from Files

Each format supports file reading:

```go
// Plain text
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## Context Variants

All format functions have `ExtractWithContext` variants supporting timeout and cancellation:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## Decision Guide

```text
Need machine consumption?── yes ──→ JSON
        │
        no
        │
Need format preservation?── yes ──→ Markdown
        │
        no
        │
        └──→ Plain Text
```

## Next Steps

- [API Reference: Output Formats](../../api-reference/modules/output) - Complete API signatures
- [Link Extraction & Grouping](./link-extraction) - Extract page resource links
- [Configuration](../../api-reference/core/config) - All configuration options
