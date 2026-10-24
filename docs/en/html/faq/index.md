---
sidebar_label: "FAQ"
title: "FAQ - CyberGo html | Troubleshooting & Behavior"
description: "CyberGo html troubleshooting: empty text, mojibake, ProcessingTimeout versus caller context errors, cache keys, panic isolation, and calls after close."
sidebar_position: 10
---

# FAQ

The entries below are ordered for troubleshooting: first confirm whether you got an error, then check the input and configuration.

## Why is the extracted text empty?

Check these in order:

1. **Empty or whitespace-only input** - Blank input returns an empty `Result` with no error
2. **Text inside invisible tags** - Text in `<script>` and `<style>` never reaches the body
3. **Content removed by sanitization** - If the body only exists inside removed tags such as `<iframe>` or `<object>`, the result is empty; for trusted input, temporarily set `EnableSanitization = false` to investigate
4. **Article detection picked the wrong container** - Disable `ExtractArticle` and retry; if content now appears, the scorer treated a non-body node as the main content

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // Retry without article detection
```

:::warning Deep nesting returns an error, not empty text
Exceeding `MaxDepth` (default 500) returns `ErrMaxDepthExceeded`; however, the `golang.org/x/net/html` parser itself fails first at roughly 512 unclosed levels and returns `ErrInvalidHTML`. When a call returns an `error`, use `errors.Is` to classify it instead of inspecting the text.
:::

## Why is Chinese text garbled?

Auto-detection only reads the HTML itself: the BOM, a `<meta charset>` declaration, and byte statistics. It **does not read HTTP response headers**. A GBK or Shift_JIS page without `<meta charset>` is therefore decoded as windows-1252, producing mojibake with `err == nil` — no error signal at all.

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk" // Set explicitly when the source encoding is known
result, err := html.Extract(pageData, cfg)
```

In production, set the encoding per source: the HTTP `Content-Type` header, a site allowlist, or an offline probe. An `encoding detection failed: ...` error only appears when you force a wrong encoding. There is no sentinel for it — compare the message prefix. See [Encoding Detection](../guides/core-features/encoding-detection).

## What's the difference between ProcessingTimeout and user context timeout?

The error type depends on what fired:

| Scenario | Error returned |
|----------|----------------|
| Library `ProcessingTimeout` expires (caller context still live) | `ErrProcessingTimeout` |
| Caller context deadline expires (earlier than or equal to the library timeout) | `context.DeadlineExceeded` (returned unchanged, **not** normalized) |
| Caller calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` and the caller context expires | `context.DeadlineExceeded` |

When `ProcessingTimeout > 0`, the library derives a child context with `context.WithTimeout(parentCtx, ProcessingTimeout)` and takes the earlier deadline. Only when the child expires while the parent is still live is the error normalized to `ErrProcessingTimeout`.

A timeout does not kill the goroutine: extraction stops at the next cooperative checkpoint, so the caller may receive the error before the inner work has fully stopped.

## How is the cache key generated?

The key is computed over the **entire raw input** and mixed with configuration. The algorithm is hash/maphash (AES-NI accelerated, with a per-process random seed):

1. One byte of boolean flags: `ExtractArticle` and the four `Preserve*` switches
2. Three format strings: `InlineImageFormat`, `InlineLinkFormat`, `TableFormat`
3. `Encoding` (an empty string under auto-detection)
4. **All** input bytes

The 64-bit result is extended to a 128-bit key by deriving a second 64-bit value with splitmix64. Hashing every byte means any change anywhere in the document changes the key; it also means the same document stored in different encodings has different bytes and cannot hit the same entry. `Encoding` participates so that the same bytes decoded under different forced encodings are not conflated.

An all-zero key (`[16]byte{}`) is treated as "no key", so such an input always misses.

## Why do `ExtractAllLinks` and `Extract` produce different results?

`Extract` sanitizes the HTML first, then collects `<a>` links from the sanitized DOM and returns them as `Result.Links` (`LinkInfo`). `ExtractAllLinks` does not sanitize; it enumerates every resource the page references (including `<script src>`, `<link>`, `<iframe>`, `<embed>`) and returns `[]LinkResource` with a `Type` classification.

Summary: `Extract` returns `<a>` links from the cleaned body, `ExtractAllLinks` returns all resources referenced by the unsanitized page. You can call both in sequence; they do not interfere.

:::tip Internal vs external is decided from the href alone
`ExtractAllLinks` sets `IsExternal` from the raw href: anything starting with `http(s)://` or `//` is external, and relative paths are internal. It **does not compare domains**, so an absolute same-site link still counts as external.
:::

## What happens on an internal panic?

Every extraction call is wrapped in a recover, so panics do not escape to the caller; they surface as `ErrInternalPanic`:

- Single extraction: panic → `ErrInternalPanic`
- Batch processing: a panic in one item is recovered independently and only marks that item `Failed`
- Audit sinks: panics in `Write`/`Close` are isolated; auditing is best-effort and never interrupts extraction
- Timeout goroutine: internal panics are recovered independently

:::warning Don't retry ErrInternalPanic unchanged
It means the input may have triggered an internal library defect. Record the input or a minimal reproduction and report it; the same input will likely trigger it again.
:::

## What happens if I call a Processor after closing it?

Extraction, formatting, link, and batch methods check the closed flag at entry and return `ErrProcessorClosed`:

- `Close()` is idempotent; repeated calls are safe
- A closed pooled instance is not returned to the pool (so the next `Get` cannot receive an instance whose cache-cleanup goroutine has stopped); `sync.Pool` rebuilds it
- Batch methods on a closed instance return a `BatchResult` whose every item error is `ErrProcessorClosed`
- `GetStatistics`, `GetAuditLog`, `ClearCache`, `ClearAuditLog`, and `ResetStatistics` do not check the flag and remain safe to call

## Do package-level functions still use the pool when a Config is passed?

No. Without a Config they use the built-in default configuration (with caching disabled) and take an instance from `sync.Pool`; with one Config they create a temporary Processor and discard it afterwards. So `html.Extract(data, cfg)` creates and destroys an instance on every call — for high-frequency calls with custom configuration, create a Processor with `html.New(cfg)` and reuse it.

## What happens if a batch exceeds 10000 items?

The whole batch fails with no partial processing: `Failed` equals the input count, `Results` are all `nil`, and every `Errors` entry wraps `ErrBatchTooLarge`. Split larger datasets yourself (for example 5000 items per batch). Fields and error text are in [Batch Processing](../api-reference/modules/batch).

## What are the limits on data URLs?

The sanitizer only allows whitelisted MIME types (images, fonts, PDF) and blocks `image/svg+xml` as well as empty media types. The length limit is 100KB and is not configurable; an oversized `<img>` is **silently dropped** (it does not appear in `Images`, and `err == nil`). The full allowlist and audit events are in [Security](../api-reference/modules/security).

## Why does a `.ogg` URL appear in both Videos and Audios?

`.ogg` is a container format that can carry video (Theora) or audio (Vorbis/Opus). During the regex fallback scan, a `.ogg` URL matches both the video and audio extension lists, so it lands in both `Result.Videos` and `Result.Audios`. The audio-only `.oga` appears only in the audio list.

## What should a custom Scorer keep in mind?

The library calls `Scorer.Score`. `ShouldRemove` is a reserved interface method that **is not called in the current version**, so removal logic placed there has no effect.

When one Processor is shared across goroutines, `Score` runs concurrently. Implementations that hold mutable state (caches, counters) must do their own locking.

:::warning Stateless Scorers need no locking
Computing only from the incoming `ContentNode` avoids lock overhead. When you need aggregated statistics, lock and record into your own structure — `Processor` exposes no public statistics write path.
:::

The interface is defined in [Interfaces](../api-reference/types/interfaces#scorer); implementation and test patterns are in [Testing & Custom](../guides/integration/testing-custom).

## How does TableFormat affect output?

With `"markdown"` (the default) `<table>` elements render as Markdown tables; with `"html"` the original tags are preserved. The value is case-insensitive, and an empty value falls back to `markdown`. Accepted values and validation are in the [configuration reference](../api-reference/core/config).

## Is AllowedBaseDir behavior the same on every platform?

Yes. The library resolves the real path from an already-open file handle and uses that same handle for validation and reading, which closes the TOCTOU window. Linux and macOS go through `/proc/self/fd` and `/dev/fd`; Windows uses `GetFinalPathNameByHandleW` to resolve junctions and reparse points. See [Security](../api-reference/modules/security#path-security).

## Does a cache hit return the original object?

No. A hit returns a deep copy produced by `cloneResult`, with all slices copied; the miss path also writes to the cache first and returns a clone. Modifying the returned result therefore never pollutes the cache entry.

## Other Questions

- **What does `ProcessingTimeout = 0` do?** It disables the timeout: no timeout goroutine is started. This differs from leaving the default alone — `DefaultConfig()` sets 30 seconds.
- **Does `ExtractToMarkdown` use the cache?** No. It builds a temporary Processor for format conversion and neither reads nor writes the main Processor's cache. See [Output](../api-reference/modules/output).
- **How do I monitor processing?** Read `TotalProcessed`, `CacheHits`, `AverageProcessTime`, and other fields from `p.GetStatistics()`; package-level functions expose no statistics. Field meanings are in [Type Definitions](../api-reference/types/type-defs#statistics).
- **How do I enable auditing?** Set `cfg.Audit = html.DefaultAuditConfig()`, set `cfg.Audit.Enabled = true`, then create the Processor with `html.New(cfg)`. Sinks and event types are in [Audit System](../api-reference/modules/audit).

## Related Documentation

- [Overview](../) - Features and architecture
- [Quick Start](../getting-started/) - Installation and first extraction
- [API Reference](../api-reference/) - Complete API documentation
