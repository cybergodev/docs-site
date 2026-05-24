---
title: "Batch Processing - HTML"
description: "Concurrent batch extraction API for CyberGo HTML, including ExtractBatch, ExtractBatchFiles, WorkerPoolSize concurrency control, and BatchResult statistics."
---

# Batch Processing

Batch extraction supports concurrent processing of multiple HTML documents, with a maximum of 10000 items per batch.

## Package Functions

```go
func ExtractBatch(htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchFiles(filePaths []string, cfg ...Config) *BatchResult
func ExtractBatchFilesWithContext(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult
```

## Processor Methods

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## BatchResult

```go
type BatchResult struct {
    Results   []*Result  // Successful extraction results
    Errors    []error    // Failed errors
    Success   int        // Success count
    Failed    int        // Failure count
    Cancelled int        // Count cancelled due to context cancellation
}
```

## Example

```go
pages := [][]byte{page1, page2, page3}
batch := html.ExtractBatch(pages)

fmt.Printf("Success: %d, Failed: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    fmt.Printf("Page %d: %s\n", i, result.Title)
}

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("Page %d error: %v\n", i, err)
    }
}
```

:::warning Batch Limit
A single batch supports up to 10000 items. Exceeding this limit will result in an error.
:::
