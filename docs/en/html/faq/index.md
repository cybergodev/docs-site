---
sidebar_label: "FAQ"
title: "FAQ - CyberGo html | Top Questions & Answers"
description: "CyberGo html FAQ: package functions vs Processor, 15+ encoding detection, input/depth limits, empty-text fixes, GetStatistics, audit setup, cache hit-rate."
sidebar_position: 1
---

# FAQ

## What's the difference between package functions and Processor?

**Package functions** (e.g., `html.Extract`) use `sync.Pool` internally to reuse Processors, suitable for low-frequency, one-time calls. The Processor is returned to the pool after each call.

**Processor** (e.g., `p := html.New()`) is suited for high-frequency calls, reusing cache and internal resources. It also supports statistics collection and audit logging.

```go
// Low frequency: package functions
result, _ := html.Extract(data)

// High frequency: Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## How to handle encoding issues?

The HTML library auto-detects 15+ encodings (UTF-8, GBK, Shift_JIS, Windows-1252, etc.). Manual specification is usually not needed.

To force a specific encoding:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## What's the input size limit?

Default maximum is 50MB (`DefaultMaxInputSize = 52428800`). Adjustable via config:

```go
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB
```

## How to get Markdown output?

```go
md, err := html.ExtractToMarkdown(data)
```

Or using Processor:

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## What's the batch processing limit?

A single batch supports up to 10000 items. For larger datasets, process in multiple batches.

## Why is the extracted text empty?

Possible causes:

1. **HTML structure issue** - Content is inside `<script>` or `<style>` tags
2. **Content empty after sanitization** - If the body text only exists inside tags removed by sanitization (e.g., `<iframe>`, `<object>`), the result may be empty; for trusted input you can temporarily set `EnableSanitization = false` to investigate
3. **Empty input** - Check whether the input byte array is empty (blank content returns an empty `Result`)
4. **Article detection** - Try disabling `ExtractArticle` to see whether content can be extracted

:::tip Distinguish errors from empty results
DOM nesting that exceeds `MaxDepth` does not produce empty text — it returns the `ErrMaxDepthExceeded` error. If a call returns an `error`, prefer using `errors.Is` to determine the error type rather than checking whether the text is empty.
:::

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // Disable article recognition
```

## How to monitor processing statistics?

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// After processing some content
stats := p.GetStatistics()
fmt.Printf("Processed: %d\n", stats.TotalProcessed)
fmt.Printf("Cache hits: %d\n", stats.CacheHits)
fmt.Printf("Avg duration: %v\n", stats.AverageProcessTime)
fmt.Printf("Errors: %d\n", stats.ErrorCount)
```

## How to enable auditing?

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

See [Audit System](../api-reference/modules/audit) for details.

## Are file paths secure?

`FileError` automatically truncates full paths to prevent server path leakage in error messages:

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // Filename only, not full path
}
```

## How to implement custom content scoring?

Implement the `Scorer` interface:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // Custom scoring logic
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // Custom removal logic
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

See [Interfaces](../api-reference/types/interfaces) for details.

## Does a custom Scorer need to be concurrent-safe?

Yes. When a single Processor is shared by multiple concurrent `Extract` calls, `Score`/`ShouldRemove` are invoked from multiple goroutines simultaneously. A custom Scorer that holds mutable state (caches, counters) must handle its own locking and synchronization. The library's built-in default scorer (internal implementation, not exported) is read-only and inherently concurrent-safe.

:::warning Stateless preferred
We recommend designing custom Scorers to be stateless (computing only from the incoming `ContentNode`). This avoids lock overhead and eliminates concurrency issues at the root. When you need aggregated statistics, write the results back to the `Processor`'s statistics channel rather than to the Scorer itself.
:::

## How is the cache Key generated?

The cache Key is computed from the **raw input bytes** (not the UTF-8 text after encoding conversion), mixed with the processor configuration (the `ExtractArticle`/`Preserve*` extraction switches, the three format strings `InlineImageFormat`/`InlineLinkFormat`/`TableFormat`, and the `Encoding` forced-encoding setting). The algorithm is hash/maphash (AES-NI accelerated, with a process-lifetime random seed); the 64-bit hash result is extended to a 128-bit (16-byte) Key via splitmix64:

- For content up to 64KB (`maxCacheKeySize`): computed over the full content
- For content larger than 64KB: uses 5-point sampling (head, tail, and 3 evenly distributed points), with a total sampling budget of 4096 bytes (`cacheKeySample`, roughly 819 bytes per point), and additionally mixes in the total content length to improve uniqueness
- The Key is computed from the raw bytes — the same document stored in different encodings (GBK, Shift_JIS, Windows-1252, ...) has different byte sequences and produces **different** Keys

:::tip Why raw bytes
The Key is computed directly over the raw bytes **before** encoding detection, so a cache hit skips the encoding-detection scan entirely (one of the most expensive steps on the repeated-extraction hot path). The trade-off: the same document stored in different encodings produces different Keys and cannot hit each other. `Encoding` participates in the computation because the same bytes decode differently under different forced encodings and must be distinguished — otherwise cache entries would be incorrectly shared.
:::

## Why do ExtractAllLinks and Extract produce different results?

The two serve different purposes and follow different processing paths with different return types:

- `Extract` first applies HTML sanitization (removing `<script>`, `<iframe>`, and similar tags), then extracts links from the sanitized DOM. Results appear in `Result.Links` with type `LinkInfo` (including fields like `Position`, `IsExternal`, etc.)
- `ExtractAllLinks` does **not** apply sanitization. It enumerates all resource links (including `<script src>`, `<iframe>`, `<link>`, `<embed>`) and returns `[]LinkResource` (with `Type` classification such as script, style, media)

In short: `Extract` gives you "links within the body content," while `ExtractAllLinks` gives you "all resources referenced by the page."

## Do package-level functions still use pooling when a Config is passed?

No. The `resolveConfig` logic is:

- No Config → uses `DefaultConfig()`, **goes through `sync.Pool` pooling**
- One Config → uses that Config, **creates a temporary Processor (does not reuse the pool)**

Therefore `html.Extract(data, cfg)` creates and destroys a new Processor on every call. For high-frequency calls with custom configuration, you should call `html.New(cfg)` yourself and reuse the Processor to benefit from caching and statistics.

## What happens if an internal panic occurs?

All extraction operations are wrapped by `recoverPanic`. Panics do not escape to the caller but are recovered into an `ErrInternalPanic` error. The isolation granularity is as follows:

- Single extraction: panic → `ErrInternalPanic`
- Batch processing: a panic in a single item is independently recovered and only affects that item (recorded in `Failed`); other items are unaffected
- Audit subsystem: panics from `AuditSink`'s `Write`/`Close` are isolated (audit is best-effort, see SEC-003) and do not interrupt the main extraction flow
- Timeout goroutine: internal panics are also independently recovered

:::warning What to do when you see ErrInternalPanic
`ErrInternalPanic` indicates the input may have triggered an internal bug in the library. You should record the original input (or a minimal reproduction sample) and report it, rather than simply retrying — the same input will likely trigger it again.
:::

## How to disable caching to save memory?

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // Disable cache, skip Key generation (zero overhead)
```

When disabled, every extraction runs the full processing pipeline, but avoids the memory overhead of cache entries. This is suitable for scenarios that process large amounts of distinct content (e.g., one-time crawling of many different pages).

:::tip Pooled Processors already have caching disabled by default
The pooled Processors used by package-level functions (such as `html.Extract`) are configured with `MaxCacheEntries = 0` and `CacheTTL = 0` — because the cache is cleared every time the instance is returned to the pool, enabling caching only adds unnecessary hash and map operation overhead. If you need caching, explicitly call `html.New(cfg)`.
:::

## What's the difference between ProcessingTimeout and user context timeout?

The library timeout works in concert with the caller's context. The error type depends on the trigger source and configuration:

| Scenario | Error type | Trigger |
|----------|-----------|---------|
| `ProcessingTimeout` configured and expires first | `ErrProcessingTimeout` | Library timeout |
| User context expires before `ProcessingTimeout` | `ErrProcessingTimeout` (normalized) | Caller timeout |
| No `ProcessingTimeout` configured, user context expires | `context.DeadlineExceeded` | Caller timeout |
| User calls `cancel()` | `context.Canceled` | Manual cancellation |

Mechanism: when `ProcessingTimeout > 0`, the library derives a new deadline using `context.WithTimeout(parentCtx, ProcessingTimeout)`, taking the **earlier of the two**. Whichever expires, the error is uniformly reported as `ErrProcessingTimeout`. Only `context.Canceled` from a manual `cancel()` is returned as-is. When `ProcessingTimeout` is not configured, the user context's error is passed through directly.

## Does ExtractToMarkdown use the cache?

No. `ExtractToMarkdown` internally creates a temporary Processor via `buildFormatProcessor`, which explicitly disables caching (`MaxCacheEntries = 0`, internally built with a zero-capacity cache, not exported). It neither reads from nor writes to the main Processor's cache.

:::tip Why this design
Markdown format conversion is just a different output form — the extraction result itself should not pollute the main cache (otherwise the same content would be cached multiple times for different formats). The temporary Processor reuses the main Processor's `Scorer` and only overrides `InlineImageFormat`/`InlineLinkFormat`. Configuration is isolated through value copying to avoid concurrent modification of shared state.
:::

## Why aren't `<form>` tags removed by sanitization?

Many server-side frameworks (ASP.NET WebForms, JSF, JSP) wrap the entire page `<body>` inside a single `<form>`. Removing `<form>` would discard nearly all visible content. Text extraction neither renders nor submits forms, so the CSRF/UI-redress rationale for removing `<form>` **does not apply to the container itself**. However, form controls like `<input>` and `<button>` are still removed.

## What are the restrictions on data URLs?

The sanitizer applies multiple validations to `data:` URLs:

- Only whitelisted MIME types are allowed: images (gif/jpeg/png/webp/bmp/avif, etc.), fonts (woff/woff2/ttf/otf), PDF
- **Blocks `image/svg+xml`** (SVG can embed JavaScript)
- Blocks empty media types (e.g., `data:;base64,...`)
- Has a size limit: subject to an internal limit (100KB) that cannot be adjusted via configuration
- Validates character legality of the base64-encoded portion

Blocked URLs are recorded as audit events — the configured `AuditSink` receives an `AuditEntry` of type `AuditEventBlockedURL`, whose `Message` carries the reason for the block (e.g., `malformed data URL`, `unsafe media type in data URL`).

## What happens if a batch exceeds 10000 items?

The entire batch fails (no partial processing). The `maxBatchSize` limit is 10000. When exceeded, every item's `Errors` is populated with `html: batch size N exceeds maximum 10000`, the `Failed` count equals the input count, and all `Results` are `nil`.

<!-- check-code: skip -->
```go
// Over-limit BatchResult: Failed == len(inputs), no partial success
br := html.ExtractBatch(hugeSlice) // len(hugeSlice) > 10000
fmt.Println(br.Failed)             // == len(hugeSlice)
```

The caller must split the work into smaller batches (e.g., 5000 items per batch) for larger datasets.

## What happens if I call methods after closing the Processor?

It returns `ErrProcessorClosed`. The Processor uses an `atomic.Bool` internally to mark the closed state, and all extraction/formatting methods check it at entry. Key behaviors:

- `Close()` is idempotent; multiple calls are safe
- A pooled Processor that has been closed is **not returned to the pool** (to avoid the next `Get` retrieving a closed instance whose cache-cleaning goroutine has stopped). It is discarded instead, and `sync.Pool` rebuilds it on the next `Get`
- Calling batch methods on a closed Processor returns a `BatchResult` where every item's error is `ErrProcessorClosed`

## What is the article recognition (ExtractArticle) scoring algorithm?

The built-in default scorer (internal implementation, not exported) calculates a content relevance score for each element node based on multi-dimensional signals, selecting the highest-scoring node as the article container. Scoring dimensions include:

| Dimension | Positive signals | Negative signals |
|-----------|-----------------|------------------|
| Tag semantics | `<article>`(+1000), `<main>`(+900), `<section>`(+300) | `nav`/`aside`/`footer`/`header` return 0 directly |
| class/id patterns | `content`/`article`/`post`/`main`/`entry` etc. (strong positive); `blog`/`news`/`detail` etc. (moderate positive) | `comment`/`sidebar`/`nav`/`ad`/`menu` etc. (strong negative); `widget`/`share`/`social` etc. (moderate negative) |
| Paragraph density | `<p>` count in subtree multiplied by a rate bonus | — |
| Text length | Long text above a threshold gets bonus; short text gets penalized | — |
| Link density | — | Short text with dense links gets penalized (likely navigation) |
| Punctuation features | Dense commas (`,` or `，`) indicate prose, gets bonus | — |
| Content density | High text/tag ratio gets a boost multiplier | Low ratio gets a decay factor |
| ARIA role | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |

:::tip Layout wrapper special handling
When class/id contains both content signals (`content`/`article`) and removal signals (e.g. `sidebar`) — typically CSS layout classes like `content-sidebar` — the scorer **does not** remove the node, because it wraps the main content. Semantic tags `<article>`/`<main>` are always exempt from class/id removal heuristics.
:::

If the default scorer doesn't fit your target website, you can implement a custom `Scorer` interface to replace it. See [Testing & Custom Extensions](../guides/integration/testing-custom).

## How does TableFormat affect table output?

`TableFormat` controls how HTML `<table>` elements are rendered in the extracted plain text/Markdown:

| Format value | Effect | Use case |
|-------------|--------|----------|
| `"markdown"` (default) | Renders as Markdown table (with header separator row); `colspan` expanded into repeated cells; structure-only rows with width definitions are skipped | Human reading, Markdown consumption |
| `"html"` | Preserves the original HTML `<table>` tags (`colspan`/`rowspan` kept as-is); structure rows not skipped | Downstream processing requiring exact table structure |

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "html" // Preserve HTML tables
```

The format string is case-insensitive (`"Markdown"` and `"markdown"` are equivalent); an empty value falls back to `"markdown"`.

## Is AllowedBaseDir consistent across platforms?

Yes, the core security semantics are consistent across platforms, but the underlying path resolution mechanism differs:

| Platform | Resolution method | Covered redirects |
|----------|------------------|-------------------|
| Linux | Read the link at `/proc/self/fd/<fd>` | Symlinks (race-free) |
| macOS / BSD | Read the link at `/dev/fd/<fd>` | Symlinks (race-free) |
| Other Unix | Fallback to `filepath.EvalSymlinks` | Symlinks (slight residual TOCTOU) |
| Windows | `GetFinalPathNameByHandleW` | Symlinks + junctions + all reparse points |

Key design: the library resolves the real path from an **already-open OS file handle** (not the path string), closing the TOCTOU race window — validation and reading use the same file handle, so a path substitution between the two cannot affect the result. Windows junctions/reparse points can be created without any privileges, and `filepath.EvalSymlinks` cannot resolve them, so the library specifically uses `GetFinalPathNameByHandleW`.

## Is the original object returned on a cache hit?

No. A cache hit returns a **deep copy** produced by `cloneResult` — slices like `Images`/`Links`/`Videos`/`Audios` are all `copy`'d. This is necessary: cache entries are read concurrently by multiple goroutines; returning a pointer directly would let caller modifications pollute the cache through aliasing.

The miss path also writes to the cache first, then returns a clone — so the cache entry and the return value never alias each other.

## Why does the same video URL appear in both Videos and Audios?

`.ogg` is a container format that can carry video (Theora codec) or audio (Vorbis/Opus codec). During the regex fallback scan, a `.ogg` URL matches both the video and audio extension lists, so it appears in both `Result.Videos` and `Result.Audios`. The audio-only variant `.oga` appears only in the audio list.

## What's the difference between ProcessingTimeout set to 0 and not setting it?

There is no difference. The `Config` zero value is not directly usable (you must start from `DefaultConfig()`), and `DefaultConfig()` sets `ProcessingTimeout` to 30 seconds. Manually setting it to `0` is equivalent to "no timeout" — `Extract` does not start the timeout goroutine and does not occupy a `maxTimeoutGoroutines` quota. This avoids unnecessary goroutine overhead when processing known-valid large documents.

## Can `Extract` and `ExtractAllLinks` be used together?

Yes, they work independently:

- `Extract` returns a `*Result`, where `Result.Links` contains `<a>` links from the **sanitized** DOM (type `LinkInfo`, with `Position`/`IsExternal` etc.)
- `ExtractAllLinks` returns `[]LinkResource`, enumerating all resource links in **unsanitized** HTML (including `<script src>`, `<iframe>`, `<link>`, etc.), with `Type` classification

You can call both sequentially without interference. A typical scenario: first use `Extract` to get the body content, then use `ExtractAllLinks` to collect all resources referenced by the page.

## Related Documentation

- [Overview](../) — Feature highlights and architecture overview
- [Quick Start](../getting-started/) — 5-minute tutorial
- [API Reference](../api-reference/) — Entry point to the complete API documentation
