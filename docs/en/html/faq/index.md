---
sidebar_label: "FAQ"
title: "FAQ - CyberGo html | Troubleshooting & Behavior"
description: "CyberGo html troubleshooting: empty text, mojibake, reader mode, Confidence and ExtractionMethod, timeouts, cache keys, panic isolation, batch, data URLs."
sidebar_position: 10
---

# FAQ

The entries below are ordered for troubleshooting: first confirm whether you got an error, then check the input and configuration.

## Why is the extracted text empty?

Check these in order:

1. **Empty or whitespace-only input** - Empty and whitespace-only input return an empty `Result` with no error
2. **Text inside invisible tags** - Text in `<script>` and `<style>` never reaches the body
3. **Content removed by sanitization** - If the body only exists inside removed tags such as `<iframe>` or `<object>`, the result is empty; for trusted input, temporarily set `EnableSanitization = false` to investigate
4. **Article detection picked the wrong container** - Disable `ExtractArticle` and retry; if content now appears, the scorer treated a non-body node as the main content

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // Retry without article detection
```

:::warning Deep nesting returns an error, not empty text
Exceeding `MaxDepth` (default 500) returns `ErrMaxDepthExceeded`; however, the `golang.org/x/net/html` parser itself rejects documents nested more than 512 levels deep first, in which case you get `ErrInvalidHTML`. When a call returns an `error`, classify it with `errors.Is` instead of only checking whether the text is empty.
:::

## Why is Chinese text garbled?

Auto-detection reads only the HTML itself: the BOM, a `<meta charset>` declaration, and byte statistics. It **does not read HTTP response headers**.

A GBK or Shift_JIS page without `<meta charset>` is therefore decoded as windows-1252, producing mojibake with `err == nil` — there is no error signal at all.

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk" // Set explicitly when the source encoding is known
result, err := html.Extract(pageData, cfg)
```

In production, set the encoding per source: the HTTP `Content-Type` header, a site allowlist, or an offline probe. You get `encoding detection failed: ...` only when the declared or forced encoding conflicts with the actual bytes. There is no sentinel for it — match the message prefix. See [Encoding Detection](../guides/core-features/encoding-detection).

## What's the difference between ProcessingTimeout and user context timeout?

The error type depends on what fired:

| Scenario | Error returned |
|----------|----------------|
| Library `ProcessingTimeout` expires (caller context still live) | `ErrProcessingTimeout` |
| Caller context deadline expires (earlier than or equal to the library timeout) | `context.DeadlineExceeded` (returned unchanged, **not** normalized) |
| Caller calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` and the caller context expires | `context.DeadlineExceeded` |

When `ProcessingTimeout > 0`, the library derives a child context with `context.WithTimeout(parentCtx, ProcessingTimeout)` and takes the earlier deadline. Only when the child fires first while the parent is still live is the error normalized to `ErrProcessingTimeout`.

A timeout does not force the goroutine to stop: the caller receives the error first, and the extraction goroutine exits at its next cooperative checkpoint.

## How is the cache key generated?

The key is computed over the **entire raw input bytes** and mixed with configuration. The algorithm is hash/maphash (AES-NI accelerated, with a per-process random seed):

1. One byte of boolean flags: `ExtractArticle`, the four `Preserve*` switches, and `ExtractMetadata` (6 in total)
2. Three format strings: `InlineImageFormat`, `InlineLinkFormat`, `TableFormat`
3. `Encoding` (an empty string under auto-detection)
4. **All** input bytes

The 64-bit result is extended to a 128-bit key by deriving a second 64-bit value with splitmix64. Hashing every byte means any change anywhere in the document changes the key; it also means the same document stored in different encodings has different bytes and cannot hit the same entry. `Encoding` participates so that the same bytes decoded under different forced encodings are not conflated.

An all-zero key (`[16]byte{}`) is treated by the cache as "no key", so that input always misses.

## Why do `ExtractAllLinks` and `Extract` produce different results?

`Extract` sanitizes the HTML first, then collects `<a>` links from the sanitized DOM and returns them as `Result.Links` (`LinkInfo`). `ExtractAllLinks` does not sanitize; it enumerates every resource the page references (including `<script src>`, `<link>`, `<iframe>`, `<embed>`) and returns `[]LinkResource` with a `Type` classification.

Summary: `Extract` returns `<a>` links from the cleaned body, `ExtractAllLinks` returns all resources referenced by the unsanitized page. You can call both in sequence; they do not interfere.

:::tip Internal vs external is decided from the href alone
`ExtractAllLinks` sets `IsExternal` from the raw href: anything starting with `http(s)://` or `//` is external, and relative paths are internal. It **does not compare domains**, so an absolute same-site link still counts as external.
:::

## What's the difference between reader mode and Extract?

`Extract` selects one article and returns its body plus metadata; navigation and footers are treated as noise and removed. `ReadPage` keeps the whole page, splits it into five section kinds (header/navigation/main/aside/footer), and returns a `ReadResult` with `Sections`, preserving inline links as `[text](URL)` throughout.

Use `Extract` when you want "the article only"; use `ReadPage` when you want to feed a whole page to an LLM or RAG and need the navigation and footer context preserved. `ReadPageToMarkdown` emits a Markdown document directly, while `ReadResult.Render` / `RenderText` assemble one after you filter sections yourself. Reader mode does not use the cache. See [Reader Mode](../guides/core-features/reader-mode).

## How should Result.Confidence and ExtractionMethod be used?

`ExtractionMethod` reports where `Text` came from: `article` (the scorer selected a content node), `listing` (recognized as a card listing page), or `body` (whole-`<body>` fallback). `Confidence` is a coarse quality signal in `0`–`1` used for routing rather than as a probability: `1.0` means the body is substantial and covers an adequate share of the page text, `0.6` is common for listings or short articles, and `0.2`–`0.4` usually means a `<body>` fallback, a very short output, or paywall/consent-wall wording.

A typical use sends results below `1.0` for review or a fallback strategy: `body` + `0.2` often means the page is JS-rendered. Tier details are in [Content Extraction](../guides/core-features/content-extraction#quality-signals).

## What happens on an internal panic?

Every extraction call is wrapped in a recover, so panics do not escape to the caller and instead become `ErrInternalPanic`:

- Single extraction: panic → `ErrInternalPanic`
- Batch processing: a panic in one item is recovered independently and only marks that item `Failed`
- Audit sinks: panics in `Write`/`Close` are isolated; auditing is best-effort and never interrupts the main flow
- Timeout goroutine: internal panics are recovered independently

:::warning Don't retry ErrInternalPanic unchanged
It means the input triggered an internal library defect. Record the original input or a minimal reproduction and report it; the same input will reach the same path again.
:::

## What happens if I call a Processor after closing it?

Extraction, formatting, link, and batch methods check the closed flag at entry and return `ErrProcessorClosed`:

- `Close()` is idempotent; repeated calls are safe
- A closed pooled instance is not returned to the pool (so the next `Get` cannot receive an instance whose cache-cleanup goroutine has stopped); `sync.Pool` rebuilds it
- Batch methods on a closed instance return a `BatchResult` whose every item error is `ErrProcessorClosed`
- `GetStatistics`, `GetAuditLog`, `ClearCache`, `ClearAuditLog`, and `ResetStatistics` do not check the flag and remain safe to call

## Do package-level functions still use the pool when a Config is passed?

No. Without a Config they use the built-in default configuration (with caching disabled) and take an instance from `sync.Pool`; with one Config they create a temporary Processor and discard it afterwards. So `html.Extract(data, cfg)` creates and destroys an instance on every call. For high-frequency calls with custom configuration, create a Processor with `html.New(cfg)` and reuse it.

## What happens if a batch exceeds 10000 items?

The whole batch fails with no partial processing: `Failed` equals the input count, `Results` are all `nil`, and every `Errors` entry wraps `ErrBatchTooLarge`. Split larger datasets yourself (for example 5000 items per batch). Fields and error text are in [Batch Processing](../api-reference/modules/batch).

## What are the limits on data URLs?

The sanitizer only allows whitelisted MIME types (images, fonts, PDF) and blocks `image/svg+xml` as well as empty media types. The length limit is 100KB and is not configurable; an oversized `<img>` is **silently dropped** (it does not appear in `Images`, and `err == nil`). The full allowlist and audit events are in [Security](../api-reference/modules/security).

## Why does a `.ogg` URL appear in both Videos and Audios?

`.ogg` is a container format that can carry video (Theora) or audio (Vorbis/Opus). During the regex fallback scan, a `.ogg` URL matches both the video and audio extension lists, so it lands in both `Result.Videos` and `Result.Audios`. The audio-only `.oga` appears only in the audio list.

## What should a custom Scorer keep in mind?

`Scorer.Score` decides body selection. `ShouldRemove` is consulted only when the **built-in default scorer** is in use (both candidate filtering and the node-removal heuristics rely on it); with a custom `Scorer` configured, node removal in the cleaning stage still follows the built-in rules, so a custom `ShouldRemove` does not decide which nodes are stripped. To influence selection, return a low or negative score from `Score`, or implement `ArticleFinder` for single-pass selection.

When one Processor is shared across goroutines, `Score` runs concurrently. Implementations that hold mutable state (caches, counters) must do their own locking.

:::warning Stateless Scorers need no locking
Computing only from the incoming `ContentNode` avoids lock overhead. When you need aggregated statistics, lock and record into your own structure — `Processor` exposes no public statistics write path.
:::

The interface signatures are in [Interfaces](../api-reference/types/interfaces#scorer); implementation and test patterns are in [Testing & Custom](../guides/integration/testing-custom).

## How does TableFormat affect output?

With `"markdown"` (the default) `<table>` elements render as Markdown tables; with `"html"` the original tags are preserved. The value is case-insensitive, and an empty value falls back to `markdown`. Accepted values and validation are in the [configuration reference](../api-reference/core/config).

## Is AllowedBaseDir behavior the same on every platform?

Yes. The library resolves the real path from an already-open file handle and uses the same handle for validation and reading, closing the TOCTOU (time-of-check to time-of-use) window. Linux and macOS go through `/proc/self/fd` and `/dev/fd`; Windows uses `GetFinalPathNameByHandleW` to resolve junctions and reparse points. See [Security](../api-reference/modules/security#path-security).

## Does a cache hit return the original object?

No. A hit returns a deep copy produced by `cloneResult`, with all slices copied; the miss path also writes to the cache first and returns a clone. Modifying the returned result therefore never pollutes the cache entry.

## What does setting `ProcessingTimeout` to `0` do?

It removes the limit: the library starts no timeout goroutine. `0` explicitly declares "no time limit" — it does not mean "unset"; the default is 30 seconds (`DefaultConfig()`).

## Does `ExtractToMarkdown` use the cache?

No. It builds a temporary Processor for format conversion and neither reads nor writes the main Processor's cache. See [Output](../api-reference/modules/output).

## How do I monitor processing?

Read `TotalProcessed`, `CacheHits`, `AverageProcessTime`, and other fields from `p.GetStatistics()`; package-level functions expose no statistics. Field meanings are in [Type Definitions](../api-reference/types/type-defs#statistics).

## How do I enable auditing?

Set `cfg.Audit = html.DefaultAuditConfig()`, set `cfg.Audit.Enabled` to `true`, then create the Processor with `html.New(cfg)`. Sinks and event types are in [Audit System](../api-reference/modules/audit).

## Related Documentation

- [Overview](../) - Features and architecture
- [Quick Start](../getting-started/) - Installation and first extraction
- [API Reference](../api-reference/) - Complete API documentation
