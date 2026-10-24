---
sidebar_label: "Concurrency & Parallelism"
title: "Concurrency & Parallelism - CyberGo JSON | Goroutine Safety"
description: "CyberGo JSON concurrency: the thread-safety contract for sharing one Processor across goroutines, plus ParallelIterator and StreamJSONLParallel usage."
sidebar_position: 40
---

# Concurrency and Parallel Processing

All CyberGo JSON operations are **concurrency-safe**, and the library includes parallel APIs (`ParallelIterator`, parallel JSONL streams). This page gives the thread-safety semantics, the built-in parallel APIs, and the concurrent usage patterns.

:::tip Division of labor with the performance page
The "concurrent processing" section of [Performance Optimization](./performance) shows **general Go patterns** (`sync.WaitGroup` + semaphore + worker pool) for manually concurrent array processing; the APIs below are the **library-built-in** parallel implementation — the two complement each other.
:::

## Thread-Safety Guarantees

`Processor` is the thread-safe main processing engine (source comment: `Processor is the main JSON processing engine with thread safety`):

- **A single Processor instance can be shared across goroutines** — all public methods (`Get`/`Set`/`Delete`/`Marshal`, etc.) are internally protected by atomic operations and concurrency governance (`beginGovernedOp`/`endGovernedOp`).
- **Package-level functions** (`json.Get`, `json.GetString`, etc.) share one global Processor and are concurrency-safe by nature.
- **A `*ParsedJSON` returned by `PreParse` can be read concurrently** — multiple goroutines can call `GetFromParsed` on the same `ParsedJSON` simultaneously.

:::warning When not to share
The `Processor` can be shared, but **do not share mutable Go containers across goroutines** (e.g. handing the `map[string]any` returned by `Get` to multiple goroutines for writing). Containers returned by the library are copies by default (unless `CacheSharedResults` is enabled), so mutating a return value does not affect the cache — but multiple goroutines writing the same container still requires caller-side locking.
:::

## ParallelIterator

`ParallelIterator` processes arrays in parallel with a worker pool, built-in error aggregation, and panic recovery.

### Basic Parallel Traversal

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":[1,2,3,4,5,6,7,8]}`
	items := json.GetArray(data, "items")

	// Worker count defaults to Config.MaxConcurrency (clamped to array length)
	iter := json.NewParallelIterator(items)
	defer iter.Close()

	var mu sync.Mutex
	var sum int64
	err := iter.ForEach(func(_ int, val any) error {
		mu.Lock()
		sum += int64(val.(float64))
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Sum = %d\n", sum)
	// Output: Sum = 36
}
```

### Parallel Map

`Map` transforms every element in parallel, and results **keep the original order** (each worker writes its own index slot — no locking needed).

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":[1,2,3,4]}`
	items := json.GetArray(data, "items")

	iter := json.NewParallelIterator(items)
	defer iter.Close()

	// Parallel map: each element *10, result order matches input
	doubled, err := iter.Map(func(_ int, val any) (any, error) {
		return int(val.(float64)) * 10, nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(doubled)
	// Output: [10 20 30 40]
}
```

### Batched Parallelism: ForEachBatch / ForEachBatchWithContext

When the per-element callback is expensive (e.g. a syscall or network request per element), `ForEachBatch` slices elements into fixed-size batches, **each handled by one goroutine** — serial within a batch, parallel across batches — amortizing scheduling and synchronization costs.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"records":[10,20,30,40,50,60,70,80,90,100]}`
	records := json.GetArray(data, "records")

	iter := json.NewParallelIterator(records)
	defer iter.Close()

	// 10 records in batches of 3 -> 4 batches (last has 1); write by batchIdx
	// into dedicated slots, no locking needed
	subtotals := make([]int, 4)
	err := iter.ForEachBatch(3, func(batchIdx int, batch []any) error {
		sum := 0
		for _, v := range batch {
			sum += int(v.(float64))
		}
		subtotals[batchIdx] = sum
		return nil
	})
	if err != nil {
		panic(err)
	}

	// Consume in order once all batches finish (execution order is not
	// guaranteed; results land by index)
	for i, s := range subtotals {
		fmt.Printf("Batch %d subtotal = %d\n", i, s)
	}

	// Version with timeout control: undispatched batches are skipped once ctx
	// expires; running batches exit upon noticing cancellation
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	err = iter.ForEachBatchWithContext(ctx, 100, func(batchIdx int, batch []any) error {
		return nil // Simulate one batch of work
	})
	fmt.Println("Timed batch processing done, error:", err)
}

// Output:
// Batch 0 subtotal = 60
// Batch 1 subtotal = 150
// Batch 2 subtotal = 240
// Batch 3 subtotal = 100
// Timed batch processing done, error: <nil>
```

`batchSize <= 0` is treated as 100. Callback errors behave as in `ForEach`: the first error wins and dispatching stops; batch **dispatch** order matches input (`batchIdx` increasing), but **execution** order is not guaranteed — the ordered-output technique is the example above: write by index, consume in order after completion.

### ParallelIterator API Overview

| API | Signature | Description |
|-----|-----------|-------------|
| `NewParallelIterator` | `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator` | Creates the iterator; worker count from `cfg.MaxConcurrency` (default 50, clamped to array length; `<= 0` falls back to 4) |
| `ForEach` | `func (it *ParallelIterator) ForEach(fn func(int, any) error) error` | Parallel traversal; returns the first error |
| `ForEachWithContext` | `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error` | Supports context cancellation |
| `ForEachBatch` | `func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error` | Batched parallel processing — serial within a batch, parallel across |
| `ForEachBatchWithContext` | `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error` | Batched parallel + context cancellation |
| `Map` | `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)` | Parallel transform, order-preserving return |
| `Filter` | `func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any` | Parallel filter, order-preserving return (no error return) |
| `Close` | `func (it *ParallelIterator) Close()` | Releases resources (signals running goroutines to stop; safe to call repeatedly) |

For full signatures and usage see [Iterator Types](../api-reference/iterator#the-paralleliterator-type).

:::tip Error and panic handling
`ForEach` stops dispatching new tasks after the **first** error; panics inside workers are recovered and converted into returned errors — the process is never killed. Use `ForEachWithContext` when cancellation matters; it stops dispatching and returns on `ctx.Done()`.
:::

## Parallel JSONL Stream Processing

For large JSONL (NDJSON) files, `StreamJSONLParallel` processes each line with multiple workers in parallel.

```go
package main

import (
	"fmt"
	"strings"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// Simulated JSONL data (one JSON object per line)
	jsonlData := `{"id":1,"score":95}
{"id":2,"score":82}
{"id":3,"score":78}
{"id":4,"score":90}`

	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	var mu sync.Mutex
	var total int64
	var count int64

	// 4 workers process each line in parallel
	err = processor.StreamJSONLParallel(strings.NewReader(jsonlData), 4, func(lineNum int, item *json.IterableValue) error {
		score := int64(item.GetInt("score"))
		mu.Lock()
		total += score
		count++
		mu.Unlock()
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d records, total score %d\n", count, total)
	// Output: Processed 4 records, total score 345
}
```

| API | Description |
|-----|-------------|
| `StreamJSONLParallel(reader, workers, fn)` | Multi-worker parallel JSONL processing |
| `StreamJSONLParallelWithContext(ctx, reader, workers, fn)` | Same, with context cancellation and timeout |
| `StreamJSONLChunked(reader, chunkSize, fn)` | Chunked processing, memory-friendly |

For full signatures and configuration (`JSONLWorkers`/`JSONLChunkSize`, etc.) see [JSONL Methods](../api-reference/processor/jsonl) and [JSONL Streaming](../streaming/jsonl).

:::tip Line order
In parallel mode the callback's `lineNum` still reflects the original line number, but **execution order is not guaranteed**. For ordered output, write into a pre-allocated slice at the position given by `lineNum` inside the callback.
:::

## Using the Global Processor Concurrently

`SetGlobalProcessor` makes all package-level functions share one custom Processor — a good fit for multi-goroutine services that need a unified configuration (cache parameters, hooks, security limits).

```go
package main

import (
	"fmt"
	"sync"

	"github.com/cybergodev/json"
)

func main() {
	// Custom global processor (shared by all package-level functions, concurrency-safe)
	cfg := json.DefaultConfig()
	processor, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	json.SetGlobalProcessor(processor)   // The old global Processor is closed automatically
	defer json.ShutdownGlobalProcessor() // Clean shutdown when the app exits

	data := `{"user":{"name":"Alice","age":30}}`

	// Multiple goroutines use package-level functions concurrently (sharing the same global Processor)
	var wg sync.WaitGroup
	results := make([]string, 3)
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			switch idx {
			case 0:
				results[idx] = json.GetString(data, "user.name")
			case 1:
				results[idx] = fmt.Sprintf("%d", json.GetInt(data, "user.age"))
			case 2:
				results[idx] = json.GetString(data, "user.name")
			}
		}(i)
	}
	wg.Wait()
	fmt.Println(results)
	// Output: [Alice 30 Alice]
}
```

:::warning Ownership transfer
After `SetGlobalProcessor`, that Processor's lifecycle is managed globally — do **not** call `Close()` on it manually, or you will clash with the global shutdown logic. Call `ShutdownGlobalProcessor()` at exit for a clean shutdown and resource release.
:::

## Concurrency Limit: MaxConcurrency

`Config.MaxConcurrency` (default 50) is a **soft concurrency cap** per Processor: an atomic counting semaphore bounds in-flight operations. At the cap, new operations return `ErrConcurrencyLimit` (retryable).

```go
cfg := json.DefaultConfig()
cfg.MaxConcurrency = 100 // Raise the per-Processor concurrency cap
```

- `ErrConcurrencyLimit` is a **retryable** transient error (see [Error Handling](./error-handling#system-errors)).
- The worker count of parallel streaming (`StreamJSONLParallel`) is given explicitly by parameter and is not directly bound to `MaxConcurrency`, though it shares the same governance slots.
- `ParallelIterator`'s worker count comes from `cfg.MaxConcurrency` (default 50), clamped to the array length.

## Best Practices and Pitfalls

### 1. Reuse the Processor — do not create one per request

A `Processor` internally holds caches, recursion processors, and other state; **reusing the same instance** is what makes the cache pay off. Per-request `json.New()` forfeits cache benefits and adds allocations.

### 2. Sharing the instance is safe; sharing returned containers needs care

A `Processor` can be shared across goroutines; but if the `map`/`slice` returned by `Get` is to be shared and mutated across goroutines, the caller must lock it (or enable `CacheSharedResults` and treat results as read-only).

### 3. Release resources with Close

In long-running services, explicitly `defer processor.Close()` and `defer iter.Close()` to avoid cache goroutines and memory leaks. An instance installed via `SetGlobalProcessor` uses `ShutdownGlobalProcessor` instead.

### 4. Only CPU-bound work is worth parallelizing

Parallelism has scheduling and synchronization overhead. Small arrays (below the `ParallelThreshold` default of 10) are faster serially; JSONL with many lines and heavy per-line work benefits clearly.

### 5. Mind line order in parallel mode

`StreamJSONLParallel` does not guarantee processing order. When order matters, write into position-indexed slots by `lineNum` and consume sequentially afterwards.

## See Also

- [Performance Optimization](./performance) — Processor reuse, general Go concurrency patterns, benchmarks
- [Iterator Types](../api-reference/iterator) — The complete `ParallelIterator` API
- [JSONL Methods](../api-reference/processor/jsonl) — Parallel JSONL API details
- [Caching & Pre-Parsing](./caching) — Cache mechanics and PreParse
- [Error Handling](./error-handling) — Error classification incl. `ErrConcurrencyLimit`
