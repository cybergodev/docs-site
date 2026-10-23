---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo html | Launch Safety Review"
description: "CyberGo html production checklist by P0/P1/P2 priority: HighSecurityConfig, Processor lifecycle, auditing, context timeouts, sandboxing, resource release."
sidebar_position: 30
---

# Production Checklist

Before taking the html library to production, go through this checklist item by item. Each item is tagged with a priority so you can tell what must be done and what can wait:

- 🔴 **Must (P0)**: skipping this leads to security holes or resource leaks
- 🟡 **Recommended (P1)**: strongly suggested; affects reliability and observability
- 🟢 **Optional (P2)**: nice to have

:::tip
`HighSecurityConfig()` already tightens every limit to a safe level and turns on full audit. For the vast majority of untrusted-input scenarios, just use it and relax individual fields as needed — there is no need to assemble a config from scratch.
:::

## Basic Configuration

- [ ] 🔴 Use `HighSecurityConfig()` or a custom security configuration as the starting point
- [ ] 🔴 Set a reasonable `MaxInputSize` (per business needs; hard cap is 50MB)
- [ ] 🔴 Set `ProcessingTimeout` to prevent long-running blocks (10–30s recommended)
- [ ] 🟡 Configure `MaxDepth` to limit DOM depth (default 500; 100 for high security)
- [ ] 🟡 Keep `EnableSanitization = true` (on by default; do not turn it off)
- [ ] 🟢 Tune `WorkerPoolSize` to your concurrency (default 4, max 256)

**Why**:

- `MaxInputSize` is the first line of memory defense. It is also hard-bounded by `maxConfigInputSize` (50MB) — even a misconfiguration will not scale it to a dangerous value. Peak memory is roughly `MaxInputSize × WorkerPoolSize`; for a public-facing Web API, tighten it to 10MB.
- `WorkerPoolSize` controls the concurrency of batch extraction. Setting it to the CPU core count is usually enough; setting it too high (near the 256 cap) produces large numbers of goroutines and memory pressure under high concurrency.
- `CacheTTL` (default 1h) and `CacheCleanup` (default 5min) control the lifetime of result cache entries and the cadence of background sweeps. Set `MaxCacheEntries` to 0 to disable the cache entirely; cache hits save CPU but not memory, since cache entries themselves occupy memory (up to 100000 entries).

## Processor Lifecycle

- [ ] 🔴 Use `defer p.Close()` to ensure the Processor is properly released
- [ ] 🔴 Do not call any extraction method after `Close()` (returns `ErrProcessorClosed`)
- [ ] 🟡 Reuse a singleton Processor across requests instead of creating one per request

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

**Why**:

- `Processor` is concurrency-safe; once created it can be shared by multiple goroutines, and its internal cache and statistics counters are all synchronized. Making it an application-level singleton (e.g. an HTTP handler holding one global `*html.Processor`) both reuses the cache and avoids repeated initialization overhead.
- **Do not call `html.New()` on every request**: each Processor starts a background cache-sweep goroutine and allocates cache and audit structures; frequent creation is wasteful and adds GC pressure.
- The package-level convenience functions (`html.Extract`, `html.ExtractWithContext`, etc.) reuse temporary Processors internally via `sync.Pool`, but **do not cache extraction results** — there are no cross-call cache hits. For cache reuse, hold an explicit Processor instance.

## Audit & Monitoring

- [ ] 🔴 Enable the audit system (`Audit.Enabled = true`)
- [ ] 🟡 Configure a `WriterAuditSink` to persist audit logs to a file
- [ ] 🟡 Monitor `ErrorCount` and `CacheHits` from `GetStatistics()`
- [ ] 🟡 Configure real-time alerting for critical-level events (input violations, path traversal)
- [ ] 🟢 Use a `ChannelAuditSink` to feed the audit stream into an external SIEM

```go
auditFile, err := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
if err != nil {
    log.Fatal(err)
}
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

**Tiered audit pipeline** — real-time alerting for critical events, the rest written to a file for the record:

```go
// critical events are pushed into a channel; a separate goroutine sends alerts
alertSink := html.NewChannelAuditSink(50)
go func() {
    for entry := range alertSink.Channel() {
        sendAlert(entry) // integrate with PagerDuty / Slack / SMS
    }
}()

// File for the record + critical alerts — two paths in parallel, neither blocks the other
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(auditFile),
    html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    }),
)
```

**ChannelAuditSink drop monitoring**: when the channel buffer is full, events are dropped; inspect with `DroppedCount()`:

```go
if n := alertSink.DroppedCount(); n > 0 {
    log.Printf("alert channel dropped %d audit events; enlarge the buffer or consume faster", n)
}
```

For more pipeline patterns (routing by level, custom Sinks, high-security forensics), see [Audit System in Practice](./audit-pipeline).

## Context & Timeout

- [ ] 🔴 Use `ExtractWithContext` variants rather than bare `Extract` for all extraction operations
- [ ] 🔴 Set reasonable context timeouts
- [ ] 🟡 For batch operations, use a cancellation-enabled context to abort remaining tasks promptly on error

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := p.ExtractWithContext(ctx, data)
```

**Why**:

- The library has two timeout layers: `Config.ProcessingTimeout` (default 30s, applies to a single document) and the `context.Context` passed by the caller. The two **stack** — whichever expires first takes effect. Even without a timeout context, `ProcessingTimeout` is the backstop; a shorter context wins.
- Batch extraction (`ExtractBatch`) should have a single overall timeout context for the whole batch to keep runaway batches in check. A single item failure should not block the whole batch — batch methods recover each item independently.
- The timeout mechanism is implemented via a dedicated goroutine + context deadline, guarded globally by `maxTimeoutGoroutines` (1000). Under extreme concurrency, once the limit is exceeded, new requests return `ErrTooManyConcurrentOps` directly rather than piling up goroutines indefinitely.

## Error Handling

- [ ] 🔴 Use `errors.Is` to distinguish business errors from security errors
- [ ] 🔴 Output `*FileError` via `SafePath()` rather than the raw error string
- [ ] 🟡 Log all `ErrInputTooLarge` and `ErrMaxDepthExceeded` (likely attack probing)
- [ ] 🟡 Monitor the frequency of `ErrInternalPanic` (if it appears, investigate and file an issue)
- [ ] 🟢 Degrade gracefully on `ErrProcessorClosed` rather than crashing

```go
_, err := p.Extract(data)
switch {
case errors.Is(err, html.ErrInputTooLarge):
    log.Printf("input over limit, suspected attack probing")
case errors.Is(err, html.ErrMaxDepthExceeded):
    log.Printf("depth violation, suspected recursion bomb")
case errors.Is(err, html.ErrInternalPanic):
    // the panic has been recovered, but this is a library bug — report it
    log.Printf("internal panic recovered: %v", err)
case errors.Is(err, html.ErrFileNotFound),
    errors.Is(err, html.ErrInvalidFilePath):
    var fe *html.FileError
    if errors.As(err, &fe) {
        log.Printf("file error: %s", fe.SafePath()) // print only the file name, not the full path
    }
}
```

**Why**:

- `FileError.Error()` already has built-in redaction (shows only the file name, not the full path), but the `FileError.Path` field retains the original path. In logs **always go through `SafePath()`** to avoid leaking the server directory structure to log aggregation systems.
- `ErrInternalPanic` should theoretically never appear — it means a malicious input triggered an unexpected panic in the library. Once detected, preserve the triggering input and report it. The library's panic recovery keeps the process alive, but you should not rely on it long-term.

## Resource Management

- [ ] 🔴 Batch operations must not exceed 10000 items per batch
- [ ] 🟡 Configure `WorkerPoolSize` sensibly (the CPU core count is recommended)
- [ ] 🟡 Monitor memory usage and cache hit rate
- [ ] 🟢 Periodically call `ClearCache()` on long-running instances to release cache

**Why**:

- **Peak memory estimate**: `MaxInputSize × WorkerPoolSize` is roughly the peak memory during batch processing (each worker processes one input at a time). For example, `10MB × 8 = 80MB`. Reserve container memory accordingly.
- **Cache and memory**: each `MaxCacheEntries` entry (default 2000) occupies memory proportional to the extraction result size. For long-running services tight on memory, reduce the entry count or shorten `CacheTTL`; the shorter the `CacheCleanup`, the more promptly expired entries are reclaimed.
- **Batching strategy**: too large a batch both hogs memory and amplifies the cost of failure. Slice large jobs into smaller batches of 1000–5000 each, each with its own timeout context, so a single failed batch does not affect the rest.

## File Processing

- [ ] 🔴 Validate the source of file paths (do not let users control the full path directly)
- [ ] 🔴 Set `AllowedBaseDir` to restrict the file-reading directory
- [ ] 🟡 Pre-check the file size with `os.Stat` before processing (the library does this internally; an outer layer adds defense in depth)
- [ ] 🟢 Apply a type/extension whitelist to uploaded files

**Why**:

- `AllowedBaseDir` is the sandbox for file reads. It resolves real paths through an **OS file handle**, so it can intercept Windows junction/reparse points and cross-platform symlink escapes that `filepath.EvalSymlinks` cannot handle. Leaving it empty means only `..` traversal detection is kept and the sandbox is not enabled — whenever the path comes from user input, you must set it explicitly.
- The library already pre-checks the file size with `os.Stat` before `io.ReadAll` loads it into memory and rejects oversized files, closing the "read everything then find out it is over the limit" memory-peak window. An additional outer size check is defense in depth.

## Pre-deployment Self-check Script

Run this self-check program before launch to verify the config is valid and the Processor can be created and extract normally:

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

	// 1. Config validity check (New calls Validate internally)
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
	fmt.Printf("Extraction succeeded, text length: %d\n", len(result.Text))

	fmt.Println("✓ Config self-check passed")
}
```

:::tip
The self-check script confirms that the config is valid and the pipeline runs through, but it **does not replace** monitoring under real traffic. Continue to watch runtime metrics after launch.
:::

## Runtime Monitoring Points

After deployment, keep an eye on the following metrics and alert on anomalies:

| Metric | How to get | Alert threshold | Possible cause |
|--------|------------|-----------------|----------------|
| Error rate | `Statistics.ErrorCount / TotalProcessed` | > 5% | Poor input quality, overly strict config, upstream anomalies |
| Cache hit rate | `Statistics.CacheHits / TotalProcessed` | < 30% | Insufficient input dedup, cache TTL too short |
| Average processing time | `Statistics.AverageProcessTime` | Above business baseline | Malicious input, improper timeout config |
| Critical audit events | Filter `GetAuditLog()` for `AuditLevelCritical` | Any one | Input violation, path-traversal attack |
| ChannelAuditSink drops | `sink.DroppedCount()` | > 0 | Insufficient buffer, consumer too slow |

```go
// Collect metrics periodically (e.g. scraped by Prometheus every minute)
stats := p.GetStatistics()
var errorRate float64
if stats.TotalProcessed > 0 {
    errorRate = float64(stats.ErrorCount) / float64(stats.TotalProcessed)
}

hitRate := 0.0
if stats.TotalProcessed > 0 {
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

:::warning
The counters returned by `GetStatistics()` accumulate from Processor creation and are not reset by `ClearCache()`. For windowed statistics, call `ResetStatistics()` periodically to zero them, or compute the delta yourself.
:::

## Config Quick Matrix

Pick config values quickly by deployment environment:

| Environment | MaxInputSize | ProcessingTimeout | MaxDepth | WorkerPoolSize | Audit | Recommended preset |
|-------------|-------------|-------------------|----------|----------------|-------|--------------------|
| Internal tools | 50MB (default) | 30s (default) | 500 (default) | 4 (default) | Optional | `DefaultConfig()` |
| Web API | 10MB | 10s | 200 | CPU core count | Recommended | `DefaultConfig()` tuned |
| High security | 10MB | 10s | 100 | 2 | Must | `HighSecurityConfig()` |
| Batch crawler | 50MB | 30s | 500 | 8–16 | Recommended | `DefaultConfig()` tuned |

:::tip
A batch crawler faces untrusted web pages but prioritizes throughput. Keep `EnableSanitization = true`, set `WorkerPoolSize` to 8–16 for throughput, and give each batch its own overall timeout context so a malicious page cannot drag down the whole batch.
:::

## Related Documentation

- [Security Overview](./) — defense-in-depth architecture and each protection layer explained
- [Audit System in Practice](./audit-pipeline) — 8 event types, comparison of built-in Sinks, tiered routing pipeline
- [API Reference: Security](../../api-reference/modules/security) — security-related API signatures
- [API Reference: Constants & Errors](../../api-reference/types/constants) — default-value constants and sentinel errors
