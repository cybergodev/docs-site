---
sidebar_label: "Output Formats"
title: "Output Formats - CyberGo html | Markdown & JSON Output"
description: "CyberGo html output format API: ExtractToMarkdown and ExtractToJSON package functions and Processor methods for converting bytes or files to Markdown/JSON."
sidebar_position: 1
---

# Output Formats

The HTML library supports outputting extraction results as Markdown or JSON format.

## Markdown Output

Extract HTML content and convert to Markdown format. This method uses a transient Processor with caching disabled; it neither reads from nor writes to the main Processor's cache.

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
cfg := html.MarkdownConfig()
md, err := html.ExtractToMarkdown(data, cfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## JSON Output

Serialize extraction results to JSON bytes. This method goes through the main Processor's normal Extract (hits/writes the cache when enabled), then serializes to JSON.

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
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

:::tip Result.MarshalJSON
`Result` implements the `json.Marshaler` interface. The `ProcessingTime` and `ReadingTime` fields have `json:"-"` tags (standard serialization skips them), but the custom `MarshalJSON()` method includes them as millisecond values in the output.
:::
