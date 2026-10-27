---
sidebar_label: "Output Formats"
title: "Output Formats - CyberGo html | Format Comparison Guide"
description: "CyberGo html output formats: plain text, Markdown, and JSON compared by structure and use case, plus inline format fields and JSON omission rules."
sidebar_position: 30
---

# Output Formats

The library produces plain text, Markdown, or JSON. This page compares the three structures and their use cases, and documents the inline-format fields.

## Format Comparison

| Feature | Plain Text | Markdown | JSON |
|---------|-----------|----------|------|
| Readability | High | High | Low (machine-oriented) |
| Structure preserved | Heading ATX markers and paragraph breaks | Headings/lists/links/images | Full metadata |
| Image handling | Not emitted | `![alt](url)` | `ImageInfo` list |
| Link handling | Visible text only | `[text](url)` | `LinkInfo` list |
| Table support | Rendered per `TableFormat` | Markdown tables | Same in `text`, plus structured metadata |
| Use cases | Search indexing/text analysis | Blogs/docs/readers | API transport/data storage |

## Plain Text

Keeps the text only and drops every HTML tag and formatting cue:

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
- Word count and reading-time statistics

### Characteristics

- Images are not emitted; links contribute only their visible text, without the URL
- Headings are written with Markdown ATX markers (`# ` through `###### `), and line breaks are preserved between paragraphs
- List content appears as plain text
- Tables are rendered per `TableFormat` (Markdown tables by default)

`ExtractText` calls `Extract` internally and returns `.Text`; the processing steps are identical.

## Markdown

Keeps headings, lists, tables, and inline resources while staying readable:

```go
// Option 1: package-level function
md, err := html.ExtractToMarkdown(data)

// Option 2: Processor instance
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
# Getting Started with Go

Go is a compiled language.

![Gopher](gopher.png)
[Go Official Site](https://go.dev)
```

### Format Options

In the text output of `Extract`, images and links are controlled by two fields:

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| Format value | Image output (`InlineImageFormat`) | Link output (`InlineLinkFormat`) |
|-------------|------------------|------------------|
| `none` | Not emitted | Visible text only |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | Not supported |

`placeholder` applies only to `InlineImageFormat` and leaves `[IMAGE:N]` tokens in the text so a later pass can substitute them by index; `InlineLinkFormat` accepts only `none`, `markdown`, and `html`.

:::tip MarkdownConfig vs ExtractToMarkdown
`MarkdownConfig()` sets `InlineImageFormat` and `InlineLinkFormat` to `markdown`, which affects the `Text` returned by `Extract`. `ExtractToMarkdown` always uses Markdown formatting regardless of configuration, so it does not need that preset.
:::

### Use Cases

- Content migration to Markdown blogs/static sites
- Email body generation
- Document format conversion
- RSS / newsletter content generation

## JSON

Structured output that keeps the full metadata:

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### Output Structure

A page with an h1, one paragraph, and one link measures as follows:

```json
{
  "text": "# Getting Started with Go\n\nGo is a compiled language.\n\nGo Official Site",
  "title": "Getting Started with Go",
  "links": [
    {"url": "https://go.dev", "text": "Go Official Site", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 12,
  "reading_time_ms": 3600,
  "confidence": 0.6,
  "extraction_method": "article"
}
```

The six fields `text`, `title`, `processing_time_ms`, `word_count`, `reading_time_ms`, and `confidence` are always present (`confidence` has no `omitempty`, so even `0` is serialized as usual). The rest appear as needed:

| Field | Type | When it appears |
|-------|------|-----------------|
| `images`/`links`/`videos`/`audios` | Arrays | `omitempty`: omitted when the matching `Preserve*` is `false` or there is no such content |
| `author` | String | `omitempty`: omitted when there is no author |
| `description` | String | `omitempty`: omitted when there is no summary |
| `site_name` | String | `omitempty`: omitted when there is no site name |
| `canonical_url` | String | `omitempty`: omitted when there is no canonical URL |
| `published_time` | RFC 3339 time | omitted when zero — a pointer is used internally, so `0001-01-01T00:00:00Z` never appears |
| `extraction_method` | String | `omitempty`: omitted when empty; it normally always has a value (`article`/`listing`/`body`) |

When the page declares structured metadata (and `ExtractMetadata` is `true`), the output gains these fields:

```json
{
  "author": "Example Reporter",
  "published_time": "2026-04-21T09:30:00Z",
  "description": "The company posted strong quarterly results on Tuesday.",
  "site_name": "Example News",
  "canonical_url": "https://news.example.com/q3-results.html"
}
```

:::tip Duration fields are emitted as milliseconds
`Result.ProcessingTime` and `Result.ReadingTime` carry `json:"-"` tags, so standard serialization skips them; the custom `MarshalJSON` writes them as the millisecond numbers `processing_time_ms` and `reading_time_ms`. The JSON form targets external consumers and does not implement `UnmarshalJSON`, so it cannot be deserialized back into a `Result`.
:::

### Use Cases

- API response data
- Database storage
- Microservice communication
- Frontend application integration

## Extracting Each Format from Files

Each format has a file variant:

```go
// Plain text
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## Context Variants

All three formats have `*WithContext` variants supporting timeout and cancellation:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## Decision Guide

```text
Need machine consumption? ── yes ──→ JSON
        │
        no
        │
Need structure preserved? ── yes ──→ Markdown
        │
        no
        │
        └──→ Plain text
```

## Next Steps

- [API Reference: Output Formats](../../api-reference/modules/output) - Complete API signatures
- [Link Extraction](./link-extraction) - Enumerate every resource link the page references
- [Configuration](../../api-reference/core/config) - All configuration options
