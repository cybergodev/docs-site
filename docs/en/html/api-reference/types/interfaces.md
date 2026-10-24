---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo html | Core Interface Reference"
description: "CyberGo html core interfaces: Extractor, StatsProvider, ContentNode, Scorer, and AuditSink, with mock testing, concurrency rules, and adapter design."
sidebar_position: 10
---

# Interfaces

The HTML library defines 5 core interfaces: `Extractor`, `StatsProvider`, `ContentNode`, `Scorer`, and `AuditSink`.

## Extractor

The primary interface for HTML content extraction. `Processor` implements it. The interface has 25 methods.

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
| `StatsProvider.ClearCache` | Clear the cache, keeping accumulated statistics |
| `StatsProvider.ResetStatistics` | Reset all statistics counters to zero |

`Processor` implements both `Extractor` and `StatsProvider`. Referencing it through interface types lets you inject extraction and monitoring capabilities into separate consumers:

```go
type ExtractionService struct {
	extractor     html.Extractor     // only needs extraction
	statsProvider html.StatsProvider // only needs monitoring
}

func NewService(p *html.Processor) *ExtractionService {
	return &ExtractionService{
		extractor:     p, // *Processor satisfies Extractor
		statsProvider: p, // *Processor satisfies StatsProvider
	}
}
```

## Dependency Injection & Mock Testing

The `Extractor` interface decouples extraction from business code, so unit tests can inject a mock implementation.

<!-- check-code: skip -->
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
func (m *mockExtractor) ExtractFromFile(string) (*html.Result, error) { return m.result, m.err }
func (m *mockExtractor) ExtractFromFileWithContext(context.Context, string) (*html.Result, error) {
	return m.result, m.err
}
func (m *mockExtractor) ExtractText([]byte) (string, error)         { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextFromFile(string) (string, error) { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextWithContext(context.Context, []byte) (string, error) {
	return m.result.Text, m.err
}
func (m *mockExtractor) ExtractTextFromFileWithContext(context.Context, string) (string, error) {
	return m.result.Text, m.err
}
// ... remaining methods return zero values
```

To keep the example short, this `mockExtractor` implements only some methods. A real implementation must supply all 25 methods of `Extractor` or it will not compile; the omitted methods can return zero values.

```go
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
```

```go
// Inject the mock in tests (assertions use testify; imports omitted)
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

Abstract interface for HTML nodes, used by content scoring. `Type`, `Data`, `AttrValue`, and `Attrs` give read-only access; `FirstChild`, `NextSibling`, and `Parent` traverse the tree.

```go
type ContentNode interface {
	Type() string                // Node type ("element", "text", "comment", etc.)
	Data() string                // Tag name or text content
	AttrValue(key string) string // Attribute value
	Attrs() []NodeAttr           // All attributes
	FirstChild() ContentNode     // First child node
	NextSibling() ContentNode    // Next sibling node
	Parent() ContentNode         // Parent node
}
```

### Method Overview

| Method | Signature | Description |
|--------|-----------|-------------|
| `ContentNode.Type` | `Type() string` | Node type string; values listed below |
| `ContentNode.Data` | `Data() string` | Tag name for element nodes (e.g. `"div"`); text content for text nodes |
| `ContentNode.AttrValue` | `AttrValue(key string) string` | Look up an attribute by name; returns an empty string when absent |
| `ContentNode.Attrs` | `Attrs() []NodeAttr` | Return all attributes of the node |
| `ContentNode.FirstChild` | `FirstChild() ContentNode` | First child node, or `nil` if none |
| `ContentNode.NextSibling` | `NextSibling() ContentNode` | Next sibling node, or `nil` if none |
| `ContentNode.Parent` | `Parent() ContentNode` | Parent node, or `nil` for the root |

`Type()` returns one of: `element`, `text`, `comment`, `document`, `doctype`, `error`, `raw`, `unknown`.

## Scorer

Content scoring interface for customizing article recognition.

```go
type Scorer interface {
	Score(node ContentNode) int         // Compute node relevance score
	ShouldRemove(node ContentNode) bool // Reserved: not called by the library in the current version
}
```

### Method Overview

| Method | Signature | Description |
|--------|-----------|-------------|
| `Scorer.Score` | `Score(node ContentNode) int` | Compute the content-relevance score of a node |
| `Scorer.ShouldRemove` | `ShouldRemove(node ContentNode) bool` | Reserved method; not called by the library in the current version |

`ShouldRemove` is required to satisfy the interface, but the library only calls `Score`, so its return value has no effect; returning `false` always is fine. To exclude nodes, return a low or negative score from `Score`.

:::warning Custom Scorers must be concurrency-safe
When one `Processor` is shared across concurrent `Extract` calls, `Score` is invoked **from multiple goroutines at once**, so every `Scorer` implementation must ensure its own concurrency safety.

The built-in default scorer is read-only and inherently safe. **A custom `Scorer` that holds mutable state (a cache, a counter) must do its own locking**.
:::

Inject a custom scorer through `Config.Scorer`:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
	// Custom scoring logic
	return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
	// Reserved method: not called by the library in the current version, so the logic below never runs
	return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

### ContentNode and Internal Types

`ContentNode` is an abstract interface that hides the underlying `golang.org/x/net/html.Node`. Internally, `contentNodeAdapter` wraps `*html.Node` as a `ContentNode`:

```text
Caller's Scorer.Score(ContentNode)
                          │
                    contentNodeAdapter (adapter)
                          │
                  Internal *html.Node (golang.org/x/net/html)
```

The two-layer design gives three benefits:

- **Clean public API**: implementing a custom Scorer never requires importing `golang.org/x/net/html`.
- **Low internal overhead**: the library's `DefaultScorer` works directly on `*html.Node`, skipping the adapter.
- **Automatic adaptation**: `scorerAdapter` converts between the public `Scorer` and the internal scorer, invisible to callers.

:::tip Check for nil when traversing
`FirstChild()`, `NextSibling()`, and `Parent()` return `nil` when there is no corresponding node. A custom Scorer traversing a subtree must check for nil, or it will panic.
:::

## AuditSink

Audit log output interface.

```go
type AuditSink interface {
	Write(entry AuditEntry)
	Close() error
}
```

For built-in Sink implementations see [Audit System](../modules/audit).
