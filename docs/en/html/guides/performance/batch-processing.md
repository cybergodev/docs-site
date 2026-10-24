---
sidebar_label: "Batch Processing"
title: "Batch Processing - CyberGo html | Concurrency & Isolation"
description: "CyberGo html batch processing: four batch APIs, package vs Processor caching, WorkerPoolSize concurrency, the 10000-item cap, cancellation, failure isolation."
sidebar_position: 20
---

# Batch Processing in Practice

The batch APIs process multiple documents in parallel using `WorkerPoolSize` concurrency slots, with a 10000-item cap per batch. This page covers the four batch functions, concurrency control, cancellation semantics, and failure isolation; field definitions and full signatures are in [API Reference: Batch](../../api-reference/modules/batch).

## The Four Batch APIs

They combine input type with optional context:

| API | Input | Context |
|-----|-------|---------|
| `ExtractBatch` | `[][]byte` | None |
| `ExtractBatchFiles` | `[]string` | None |
| `ExtractBatchWithContext` | `[][]byte` | Yes |
| `ExtractBatchFilesWithContext` | `[]string` | Yes |

Each has both a package-level and a `Processor` form, and all return `*BatchResult`:

```go
// Package level (internally pooled Processor, cache disabled)
br := html.ExtractBatch(pages)

// Processor instance (reuses the cache)
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()
br = p.ExtractBatch(pages)
```

`Results[i]` and `Errors[i]` correspond to the `i`-th input: on success `Results[i]` is non-nil and `Errors[i]` is nil; on failure or cancellation `Results[i]` is nil. Always `Success + Failed + Cancelled == len(input)`.

## Basic Example

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

	br := html.ExtractBatch(pages)

	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", br.Success, br.Failed, br.Cancelled)
	// Output: Success: 3, Failed: 0, Cancelled: 0

	for i, result := range br.Results {
		if result != nil {
			fmt.Printf("[%d] Title: %s\n", i, result.Title)
		}
	}
	// Output:
	// [0] Title: Page One
	// [1] Title: Page Two
	// [2] Title: Page Three
}
```

## Package Functions vs Processor Instances

| Call form | Cache | Use case |
|-----------|-------|----------|
| `html.ExtractBatch(pages)` | Disabled: the pooled Processor has `MaxCacheEntries = 0`, and the cache is cleared on return | One-off batch jobs |
| `p.ExtractBatch(pages)` | Enabled: reuses the Processor cache | High-frequency batches with repeated content |

:::warning Package functions never cache

A call with no arguments uses a Processor from `sync.Pool` whose cache config is always 0, and `ClearCache()` runs on every return; passing a `Config` switches to a one-shot Processor whose cache is also disabled. When a batch contains repeated content, only a long-lived instance you create with `html.New()` can hit the cache. See [Processor Cache & Reuse](./processor-cache) for the mechanism.

:::

```go
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()

for batch := range batchQueue {
	br := p.ExtractBatch(batch) // The same Processor's cache carries across batches
	processResult(br)
}
```

## Concurrency Control

`WorkerPoolSize` is the concurrency cap. The batch methods use a buffered channel as a semaphore: a task must acquire a slot before its goroutine starts, so at most `WorkerPoolSize` tasks run at once regardless of input size.

```go
cfg := html.DefaultConfig()

n := runtime.NumCPU()
if n > 256 {
	n = 256
}
cfg.WorkerPoolSize = n

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

br := p.ExtractBatch(pages)
```

| Config | Default | Range |
|--------|---------|-------|
| `WorkerPoolSize` | 4 | 1–256 (values outside the range are rejected by `Validate()`) |

:::tip Pick a value by workload type

Use `runtime.NumCPU()` for pure CPU parsing; file-heavy jobs such as `ExtractBatchFiles` can go higher (8–16). Values above 256 fail config validation instead of being silently clamped.

:::

## The 10000-Item Batch Cap

Above `maxBatchSize` (10000) the batch processes nothing; instead every `Errors[i]` receives the same error and `Failed` equals the input count:

```go
huge := make([][]byte, 10001)

br := html.ExtractBatch(huge)

fmt.Printf("Failed: %d\n", br.Failed)
// Output: Failed: 10001

fmt.Println(br.Errors[0])
// Output: html: batch size exceeds maximum: 10001 exceeds maximum 10000

fmt.Println(errors.Is(br.Errors[0], html.ErrBatchTooLarge))
// Output: true
```

:::warning Over the cap fails the whole batch, not the process

`maxBatchSize = 10000` is a hard limit with no config knob. The call returns normally with `Failed` equal to the input count. To process more, call in chunks of ≤10000; test the error with `errors.Is(err, html.ErrBatchTooLarge)` rather than comparing strings.

:::

## Context Cancellation

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` check `ctx` in three places: before dispatching a task, after acquiring a semaphore slot, and inside the goroutine before extraction. Once cancelled:

| Item state | Handling |
|------------|----------|
| Completed | Result kept in `Results` |
| Running | Runs to completion and records its result |
| Not started | Skipped, `Cancelled` incremented, `Errors[i] = ctx.Err()` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

br := p.ExtractBatchWithContext(ctx, pages)

fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", br.Success, br.Failed, br.Cancelled)
```

:::tip Completed results survive cancellation

Cancellation only affects tasks that have not started. Completed `Results[i]` entries stay non-nil and remain usable, so there is no need to discard the whole batch.

:::

## Partial Failure Isolation

One item's failure does not interrupt the batch. The example below uses file input: the second path does not exist, so only that item fails, `Errors[1]` matches `ErrFileNotFound`, and the other two return results.

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/cybergodev/html"
)

func main() {
	dir, err := os.MkdirTemp("", "html-batch")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(dir)

	content := map[string]string{
		"a.html": `<html><body><article><h1>Page One</h1><p>Body.</p></article></body></html>`,
		"b.html": `<html><body><article><h1>Page Two</h1><p>Body.</p></article></body></html>`,
	}
	for name, body := range content {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			log.Fatal(err)
		}
	}

	files := []string{
		filepath.Join(dir, "a.html"),
		filepath.Join(dir, "missing.html"), // does not exist
		filepath.Join(dir, "b.html"),
	}

	p, err := html.New()
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	br := p.ExtractBatchFiles(files)

	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n", br.Success, br.Failed, br.Cancelled)
	// Output: Success: 2, Failed: 1, Cancelled: 0

	for i, result := range br.Results {
		if result == nil {
			fmt.Printf("[%d] Failed: %v (ErrFileNotFound=%v)\n",
				i, br.Errors[i], errors.Is(br.Errors[i], html.ErrFileNotFound))
			continue
		}
		fmt.Printf("[%d] Title: %s\n", i, result.Title)
	}
	// Output:
	// [0] Title: Page One
	// [1] Failed: html: ReadFile "missing.html": file not found (ErrFileNotFound=true)
	// [2] Title: Page Two
}
```

:::warning Empty input is not a failure

`[]byte("")` and whitespace-only input do not error: extraction returns an empty `Result`, and the item counts as `Success` in a batch. An empty input slice returns an empty `BatchResult` with empty (non-nil) `Results` / `Errors`. Whole-batch failures (more than 10000 items, a closed Processor, an invalid `Config` passed to a package-level function) put the same error in every item.

:::

## Chunking

| Document count | Recommended approach | Notes |
|----------------|----------------------|-------|
| 1–10 | Individual `Extract` calls | Batch scheduling costs more than concurrency saves |
| 10–10000 | `ExtractBatch` | Package function is enough; no Processor management |
| 10000+ | Chunks of ≤10000 + Processor instance | Exceeds the per-batch cap; chunking also avoids holding every result at once |

```go
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()

const batchSize = 5000
for i := 0; i < len(allPages); i += batchSize {
	end := min(i+batchSize, len(allPages))

	br := p.ExtractBatch(allPages[i:end])
	// Process this chunk's results...
}
```

## Next Steps

- [Processor Cache & Reuse](./processor-cache) - Cache differences between package functions and instances
- [Error Handling](./error-handling) - Sentinel errors, timeout semantics, and batch errors
- [API Reference: Batch](../../api-reference/modules/batch) - Full signatures and `BatchResult` fields
