---
sidebar_label: "Output Formats"
title: "Output Formats - CyberGo html | Markdown & JSON Output"
description: "CyberGo html output API: ExtractToMarkdown and ExtractToJSON signatures, context variants, Markdown cache isolation, and JSON field omission rules."
sidebar_position: 10
---

# Output Formats

`ExtractToMarkdown` renders extraction results as Markdown text; `ExtractToJSON` renders them as JSON bytes.

## Markdown Output

`ExtractToMarkdown` fixes `InlineImageFormat` and `InlineLinkFormat` to `markdown` before extracting, then returns `Result.Text`. The values of those two fields in the `Config` you pass have no effect, so `html.MarkdownConfig()` is not needed.

### Cache and Instance Behavior

Called as a Processor method, `ExtractToMarkdown` neither hits nor writes the main Processor's cache. It builds a **one-shot Processor** from the current configuration:

- It makes a **value copy** of the config (the config is immutable after `New()`, so no lock is needed) and then overrides the two format fields; the format settings are never written back to the shared config
- **Cache is disabled** (`MaxCacheEntries = 0`): it neither reads nor writes the main cache, so format-specific results never pollute it
- It **reuses the main Processor's Scorer, audit collector, and statistics counters**: audit events and statistics from the conversion count toward the main Processor and are visible through `GetAuditLog` and `GetStatistics`
- The mechanism is thread-safe

To let extraction results enter the main cache, use `Extract` and set `InlineImageFormat`/`InlineLinkFormat` yourself.

### Package Functions

```go
func ExtractToMarkdown(htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFile(filePath string, cfg ...Config) (string, error)
func ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) (string, error)
```

### Processor Methods

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

### Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Example Document</title></head><body>
<p>A body paragraph that contains an image.</p>
<p><img src="/img/photo.png" alt="Example image"></p>
<p>Visit <a href="https://example.com">example site</a> to learn more.</p>
</body></html>`)

	md, err := html.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// Output: Markdown text containing the image and the link,
	//         e.g. ![Example image](/img/photo.png) and [example site](https://example.com)
}
```

### Format Options

`ExtractToMarkdown` always uses the `markdown` format. For other inline formats, use `Extract` with these `Config` fields:

| Field | Values | Effect |
|-------|--------|--------|
| `InlineImageFormat` | `none` (default) | Images are not inlined into the text |
| | `markdown` | Emits `![alt](url)` |
| | `html` | Emits `<img src="url" alt="alt">` |
| | `placeholder` | Emits a `[IMAGE:N]` placeholder |
| `InlineLinkFormat` | `none` (default) | Links are not inlined into the text |
| | `markdown` | Emits `[text](url)` |
| | `html` | Emits `<a href="url">text</a>` |

### Markdown Formatting Mechanism

Inline images and links are produced by **placeholder replacement** in two steps:

1. **Text extraction**: each `<img>` inserts a `[IMAGE:N]` placeholder into the text stream, and each `<a>` inserts a paired `[LINK:N]...[/LINK]` (`N` is a positional index matching the `Position` in the `Images`/`Links` slices)
2. **Formatting**: per `InlineImageFormat`/`InlineLinkFormat`, placeholders are replaced with the target format (markdown/html) or removed outright (none). Links are replaced before images: a leftover `[IMAGE:N]` placeholder inside link text is rendered during the image phase, producing a link-wrapped image of the form `[text ![alt](img)](url)`

When emitting the `markdown` format, the formatting step escapes `[`, `]`, `\`, and `|` in image alt text and link text to `\[`, `\]`, `\\`, and `\|`, so they cannot break Markdown link/image syntax (a bare `|` would also split a Markdown table cell). In link/image target URLs, `(`, `)`, spaces, and `|` are percent-encoded to `%28`, `%29`, `%20`, and `%7C`, keeping the target a valid, copyable URL. Escaping and encoding happen only on the markdown branch and are **never reverted** — keeping them is the point of the injection guard.

## JSON Output

`ExtractToJSON` runs the regular `Extract` first and then serializes with `json.Marshal`. The Processor method hits and writes the main cache; the package function uses a pooled or one-shot Processor, so nothing is cached across calls.

### Package Functions

```go
func ExtractToJSON(htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFile(filePath string, cfg ...Config) ([]byte, error)
func ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)
```

### Processor Methods

```go
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

### Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Example Document</title></head><body>
<p>This is a body paragraph.</p>
<p><img src="/img/photo.png" alt="Example image"></p>
<a href="https://example.com">example site</a>
</body></html>`)

	jsonBytes, err := html.ExtractToJSON(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(jsonBytes))
	// Output: a JSON string containing fields such as text/title/images/links
}
```

### JSON Output Structure

JSON serialization is a custom implementation in `Result.MarshalJSON()`, mirroring the internal `jsonResult` struct:

| JSON field | Type | Source | Omission rule |
|------------|------|--------|---------------|
| `text` | string | `Result.Text` (extracted body) | Always emitted |
| `title` | string | `Result.Title` (document title) | Always emitted |
| `images` | array | `Result.Images` | `omitempty`, omitted when empty |
| `links` | array | `Result.Links` | `omitempty`, omitted when empty |
| `videos` | array | `Result.Videos` | `omitempty`, omitted when empty |
| `audios` | array | `Result.Audios` | `omitempty`, omitted when empty |
| `processing_time_ms` | int | `Result.ProcessingTime` | Always emitted (milliseconds) |
| `word_count` | int | `Result.WordCount` | Always emitted |
| `reading_time_ms` | int | `Result.ReadingTime` | Always emitted (milliseconds) |
| `author` | string | `Result.Author` | `omitempty`, omitted when empty |
| `published_time` | string | `Result.PublishedTime` (RFC 3339) | Omitted when zero (a pointer is used internally, so `0001-01-01T00:00:00Z` never appears) |
| `description` | string | `Result.Description` | `omitempty`, omitted when empty |
| `site_name` | string | `Result.SiteName` | `omitempty`, omitted when empty |
| `canonical_url` | string | `Result.CanonicalURL` | `omitempty`, omitted when empty |
| `confidence` | number | `Result.Confidence` | Always emitted (**no** `omitempty`, so `0` is serialized too) |
| `extraction_method` | string | `Result.ExtractionMethod` | `omitempty`, omitted when empty |

`ProcessingTime` and `ReadingTime` carry a `json:"-"` tag on the `Result` struct, so standard serialization skips them; the custom `MarshalJSON` is what writes them as millisecond values. The JSON form targets external consumers and **does not implement `UnmarshalJSON`**, so it cannot be deserialized back into a `Result`.

### Sample Output

Below is the output for a sample page with an h1, two body paragraphs, one image, and one link (`processing_time_ms` varies by machine; `reading_time_ms`, `confidence`, and `extraction_method` are measured values):

```json
{
  "text": "# Go Tutorial\n\nGo is a compiled language.\n\nGo website",
  "title": "Go Tutorial",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Go website", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 17,
  "reading_time_ms": 3428,
  "confidence": 0.6,
  "extraction_method": "article"
}
```

`reading_time_ms` is 3428: whitespace-tokenized words convert at 200 words per minute and CJK characters at 350 characters per minute, then the two parts are added. `confidence=0.6` means an article node was selected but its text is short; `extraction_method=article` means the body came from the node the scorer selected. Grading rules are in [Type Definitions](../types/type-defs#quality-signals).

When the page declares structured metadata, the output carries these extra fields (values are examples):

```json
{
  "author": "Example Reporter",
  "published_time": "2026-04-21T09:30:00Z",
  "description": "The company reported strong quarterly results on Tuesday.",
  "site_name": "Example News",
  "canonical_url": "https://news.example.com/q3-results.html"
}
```

They appear only when `ExtractMetadata=true` (the default) and the page actually declares the corresponding metadata; source priority is in [Type Definitions](../types/type-defs#metadata-field-resolution).
