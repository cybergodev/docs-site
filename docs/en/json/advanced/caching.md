---
sidebar_label: "Caching & Pre-Parsing"
title: "Caching & Pre-Parsing - CyberGo JSON | Pre-Parse & Caching"
description: "CyberGo JSON offers automatic caching with EnableCache, WarmupCache, and PreParse to track GetStats hit ratios, warm up hot paths, and cut repeated parsing."
sidebar_position: 30
---

# Caching and Pre-Parsing Strategies

CyberGo JSON ships with an **automatic caching subsystem**: parse results and path query results are cached automatically — no hand-rolled `sync.Map` needed. This page covers configuring, monitoring, and warming the built-in cache plus the PreParse pattern, and closes with a selection guide.

:::tip Division of labor with the performance page
The "caching strategy" section of [Performance Optimization](./performance) shows a **user-built** `sync.Map` cache; this page documents the **library-built-in** cache (`EnableCache`/`WarmupCache`/`PreParse`) — the two complement each other.
:::

## How the Built-in Cache Works

When `Config.EnableCache` is `true` (default) and `CacheResults` is `true` (default), query operations such as `Get` cache automatically:

1. **Parse cache**: JSON string → parsed `any` tree (keyed by FNV-1a hash)
2. **Result cache**: `(JSON, path)` → query result

The second query against the same JSON skips parsing and goes straight to path navigation; an identical `(JSON, path)` combination returns the cached result directly.

:::warning Writes invalidate automatically
Mutating operations such as `Set`/`Delete` **automatically invalidate** the related cache entries (bulk-cleared by JSON-hash prefix) — no manual intervention needed. Manual `ClearCache` is only needed when an external data source changes or memory pressure is high.
:::

## Monitoring the Cache Hit Ratio

`GetStats()` returns `Stats` with hit count, miss count, hit ratio, and current entry count. The first query misses (one miss each for the parse cache and the result cache); repeating the same `(JSON, path)` hits:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	data := `{"user":{"name":"Alice","email":"alice@example.com"},"version":1}`

	// First query: result and parse both miss
	_, err = processor.Get(data, "user.name")
	if err != nil {
		panic(err)
	}

	// Query the same (JSON, path) again: result cache hits directly
	_, err = processor.Get(data, "user.name")
	if err != nil {
		panic(err)
	}

	stats := processor.GetStats()
	fmt.Printf("Hits %d, misses %d (hit ratio %.1f%%)\n",
		stats.HitCount, stats.MissCount, stats.HitRatio*100)
	// Output: Hits 1, misses 2 (hit ratio 33.3%)

	fmt.Printf("Cache enabled: %v, TTL: %v\n", stats.CacheEnabled, stats.CacheTTL)
	// Output: Cache enabled: true, TTL: 5m0s
}
```

Key `Stats` fields (full structure in [Lifecycle & Statistics](../api-reference/processor/lifecycle#statistics)):

| Field | Description |
|-------|-------------|
| `HitRatio` | Hit ratio (0–1); below 0.5, inspect the workload or tune parameters |
| `HitCount` / `MissCount` | Cumulative hits / misses |
| `CacheSize` | Current cache entry count |
| `CacheTTL` | Cache expiration time |

## Warming the Cache with WarmupCache

`WarmupCache(jsonStr, paths, cfg...)` bulk-fills the cache before real queries arrive, eliminating first-request "cold start" latency. Suited to services that take traffic immediately after startup.

```go
// Signature: func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)
```

`WarmupResult` contains `TotalPaths`/`Successful`/`Failed`/`SuccessRate`/`FailedPaths`, useful for verifying the warm-up completed (e.g. a typo in a config-file path shows up in `FailedPaths`).

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	data := `{"db":{"host":"db.local","port":5432},"cache":{"ttl":300}}`

	// Warm up hot paths at service startup (internally runs one Get per path and fills the cache)
	hotPaths := []string{"db.host", "db.port", "cache.ttl"}
	result, err := processor.WarmupCache(data, hotPaths)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Warm-up: %d/%d succeeded (success rate %.0f%%)\n",
		result.Successful, result.TotalPaths, result.SuccessRate)
	// Output: Warm-up: 3/3 succeeded (success rate 100%)

	// After warm-up, the first business queries already hit (the first path's
	// parse missed; later paths share the parse cache)
	_, err = processor.Get(data, "db.host")
	if err != nil {
		panic(err)
	}
	stats := processor.GetStats()
	fmt.Printf("Hits %d / misses %d\n", stats.HitCount, stats.MissCount)
	// Output: Hits 3 / misses 4
}
```

:::warning Prerequisites
Calling `WarmupCache` with `EnableCache` set to `false` returns an error (cannot warm up with the cache disabled). Warm-up must happen on **the same Processor instance** — package-level functions (e.g. `json.GetString`) use the global Processor, whose cache is isolated from your custom instance's.
:::

## The PreParse Pattern

When **the same JSON needs queries at many different paths**, `PreParse` + `GetFromParsed` is the most direct pattern: parse once, share the parse result across queries, and bypass cache-key lookups entirely.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	data := `{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}],"total":2}`

	// Parse once, query many times (skips repeated parsing cost)
	parsed, err := processor.PreParse(data)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	// Multiple paths share the same parse result
	for _, path := range []string{"users[0].name", "users[1].name", "total"} {
		val, err := processor.GetFromParsed(parsed, path)
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s = %v\n", path, val)
	}
	// Output:
	// users[0].name = Alice
	// users[1].name = Bob
	// total = 2
}
```

Key APIs:

| API | Signature | Description |
|-----|-----------|-------------|
| `PreParse` | `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)` | Parses and returns a reusable `*ParsedJSON` |
| `GetFromParsed` | `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)` | Queries the pre-parsed result, skipping the parse step |
| `(*ParsedJSON).Release` | `func (p *ParsedJSON) Release()` | Releases the reference; call when done (usually via `defer`) |

:::tip PreParse vs automatic caching
`PreParse` holds an explicit handle to the parse result — a good fit for local flows of "parse in one place, consume in many". The automatic cache deduplicates **globally by JSON content**, fitting the same JSON queried repeatedly from different call sites. The two coexist: `PreParse` also writes the parse cache internally.
:::

## Tuning Cache Configuration

Cache behavior is controlled by several `Config` fields (complete list in [Config](../api-reference/config#the-config-struct)):

| Field | Default | Description |
|-------|---------|-------------|
| `EnableCache` | `true` | Master switch; when off, all cache logic is skipped (`Get` takes the fast path) |
| `CacheResults` | `true` | Whether to cache query results; `false` keeps only the parse cache |
| `CacheTTL` | `5 minutes` | Entry expiration time |
| `MaxCacheSize` | `128` | Maximum entries (LRU eviction) |
| `CacheSharedResults` | `false` | Share cached results, skipping the defensive deep copy (high-performance read-only scenarios) |

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/json"
)

func main() {
	cfg := json.DefaultConfig()
	cfg.MaxCacheSize = 256          // Hold more hot data
	cfg.CacheTTL = 10 * time.Minute // Extend validity

	processor, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	data := `{"key":"value"}`
	_, err = processor.Get(data, "key")
	if err != nil {
		panic(err)
	}
	fmt.Println("Query done")
	// Output: Query done
}
```

Read-heavy, read-only-result workloads can additionally enable the zero-copy switch:

```go
// Contract: once enabled, callers must not mutate the map/slice returned by Get
// (primitives are always safe)
cfg := json.DefaultConfig()
cfg.CacheSharedResults = true
```

### The CacheSharedResults Zero-Copy Contract

With `CacheSharedResults = true`, cache hits in `Get`/`GetFromParsed` **return the cached value directly**, skipping the defensive deep copy and significantly cutting the cost of repeatedly reading large objects.

:::danger Read-only contract
Once enabled, **callers must not mutate** the returned `map[string]any` / `[]any`; otherwise the shared cache is corrupted and subsequent reads polluted. Primitives (`bool`/`float64`/`string`/`json.Number`/`nil`) are immutable and always safe. Enable only when callers treat results as read-only (e.g. analytical loads repeatedly reading the same large subtree).
:::

## Cleanup and Invalidation

| Operation | API | When it fires |
|-----------|-----|---------------|
| Manual clear | `processor.ClearCache()` | Data source changed, memory pressure, forced refresh needed |
| Automatic invalidation after writes | Internal to `Set`/`Delete` | No manual cleanup after mutations; entries clear automatically by JSON-hash prefix |

`ClearCache` suits the "one long-lived Processor with rotating data sources" scenario. One-off scripts need no manual cleanup — `Close()` reclaims all resources.

## Practical Recipe: High-Frequency Query Caching

The following pattern combines warm-up, PreParse, and monitoring — a good fit for API gateways / config centers and other read-heavy scenarios.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	configJSON := `{"db":{"host":"db.local","port":5432},"cache":{"ttl":300},"features":["audit","metrics"]}`

	// 1. Warm up hot paths at startup
	hotPaths := []string{"db.host", "db.port", "cache.ttl"}
	if _, err := processor.WarmupCache(configJSON, hotPaths); err != nil {
		panic(err)
	}

	// 2. Batch field extraction on the same config (PreParse pattern)
	parsed, err := processor.PreParse(configJSON)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	host, err := processor.GetFromParsed(parsed, "db.host")
	if err != nil {
		panic(err)
	}
	fmt.Printf("Database host: %v\n", host)
	// Output: Database host: db.local

	// 3. Business queries keep hitting (warm-up and pre-parsing filled the cache)
	for _, path := range []string{"db.host", "db.port", "cache.ttl"} {
		_, err = processor.Get(configJSON, path)
		if err != nil {
			panic(err)
		}
	}

	// 4. Monitor the hit ratio at runtime; alert below a threshold
	stats := processor.GetStats()
	fmt.Printf("Hits %d / misses %d (hit ratio %.1f%%)\n",
		stats.HitCount, stats.MissCount, stats.HitRatio*100)
	// Output: Hits 6 / misses 4 (hit ratio 60.0%)
	if stats.HitRatio < 0.5 {
		fmt.Println("Alert: hit ratio below 50%, inspect the workload or adjust CacheTTL/MaxCacheSize")
	}

	// 5. On config rotation (data source change), clear manually to avoid stale reads
	processor.ClearCache()
	stats = processor.GetStats()
	fmt.Printf("Cache entries after clear: %d\n", stats.CacheSize)
	// Output: Cache entries after clear: 0
}
```

## Selection Guide

| Scenario | Recommended approach | Why |
|----------|----------------------|-----|
| One-off query / script | Default configuration | The built-in cache adds no burden to single calls; `Get` has a fast path |
| Same JSON queried repeatedly (different call sites) | Keep `EnableCache=true` | Automatic dedup by JSON content, zero code changes |
| Same JSON, one parse, many paths in a batch | `PreParse` + `GetFromParsed` | Explicit reuse of the parse result, bypassing cache-key overhead |
| Service taking traffic right after startup | `WarmupCache` warm-up | Eliminates first-request cold-start latency |
| Repeatedly reading the same large read-only subtree | `CacheSharedResults=true` | Skips the deep copy for zero-copy performance |
| Untrusted input / security-sensitive | `SecurityConfig()` (shorter TTL) | The security preset ships conservative cache parameters |

## See Also

- [Performance Optimization](./performance) — Processor reuse, memory optimization, benchmarks
- [Lifecycle & Statistics](../api-reference/processor/lifecycle#statistics) — `GetStats`/`WarmupCache`/`ClearCache` API details
- [Config](../api-reference/config) — Complete documentation of cache-related fields
- [Concurrency & Parallelism](./concurrency) — Processor thread safety and parallel iterators
