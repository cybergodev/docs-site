---
sidebar_label: "Batch Processing"
title: "Batch Processing - CyberGo html | Concurrency Guide"
description: "CyberGo html batch processing: four APIs incl. ExtractBatch, BatchResult, WorkerPoolSize concurrency, context cancellation, partial failures, and scale tuning."
sidebar_position: 2
---

# Batch Processing Guide

When processing large numbers of HTML documents, the batch APIs execute concurrently and automatically, running several times faster than calling extraction one by one in a loop. This guide covers the four batch APIs, the result structure, and concurrency tuning.

## Batch API Overview

The library provides four batch functions, corresponding to byte input/file input crossed with no context/with context:

| API | Input | Context | Description |
|-----|------|--------|------|
| `ExtractBatch` | `[][]byte` | None | Batch extract from byte slices |
| `ExtractBatchFiles` | `[]string` | None | Batch extract from file paths |
| `ExtractBatchWithContext` | `[][]byte` | Yes | Supports timeout/cancellation |
| `ExtractBatchFilesWithContext` | `[]string` | Yes | Supports timeout/cancellation |

All functions can be called at the package level or on a `Processor` instance:

```go
// Package level (uses an internally pooled Processor)
br := html.ExtractBatch(pages)

// Processor instance (reuses the cache)
p, _ := html.New()
defer p.Close()
br := p.ExtractBatch(pages)
```

## BatchResult Structure

Batch operations return a `*BatchResult` containing per-item results and aggregate counts:

| Field | Type | Description |
|------|------|------|
| `Results` | `[]*Result` | Extraction result for each item; `nil` for failed or cancelled items |
| `Errors` | `[]error` | Error for each item; `nil` for successful items; indices correspond to the input |
| `Success` | `int` | Number of successful extractions |
| `Failed` | `int` | Number of failed extractions |
| `Cancelled` | `int` | Number of items skipped due to context cancellation |

:::tip Index correspondence
`Results[i]` and `Errors[i]` correspond one-to-one with the `i`-th input item. On success, `Results[i]` is non-nil and `Errors[i]` is nil; on failure, the reverse is true.
:::

## Basic Example

Batch extract three HTML byte slices:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := [][]byte{
		[]byte(`<html><body><article><h1>Page One</h1><p>Go language tutorial.</p></article></body></html>`),
		[]byte(`<html><body><article><h1>Page Two</h1><p>Concurrency guide.</p></article></body></html>`),
		[]byte(`<html><body><article><h1>Page Three</h1><p>Performance optimization tips.</p></article></body></html>`),
	}

	// Batch concurrent extraction (using the package function)
	br := html.ExtractBatch(pages)

	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", br.Success, br.Failed, br.Cancelled)
	// Success: 3, Failed: 0, Cancelled: 0

	// Iterate results (index corresponds to input)
	for i, result := range br.Results {
		if result != nil {
			fmt.Printf("  [%d] Title: %s\n", i+1, result.Title)
		} else if br.Errors[i] != nil {
			fmt.Printf("  [%d] Error: %v\n", i+1, br.Errors[i])
		}
	}
	// [1] Title: Page One
	// [2] Title: Page Two
	// [3] Title: Page Three
}
```

## Batch Extracting from Files

```go
files := []string{"page1.html", "page2.html", "page3.html"}

br := html.ExtractBatchFiles(files)

fmt.Printf("Success: %d, Failed: %d\n", br.Success, br.Failed)

for i, err := range br.Errors {
    if err != nil {
        fmt.Printf("File %s failed: %v\n", files[i], err)
    }
}
```

## Package Functions vs Processor Instances

The two calling modes differ in caching behavior:

| Calling mode | Cache | Use case |
|----------|------|----------|
| `html.ExtractBatch(pages)` | Disabled (pooled Processor clears cache each time) | One-off batch tasks |
| `p.ExtractBatch(pages)` | Enabled (reuses the Processor cache) | High-frequency batches, repeated content |

:::warning Package functions do not cache
Package functions use a Processor managed by an internal `sync.Pool` whose config disables caching (`MaxCacheEntries = 0`) and clears the cache on return. If your batch contains repeated content, use a Processor instance to benefit from cache acceleration. See [Processor Cache & Reuse](./processor-cache).
:::

```go
// Recommended: reuse a Processor for high-frequency batch workloads
p, _ := html.New()
defer p.Close()

for batch := range batchQueue {
    br := p.ExtractBatch(batch) // Cache is active; duplicate content hits directly
    processResult(br)
}
```

## Concurrency Control

`WorkerPoolSize` controls the number of concurrent workers for batch processing (default 4, maximum 256):

```go
cfg := html.DefaultConfig()

// Set concurrency to the number of CPU cores (capped at 256)
n := runtime.NumCPU()
if n > 256 {
    n = 256
}
cfg.WorkerPoolSize = n

p, _ := html.New(cfg)
defer p.Close()

br := p.ExtractBatch(pages)
```

| Config | Default | Upper limit | Description |
|------|--------|------|------|
| `WorkerPoolSize` | 4 | 256 | Number of concurrent workers; must be a positive integer |

:::tip WorkerPoolSize tuning
Set it to the number of CPU cores for CPU-bound tasks; increase it moderately for I/O-bound tasks (such as file reading). Values above 256 are rejected by config validation.
:::

## Batch Size Limit

A single batch supports up to 10000 items. When exceeded, **all items** return an error (rather than partial processing):

```go
huge := make([][]byte, 10001) // Exceeds the limit

br := html.ExtractBatch(huge)

fmt.Printf("Failed: %d\n", br.Failed)
// Failed: 10001

fmt.Printf("First error: %v\n", br.Errors[0])
// First error: html: batch size 10001 exceeds maximum 10000
```

:::warning Over-limit behavior
`maxBatchSize = 10000` is a hard limit. When exceeded, no items are processed; instead, a uniform error is returned for all inputs. To process more, call in chunks.
:::

## Context Cancellation

`ExtractBatchWithContext` terminates gracefully when the context is cancelled:

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

br := p.ExtractBatchWithContext(ctx, pages)

fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
    br.Success, br.Failed, br.Cancelled)
```

| Item status | Handling |
|----------|----------|
| Completed | Result retained in `Results` |
| In progress | Recorded normally after completion |
| Not started | Skipped, counted in `Cancelled`, `Errors[i]` set to `ctx.Err()` |

:::tip Partial results are available
After context cancellation, results for completed items are still retained in `br.Results` (non-nil). You can safely use the completed results without discarding all output due to cancellation.
:::

## Partial Failure Handling

Batches are **partially successful** — a single item's failure does not affect the others:

```go
pages := [][]byte{
    validHTML,   // Valid
    []byte(""),  // Empty input, triggers an error
    validHTML2,  // Valid
}

br := p.ExtractBatch(pages)

// Item 2 fails; items 1 and 3 still succeed
fmt.Printf("Success: %d, Failed: %d\n", br.Success, br.Failed)
// Success: 2, Failed: 1

// Process item by item, skipping failures
for i, result := range br.Results {
    if result == nil {
        fmt.Printf("[%d] Failed: %v\n", i, br.Errors[i])
        continue
    }
    fmt.Printf("[%d] Title: %s\n", i, result.Title)
}
```

## Performance Recommendations

| Document count | Recommended strategy | Description |
|----------|----------|------|
| 1–10 | Individual `Extract` calls | Batch scheduling overhead may exceed concurrency gains |
| 10–1000 | `ExtractBatch` + package function | Automatic concurrency, no Processor management |
| 1000+ | `p.ExtractBatch` + Processor instance | Reuses cache; process in chunks to avoid memory spikes |
| 10000+ | Chunking (≤10000 per batch) + Processor instance | Exceeds the single-batch limit; shard the work |

```go
// Large-scale chunked batch processing example
p, _ := html.New()
defer p.Close()

const batchSize = 5000
for i := 0; i < len(allPages); i += batchSize {
    end := i + batchSize
    if end > len(allPages) {
        end = len(allPages)
    }

    br := p.ExtractBatch(allPages[i:end])
    // Process this batch's results...
}
```

## Next Steps

- [Processor Cache & Reuse](./processor-cache) - Cache differences between package functions and instances
- [Performance](./performance) - Throughput improvements and timeout settings
- [Error Handling](./error-handling) - Sentinel errors and batch error handling
- [API Reference: Batch Processing](../../api-reference/modules/batch) - Complete API signatures
