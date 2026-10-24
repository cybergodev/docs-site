---
sidebar_label: "Processor & Cache"
title: "Processor Cache & Reuse - CyberGo html | Reuse Guide"
description: "CyberGo html Processor reuse and cache: package functions vs instances, sync.Pool, cache key inputs, hit-rate monitoring, and instance maintenance."
sidebar_position: 10
---

# Processor Cache & Reuse

CyberGo html is a Go library for HTML content extraction and sanitization. It offers two calling modes: package functions and a long-lived `Processor` instance. They differ in lifecycle and caching. The sections below cover how to choose, how the cache key is built, how to monitor the hit rate, and how to maintain a long-running instance.

## Two Calling Modes

### Package Functions (One-shot Calls)

```go
result, err := html.Extract(data)
```

A temporary Processor is managed by `sync.Pool`: borrowed from the pool per call, returned when done.

**Use cases**: low-frequency calls (CLI tools, one-off scripts)

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
    if _, err := p.Extract(page); err != nil {
        log.Fatal(err)
    }
}
```

A standalone Processor instance whose lifecycle you manage.

**Use cases**: high-frequency calls (web services, crawlers)

**Lifecycle**:

```text
html.New()
  → Create Processor (cache, audit, statistics)
  → Loop calling p.Extract() (reuse the cache)
  → defer p.Close()
```

## How to Choose

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| CLI tools, one-off processing | Package functions | No lifecycle to manage |
| Web services, API backends | Processor instance | Cache acceleration, observable statistics |
| Batch crawlers | Processor instance | Deduplication via cache, bounded resources |
| Test code | Package functions | Stateless, tests stay isolated |

## Cache Mechanism

A Processor instance keeps a result cache keyed on the input bytes. **A hit requires the same raw bytes plus the same configuration**, not merely "the same HTML": two documents differing by one space or one attribute order have different bytes and do not hit each other.

### Cache Configuration

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000         // Max entries (0 = disabled)
cfg.CacheTTL = time.Hour           // Entry lifetime
cfg.CacheCleanup = 5 * time.Minute // Background sweep interval
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MaxCacheEntries` | 2000 | Cache capacity; 0 disables the cache |
| `CacheTTL` | 1 hour | Entry expiration time |
| `CacheCleanup` | 5 minutes | Interval for the background sweep of expired entries; 0 starts no sweep goroutine |

`New` starts the background sweep goroutine only when both `CacheTTL` and `CacheCleanup` are greater than 0.

### Cache Key Generation

The cache key is a `[16]byte` value used directly as a `map` key; generating it allocates nothing on the heap. Inputs come in two groups:

- **The complete raw input bytes**: `hash/maphash` hashes every byte. On amd64 it uses AES-NI, with a per-process random seed. Because the whole input is hashed, a change anywhere in the document changes the key.
- **Configuration**: five booleans (`ExtractArticle`, `PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios`) packed into one byte, followed by three format strings (`InlineImageFormat`, `InlineLinkFormat`, `TableFormat`) and `Encoding`.

maphash returns 64 bits; splitmix64 diffuses it into a second 64-bit half, and the two form the 128-bit key. The key is 128 bits wide but its effective collision strength is about 64 bits: splitmix64 separates the output space, it does not add entropy.

Consequences:

- The same raw bytes plus the same configuration hit the cache directly on repeated calls, skipping encoding detection, parsing, and extraction;
- The same document stored in a different encoding (different bytes), or processed with a different `Encoding`, produces a different key and cannot hit;
- Different `ExtractArticle` or `Preserve*` switches, or different format strings, also prevent a hit;
- An all-zero key (`[16]byte{}`) is treated by the cache as "no key", so that input misses on every call. The probability is 2^-128.

## Monitoring Hit Rate

```go
p, _ := html.New()
defer p.Close()

// Process a batch of pages
for _, page := range pages {
    if _, err := p.Extract(page); err != nil {
        log.Fatal(err)
    }
}

// Read the statistics
stats := p.GetStatistics()
fmt.Printf("Total processed: %d\n", stats.TotalProcessed)
fmt.Printf("Cache hits: %d\n", stats.CacheHits)
fmt.Printf("Cache misses: %d\n", stats.CacheMisses)

if stats.TotalProcessed > 0 {
    hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
    fmt.Printf("Hit rate: %.1f%%\n", hitRate)
}
```

`TotalProcessed` counts extractions that completed successfully, including cache hits; failed calls are not counted.

## Recommended Patterns

### Web Service Singleton

A web service keeps one Processor in a package-level variable, created in `init`:

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

Long-running Processors need periodic cleanup:

```go
// Periodic cache cleanup (prevents unbounded growth)
go func() {
    ticker := time.NewTicker(10 * time.Minute)
    for range ticker.C {
        p.ClearCache()
    }
}()

// Periodic statistics reset (keeps the cache)
go func() {
    ticker := time.NewTicker(time.Hour)
    for range ticker.C {
        stats := p.GetStatistics()
        log.Printf("Processed %d, errors %d",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## Cost of the Two Modes

| Mode | First processing | Repeated input |
|------|------------------|----------------|
| Package functions | Full extraction | Full extraction (no cache) |
| Processor (`MaxCacheEntries = 0`) | Full extraction | Full extraction |
| Processor (cache enabled) | Full extraction | Key hashing + lookup + `cloneResult` deep copy; skips encoding detection, parsing, and extraction |

:::tip Where the cache applies
Caching works only on a `Processor` instance. Package functions reuse a Processor through `sync.Pool`, but the pooled configuration sets `MaxCacheEntries`, `CacheTTL`, and `CacheCleanup` to 0 and clears the cache on every return, so there is no cache payoff. Package-level calls that pass a custom Config behave the same way: the library builds a one-shot Processor with the cache fields forced to zero.
:::

## Common Mistakes

| Mistake | Correct approach |
|---------|-----------------|
| Calling `html.New()` on every call | Reuse one instance |
| Forgetting `p.Close()` | Use `defer p.Close()` |
| Expecting a cache from package functions | Caching works only on a `Processor` instance |
| Using a Processor after closing it | Check for `ErrProcessorClosed` |
| Expecting a hit for semantically equal but byte-different input | A hit requires identical raw bytes and configuration |

## Next Steps

- [Performance](./performance) - Internal optimizations, timeout and concurrency tuning
- [Batch Processing in Practice](./batch-processing) - Concurrent batch extraction
- [API Reference: Processor](../../api-reference/core/processor) - Complete method list
- [API Reference: Config](../../api-reference/core/config) - Cache configuration details
