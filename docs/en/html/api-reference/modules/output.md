---
sidebar_label: "Output Formats"
title: "Output Formats - CyberGo html | Markdown & JSON Output"
description: "CyberGo html output API: ExtractToMarkdown and ExtractToJSON functions and Processor methods, from bytes or files, with temporary Processor cache isolation."
sidebar_position: 10
---

# Output Formats

The HTML library supports outputting extraction results as Markdown or JSON format.

## Markdown Output

Extract HTML content and convert to Markdown format. Internally it sets both `InlineImageFormat` and `InlineLinkFormat` to `markdown` before extracting, and ultimately returns `Result.Text`.

:::warning
`ExtractToMarkdown` neither hits nor writes to the main Processor's cache. It builds a **transient Processor** via `buildFormatProcessor`:

- It performs a **value copy** of the current configuration (`config` is immutable after `New()`, so the copy needs no lock) and then overrides the two format fields — the format settings are never written back to the shared config
- **Cache is disabled** (`MaxCacheEntries = 0`): it neither reads from nor writes to the main Processor's cache, preventing format-specific results from polluting the main cache
- It **reuses the main Processor's Scorer** but uses an **independent, disabled audit collector**, ensuring that the main Processor's `Close()` does not race with an in-flight extraction
- This mechanism is thread-safe

If you want extraction to go through the cache, use the regular `Extract` instead and configure `InlineImageFormat`/`InlineLinkFormat` yourself.
:::

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

	md, err := html.ExtractToMarkdown(data, html.MarkdownConfig())
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// Output: Markdown text containing the image and the link,
	//         e.g. ![Example image](/img/photo.png) and [example site](https://example.com)
}
```

### Format Options

`ExtractToMarkdown` always uses the `markdown` format. If you need other inline formats, use the regular `Extract` together with the following `Config` fields:

| Field | Optional values | Effect |
|-------|-----------------|--------|
| `InlineImageFormat` | `none` (default) | Images are not inlined into the text |
| | `markdown` | Outputs `![alt](url)` |
| | `html` | Outputs `<img src="url" alt="alt">` |
| | `placeholder` | Outputs a placeholder `[IMAGE:N]` |
| `InlineLinkFormat` | `none` (default) | Links are not inlined into the text |
| | `markdown` | Outputs `[text](url)` |
| | `html` | Outputs `<a href="url">text</a>` |

### Markdown Formatting Mechanism

Inline images and links are produced via **placeholder replacement** in two steps:

1. **Text extraction phase**: each `<img>` inserts a placeholder `[IMAGE:N]` in the text stream, and each `<a>` inserts a paired `[LINK:N]...[/LINK]` (`N` is a positional index that corresponds one-to-one with the `Position` in the `Images`/`Links` slices)
2. **Formatting phase**: according to `InlineImageFormat`/`InlineLinkFormat`, the placeholders are replaced with the target format (markdown/html) or removed outright (none)

To prevent `[`, `]`, and `\` in image alt text and link text from breaking Markdown link/image syntax (Markdown injection), the **formatting phase** escapes these characters to `\[`, `\]`, and `\\` when emitting the `markdown` format (escaping happens only in the markdown branch). The escapes are **never reverted** — keeping them is exactly what prevents injection.

## JSON Output

Serialize the extraction result to JSON bytes. Unlike Markdown, this method goes through the main Processor's normal `Extract` (hitting/writing the cache when enabled) and then serializes via `json.Marshal`.

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

JSON serialization is a custom implementation via `Result.MarshalJSON()`, corresponding to the internal structure `jsonResult`:

| JSON field | Type | Source |
|------------|------|--------|
| `text` | string | `Result.Text` (extracted body) |
| `title` | string | `Result.Title` (document title) |
| `images` | array | `Result.Images` (`omitempty`, omitted when empty) |
| `links` | array | `Result.Links` (`omitempty`) |
| `videos` | array | `Result.Videos` (`omitempty`) |
| `audios` | array | `Result.Audios` (`omitempty`) |
| `processing_time_ms` | int | `Result.ProcessingTime` converted to **milliseconds** |
| `word_count` | int | `Result.WordCount` |
| `reading_time_ms` | int | `Result.ReadingTime` converted to **milliseconds** |

Note that `ProcessingTime` and `ReadingTime` carry a `json:"-"` tag on the `Result` struct (standard serialization skips them); the custom `MarshalJSON` is what includes them as millisecond values in the output. The JSON format is intended for external consumption and **does not implement `UnmarshalJSON`**, so it cannot be deserialized back into a `Result` as-is.

:::tip
`Result` implements the `json.Marshaler` interface. The `ProcessingTime` and `ReadingTime` fields have `json:"-"` tags (standard serialization skips them), but the custom `MarshalJSON()` method includes them as millisecond values in the output.
:::
