---
title: "Interfaces - HTML"
description: "Core interface definitions for CyberGo HTML, including Extractor, StatsProvider, ContentNode, Scorer, and AuditSink for extension and integration testing."
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

## StatsProvider

Statistics and cache management interface.

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

## ContentNode

Abstract interface for HTML nodes, used in content scoring algorithms.

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

## Scorer

Content scoring algorithm interface for customizing article recognition strategies.

```go
type Scorer interface {
    Score(node ContentNode) int          // Calculate node relevance score
    ShouldRemove(node ContentNode) bool  // Determine if node should be removed
}
```

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

## AuditSink

Audit log output interface.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

See [Audit System](./audit) for built-in Sink implementations.
