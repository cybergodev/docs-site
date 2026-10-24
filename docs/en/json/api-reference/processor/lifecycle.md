---
sidebar_label: "Lifecycle"
title: "Processor Lifecycle - CyberGo JSON | Close & GetStats"
description: "Processor lifecycle: Close drains in-flight work then releases resources, IsClosed, ClearCache, GetStats and GetHealthStatus gated by EnableMetrics."
sidebar_position: 110
---

# Lifecycle & Statistics

Lifecycle methods cover creating, observing and releasing a processor instance: `Close` drains in-flight operations before releasing resources, and `GetStats` / `GetHealthStatus` expose runtime metrics.

## Lifecycle

### Close

Signature: `func (p *Processor) Close() error`

Closes the processor and releases resources (cache, security validator, hook references). Call it when you are done with the Processor.

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

:::tip Close semantics
- **Idempotent and thread-safe**: repeated `Close` calls take effect only once.
- **Drains in-flight operations first**: `Close` waits for running operations to finish, with a timeout cap. After the timeout the processor rejects new operations (`IsClosed()` returns `true`), but resources stay intact so in-flight operations finish undisturbed; they are released once all of them complete.
- After closing, every operation returns `ErrProcessorClosed`.
- `Close` does **not** clean up global caches shared across instances (path-type cache, struct encoder cache). For full cleanup before process exit use [`ShutdownGlobalProcessor`](#global-processor-management).
:::

### IsClosed

Signature: `func (p *Processor) IsClosed() bool`

Checks whether the processor is closed. During the "closing (draining)" state it also returns `true` — new operations are already rejected in that window.

```go
if processor.IsClosed() {
    // Processor is closed, cannot be used anymore
}
```

## Cache Management

### ClearCache

Signature: `func (p *Processor) ClearCache()`

Clears the processor's result cache and parse cache. Use it after the data source changed, when memory use is high, or when you need a forced refresh.

```go
processor.ClearCache()
```

### WarmupCache

Signature: `func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Pre-evaluates hot paths so later first reads hit the cache. Requires the processor's cache to be enabled (it is by default); otherwise returns an error. For full examples and the `WarmupResult` fields see [Batch Operations](./batch#cache-warm-up-warmupcache).

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Successfully warmed up %d paths\n", result.Successful)
```

## Statistics

### GetStats

Signature: `func (p *Processor) GetStats() Stats`

Returns the processor's statistics: live cache figures (`CacheSize` / `CacheMemory` / hit counters), configured caps (`MaxCacheSize` / `CacheTTL`), and the operation and error counters.

```go
stats := processor.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Cache size: %d\n", stats.CacheSize)
```

**Stats struct**:

```go
type Stats struct {
    CacheSize        int64         `json:"cache_size"`        // Cache entry count
    CacheMemory      int64         `json:"cache_memory"`      // Cache memory usage (bytes)
    MaxCacheSize     int           `json:"max_cache_size"`    // Maximum cache size
    HitCount         int64         `json:"hit_count"`         // Cache hit count
    MissCount        int64         `json:"miss_count"`        // Cache miss count
    HitRatio         float64       `json:"hit_ratio"`         // Cache hit ratio
    CacheTTL         time.Duration `json:"cache_ttl"`         // Cache TTL
    CacheEnabled     bool          `json:"cache_enabled"`     // Whether cache is enabled
    IsClosed         bool          `json:"is_closed"`         // Whether the processor is closed
    MemoryEfficiency float64       `json:"memory_efficiency"` // Memory efficiency
    OperationCount   int64         `json:"operation_count"`   // Total operation count
    ErrorCount       int64         `json:"error_count"`       // Total error count
}
```

| Field | Type | Description |
|-------|------|-------------|
| `CacheSize` | `int64` | Current cache entry count |
| `CacheMemory` | `int64` | Cache memory usage (bytes) |
| `MaxCacheSize` | `int` | Maximum cache size limit |
| `HitCount` | `int64` | Cache hit count |
| `MissCount` | `int64` | Cache miss count |
| `HitRatio` | `float64` | Cache hit ratio (0-1) |
| `CacheTTL` | `time.Duration` | Cache expiration time |
| `CacheEnabled` | `bool` | Whether cache is enabled |
| `IsClosed` | `bool` | Whether the processor is closed |
| `MemoryEfficiency` | `float64` | Memory efficiency |
| `OperationCount` | `int64` | Total operation count |
| `ErrorCount` | `int64` | Total error count |

**Reading the fields**:

- `OperationCount` / `ErrorCount`: incremented on every `Get`, `GetMultiple`, `Set`, `SetMultiple` and `Delete` call, **regardless of `EnableMetrics`** (that switch only gates latency and concurrency metric collection). Lifecycle rejections (processor closed, concurrency limit exceeded) are not counted as errors.
- `HitRatio`: 0–1 range (0.85 means 85%); no hit data when `CacheEnabled=false`.
- `CacheSize` / `CacheMemory` are live cache figures; `MaxCacheSize` / `CacheTTL` are configured caps (see [Config](../config)).
- `IsClosed`: consistent with [`IsClosed()`](#isclosed); useful in monitoring to spot a processor that was closed unexpectedly.

## Health Check

### GetHealthStatus

Signature: `func (p *Processor) GetHealthStatus() HealthStatus`

Returns the processor's health status: `Checks` holds each individual check, and any unhealthy entry makes the overall `Healthy` false.

```go
status := processor.GetHealthStatus()
if status.Healthy {
    fmt.Println("Processor is healthy")
} else {
    for name, check := range status.Checks {
        if !check.Healthy {
            fmt.Printf("Check %s failed: %s\n", name, check.Message)
        }
    }
}
```

**HealthStatus struct** (overall status in `HealthStatus`, per-check results in `CheckResult`):

```go
type HealthStatus struct {
    Timestamp time.Time              `json:"timestamp"` // Check time
    Healthy   bool                   `json:"healthy"`   // Overall health status
    Checks    map[string]CheckResult `json:"checks"`    // Results of each check
}

type CheckResult struct {
    Healthy bool   `json:"healthy"` // Whether healthy
    Message string `json:"message"` // Status message
}
```

`HealthStatus` fields:

| Field | Type | Description |
|-------|------|-------------|
| `Timestamp` | `time.Time` | Check time |
| `Healthy` | `bool` | Whether overall healthy |
| `Checks` | `map[string]CheckResult` | Details of each check |

`CheckResult` fields:

| Field | Type | Description |
|-------|------|-------------|
| `Healthy` | `bool` | Whether this check is healthy |
| `Message` | `string` | Status message (failure reason, etc.) |

:::tip Interpretation
`Checks` maps each individual check, and any unhealthy entry makes `Healthy=false`. A nil processor returns `Healthy=false` with `processor: processor is nil` in `Checks`.

`EnableMetrics` decides whether the metrics collector exists, which in turn decides the health result:

| `EnableMetrics` | Metrics collector | `GetHealthStatus()` |
|:---:|:---:|------|
| `false` (default) | Not created | `Healthy=false`, `Checks["metrics"].Message` is `Metrics collector not initialized` |
| `true` | Created | Computed from the `metrics`, `memory` and `error_rate` checks; any unhealthy one makes `Healthy=false` |

`Healthy=false` does not mean the processor is unusable. With `EnableMetrics` off, `GetStats()` still accumulates `OperationCount` / `ErrorCount`, and reads and writes work normally. Set `EnableMetrics=true` at construction when you need a usable health signal. `Config.EnableHealthCheck` is deprecated and never read, so it does not affect this behavior (see [Config](../config#input-and-observability-toggles)).
:::

## Extension Hooks

### AddHook

Signature: `func (p *Processor) AddHook(hook Hook)`

Adds an operation hook to the processor.

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

Hooks run before and after each operation: for logging, performance monitoring, metrics collection and audit trails.

### SetLogger

Signature: `func (p *Processor) SetLogger(logger *slog.Logger)`

`SetLogger` atomically replaces the processor's structured logger (automatically attaching the `component=json-processor` field); passing `nil` falls back to `slog.Default()`. Used for debugging and runtime diagnostics.

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

Signature: `func (p *Processor) GetConfig() Config`

`GetConfig` returns a deep copy of the processor's current configuration (internally via `Config.Clone`); modifying the return value does not affect the processor. Calling on a nil processor returns a zero-value Config.

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("Cache enabled: %v\n", cfg.EnableCache)
fmt.Printf("Max JSON size: %d\n", cfg.MaxJSONSize)
```

## Global Processor Management

Package-level functions rely on an internal global processor, and the two package-level management functions also belong to the lifecycle (signatures and full examples in the [Processor Overview](./index#global-processor-management)):

- `json.SetGlobalProcessor(p)` — sets a custom processor as global: passing `nil` is a no-op, the old global processor is closed first, and the function is thread-safe.
- `json.ShutdownGlobalProcessor()` — shuts down and removes the global processor, also clearing the global caches shared across instances and the per-config processor cache; suitable to call before a long-lived service exits.

## Usage Recommendations

### Resource Management

```go
processor, _ := json.New()
defer processor.Close()  // Ensure resources are released

// Use processor...
```

### Statistics and Warm-Up

```go
// Warm up frequently used paths
processor.WarmupCache(data, []string{
    "user.name",
    "user.email",
    "items[*].id",
})

// Periodically check statistics
stats := processor.GetStats()
if stats.HitRatio < 0.5 {
    // Low hit ratio, consider adjusting cache configuration
}
```

### Monitoring Integration

The health check below requires the processor to be created with `EnableMetrics=true`; otherwise `status.Healthy` is always `false`:

```go
cfg := json.DefaultConfig()
cfg.EnableMetrics = true
processor, _ := json.New(cfg)
defer processor.Close()

// Periodic health checks
go func() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        status := processor.GetHealthStatus()
        if !status.Healthy {
            log.Printf("Processor unhealthy: %+v", status.Checks)
        }
    }
}()
```

## See Also

- [Config](../config) - Configuration options (cache size, TTL, etc.)
- [Hook System](../../extensions/hooks) - Detailed hook usage guide
- [Interface Definitions](../interfaces) - Hook interfaces
