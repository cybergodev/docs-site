---
sidebar_label: "Output Formats"
title: "Output Formats - CyberGo html | Markdown & JSON Output"
description: "CyberGo html output API: ExtractToMarkdown and ExtractToJSON functions and methods, context variants, cache isolation, and JSON field mapping."
sidebar_position: 10
---

# Output Formats

`ExtractToMarkdown` renders extraction results as Markdown text; `ExtractToJSON` renders them as JSON bytes.

## Markdown Output

`ExtractToMarkdown` fixes `InlineImageFormat` and `InlineLinkFormat` to `markdown` before extracting, then returns `Result.Text`. The values of those two fields in the `Config` you pass have no effect, so `html.MarkdownConfig()` is not needed.

### Cache and Instance Behavior

Called as a Processor method, `ExtractToMarkdown` neither hits nor writes the main Processor's cache. It builds a **transient Processor** from the current configuration:

- It makes a **value copy** of the config (the config is immutable after `New()`, so no lock is needed) and then overrides the two format fields; the format settings are never written back to the shared config
- **Cache is disabled** (`MaxCacheEntries = 0`), so format-specific results never pollute the main cache
- It **reuses the main Processor's Scorer, audit collector, and statistics counters**, so audit events and statistics from the conversion appear in `GetAuditLog` and `GetStatistics`
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
2. **Formatting**: per `InlineImageFormat`/`InlineLinkFormat`, placeholders are replaced with the target format (markdown/html) or removed (none)

When emitting the `markdown` format, the formatting step escapes `[`, `]`, and `\` in image alt text and link text to `\[`, `\]`, and `\\`, so they cannot break Markdown link/image syntax. Escaping happens only on the markdown branch and is **never reverted** — keeping the escapes is the point.

## JSON Output

`ExtractToJSON` runs the regular `Extract` first and then serializes with `json.Marshal`. The Processor method hits and writes the main cache; the package function uses a pooled or transient Processor, so nothing is cached across calls.

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

| JSON field | Type | Source |
|------------|------|--------|
| `text` | string | `Result.Text` (extracted body) |
| `title` | string | `Result.Title` (document title) |
| `images` | array | `Result.Images` (`omitempty`, omitted when empty) |
| `links` | array | `Result.Links` (`omitempty`) |
| `videos` | array | `Result.Videos` (`omitempty`) |
| `audios` | array | `Result.Audios` (`omitempty`) |
| `processing_time_ms` | int | `Result.ProcessingTime` in **milliseconds** |
| `word_count` | int | `Result.WordCount` |
| `reading_time_ms` | int | `Result.ReadingTime` in **milliseconds** |

`ProcessingTime` and `ReadingTime` carry a `json:"-"` tag on the `Result` struct, so standard serialization skips them; the custom `MarshalJSON` is what writes them as millisecond values. The JSON form targets external consumers and **does not implement `UnmarshalJSON`**, so it cannot be deserialized back into a `Result`.
