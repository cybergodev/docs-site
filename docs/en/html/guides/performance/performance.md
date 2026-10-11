---
sidebar_label: "Performance"
title: "Performance - CyberGo html | Throughput Guide"
description: "CyberGo html performance: sync.Pool Processor reuse, cache hit-rate monitoring, batch concurrency, WorkerPoolSize/ProcessingTimeout tuning, and anti-patterns."
sidebar_position: 3
---

# Performance

This page is the performance tuning overview for the html library: it first covers the **optimization mechanisms already implemented internally** (to help you understand performance characteristics), then provides **configuration-level tuning**, **anti-pattern avoidance**, and **benchmarking methods**.

If you need full details on a specific topic, see the dedicated pages in the same section:

- [Processor Reuse & Caching](./processor-cache) — package functions vs instances, `sync.Pool` mechanism, cache strategy and hit-rate monitoring
- [Batch Processing in Practice](./batch-processing) — the four batch APIs, `BatchResult` structure, concurrency control, and partial-failure handling

## Internal Optimization Mechanisms

The html library performs extensive zero-allocation and reuse optimizations on hot paths. Understanding these mechanisms helps you predict the performance characteristics of different usage patterns and avoid "fighting" the library's optimizations.

### sync.Pool Processor Reuse

Package-level functions (such as `html.Extract`) reuse `Processor` instances through `sync.Pool`, avoiding the cost of rebuilding heavyweight objects like encoding detectors and scorers on every call:

```text
html.Extract(data)
  → Get Processor from sync.Pool (reuse on pool hit, otherwise create new)
  → Execute extraction
  → Return to sync.Pool (reset statistics + clear audit log + clear cache)
```

The pooled Processor has two key design decisions:

- **Cache disabled**: `MaxCacheEntries`, `CacheTTL`, and `CacheCleanup` are all set to zero for pooled instances. Because pooled instances call `ClearCache()` every time they are returned, enabling caching only wastes hash computation and background cleanup goroutine overhead (every `Get` is always a miss) — the cache could never be hit.
- **Custom Config bypasses pooling**: When you call `html.Extract(data, cfg)` with a custom configuration, the library creates a **temporary Processor** (closed immediately after use) instead of reusing a pooled instance — because pooled instances are fixed to the default configuration.

:::tip When to create your own instance
Pooled instances have caching disabled. If you are repeatedly processing **potentially duplicate** content in a loop (crawler deduplication, services downstream of a cache layer), use `html.New()` to create a long-lived `Processor` instance to benefit from cache hits. See [Processor Reuse & Caching](./processor-cache).
:::

### Cache Key Generation Strategy

The cache Key is a `[16]byte` (128-bit) value used directly as a `map` key — **generating the Key does not cause heap allocations**. The inputs to Key computation include:

- The **raw input bytes** (not the UTF-8 text after encoding conversion) — a cache hit skips the entire encoding detection step; the same document stored in a different encoding produces a different Key and cannot hit
- Content extraction switches (`ExtractArticle`, `PreserveImages`, and 3 other boolean flags) packed into a single `uint8`
- Format options (`InlineImageFormat`, `InlineLinkFormat`, `TableFormat`)
- The `Encoding` forced-encoding setting — the same bytes decode differently under different `Encoding` configurations, so they must be distinguished

For content of different sizes, the Key generation uses two strategies:

| Content size | Strategy | Description |
|-------------|----------|-------------|
| ≤ 64 KB | Full content hash | hash/maphash computation over all bytes (AES-NI accelerated), with the 64-bit result extended to 128 bits via splitmix64 |
| > 64 KB | 5-point sampling | Head + tail + 3 evenly distributed sampling points, with a total sampling budget of 4096 bytes (about 819 bytes per point) |

Large document sampling is used to limit hashing cost — full hashing of a 10 MB document would negate the cache benefit. 5-point sampling balances **hash flood resistance** (modifications anywhere in the document are very likely to change the Key) with **throughput**.

### Pre-allocation and Object Pooling

The most frequently allocated objects during extraction have all been pooled or pre-allocated:

| Object | Mechanism | Purpose |
|--------|-----------|---------|
| Pooled text builder (internal implementation) | `sync.Pool` | Reuses underlying `[]byte` capacity across calls, avoiding growing from zero to document length on every extraction |
| Link result slice | Pre-allocated capacity 128 | Covers the link count of typical pages, avoiding `append` triggering underlying array copies |
| Depth validation stack (`depthStackEntry`) | `sync.Pool` | Stack reuse for iterative depth validation, avoiding per-extraction stack allocation |
| `[]byte` temporary buffers | `sync.Pool` | Reuse of high-frequency small buffers for encoding conversion, text concatenation, etc. |

:::warning Oversized buffers are discarded by the pool
To prevent the classic `sync.Pool` pitfall of "one oversized document → pool permanently holds oversized buffer → all subsequent small requests get oversized buffers," buffers with capacity exceeding 64 KiB are **discarded** rather than returned to the pool. This means processing very large documents does not benefit from pooling — this is expected behavior.
:::

### Pre-computed Format Strings

At `New()` time, `InlineImageFormat`/`InlineLinkFormat` are pre-computed via `normalizeInlineFormat` (lowercase + trim + null value normalized to `"none"`) and stored in `Processor` fields. The extraction hot path directly compares the pre-computed values, **avoiding `strings.ToLower` on every extraction**.

This optimization has a minor impact on a single extraction, but accumulates significantly when batch processing tens of thousands of documents.

### Lazy Allocation for Media Extraction

Video/audio extraction uses a two-level gating mechanism that makes the common case of "no media content" nearly zero-overhead:

1. **Front regex gate**: first a quick scan with the internal media reference detection (regex gate). When it confirms the content **does not contain** any media references, all regex scanning and iframe/embed/object attribute extraction is skipped entirely.
2. **Size gate**: when content exceeds 1 MB (`maxHTMLForRegex`), regex scanning is skipped — running regexes on very large documents is both slow and carries ReDoS risk.
3. **Lazy initialization**: `ensureDedup` only allocates result slices and the dedup map when the first media match appears. Documents with no media have zero allocation throughout.

:::tip Optimal config for plain text scenarios
If you only care about body text and don't need image/video/audio information, use [`TextOnlyConfig()`](../../api-reference/core/config#preset-configs) to disable all media preservation in one step. Combined with the lazy mechanisms described here, media-related overhead approaches zero.
:::

## Cache Deep Tuning

[Processor Reuse & Caching](./processor-cache) covers basic cache usage and hit-rate monitoring. Here are a few key details that affect cache behavior.

### Hit Conditions

Two inputs must produce the **same cache Key** for a hit, which means:

- Same content + same config → hit
- The same body stored in different encodings (e.g., one GBK copy and one UTF-8 copy) → **no hit** (the Key is computed from the raw input bytes, and different encodings produce different byte sequences)
- Same bytes but a different `Encoding` setting → **no hit** (`Encoding` participates in Key computation)
- Same content but different `PreserveImages` and other switches → **no hit** (the switch bits participate in Key computation)

### Clone Cost After a Hit

Every cache hit returns `cloneResult` (deep copy of the entire `Result`, including Images/Links/Videos/Audios slices). This is **necessary** — cache entries are read concurrently; if a pointer were returned directly, caller modifications to the result would pollute the cache through aliasing.

The cost: when `Result` contains a large number of links/images, the clone itself has some overhead. In scenarios with "extremely high cache hit rate + large single result" (e.g., repeatedly extracting the same link-dense large document), this cost may become noticeable.

### When to Disable Caching

When `MaxCacheEntries = 0`, `Extract` **completely skips Key generation** (no hash computation, no table lookup, no writes) — true zero overhead, not "cache enabled but always miss."

Disabling the cache is suitable for **one-time processing of large amounts of different content**:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	// Crawler processing many distinct pages: disable cache to save hash computation and memory
	cfg := html.DefaultConfig()
	cfg.MaxCacheEntries = 0 // Zero overhead, skip the entire cache layer
	cfg.CacheTTL = 0        // Also disable the background cleanup goroutine
	cfg.CacheCleanup = 0

	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// eachPage comes from a real crawl stream, almost never duplicated
	result, err := p.Extract([]byte("<html><body>Every page is different</body></html>"))
	if err != nil {
		panic(err)
	}
	fmt.Println("Text length:", len(result.Text))
	// Output: Text length: ...
}
```

### Format Conversion Bypasses the Main Cache

`ExtractToMarkdown` / `ExtractToMarkdownFromFile` internally create a **temporary Processor with caching disabled** via `buildFormatProcessor` to perform format conversion. This means:

- Markdown conversion **does not read from** and **does not write to** the main Processor's cache — even if you previously extracted the same content with `Extract`, `ExtractToMarkdown` will not hit
- Calling `ExtractToMarkdown` multiple times on the same content will also not hit each other

:::warning Don't expect format conversion to hit the cache
If you need to repeatedly get Markdown for the same content, rather than calling `ExtractToMarkdown` multiple times, call `Extract` once (configuring `InlineImageFormat`/`InlineLinkFormat` to `"markdown"`) — this way the result enters the main cache and repeated inputs can hit.
:::

## Timeout and Goroutine Management

`ProcessingTimeout` is a cooperative timeout, not a forced kill. Understanding its cooperation points and error semantics helps you correctly handle timeouts and user cancellation.

### Cooperative Cancellation Mechanism

When `ProcessingTimeout > 0`, the library derives a child context with a deadline from the incoming context. The processing function polls `ctx.Done()` at **key checkpoints**:

- Before encoding detection
- Before DOM parsing
- Before depth validation
- Before content extraction

If the deadline has been reached, processing stops at the **next checkpoint** and returns an error. This means the timeout is not instantaneous — work between two checkpoints (such as parsing a very large document) will complete.

### Global Limit for Timeout Goroutines

Each extraction with a timeout occupies one goroutine until completion or timeout. To prevent goroutine leaks from exhausting resources, the library enforces a global limit of `maxTimeoutGoroutines = 1000`. When the number of concurrent timeout operations reaches the limit, new extractions **immediately** return `ErrProcessingTimeout` (instead of queuing).

:::warning Concurrency limit in batch scenarios
The concurrency of batch extraction (`ExtractBatch`) is limited by `WorkerPoolSize` (default 4, max 256), typically well below the 1000 goroutine limit. However, if you concurrently call large numbers of `ExtractWithContext` with timeouts at the application level, be aware of this global limit — it is process-level and shared across all Processors.
:::

### Distinguishing Three Cancellation Sources

When handling timeouts/cancellation at the application layer, distinguish the source based on error type:

| Trigger condition | Returned error | Meaning |
|-------------------|---------------|---------|
| Library `ProcessingTimeout` expires | `ErrProcessingTimeout` | Single document processing exceeded the configured timeout |
| User context deadline expires | `context.DeadlineExceeded` | Outer context timed out (passed through by the library) |
| User manually cancels context | `context.Canceled` | Outer active cancellation (passed through by the library) |

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 5 * time.Second // Library timeout
	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// Outer context adds another safeguard (can be shorter than the library timeout)
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	result, err := p.ExtractWithContext(ctx, []byte("<html></html>"))
	switch {
	case errors.Is(err, html.ErrProcessingTimeout):
		fmt.Println("Library processing timeout: consider increasing ProcessingTimeout or reducing input")
	case errors.Is(err, context.DeadlineExceeded):
		fmt.Println("Outer context timeout")
	case errors.Is(err, context.Canceled):
		fmt.Println("Caller cancelled")
	case err != nil:
		fmt.Println("Other error:", err)
	default:
		fmt.Println("Success, text length:", len(result.Text))
	}
	// Output: Success, text length: ...
}
```

## Batch Processing Performance Tuning

[Batch Processing in Practice](./batch-processing) covers batch API usage in detail. Here we focus on a few tuning points that affect throughput.

### The Role of WorkerPoolSize

`WorkerPoolSize` limits the number of concurrent goroutines through a **semaphore** (buffered channel), rather than spawning without limit:

```text
ExtractBatch(items)
  → Create an extractor for each item
  → Loop: first acquire a semaphore slot (blocks if full) → then spawn goroutine
  → Goroutine releases the slot when done
```

Therefore, no matter how large the batch, the **number of extractions running simultaneously** never exceeds `WorkerPoolSize`. The default value of 4 is suitable for mixed I/O scenarios; for pure CPU-intensive extraction, set it close to `runtime.NumCPU()` (max 256).

```go
package main

import (
	"fmt"
	"runtime"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	// WorkerPoolSize is capped at 256; cap it on high-core machines
	n := runtime.NumCPU()
	if n > 256 {
		n = 256
	}
	cfg.WorkerPoolSize = n
	p, err := html.New(cfg)
	if err != nil {
		panic(err)
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
| Max items per batch | 10000 | When exceeded, the **entire batch fails** (every item returns an error); no partial processing |
| Single-item panic isolation | — | A panic in one item's extraction is `recover`ed; only that item is marked as failed; other items are unaffected |

:::tip Instance batch methods reuse the cache
The batch methods of a `Processor` instance (`p.ExtractBatch`) internally call `p.Extract`, so they **share and write to the main cache** — duplicate content during batch processing will hit the cache on subsequent encounters. The package-level `html.ExtractBatch` uses pooled instances with caching disabled, which lack this effect. For batch dedup acceleration, prefer instance methods.
:::

## Input Control

Reducing the amount of work per extraction is the most direct optimization:

- **Limit `MaxInputSize`**: reject oversized documents to avoid unnecessary parsing overhead. Default is 50 MB; most scenarios can reduce this to 5–10 MB.
- **Disable unneeded extraction switches**: when `PreserveImages`/`PreserveVideos`/`PreserveAudios` etc. are turned off, the corresponding overhead is skipped via the lazy media mechanism.
- **Use `TextOnlyConfig()` for plain text**: already disables all media preservation; additionally turning off `ExtractArticle` further speeds up plain text extraction.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	// TextOnlyConfig already disables all media preservation, no extra setup needed
	cfg := html.TextOnlyConfig()
	cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB, reject oversized input
	cfg.ExtractArticle = false          // Disable article recognition for faster plain text extraction

	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	result, err := p.Extract([]byte("<html><body><p>Plain text only</p></body></html>"))
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Text)
	// Output: Plain text only
}
```

## Performance Anti-Patterns

The following are common usage patterns that hurt performance. Use this reference table to quickly avoid pitfalls:

| Anti-pattern | Problem | Correct approach |
|-------------|---------|-----------------|
| `html.New()` inside a loop | Creates and destroys a Processor every iteration, rebuilding encoding detectors, scorers, etc. | Create one instance outside the loop, reuse it inside |
| Expecting cache hits from package functions | Pooled Processors have caching disabled, always miss | Use a `Processor` instance |
| Enabling a large cache for many different contents | Cache bloat, extremely low hit rate, wasted memory and hash overhead | Set `MaxCacheEntries = 0` to disable caching |
| Expecting `ExtractToMarkdown` to hit the main cache | Format conversion uses a temporary Processor with caching disabled | Configure `InlineImageFormat="markdown"` and use `Extract` |
| No timeout for very large HTML | Malicious/malformed input may occupy resources for a long time | Set `ProcessingTimeout` or use `ExtractWithContext` |
| Expecting linear speedup when batch items far exceed `WorkerPoolSize` | The semaphore limits actual concurrency; more items don't increase speed | Tune `WorkerPoolSize` based on CPU cores, submit in batches |

## Benchmarking Recommendations

Using Go benchmarks to quantify the effects of configuration changes and cache hits is the most reliable basis for performance tuning.

### Basic Extraction Benchmark

<!-- check-code: skip -->
```go
package html_test

import (
    "os"
    "testing"

    "github.com/cybergodev/html"
)

// Prepare a representative real HTML document (don't use tiny synthetic fragments)
var benchDoc, _ = os.ReadFile("testdata/sample.html")

// BenchmarkExtract measures the baseline performance of a single extraction (including encoding detection, parsing, scoring, extraction)
func BenchmarkExtract(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()

    b.ReportAllocs() // Critical: observe heap allocations per extraction
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := p.Extract(benchDoc)
        if err != nil {
            b.Fatal(err)
        }
    }
}
```

### Measuring Cache Hit Benefits

Comparing "repeated extraction of the same content" vs "different content each time" shows whether caching is actually helping:

<!-- check-code: skip -->
```go
// BenchmarkExtractCacheHit repeatedly extracts the same content; from the second call on, it should hit the cache
func BenchmarkExtractCacheHit(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()
    p.Extract(benchDoc) // Warm up the cache

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

### Comparing Different Configurations

Use `b.Run` subtests to compare multiple configurations within a single benchmark for easy side-by-side comparison:

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

:::tip Interpreting benchmark results
- `ns/op`: time per extraction — lower is faster
- `B/op` and `allocs/op`: heap allocation bytes and count per extraction — these are the core metrics for judging "whether pooling is working" and "whether caching is hitting." When the cache hits, `allocs/op` drops significantly
- Comparing the cache-hit case (with the default config warmed up, `stats.CacheHits` > 0; note the stats field is plural `CacheHits`) against `NoCache`: if they are close, your content **has no duplication** and caching is pure overhead — disable it
:::

Run benchmarks:

```bash
go test -bench=. -benchmem ./...          # Run all benchmarks, report memory allocations
go test -bench=BenchmarkExtract -count=5  # Run multiple times to observe variance
```

## Next Steps

- [Processor Reuse & Caching](./processor-cache) — deep dive into `sync.Pool` mechanism and cache hit-rate monitoring
- [Batch Processing in Practice](./batch-processing) — complete batch API usage and concurrency control
- [Config Reference](../../api-reference/core/config) — all `Config` fields and value constraints
- [Security Production Checklist](../security/production-checklist) — production readiness essentials beyond performance
