---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo html | Core Interface Reference"
description: "CyberGo html core interfaces: Extractor, StatsProvider, ContentNode, Scorer, and AuditSink for extension, custom implementations, integration, and testing."
sidebar_position: 1
---

# Interfaces

The HTML library defines the following core interfaces:

## Extractor

The primary interface for HTML content extraction. `Processor` implements this interface.

```go
type Extractor interface {
    // Core extraction
    Extract(htmlBytes []byte) (*Result, error)
    ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
    ExtractFromFile(filePath string) (*Result, error)
    ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)

    // Text extraction
    ExtractText(htmlBytes []byte) (string, error)
    ExtractTextFromFile(filePath string) (string, error)
    ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)

    // Formatted output
    ExtractToMarkdown(htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFile(filePath string) (string, error)
    ExtractToJSON(htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFile(filePath string) ([]byte, error)
    ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
    ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)

    // Batch processing
    ExtractBatch(htmlContents [][]byte) *BatchResult
    ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
    ExtractBatchFiles(filePaths []string) *BatchResult
    ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult

    // Link extraction
    ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
    ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)

    // Lifecycle
    Close() error
}
```

### Method Overview

| Method | Description |
|--------|-------------|
| `Extractor.Extract` | Extract a full `Result` from HTML bytes |
| `Extractor.ExtractWithContext` | Same, with context cancellation |
| `Extractor.ExtractFromFile` | Extract from an HTML file |
| `Extractor.ExtractFromFileWithContext` | Same, with context cancellation |
| `Extractor.ExtractText` | Extract plain text only |
| `Extractor.ExtractTextWithContext` | Same, with context cancellation |
| `Extractor.ExtractTextFromFile` | Extract plain text from a file |
| `Extractor.ExtractTextFromFileWithContext` | Same, with context cancellation |
| `Extractor.ExtractToMarkdown` | Extract and render as Markdown |
| `Extractor.ExtractToMarkdownWithContext` | Same, with context cancellation |
| `Extractor.ExtractToMarkdownFromFile` | Extract from a file and render as Markdown |
| `Extractor.ExtractToMarkdownFromFileWithContext` | Same, with context cancellation |
| `Extractor.ExtractToJSON` | Extract and serialize as JSON |
| `Extractor.ExtractToJSONWithContext` | Same, with context cancellation |
| `Extractor.ExtractToJSONFromFile` | Extract from a file and serialize as JSON |
| `Extractor.ExtractToJSONFromFileWithContext` | Same, with context cancellation |
| `Extractor.ExtractBatch` | Concurrent batch extraction (byte-slice input) |
| `Extractor.ExtractBatchWithContext` | Same, with context cancellation |
| `Extractor.ExtractBatchFiles` | Concurrent batch extraction (file-path input) |
| `Extractor.ExtractBatchFilesWithContext` | Same, with context cancellation |
| `Extractor.ExtractAllLinks` | Enumerate all link resources (no sanitization applied) |
| `Extractor.ExtractAllLinksWithContext` | Same, with context cancellation |
| `Extractor.ExtractAllLinksFromFile` | Enumerate link resources from a file |
| `Extractor.ExtractAllLinksFromFileWithContext` | Same, with context cancellation |
| `Extractor.Close` | Release resources (cache, background goroutines) |

## StatsProvider

Statistics and cache management interface.

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

### Method Overview

| Method | Description |
|--------|-------------|
| `StatsProvider.GetStatistics` | Return the current processing statistics |
| `StatsProvider.ClearCache` | Clear the cache contents, keeping accumulated statistics |
| `StatsProvider.ResetStatistics` | Reset all statistics counters to zero |

`Processor` implements both `Extractor` and `StatsProvider`. By referencing the `Processor` through interface types, you can inject "extraction capability" and "monitoring capability" into separate consumers:

```go
type ExtractionService struct {
    extractor     html.Extractor     // only needs extraction capability
    statsProvider html.StatsProvider // only needs monitoring capability
}

func NewService(p *html.Processor) *ExtractionService {
    return &ExtractionService{
        extractor:     p, // *Processor satisfies Extractor
        statsProvider: p, // *Processor satisfies StatsProvider
    }
}
```

## Dependency Injection & Mock Testing

The `Extractor` interface decouples the extraction logic, making it easy to inject mock implementations in unit tests:

```go
// mockExtractor implements html.Extractor, for testing
type mockExtractor struct {
    result *html.Result
    err    error
}

func (m *mockExtractor) Extract([]byte) (*html.Result, error) { return m.result, m.err }
func (m *mockExtractor) ExtractWithContext(ctx context.Context, b []byte) (*html.Result, error) {
    return m.result, m.err
}
func (m *mockExtractor) ExtractFromFile(string) (*html.Result, error)         { return m.result, m.err }
func (m *mockExtractor) ExtractFromFileWithContext(context.Context, string) (*html.Result, error) {
    return m.result, m.err
}
func (m *mockExtractor) ExtractText([]byte) (string, error)                   { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextFromFile(string) (string, error)           { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextWithContext(context.Context, []byte) (string, error) {
    return m.result.Text, m.err
}
func (m *mockExtractor) ExtractTextFromFileWithContext(context.Context, string) (string, error) {
    return m.result.Text, m.err
}
// ... remaining methods return zero values

// Business code depends on the interface, not the concrete type
type ArticleService struct {
    extractor html.Extractor
}

func (s *ArticleService) GetTitle(htmlBytes []byte) (string, error) {
    result, err := s.extractor.Extract(htmlBytes)
    if err != nil {
        return "", err
    }
    return result.Title, nil
}

// Inject the mock in tests
func TestGetTitle(t *testing.T) {
    svc := &ArticleService{
        extractor: &mockExtractor{
            result: &html.Result{Title: "Test Title"},
        },
    }
    title, err := svc.GetTitle([]byte("<html></html>"))
    assert.NoError(t, err)
    assert.Equal(t, "Test Title", title)
}
```

## ContentNode

Abstract interface for HTML nodes, used in content scoring algorithms. `Type`, `Data`, `AttrValue`, and `Attrs` provide read-only access to node information; `FirstChild`, `NextSibling`, and `Parent` are for traversing the node tree.

```go
type ContentNode interface {
    Type() string                    // Node type ("element", "text", "comment", etc.)
    Data() string                    // Tag name or text content
    AttrValue(key string) string     // Attribute value
    Attrs() []NodeAttr               // All attributes
    FirstChild() ContentNode         // First child node
    NextSibling() ContentNode        // Next sibling node
    Parent() ContentNode             // Parent node
}
```

### Method Overview

| Method | Signature | Description |
|--------|-----------|-------------|
| `ContentNode.Type` | `Type() string` | Node type: `"element"`, `"text"`, `"comment"`, `"document"`, `"doctype"`, `"error"`, `"raw"`, or `"unknown"` |
| `ContentNode.Data` | `Data() string` | Tag name for element nodes (e.g. `"div"`, `"p"`); text content for text nodes |
| `ContentNode.AttrValue` | `AttrValue(key string) string` | Look up an attribute by name; returns an empty string when the attribute is absent |
| `ContentNode.Attrs` | `Attrs() []NodeAttr` | Return all attributes of the node |
| `ContentNode.FirstChild` | `FirstChild() ContentNode` | First child node, or `nil` if none |
| `ContentNode.NextSibling` | `NextSibling() ContentNode` | Next sibling node, or `nil` if none |
| `ContentNode.Parent` | `Parent() ContentNode` | Parent node, or `nil` for the root node |

## Scorer

Content scoring algorithm interface for customizing article recognition strategies.

```go
type Scorer interface {
    Score(node ContentNode) int          // Calculate node relevance score
    ShouldRemove(node ContentNode) bool  // Determine if node should be removed
}
```

### Method Overview

| Method | Signature | Description |
|--------|-----------|-------------|
| `Scorer.Score` | `Score(node ContentNode) int` | Compute the content-relevance score of a node |
| `Scorer.ShouldRemove` | `ShouldRemove(node ContentNode) bool` | Decide whether a node should be removed from the content tree |

:::warning
When a single `Processor` is shared across concurrent `Extract` calls, `Score`/`ShouldRemove` may be invoked **from multiple goroutines simultaneously**. Therefore, any `Scorer` implementation must **ensure its own concurrency safety**.

The library's built-in default scorer is read-only and inherently concurrency-safe; **a custom `Scorer` that holds mutable state (such as a cache or counter) must perform its own locking and synchronization**.
:::

Inject a custom scorer via the `Config.Scorer` field:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // Custom scoring logic
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // Custom removal logic
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

### ContentNode and Internal Types

`ContentNode` is an **abstract interface** that hides the underlying `golang.org/x/net/html.Node` type. Internally, the library wraps `*html.Node` as `ContentNode` via `contentNodeAdapter`:

```text
Caller's Scorer.Score(ContentNode)
                          │
                    contentNodeAdapter (adapter)
                          │
                  Internal *html.Node (golang.org/x/net/html)
```

This two-layer interface design achieves:
- **Clean public API** — users implementing custom Scorers never need to import `golang.org/x/net/html`
- **High internal performance** — the library's internal `DefaultScorer` operates directly on `*html.Node` (via the internal `Scorer` interface), avoiding the adapter overhead
- **Adaptation is automatic** — `scorerAdapter` converts bidirectionally between the public `Scorer` and the internal `Scorer`, transparent to the user

:::tip ContentNode nil convention
`FirstChild()`/`NextSibling()`/`Parent()` return `nil` when there is no corresponding node. Custom Scorers traversing subtrees must do nil checks, otherwise they will panic.
:::

## AuditSink

Audit log output interface.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

See [Audit System](../modules/audit) for built-in Sink implementations.
