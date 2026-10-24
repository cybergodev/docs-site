---
sidebar_label: "Processor"
title: "Processor - CyberGo html | Methods & Lifecycle"
description: "CyberGo html Processor reference: New steps, 30 exported methods, error returns, context timeout rules, cache copies, and Close."
sidebar_position: 20
---

# Processor

`Processor` is the core processing engine of the HTML library. It reuses internal resources (cache, encoding detector) and suits high-frequency calls; for one-off calls use the [package functions](./functions).

## Creation

### New

Create a `Processor` instance, optionally passing a configuration.

```go
func New(cfg ...Config) (*Processor, error)
```

**Parameters**: at most one `Config`; when omitted, `DefaultConfig()` is used.

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

**Internal initialization**:

`New` performs these steps in order:

1. **Validates the config**: calls `Config.Validate()`; an invalid config returns `*ConfigError` (`errors.Is(err, ErrInvalidConfig)` is true). It checks numeric bounds and format strings: `MaxInputSize`, `WorkerPoolSize`, and `MaxDepth` must be positive; `MaxCacheEntries` cannot be negative (`0` is legal and disables the cache); none may exceed its upper bound.
2. **Pre-computes the format strings**: `InlineImageFormat`/`InlineLinkFormat` are normalized (lowercased, whitespace-stripped, empty mapped to `"none"`) and cached in `imageFormat`/`linkFormat`, avoiding repeated `strings.ToLower` in the hot path.
3. **Sets the Scorer**: a custom `Scorer` is adapted to the internal interface automatically; otherwise the built-in default scorer is used (unexported, read-only, concurrency-safe).
4. **Starts cache cleanup**: the background cleanup goroutine starts only when `CacheTTL>0` **and** `CacheCleanup>0`; if either is 0, it does not start.

## Concurrency Safety

:::tip What makes sharing safe
A `Processor` can be shared across goroutines without extra locking, for four reasons:

- **Immutable config**: `config` never changes after `New()`, so format methods such as `ExtractToMarkdown` can copy it into a temporary Processor without a lock, and format overrides never write back to the shared config.
- **Statistics counters**: `TotalProcessed`/`CacheHits`/`CacheMisses`/`ErrorCount`/`totalProcessTime` all use `atomic` operations.
- **Cache**: the internal cache carries its own lock. Cache behavior is observed and controlled through the public API: `Config.MaxCacheEntries = 0` disables it, `ClearCache()` empties it, and `Statistics.CacheHits`/`CacheMisses` report hits.
- **Scorer**: the built-in default scorer is read-only. **A custom `Scorer` must ensure its own concurrency safety**: one Processor calls its `Score` from multiple goroutines during concurrent `Extract`. `ShouldRemove` is a reserved interface method and is not called by the current library version.
:::

## Method Overview

`Processor` has 30 exported methods, grouped by function (signatures and behavior follow):

| Group | Method | Description |
|-------|--------|-------------|
| Content extraction | `Processor.Extract` | Extract a full `Result` from HTML bytes |
| Content extraction | `Processor.ExtractWithContext` | Same, with context cancellation |
| Content extraction | `Processor.ExtractFromFile` | Extract from an HTML file |
| Content extraction | `Processor.ExtractFromFileWithContext` | Same, with context cancellation |
| Text extraction | `Processor.ExtractText` | Extract plain text only |
| Text extraction | `Processor.ExtractTextWithContext` | Same, with context cancellation |
| Text extraction | `Processor.ExtractTextFromFile` | Extract plain text from a file |
| Text extraction | `Processor.ExtractTextFromFileWithContext` | Same, with context cancellation |
| Output formats | `Processor.ExtractToMarkdown` | Output Markdown (temporary Processor, bypasses the main cache) |
| Output formats | `Processor.ExtractToMarkdownWithContext` | Same, with context cancellation |
| Output formats | `Processor.ExtractToMarkdownFromFile` | Output Markdown from a file |
| Output formats | `Processor.ExtractToMarkdownFromFileWithContext` | Same, with context cancellation |
| Output formats | `Processor.ExtractToJSON` | Output JSON (goes through the main cache) |
| Output formats | `Processor.ExtractToJSONWithContext` | Same, with context cancellation |
| Output formats | `Processor.ExtractToJSONFromFile` | Output JSON from a file |
| Output formats | `Processor.ExtractToJSONFromFileWithContext` | Same, with context cancellation |
| Link extraction | `Processor.ExtractAllLinks` | Extract all link resources (no sanitization applied) |
| Link extraction | `Processor.ExtractAllLinksWithContext` | Same, with context cancellation |
| Link extraction | `Processor.ExtractAllLinksFromFile` | Extract links from a file |
| Link extraction | `Processor.ExtractAllLinksFromFileWithContext` | Same, with context cancellation |
| Batch processing | `Processor.ExtractBatch` | Concurrent batch extraction (byte-slice input) |
| Batch processing | `Processor.ExtractBatchWithContext` | Same, with context cancellation |
| Batch processing | `Processor.ExtractBatchFiles` | Concurrent batch extraction (file-path input) |
| Batch processing | `Processor.ExtractBatchFilesWithContext` | Same, with context cancellation |
| Statistics & cache | `Processor.GetStatistics` | Return `Statistics` processing statistics |
| Statistics & cache | `Processor.ClearCache` | Clear the cache, keeping accumulated statistics |
| Statistics & cache | `Processor.ResetStatistics` | Reset all statistics counters |
| Audit | `Processor.GetAuditLog` | Return audit log entries held in memory |
| Audit | `Processor.ClearAuditLog` | Clear the audit log |
| Lifecycle | `Processor.Close` | Release resources (idempotent). After close, extracting methods that return a value report `ErrProcessorClosed` |

## Content Extraction

### Error Returns

The `Extract` method family returns explicit sentinel errors at each stage; check them with `errors.Is`:

| Error | Trigger | Note |
|-------|---------|------|
| `ErrProcessorClosed` | `p` is `nil` or already `Close`d | Shared by the extraction, formatting, link, and batch methods |
| `ErrInputTooLarge` | Input bytes exceed `MaxInputSize` | Wrapped in `*InputError` with actual/limit sizes |
| Encoding detection error | Encoding detection or UTF-8 conversion fails | The underlying error is wrapped |
| `ErrInvalidHTML` | Bytes cannot be parsed as HTML | The parse error is wrapped too |
| `ErrMaxDepthExceeded` | Element nesting exceeds `MaxDepth` | Iterative check; prevents stack overflow |
| `ErrProcessingTimeout` | The library's processing timeout elapsed | `ProcessingTimeout=0` means unlimited |
| `ErrInternalPanic` | An unexpected internal panic was recovered | Safety net; should not occur in normal use |
| `ErrTooManyConcurrentOps` | The timeout watchdog hit its global limit (1000) | A "too busy" state; no timeout occurred |

The `context`-aware variants return errors by these rules:

| Scenario | Returned error |
|----------|----------------|
| The library's `ProcessingTimeout` elapses (user ctx still live) | `ErrProcessingTimeout` |
| The user ctx deadline fires first (or at the same time) | `context.DeadlineExceeded`, passed through unchanged, **not** normalized |
| The user calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout=0` (unlimited) and the user ctx expires | `context.DeadlineExceeded` (no timeout goroutine is started) |

When the library timeout fires, the extraction goroutine exits at its next cooperative check. When the user ctx expires, the library returns immediately; the inner checks see the same ctx and stop as well, but the goroutine is not forcibly killed.

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

Extract content from HTML bytes, detecting the encoding automatically.

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

Extract content from a file.

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

Return the plain text only.

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

Extract plain text from a file.

## Context Variants

Extraction, text, output, link, and batch methods all have `context.Context` variants:

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

Context-aware variants:

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

:::warning The two output formats treat the cache differently
- **`ExtractToMarkdown`** builds a temporary Processor (copying the immutable `config`, with `MaxCacheEntries` zeroed) and **does not touch the main cache**; Markdown results are not cached. Statistics and audit still flow into the parent Processor's counters and log.
- **`ExtractToJSON`** calls `p.Extract` directly and **goes through the normal cache path**, hitting/writing the main cache and updating statistics.

To have Markdown output cached as well, create a dedicated Processor with `MarkdownConfig()` and call `Extract`, or cache the output yourself.
:::

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

## Statistics and Cache

### Cache Behavior in Detail

With `MaxCacheEntries > 0`, `Extract` enables the cache:

- **Hit path**: `CacheHits` and `TotalProcessed` each increment by 1, and `cloneResult` is returned — a deep copy that `copy`s slices such as `Images`/`Links`/`Videos`/`Audios`. Caller mutations do not affect the cached entry, which also avoids data races on concurrent hits.
- **Miss path**: the result is written to the cache, then a `cloneResult` is returned. The cache entry and the return value never alias.
- **Cache disabled**: with `MaxCacheEntries = 0`, cache-key generation and cache reads/writes are skipped entirely, at no cache cost.

### GetStatistics

Return the current processing statistics.

```go
func (p *Processor) GetStatistics() Statistics
```

`Statistics` fields:

| Field | Description |
|-------|-------------|
| `TotalProcessed` | Extractions that completed without error, **including cache hits** |
| `CacheHits` | Times served directly from the cache |
| `CacheMisses` | Misses that required full processing |
| `ErrorCount` | Extractions that returned an error |
| `AverageProcessTime` | Average wall-clock time per extraction (0 when `TotalProcessed` is 0) |

```go
stats := p.GetStatistics()
fmt.Printf("Processed: %d, Cache hits: %d\n",
	stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

Clear the cache, keeping accumulated statistics.

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

Retrieve the audit log entries held in memory.

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

Clear the audit log.

```go
func (p *Processor) ClearAuditLog()
```

## Lifecycle

### Close

Release the resources held by the Processor. Call it when you are done.

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... use p to extract
```

:::tip Lifecycle essentials
- **Reuse one instance**: in a long-running service (HTTP handler, worker), create one Processor and share it across concurrent requests; it is concurrency-safe, so there is no need for one per request.
- **`defer Close()` immediately**: place `defer p.Close()` right after creation so exceptional paths still stop the cleanup goroutine, clear the cache, and close the audit sink.
- **Never use after Close**: extraction, formatting, link, and batch methods return `ErrProcessorClosed` after `Close`. `Close` is idempotent; repeated calls are safe but pointless.
:::
