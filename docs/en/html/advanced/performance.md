---
title: "Performance - HTML"
description: "Performance optimization guide for CyberGo HTML, covering Processor reuse, cache configuration, batch concurrency, input size limits, and timeout tuning."
---

# Performance

## Processor Reuse

Use Processor instances instead of package functions for high-frequency calls:

```go
// Recommended: Reuse Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
    // Cache, encoding detectors, and other resources are reused
}

// Not recommended: Create new Processor each time
for _, page := range pages {
    result, _ := html.Extract(page) // Gets from Pool each time
}
```

## Cache Strategy

Processor has built-in caching — identical input won't be processed twice:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 5000     // Increase cache
cfg.CacheTTL = 10 * time.Minute // Adjust per use case
cfg.CacheCleanup = time.Minute   // More frequent cleanup
```

Monitor cache hit rate:

```go
stats := p.GetStatistics()
hitRate := float64(stats.CacheHits) / float64(stats.CacheHits+stats.CacheMisses)
fmt.Printf("Cache hit rate: %.2f%%\n", hitRate*100)
```

## Batch Processing

Batch processing runs concurrently, outperforming sequential processing:

```go
// Recommended: Batch processing
batch := p.ExtractBatch(pages)

// Not recommended: Sequential loop
for _, page := range pages {
    p.Extract(page) // Serial
}
```

Configure worker pool size to match CPU cores:

```go
cfg.WorkerPoolSize = runtime.NumCPU()
```

## Input Control

- Reduce `MaxInputSize` to avoid processing oversized documents
- Use `TextOnlyConfig()` to skip unnecessary media extraction
- Disable unneeded `Preserve*` options

```go
// TextOnlyConfig already disables all media preservation
cfg := html.TextOnlyConfig()

// Optionally disable article recognition for maximum performance
cfg.ExtractArticle = false
```

## Timeout Settings

Set reasonable timeouts to prevent slow requests from blocking:

```go
cfg.ProcessingTimeout = 10 * time.Second
```
