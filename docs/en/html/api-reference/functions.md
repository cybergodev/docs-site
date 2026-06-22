---
title: "Package Functions - CyberGo HTML | Convenience API"
description: "CyberGo HTML package functions API: Extract, ExtractFromFile, ExtractText and context variants. Reuses Processor via sync.Pool for one-shot calls."
---

# Package Functions

Package-level functions are ideal for one-time calls. They use `sync.Pool` internally to reuse Processor instances, so no manual lifecycle management is needed.

## Content Extraction

### Extract

Extract content from HTML bytes, returning a complete `Result`.

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `htmlBytes` | `[]byte` | HTML content |
| `cfg` | `...Config` | Optional config, at most one |

**Example**:

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

### ExtractFromFile

Extract content from an HTML file.

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

## Text Extraction

### ExtractText

Extract plain text content only.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

Extract plain text from a file.

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## Context Variants

All functions support `context.Context` variants for cancellation and timeout control:

| Function | Signature |
|----------|-----------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## Output Formats

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | File → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | With context |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | File + context |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | File → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | With context |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | File + context |

For detailed usage and examples, see [Output Formats](./output).

## Link Extraction

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | Extract all links |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | Extract links from file |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | With context |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | File + context |

For detailed usage and examples, see [Link Extraction](./links).

## Batch Processing

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | Batch extraction |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | With context |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | Batch file extraction |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | File + context |

For detailed usage and examples, see [Batch Processing](./batch).
