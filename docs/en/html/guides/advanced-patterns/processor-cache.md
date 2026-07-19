---
sidebar_label: "Processor & Cache"
title: "Processor Cache & Reuse - CyberGo html | Performance Guide"
description: "CyberGo html Processor reuse and cache: package-function vs instance, sync.Pool, cache strategy with hit-rate monitoring, and web-service singleton practice."
sidebar_position: 1
---

# Processor Cache & Reuse

This guide explains the difference between package functions and Processor instances, helping you make the right choice for different scenarios and achieve optimal performance.

## Two Calling Modes

### Package Functions (One-time Calls)

```go
result, err := html.Extract(data)
```

Internally uses `sync.Pool` to manage temporary Processors. Each call borrows from the pool and returns it when done.

**Use cases**: Low-frequency calls (e.g., CLI tools, one-time scripts)

**Lifecycle**:

```text
Call Extract()
  → Get Processor from sync.Pool (or create new)
  → Execute extraction
  → Return to sync.Pool
```

### Processor Instance (Reuse Mode)

```go
p, _ := html.New()
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
}
```

Creates a standalone Processor instance with manual lifecycle management.

**Use cases**: High-frequency calls (e.g., web services, crawlers)

**Lifecycle**:

```text
html.New()
  → Create Processor (cache, audit, statistics)
  → Loop calling p.Extract() (reuse cache)
  → defer p.Close()
```

## How to Choose

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| CLI tools, one-time processing | Package functions | Simple, no management needed |
| Web services, API backends | Processor instance | Cache acceleration, statistics monitoring |
| Batch crawlers | Processor instance | Cache deduplication, resource control |
| Test code | Package functions | Stateless, test isolation |

## Cache Mechanism

Processor instances include content-based caching. Identical HTML input won't be processed twice.

### Cache Configuration

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000     // Max cache entries (0=disable)
cfg.CacheTTL = time.Hour       // Cache TTL
cfg.CacheCleanup = 5 * time.Minute // Background cleanup interval
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MaxCacheEntries` | 2000 | Cache capacity limit; set to 0 to disable |
| `CacheTTL` | 1 hour | Entry expiration time |
| `CacheCleanup` | 5 minutes | Interval for background cleanup of expired entries |

### Cache Key Generation

Cache keys are generated from the UTF-8 converted content:
- Content < 64KB: Hash computed over full content
- Content > 64KB: 5-point sampling algorithm (head + tail + uniform sampling)

Identical HTML content hits the cache on repeated calls, skipping parsing and extraction.

## Monitoring Cache Hit Rate

```go
p, _ := html.New()
defer p.Close()

// Process a batch of pages
for _, page := range pages {
    p.Extract(page)
}

// Get statistics
stats := p.GetStatistics()
fmt.Printf("Total processed: %d\n", stats.TotalProcessed)
fmt.Printf("Cache hits: %d\n", stats.CacheHits)
fmt.Printf("Cache misses: %d\n", stats.CacheMisses)

hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
fmt.Printf("Hit rate: %.1f%%\n", hitRate)
```

## Recommended Patterns

### Web Service Singleton

In web services, use a singleton Processor:

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
    data, _ := io.ReadAll(r.Body)
    result, err := processor.Extract(data)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### Crawler Batch Processing

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := crawlURLs()
pages := fetchPages(urls) // [][]byte

batch := p.ExtractBatch(pages)
fmt.Printf("Success: %d, Failed: %d\n", batch.Success, batch.Failed)
```

### Periodic Maintenance

Long-running Processors need periodic maintenance:

```go
// Periodic cache cleanup (prevent memory growth)
go func() {
    ticker := time.NewTicker(10 * time.Minute)
    for range ticker.C {
        p.ClearCache()
    }
}()

// Periodic statistics reset (preserve cache)
go func() {
    ticker := time.NewTicker(time.Hour)
    for range ticker.C {
        stats := p.GetStatistics()
        log.Printf("Processed %d times, errors %d",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## Performance Comparison

Processing the same HTML 1000 times (for reference only):

| Mode | First Processing | Cache Hit |
|------|-----------------|-----------|
| Package functions | Baseline | No cache |
| Processor (no cache) | ≈Baseline | ≈Baseline |
| Processor (with cache) | ≈Baseline | ≈1/10 of baseline |

:::tip Cache Activation
Cache only works on Processor instances. Package-level functions reuse a Processor via `sync.Pool`, but the pooled config disables caching (`MaxCacheEntries = 0`) and clears the cache on return, so caching is unavailable.
:::

## Common Pitfalls

| Pitfall | Correct Approach |
|---------|-----------------|
| Creating a new Processor with `html.New()` every call | Reuse the same instance |
| Forgetting to call `p.Close()` | Use `defer p.Close()` |
| Expecting cache from package functions | Cache only works on Processor instances |
| Using a closed Processor | Check for `ErrProcessorClosed` error |

## Next Steps

- [Performance](../../advanced/performance) - More performance tuning tips
- [API Reference: Processor](../../api-reference/core/processor) - Complete method list
- [API Reference: Config](../../api-reference/core/config) - Cache configuration details
