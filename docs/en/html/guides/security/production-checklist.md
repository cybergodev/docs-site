---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo html | Launch Review"
description: "CyberGo html launch checklist by P0/P1/P2 priority: HighSecurityConfig, Processor lifecycle, audit monitoring, timeout semantics, and error handling."
sidebar_position: 30
---

# Production Checklist

Go through these items before launch. Priority meanings:

- **Must (P0)**: skipping it leads to a security hole or a resource leak
- **Recommended (P1)**: affects reliability and observability
- **Optional (P2)**: do it when you have room

:::tip Start from the preset, relax per service
`HighSecurityConfig()` already tightens every limit to a safe level and turns on full auditing. For untrusted input, start there and relax individual fields as needed.
:::

## Basic Configuration

- [ ] Use `HighSecurityConfig()` or a custom security configuration as the starting point
- [ ] Set a reasonable `MaxInputSize` (hard cap 50MB)
- [ ] Set `ProcessingTimeout` to prevent long-running blocks (10–30s recommended)
- [ ] Configure `MaxDepth` to limit DOM depth (default 500; 100 for high security)
- [ ] Keep `EnableSanitization = true` (on by default)
- [ ] Tune `WorkerPoolSize` to your concurrency (default 4, max 256)

**Why**

- `MaxInputSize` is the first memory defense and is hard-bounded by `maxConfigInputSize` (50MB), so a misconfiguration cannot raise it. Batch peak memory is roughly `MaxInputSize × WorkerPoolSize`; a public-facing API should tighten it to 10MB.
- `WorkerPoolSize` sets batch concurrency; the CPU core count is a sensible default. Approaching the 256 cap produces pronounced goroutine and memory pressure.
- `MaxDepth` only helps below the parser threshold: `golang.org/x/net/html` fails at roughly 512 unclosed elements with `ErrInvalidHTML`, and the library's `MaxDepth` check runs only after parsing succeeds.

## Processor Lifecycle

- [ ] Release the Processor with `defer p.Close()`
- [ ] Call no extraction method after `Close()` (it returns `ErrProcessorClosed`)
- [ ] Reuse one Processor across requests instead of creating one per request

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

**Why**

- `Processor` is concurrency-safe: its cache and statistics counters are synchronized, so an application-level singleton (a handler holding one global `*html.Processor`) is fine.
- Every `html.New()` allocates cache and audit structures, and when both `CacheTTL` and `CacheCleanup` are greater than zero it also starts a background sweep goroutine; creating one per request wastes resources and adds GC pressure.
- Package-level functions (`html.Extract`, etc.) reuse pooled Processors through `sync.Pool`, but pooled instances are constructed with caching disabled, so cross-call cache hits never happen — hold an explicit instance when you need caching.

## Audit & Monitoring

- [ ] Enable auditing (`Audit.Enabled = true`)
- [ ] Persist audit logs to a file with `WriterAuditSink`
- [ ] Monitor `ErrorCount` and `CacheHits` from `GetStatistics()`
- [ ] Alert in real time on critical events (input violations, path traversal)
- [ ] Feed the audit stream into an external SIEM with `ChannelAuditSink`

```go
auditFile, err := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
if err != nil {
	log.Fatal(err)
}
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

**Tiered pipeline**: critical events alert in real time, everything else lands in the file for the record.

```go
alertSink := html.NewChannelAuditSink(50)
go func() {
	for entry := range alertSink.Channel() {
		sendAlert(entry) // wire to PagerDuty / Slack / SMS
	}
}()

cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(auditFile),
	html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
		return e.Level == html.AuditLevelCritical
	}),
)
```

**Drop monitoring**: a full channel drops events instead of blocking, so poll `DroppedCount()`.

```go
if n := alertSink.DroppedCount(); n > 0 {
	log.Printf("alert channel dropped %d audit events; enlarge the buffer or consume faster", n)
}
```

More pipeline patterns are in [Audit Pipeline](./audit-pipeline).

## Context & Timeout

- [ ] Use `ExtractWithContext` rather than bare `Extract` for extraction
- [ ] Set a reasonable context timeout
- [ ] Give batch operations a cancellable context so remaining work stops on error

Inside an HTTP handler, derive the timeout from the request context:

```go
// Inside a handler: r is *http.Request
ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
defer cancel()
result, err := p.ExtractWithContext(ctx, data)
```

**Why**

- Two timeout layers exist: `Config.ProcessingTimeout` (default 30s, per document) and the caller's context. When both are present, the earlier deadline wins.
- The error type follows the source: an expired `ProcessingTimeout` returns `ErrProcessingTimeout`; an expired caller context returns `context.DeadlineExceeded` unchanged, **without** normalization; `cancel()` returns `context.Canceled`. Track them separately in logs and alerts.
- Timeouts run on a dedicated goroutine plus a context deadline, capped process-wide by `maxTimeoutGoroutines` (1000). Past the cap, new requests return `ErrTooManyConcurrentOps` rather than piling up goroutines.

## Error Handling

- [ ] Use `errors.Is` to separate business errors from security errors
- [ ] Log `*FileError` through `SafePath()`, not the raw error string
- [ ] Log every `ErrInputTooLarge` and depth-related error (possible attack probing)
- [ ] Watch the `ErrInternalPanic` rate (any occurrence warrants investigation and an issue)
- [ ] Degrade gracefully on `ErrProcessorClosed` instead of crashing

```go
_, err := p.Extract(data)
switch {
case errors.Is(err, html.ErrInputTooLarge):
	log.Printf("input over limit, suspected attack probing")
case errors.Is(err, html.ErrMaxDepthExceeded):
	log.Printf("depth violation, suspected recursion bomb")
case errors.Is(err, html.ErrInvalidHTML):
	// ~512 unclosed tags are rejected by the parser first, so this is not a depth error
	log.Printf("parse failure: %v", err)
case errors.Is(err, html.ErrInternalPanic):
	log.Printf("internal panic recovered: %v", err)
case errors.Is(err, html.ErrFileNotFound),
	errors.Is(err, html.ErrInvalidFilePath):
	var fe *html.FileError
	if errors.As(err, &fe) {
		log.Printf("file error: %s", fe.SafePath()) // file name only, no full path
	}
}
```

**Why**

- `FileError.Error()` is already redacted (file name only), but the `FileError.Path` field keeps the original path, so always log through `SafePath()`.
- Depth problems have two sources: `ErrMaxDepthExceeded` from the library's check and `ErrInvalidHTML` from the parser's own ~512-level ceiling. Counting only the former misses excessively deep inputs — they surface as `ErrInvalidHTML`.
- `ErrInternalPanic` means malicious input triggered an unexpected panic inside the library. Preserve the triggering input and report it; do not rely on recovery long term.

## Resource Management

- [ ] Keep each batch at or below 10000 items (the library's hard cap; a larger batch is rejected whole)
- [ ] Configure `WorkerPoolSize` sensibly (the CPU core count is recommended)
- [ ] Monitor memory usage and cache hit rate
- [ ] Call `ClearCache()` periodically on long-running instances

**Why**

- Batches over 10000 items are rejected whole by the library: every item in the `BatchResult` carries the same error wrapping `ErrBatchTooLarge`, and nothing is processed. Slice large jobs into 1000–5000-item batches, each with its own timeout context, so one failed batch does not affect the rest.
- `MaxCacheEntries` (default 2000, max 100000) sets cache occupancy; on a memory-tight long-running service, lower the entry count or shorten `CacheTTL`.
- Cache hits save CPU but not memory: they pay off only at a high hit rate; otherwise the entries occupy memory and add hashing cost with no return.

## File Processing

- [ ] Validate where file paths come from (never let users control the full path)
- [ ] Set `AllowedBaseDir` to restrict the readable directory
- [ ] Pre-check file size with `os.Stat` (the library does this too; an outer layer adds defense in depth)
- [ ] Apply a type/extension whitelist to uploaded files

**Why**

- `AllowedBaseDir` decides containment against the real path resolved through an **OS file handle**, so it catches Windows junction/reparse-point escapes and cross-platform symlink escapes that `filepath.EvalSymlinks` cannot.
- Leaving it empty keeps only the `..` component check and disables the sandbox. Set it explicitly whenever the path comes from user input.
- The library already rejects oversized files with `os.Stat` before `io.ReadAll` loads them; an outer size check is defense in depth.

## Pre-deployment Self-check

Run this once before launch to confirm the config is valid and the Processor can complete an extraction:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()

	// 1. Config validity (New calls Validate internally)
	p, err := html.New(cfg)
	if err != nil {
		log.Fatalf("invalid config: %v", err)
	}
	defer p.Close()

	// 2. Review key config fields
	fmt.Printf("MaxInputSize      = %d bytes\n", cfg.MaxInputSize)
	fmt.Printf("MaxDepth          = %d\n", cfg.MaxDepth)
	fmt.Printf("ProcessingTimeout = %v\n", cfg.ProcessingTimeout)
	fmt.Printf("WorkerPoolSize    = %d\n", cfg.WorkerPoolSize)
	fmt.Printf("Audit.Enabled     = %v\n", cfg.Audit.Enabled)

	// 3. Actual extraction test
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sample := []byte("<html><body><h1>Self-check</h1><p>Production ready</p></body></html>")
	result, err := p.ExtractWithContext(ctx, sample)
	if err != nil {
		log.Fatalf("extraction failed: %v", err)
	}
	fmt.Printf("extraction succeeded, text length: %d\n", len(result.Text))

	fmt.Println("✓ Config self-check passed")
}
```

:::tip The self-check only proves the path works
It confirms the config is valid and an extraction completes, but it **does not replace** monitoring under real traffic. Keep watching runtime metrics after launch.
:::

## Runtime Metrics

Watch these after deployment:

| Metric | How to get it | Alert threshold | Common cause |
|--------|---------------|-----------------|--------------|
| Error rate | `Statistics.ErrorCount / TotalProcessed` | > 5% | Poor input quality, overly strict config, upstream anomalies |
| Cache hit rate | `Statistics.CacheHits / TotalProcessed` | < 30% | Insufficient input dedup, cache TTL too short |
| Average processing time | `Statistics.AverageProcessTime` | Above business baseline | Malicious input, improper timeout config |
| Critical audit events | Filter `GetAuditLog()` for `AuditLevelCritical` | Any one | Input violation, path traversal attack |
| ChannelAuditSink drops | `sink.DroppedCount()` | > 0 | Insufficient buffer, consumer too slow |

```go
// Collect metrics periodically (e.g. scraped by Prometheus every minute)
stats := p.GetStatistics()
var errorRate, hitRate float64
if stats.TotalProcessed > 0 {
	errorRate = float64(stats.ErrorCount) / float64(stats.TotalProcessed)
	hitRate = float64(stats.CacheHits) / float64(stats.TotalProcessed)
}

log.Printf("processed=%d error_rate=%.2f%% cache_hit=%.1f%% avg_time=%v",
	stats.TotalProcessed, errorRate*100, hitRate*100, stats.AverageProcessTime)

// critical-event patrol
for _, e := range p.GetAuditLog() {
	if e.Level == html.AuditLevelCritical {
		log.Printf("[ALERT] critical audit event: %s - %s", e.EventType, e.Message)
	}
}
```

:::warning Statistics counters are cumulative
The counters from `GetStatistics()` accumulate from Processor creation and are not reset by `ClearCache()`. For windowed statistics, call `ResetStatistics()` periodically or compute the delta yourself.
:::

## Config Quick Matrix

| Environment | MaxInputSize | ProcessingTimeout | MaxDepth | WorkerPoolSize | Audit | Recommended preset |
|-------------|-------------|-------------------|----------|----------------|-------|--------------------|
| Internal tools | 50MB (default) | 30s (default) | 500 (default) | 4 (default) | Optional | `DefaultConfig()` |
| Web API | 10MB | 10s | 200 | CPU core count | Recommended | `DefaultConfig()` tuned |
| High security | 10MB | 10s | 100 | 2 | Must | `HighSecurityConfig()` |
| Batch crawler | 50MB | 30s | 500 | 8–16 | Recommended | `DefaultConfig()` tuned |

:::tip The crawler trade-off
A batch crawler faces untrusted pages but prioritizes throughput: keep `EnableSanitization = true`, raise `WorkerPoolSize` to 8–16, and give each batch its own overall timeout context so a malicious page cannot drag down the whole batch.
:::

## Related Documentation

- [Security Overview](./) — defense-in-depth architecture and each protection layer
- [Audit Pipeline](./audit-pipeline) — 8 event types, built-in Sinks, tiered routing
- [API Reference: Security](../../api-reference/modules/security) — security-related API signatures
- [API Reference: Constants & Errors](../../api-reference/types/constants) — default constants and sentinel errors
