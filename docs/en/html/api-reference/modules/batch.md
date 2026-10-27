---
sidebar_label: "Batch Processing"
title: "Batch Processing - CyberGo html | Concurrent Batch API"
description: "CyberGo html batch API: ExtractBatch and ExtractBatchFiles with context variants, WorkerPoolSize concurrency, 10000-item cap, and BatchResult layout."
sidebar_position: 30
---

# Batch Processing

The batch API processes multiple HTML documents concurrently, up to 10000 items per call. `WorkerPoolSize` bounds concurrency, and each item is extracted and reported independently.

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
	Results   []*Result // result per input item, indexed by input order; nil on failure or cancellation
	Errors    []error   // error per input item, index-aligned with Results
	Success   int       // number of successful items
	Failed    int       // number of failed items
	Cancelled int       // number of items not processed because the context was cancelled
}
```

## Concurrency Mechanism

Batch extraction uses a **semaphore** (a buffered `chan struct{}`) to bound concurrency; it never launches every goroutine at once:

- Concurrency is set by `Config.WorkerPoolSize`, default `4` (`DefaultWorkerPoolSize`), valid range `1–256`
- The semaphore capacity equals `WorkerPoolSize`: each goroutine acquires a slot (`sem <- struct{}{}`) before starting and releases it (`<-sem`) when done, so at most `WorkerPoolSize` extractions run at any moment
- With tens of thousands of input items, still only `WorkerPoolSize` tasks run concurrently, so goroutine count does not grow with input size
- **Each item runs independently**: it does its own encoding detection and reports its own error, so one failure does not affect the others
- **A panic in one item is isolated**: when an item's extraction panics internally, that item counts as `Failed` with `Errors[i]` holding an error wrapping `ErrInternalPanic`, and the other items run as usual
- **A Processor can be shared across goroutines**: concurrent `Extract` calls are thread-safe, and the batch methods reuse one Processor instance

:::tip Choosing WorkerPoolSize
File input is mostly I/O-bound, so raising it to `8–16` can improve throughput; for CPU-bound parsing keep it at or below `runtime.NumCPU()`. Values above `256` are rejected during config validation.
:::

## BatchResult Fields

`Results` and `Errors` both have **length equal to the number of input items**, with **matching indices**:

| Field | Description |
|-------|-------------|
| `Results[i]` | Extraction result for input `i`; `nil` when that item failed or was cancelled |
| `Errors[i]` | Error for input `i`; `nil` on success, the extraction error on failure, `ctx.Err()` on cancellation |
| `Success` | Count of successful items, equal to the number of non-nil elements in `Results` |
| `Failed` | Count of failed items (extraction returned an error) |
| `Cancelled` | Count of items not processed because the context was cancelled |

Identity: `Success + Failed + Cancelled == number of input items`.

## Context Cancellation

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` check for cancellation cooperatively at three points:

| Checkpoint | Behavior |
|------------|----------|
| Before dispatching a task | If `ctx` is already cancelled, the item is marked `Cancelled` with `Errors[i] = ctx.Err()`, and no goroutine starts |
| After acquiring the semaphore | If cancelled while waiting for a slot, the item is likewise marked `Cancelled` |
| Inside the goroutine, before extraction | Checked once more; if cancelled, the item is marked `Cancelled` and returns immediately |

After cancellation:

- **Completed results stay intact** — cancellation only affects tasks that have not started
- **Tasks that never started** are counted in `Cancelled`, and their `Errors[i]` is `ctx.Err()` (usually `context.Canceled` or `context.DeadlineExceeded`)
- Variants without `WithContext` use `context.Background()` internally and never cancel

## Input Validation

Batch methods validate inputs before dispatching and return a populated `BatchResult` rather than an `error`. The checks run in this order — processor state, item cap, empty input — and the first hit returns:

| Case | Result |
|------|--------|
| Processor is `nil` or already `Close`d | Every `Errors[i]` holds `ErrProcessorClosed` and `Failed = N` |
| More than `10000` items | Every `Errors[i]` holds the same error and `Failed = N`; no panic; test with `errors.Is(err, html.ErrBatchTooLarge)` |
| Empty input slice (0 items) | An empty `BatchResult` (`Results`/`Errors` are empty slices) |
| Package function given an invalid `Config` | Every item holds the configuration error |

An empty byte slice (`[]byte("")`) is not a failure: extraction returns an empty `Result` and the item counts as `Success`.

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

	// Results indices align one-to-one with the input slice
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

	// Cancel immediately to simulate early termination
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	batch := html.ExtractBatchWithContext(ctx, pages)
	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", batch.Success, batch.Failed, batch.Cancelled)
	// Output: Success: 0, Failed: 0, Cancelled: 20

	// Cancelled items: Results[i] is nil and Errors[i] holds ctx.Err()
	fmt.Printf("First item error: %v\n", batch.Errors[0])
	// Output: First item error: context canceled
}
```

:::warning Per-call limit
A single call accepts at most 10000 items. Above that, the returned `*BatchResult` marks every item as failed (`Errors[i]` is `html: batch size exceeds maximum: N exceeds maximum 10000`; check with `errors.Is(err, html.ErrBatchTooLarge)`), and no panic occurs. Split larger workloads into chunks yourself.
:::

## Related Documentation

- [Batch Processing](../../guides/performance/batch-processing) — Scenarios and tuning
- [Processor Reuse & Caching](../../guides/performance/processor-cache) — Reusing a Processor to raise throughput
