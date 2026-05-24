---
title: "Processor - HTML"
description: "Processor API reference for CyberGo HTML, including New constructor, Extract methods, statistics, cache management, and lifecycle control for repeated use."
---

# Processor

`Processor` is the core processing engine of the HTML library. Compared to package functions, Processor reuses internal resources (cache, encoding detectors), making it ideal for high-frequency call scenarios.

## Creating

### New

Create a Processor instance with optional configuration.

```go
func New(cfg ...Config) (*Processor, error)
```

**Parameters**: At most one `Config`; uses `DefaultConfig()` when not provided.

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## Content Extraction

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

Extract content from HTML bytes with automatic encoding detection.

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

Extract content from a file.

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

Return plain text only.

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

Extract plain text from a file.

## Context Variants

All extraction methods have `WithContext` variants:

```go
func (p *Processor) ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
func (p *Processor) ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)
func (p *Processor) ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

## Output Formats

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
```

Context variants:

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

## Link Extraction

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## Batch Processing

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## Statistics & Cache

### GetStatistics

Return current processing statistics.

```go
func (p *Processor) GetStatistics() Statistics
```

```go
stats := p.GetStatistics()
fmt.Printf("Processed: %d, Cache hits: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

Clear the cache while preserving cumulative statistics.

```go
func (p *Processor) ClearCache()
```

### ResetStatistics

Reset all statistics counters.

```go
func (p *Processor) ResetStatistics()
```

## Audit

### GetAuditLog

Get audit log entries.

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

Clear audit log entries.

```go
func (p *Processor) ClearAuditLog()
```

## Lifecycle

### Close

Release resources held by the Processor. Must be called when done.

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... use p for extraction
```
