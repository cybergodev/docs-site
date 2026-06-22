---
title: "Batch Processing - CyberGo HTML | Concurrent Batch API"
description: "CyberGo HTML batch API: ExtractBatch and ExtractBatchFiles families with context variants, WorkerPoolSize concurrency, 10000-item batches, and BatchResult."
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
    Results   []*Result  // result for each input item, indexed by input order; nil on failure or cancellation
    Errors    []error    // error for each input item; index corresponds one-to-one with Results
    Success   int        // Success count
    Failed    int        // Failure count
    Cancelled int        // number of items left unprocessed due to context cancellation
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
