---
sidebar_label: "Performance"
title: "Performance - CyberGo html | Throughput Guide"
description: "CyberGo html performance: sync.Pool Processor reuse, cache key hashing and hit conditions, WorkerPoolSize tuning, timeout semantics, and anti-patterns."
sidebar_position: 30
---

# Performance

CyberGo html is a Go library for HTML content extraction and sanitization. Its extraction cost depends on three things: the optimizations built into the library, the trade-offs made in configuration, and the size of the input. The sections below cover all three, plus anti-patterns and benchmarking.

Dedicated pages:

- [Processor Cache & Reuse](./processor-cache) — package functions vs instances, `sync.Pool`, cache key and hit-rate monitoring
- [Batch Processing in Practice](./batch-processing) — the batch APIs, `BatchResult`, concurrency control, and partial failures

## Internal Optimization Mechanisms

Zero-allocation and reuse optimizations on hot paths determine the cost profile of each usage pattern. Use the library the way these optimizations expect, or they stop paying off.

### sync.Pool Processor Reuse

Package-level functions (such as `html.Extract`) reuse `Processor` instances through `sync.Pool`, avoiding the cost of rebuilding heavyweight objects like encoding detectors and scorers on every call:

```text
html.Extract(data)
  → Get Processor from sync.Pool (reuse on pool hit, otherwise create new)
  → Execute extraction
  → Return to sync.Pool (reset statistics + clear audit log + clear cache)
```

Pooled processors follow two design rules:

- **Caching disabled**: `MaxCacheEntries`, `CacheTTL`, and `CacheCleanup` are all 0 for pooled instances, and every return calls `ClearCache()`. Enabling caching would only add hashing and map-write overhead (`Get` always misses) plus a goroutine sweeping an always-empty cache.
- **A custom Config bypasses the pool**: `html.Extract(data, cfg)` creates a **one-shot Processor** (closed as soon as it returns) instead of reusing a pooled instance, because pooled instances are fixed to the default configuration. The one-shot Processor's cache fields are zeroed as well.

:::tip Create your own instance when you need caching
When a loop processes the same content repeatedly (crawler deduplication, services downstream of a cache layer), create a long-lived `Processor` with `html.New()` to get cache hits. See [Processor Cache & Reuse](./processor-cache).
:::

### Cache Key Generation

The cache key is a `[16]byte` (128-bit) value used directly as a `map` key; generating it allocates nothing on the heap. Two groups of inputs feed the key:

- **The complete raw input bytes**: `hash/maphash` hashes every byte (AES-NI accelerated on amd64, with a per-process random seed). Because the whole input is hashed, a change anywhere in the document changes the key; the same document stored in a different encoding has different bytes and therefore a different key.
- **Configuration**: five booleans (`ExtractArticle`, `PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios`) packed into one byte, followed by three format strings (`InlineImageFormat`, `InlineLinkFormat`, `TableFormat`) and `Encoding`. The same bytes decoded under a different `Encoding` produce a different result, so the setting must be part of the key.

maphash returns 64 bits; splitmix64 diffuses it into a second 64-bit half, and the two form the 128-bit key. The key is 128 bits wide but its effective collision strength is about 64 bits: splitmix64 separates the output space, it does not add entropy. That is sufficient for a content cache. An all-zero key (`[16]byte{}`) is treated by the cache as "no key", so that input misses on every call. For the full description see [Processor Cache & Reuse](./processor-cache#cache-key-generation).

### Pre-allocation and Object Pooling

The most frequently allocated objects during extraction are pooled:

| Object | Mechanism | Purpose |
|--------|-----------|---------|
| Text builder | `sync.Pool` | Retains the underlying `[]byte` capacity, avoiding growth from zero to document length on every extraction |
| Image/link result slices | Pooled scratch slices | Appends go into a reusable pooled slice, and the result is copied out at exact length, so the returned slice carries no surplus capacity |
| Depth validation stack | `sync.Pool` | Stack reuse for iterative depth validation, avoiding a per-extraction allocation |
| `[]byte` temporary buffers | `sync.Pool` | Reuse of small high-frequency buffers for encoding conversion and text assembly |

:::warning Oversized buffers are dropped by the pool
One oversized document would otherwise leave the pool holding a huge buffer for every later small request. Buffers above the retention ceiling are therefore dropped on return: 64 KiB for `[]byte` and text builders, 512 elements for result scratch slices, and 8192 entries for node slices. Very large documents do not benefit from pooling; that is expected.
:::

### Pre-computed Format Strings

`New()` lowercases and trims `InlineImageFormat`/`InlineLinkFormat` (empty becomes `"none"`) and stores the result on the `Processor`. The extraction hot path compares the pre-computed values instead of calling `strings.ToLower` on every extraction.

The difference is invisible on a single extraction; over tens of thousands of documents it accumulates.

### Lazy Allocation for Media Extraction

Video/audio extraction uses three layers. A page with no media references pays one byte scan in the media stage, and content over 1 MB skips even that scan:

1. **Pre-scan gate**: a byte-by-byte table lookup decides whether the content contains any media reference. When none is present, all media URL scanning and iframe/embed/object attribute extraction is skipped.
2. **Size gate**: content over 1 MB skips the raw-HTML media scan. For those documents, media URLs come only from the DOM walk.
3. **Lazy initialization**: a result slice and dedup map are allocated only when the first match of that media kind appears. A kind with no matches allocates nothing.

:::tip Optimal config for plain-text workloads
When you only need body text and no image/video/audio data, [`TextOnlyConfig()`](../../api-reference/core/config#configuration-presets) turns off all media preservation: with `PreserveVideos`/`PreserveAudios` false, the media stage does not run at all.
:::

## Cache Tuning

Basic cache usage and hit-rate monitoring live in [Processor Cache & Reuse](./processor-cache); the key inputs are described in [Cache Key Generation](#cache-key-generation) above.

### Clone Cost on a Hit

Every cache hit returns `cloneResult`, a deep copy of the whole `Result` including the Images/Links/Videos/Audios slices. This cannot be skipped: cache entries are read concurrently, and returning a pointer would let a caller's mutation pollute the cache through aliasing.

The clone cost scales with the result size. Caching pays off only when the same input recurs often enough that the saved parsing and extraction outweighs the copy; when results are large and repeats are rare, caching multiplies both memory use and clone cost.

### When to Disable Caching

With `MaxCacheEntries = 0`, `Extract` skips key generation entirely: no hashing, no lookup, no writes.

Disabling the cache suits one-off processing of content that never repeats:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// Pages that never repeat: skip hashing and memory use entirely
	cfg := html.DefaultConfig()
	cfg.MaxCacheEntries = 0 // Zero overhead: skip the whole cache layer
	cfg.CacheTTL = 0        // Also prevents the background cleanup goroutine
	cfg.CacheCleanup = 0

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Input comes from a live crawl stream with almost no duplicates
	result, err := p.Extract([]byte("<html><body>Every page is different</body></html>"))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Text:", result.Text)
	// Output: Text: Every page is different
}
```

### Format Conversion Bypasses the Main Cache

`ExtractToMarkdown` / `ExtractToMarkdownFromFile` build a cache-disabled transient Processor internally. It copies the parent configuration and overrides only the two inline format fields:

- Markdown conversion neither reads nor writes the parent Processor's cache — even if you extracted the same content with `Extract` earlier, `ExtractToMarkdown` will not hit;
- Repeated `ExtractToMarkdown` calls do not hit each other either.

`ExtractToJSON` goes through `p.Extract` and then marshals, so it does read and write the main cache. The transient Processor's audit events and statistics still count toward the parent Processor.

:::warning Use Extract when you need Markdown repeatedly
To get Markdown for the same content repeatedly, call `Extract` with `InlineImageFormat`/`InlineLinkFormat` set to `"markdown"` instead of calling `ExtractToMarkdown` multiple times: the result enters the main cache and repeated inputs hit.
:::

## Timeout and Goroutine Management

`ProcessingTimeout` is a cooperative timeout, not a forced kill. It determines where deadlines are checked and which error comes back.

### Cooperative Cancellation

When `ProcessingTimeout > 0`, the library derives a deadline context from the incoming context, and processing polls `ctx.Done()` at fixed checkpoints:

- Entry to extraction, before encoding detection
- Before DOM parsing
- Before depth validation
- Before content extraction

When the deadline passes, processing stops at the next checkpoint and returns an error. The timeout is not instantaneous: work between two checkpoints (parsing a very large document, for example) runs to completion, while the caller receives the timeout error without waiting for it.

### Process-wide Limit on Timeout Goroutines

Each extraction with a timeout occupies a watchdog goroutine until it finishes or times out. The library caps concurrency at 1000 (`maxTimeoutGoroutines`) with the process-wide counter `activeTimeoutGoroutines`. The counter is shared across all Processors; once the limit is reached, new extractions immediately return an error wrapping `ErrTooManyConcurrentOps` rather than queuing.

Batch extraction concurrency is bounded by `WorkerPoolSize` (default 4, max 256), well below 1000. You reach the 1000 limit only by issuing many concurrent timed `ExtractWithContext` calls at the application level.

### Distinguishing the Three Timeout Sources

The source is identified by the error type alone:

| Situation | Returned error |
|-----------|----------------|
| The library's `ProcessingTimeout` expires (user ctx still live) | `ErrProcessingTimeout` |
| The user ctx deadline fires at or before the library deadline | `context.DeadlineExceeded` (returned unchanged, not normalized) |
| The user calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` (no limit) and the user ctx expires | `context.DeadlineExceeded` (the library starts no watchdog goroutine) |

The library normalizes to `ErrProcessingTimeout` only when the derived deadline fired and `ctx.Err() == nil`; a user deadline or cancellation passes through unchanged. When checking with `errors.Is`, test for both error types.

On `ErrProcessingTimeout`, the library returns the error to the caller at once and the extraction goroutine exits at its next cooperative checkpoint. When the user ctx expires, the inner checkpoints observe the same ctx and stop too — both cases exit at a checkpoint rather than being killed.

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 5 * time.Second // Library timeout
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Outer context as a backstop; 8s here, looser than the library timeout
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	result, err := p.ExtractWithContext(ctx, []byte("<html></html>"))
	switch {
	case errors.Is(err, html.ErrProcessingTimeout):
		fmt.Println("Library timeout: raise ProcessingTimeout or reduce the input")
	case errors.Is(err, context.DeadlineExceeded):
		fmt.Println("Outer context deadline exceeded")
	case errors.Is(err, context.Canceled):
		fmt.Println("Cancelled by the caller")
	case err != nil:
		fmt.Println("Other error:", err)
	default:
		fmt.Println("Success, text length:", len(result.Text))
	}
	// Output: Success, text length: 0
}
```

## Batch Performance Tuning

For batch API usage see [Batch Processing in Practice](./batch-processing). The points below affect throughput.

### What WorkerPoolSize Does

`WorkerPoolSize` bounds concurrent goroutines with a semaphore (a buffered channel):

```text
ExtractBatch(items)
  → Build an extraction function for each item
  → Loop: acquire a semaphore slot (blocks when full) → start the goroutine
  → Goroutine releases the slot when done
```

The number of extractions running at once therefore never exceeds `WorkerPoolSize`. The default is 4; for CPU-bound extraction set it close to `runtime.NumCPU()` (max 256). Items beyond the slot count wait, so concurrency is set by the slot count and does not grow with the item count.

```go
package main

import (
	"fmt"
	"log"
	"runtime"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	// WorkerPoolSize caps at 256; clamp it on high-core machines
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

	pages := [][]byte{
		[]byte("<html><body>Page A</body></html>"),
		[]byte("<html><body>Page B</body></html>"),
	}
	br := p.ExtractBatch(pages)
	fmt.Printf("Success %d, Failed %d\n", br.Success, br.Failed)
	// Output: Success 2, Failed 0
}
```

### Batch Limits and Fault Tolerance

| Constraint | Value | Behavior |
|-----------|-------|----------|
| Max items per batch | 10000 | Exceeding it fails the whole batch: every item's error wraps `ErrBatchTooLarge`, nothing is partially processed |
| Single-item panic isolation | — | A panic in one item's extraction is recovered and wrapped with `ErrInternalPanic`; only that item is marked failed |
| Context cancellation | — | `ExtractBatchWithContext` skips items that have not started after ctx is cancelled, counts them in `Cancelled`, and sets `Errors[i]` to the ctx error |

:::tip Instance batch methods use the cache
`p.ExtractBatch` calls `p.Extract` for each item, so it shares and writes the main cache: duplicate content within a batch hits on later items. The package-level `html.ExtractBatch` uses cache-disabled pooled (or one-shot) instances and gets no such benefit. Use the instance method when you want deduplication within a batch.
:::

## Input Control

Reducing the work per extraction is the most direct optimization:

- **Limit `MaxInputSize`**: reject oversized documents and skip parsing them. The default and the maximum are both 50 MB; 5–10 MB covers most workloads.
- **Turn off unneeded extraction switches**: with `PreserveImages`/`PreserveVideos`/`PreserveAudios` off, the lazy media mechanism skips those stages.
- **Use `TextOnlyConfig()` for plain text**: media preservation is already off; also setting `ExtractArticle = false` skips article scoring.

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// TextOnlyConfig already disables all media preservation
	cfg := html.TextOnlyConfig()
	cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB, reject oversized input
	cfg.ExtractArticle = false          // Skip article scoring

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	result, err := p.Extract([]byte("<html><body><p>Plain text only</p></body></html>"))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text)
	// Output: Plain text only
}
```

`ExtractText` is `Extract` followed by reading `result.Text`; it saves the caller a field access. The extraction path is identical, so it is neither faster nor lighter on memory.

## Performance Anti-Patterns

Common anti-patterns and what to do instead:

| Anti-pattern | Problem | Correct approach |
|-------------|---------|-----------------|
| `html.New()` inside a loop | Creates and destroys a Processor each iteration, rebuilding encoding detectors, scorers, and so on | Create one instance outside the loop and reuse it |
| Expecting cache hits from package functions | Pooled instances disable caching, so `Get` always misses | Use a `Processor` instance |
| A large cache for content that never repeats | Low hit rate; entries only consume memory and hashing | Set `MaxCacheEntries = 0` |
| Expecting `ExtractToMarkdown` to hit the main cache | Format conversion uses a cache-disabled transient Processor | Set `InlineImageFormat="markdown"` and use `Extract` |
| No timeout for very large HTML | Malformed input can hold the CPU for a long time | Set `ProcessingTimeout` or use `ExtractWithContext` |
| Expecting linear speedup when items far exceed `WorkerPoolSize` | The semaphore bounds actual concurrency; a fixed slot count caps throughput | Size `WorkerPoolSize` to the CPU count and submit in batches |

## Benchmarking

Go benchmarks are the basis for judging configuration changes and cache payoff.

### Baseline Extraction Benchmark

<!-- check-code: skip -->
```go
package html_test

import (
    "os"
    "testing"

    "github.com/cybergodev/html"
)

// Use a representative real HTML document, not a tiny synthetic fragment
var benchDoc, _ = os.ReadFile("testdata/sample.html")

// BenchmarkExtract measures the single-extraction baseline (encoding detection, parsing, scoring, extraction)
func BenchmarkExtract(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()

    b.ReportAllocs() // Observe heap allocations per extraction
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := p.Extract(benchDoc)
        if err != nil {
            b.Fatal(err)
        }
    }
}
```

### Measuring the Cache Payoff

Comparing repeated extraction of the same content against always-different content tells you whether caching pays:

<!-- check-code: skip -->
```go
// BenchmarkExtractCacheHit extracts the same content repeatedly; from the second call on it should hit
func BenchmarkExtractCacheHit(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()
    p.Extract(benchDoc) // Warm the cache

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = p.Extract(benchDoc)
    }
}

// BenchmarkExtractNoCache disables caching as a control group
func BenchmarkExtractNoCache(b *testing.B) {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 0
    p, _ := html.New(cfg)
    defer p.Close()

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = p.Extract(benchDoc)
    }
}
```

### Comparing Configurations

Use `b.Run` subtests to compare several configurations in one benchmark:

<!-- check-code: skip -->
```go
func BenchmarkConfigs(b *testing.B) {
    cases := []struct {
        name string
        cfg  func() html.Config
    }{
        {"Default", html.DefaultConfig},
        {"TextOnly", html.TextOnlyConfig},
        {"NoCache", func() html.Config {
            c := html.DefaultConfig()
            c.MaxCacheEntries = 0
            return c
        }},
    }
    for _, tc := range cases {
        b.Run(tc.name, func(b *testing.B) {
            p, _ := html.New(tc.cfg())
            defer p.Close()
            b.ReportAllocs()
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                _, _ = p.Extract(benchDoc)
            }
        })
    }
}
```

:::tip Reading benchmark results
- `ns/op`: time per extraction, lower is better;
- `B/op` and `allocs/op`: heap bytes and allocation count per extraction, the metrics that show whether pooling works and whether the cache hits; a cache hit drops `allocs/op` noticeably;
- Compare the hit case (after warm-up, `GetStatistics().CacheHits` > 0) against `NoCache`: if they are close, your content does not repeat, caching has no payoff, and you should disable it.
:::

Run the benchmarks:

```bash
go test -bench=. -benchmem ./...            # Run all benchmarks with allocation reports
go test -bench=Extract -benchmem -count=5 ./... # Only the extraction benchmarks, 5 runs to see variance
```

## Next Steps

- [Processor Cache & Reuse](./processor-cache) — `sync.Pool` mechanics and hit-rate monitoring
- [Batch Processing in Practice](./batch-processing) — full batch API usage and concurrency control
- [Config Reference](../../api-reference/core/config) — all `Config` fields and their constraints
- [Security Production Checklist](../security/production-checklist) — production readiness beyond performance
