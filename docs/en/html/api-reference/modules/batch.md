---
sidebar_label: "Batch Processing"
title: "Batch Processing - CyberGo html | Concurrent Batch API"
description: "CyberGo html concurrent batch API: ExtractBatch, ExtractBatchFiles, WithContext variants, WorkerPoolSize concurrency, 10000-item cap, BatchResult structure."
sidebar_position: 3
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
    Success   int        // number of successful items
    Failed    int        // number of failed items
    Cancelled int        // number of items left unprocessed due to context cancellation
}
```

## Concurrency Mechanism

Batch extraction controls concurrency through a **semaphore pattern** (buffered channel `chan struct{}`) rather than launching all goroutines at once:

- **Concurrency** is controlled by `Config.WorkerPoolSize`, default `4` (`DefaultWorkerPoolSize`), range `1–256`
- The semaphore capacity equals `WorkerPoolSize`: each goroutine must acquire a slot (`sem <- struct{}{}`) before starting and releases it (`<-sem`) upon completion, strictly limiting the **number of simultaneously running goroutines** to `WorkerPoolSize`
- Even with tens of thousands of input items, only `WorkerPoolSize` extraction tasks execute at any moment, preventing goroutine explosion
- **Each extraction item runs independently**: automatic encoding detection and per-item error isolation mean a single item failure does not affect others
- **The Processor is safe for concurrent sharing**: multiple goroutines calling `Extract` concurrently is thread-safe, and batch methods reuse the same Processor instance

:::tip WorkerPoolSize Tuning
Batch processing is mostly I/O-intensive when the input is files; increasing `WorkerPoolSize` (e.g. `8–16`) can improve throughput. For pure CPU-bound parsing scenarios, it should not exceed `runtime.NumCPU()`. Values above `256` are rejected during config validation.
:::

## BatchResult Field Reference

The `Results` and `Errors` slices both have **length equal to the number of input items**, and their **indices correspond one-to-one**:

| Field | Description |
|-------|-------------|
| `Results[i]` | Extraction result for the `i`-th input; `nil` when that item failed or was cancelled |
| `Errors[i]` | Error for the `i`-th input; `nil` on success, the extraction error on failure, or `ctx.Err()` on cancellation |
| `Success` | Count of successful items, equal to the number of non-nil elements in `Results` |
| `Failed` | Count of failed items (the extraction process returned an error) |
| `Cancelled` | Count of items left unprocessed due to context cancellation |

Identity: `Success + Failed + Cancelled == number of input items`.

## Context Cancellation Behavior

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` cooperatively respond to context cancellation at three checkpoints:

| Checkpoint | Behavior |
|------------|----------|
| Before dispatching a task | If `ctx` is already cancelled, the item is marked `Cancelled`, `Errors[i] = ctx.Err()`, and no goroutine is started |
| After acquiring the semaphore (before goroutine start) | If cancelled while waiting for the semaphore, the item is likewise marked `Cancelled` |
| Inside the goroutine before processing | Checked again right before executing extraction; if cancelled, marked `Cancelled` and returns immediately |

Semantics after cancellation:

- **Completed results are preserved unchanged** — cancellation only affects tasks that have not yet started
- **Tasks that never started** are counted in `Cancelled`, and their `Errors[i]` is populated with `ctx.Err()` (typically `context.Canceled` or `context.DeadlineExceeded`)
- The variants without the `WithContext` suffix use `context.Background()` internally and never cancel

## Input Validation

Batch methods perform upfront validation before dispatching tasks; on failure they return a populated `BatchResult` (rather than an `error`):

| Case | Return |
|------|--------|
| Batch exceeds `10000` items | Each `Errors[i]` filled with the same error, `Failed = N`; does not panic |
| Processor is `nil` or already `Close`d | Each `Errors[i]` filled with `ErrProcessorClosed`, `Failed = N` |
| Empty input slice (0 items) | An empty `BatchResult` (`Results`/`Errors` are empty slices) |
| Package function passed an invalid `Config` | Each item filled with the configuration error |

## Examples

### Basic Batch Extraction

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := [][]byte{
		[]byte("<html><head><title>Home</title></head><body><p>Welcome to the home page.</p></body></html>"),
		[]byte("<html><head><title>About Us</title></head><body><p>Team introduction.</p></body></html>"),
		[]byte("<html><head><title>Product List</title></head><body><p>Three products in total.</p></body></html>"),
	}

	batch := html.ExtractBatch(pages)
	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", batch.Success, batch.Failed, batch.Cancelled)
	// Output: Success: 3, Failed: 0, Cancelled: 0

	// Results indices correspond one-to-one with the input slice
	for i, result := range batch.Results {
		if result != nil {
			fmt.Printf("  [%d] Title: %s, Words: %d\n", i, result.Title, result.WordCount)
		}
	}
}
```

### Batch Extraction with Context Cancellation

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := make([][]byte, 20)
	for i := range pages {
		pages[i] = []byte("<html><head><title>Page</title></head><body><p>Body content.</p></body></html>")
	}

	// Cancel the context immediately to simulate early termination
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	batch := html.ExtractBatchWithContext(ctx, pages)
	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", batch.Success, batch.Failed, batch.Cancelled)
	// Output: Success: 0, Failed: 0, Cancelled: 20

	// Cancelled items: Results[i] is nil, Errors[i] is filled with ctx.Err()
	fmt.Printf("First item error: %v\n", batch.Errors[0])
	// Output: First item error: context canceled
}
```

:::warning
A single batch supports up to 10000 items. Exceeding this limit returns a `*BatchResult` in which every item failed (each `Errors` entry is `html: batch size N exceeds maximum 10000`); no panic is triggered.
:::
