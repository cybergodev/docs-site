---
sidebar_label: "Lifecycle"
title: "Processor Lifecycle - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor lifecycle: New, Close resource release, IsClosed state, GetStats statistics, and GetHealthStatus for safe concurrent shutdown."
sidebar_position: 11
---

# Lifecycle & Statistics

Processor provides complete lifecycle management, cache control, and health monitoring capabilities.

## Lifecycle

### Close

Signature: `func (p *Processor) Close() error`

Closes the processor and releases resources. This method should be called after using the Processor.

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

### IsClosed

Signature: `func (p *Processor) IsClosed() bool`

Checks whether the processor is closed.

```go
if processor.IsClosed() {
    // Processor is closed, cannot be used anymore
}
```

## Cache Management

### ClearCache

Signature: `func (p *Processor) ClearCache()`

Clears the processor's internal cache.

```go
processor.ClearCache()
```

Useful for:
- Data source has changed
- Memory usage is too high
- Need to force a refresh

### WarmupCache

Signature: `func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Warms up the cache to improve subsequent operation performance.

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Successfully warmed up %d paths\n", result.Successful)
```

**WarmupResult Struct**:

```go
type WarmupResult struct {
    TotalPaths  int      `json:"total_paths"`            // Total path count
    Successful  int      `json:"successful"`             // Successfully warmed up path count
    Failed      int      `json:"failed"`                 // Failed path count
    SuccessRate float64  `json:"success_rate"`           // Success rate (percentage)
    FailedPaths []string `json:"failed_paths,omitempty"` // List of failed paths
}
```

| Field | Type | Description |
|------|------|------|
| `TotalPaths` | `int` | Total path count |
| `Successful` | `int` | Successfully warmed up path count |
| `Failed` | `int` | Failed path count |
| `SuccessRate` | `float64` | Success rate (0-100) |
| `FailedPaths` | `[]string` | List of failed paths |

## Statistics

### GetStats

Signature: `func (p *Processor) GetStats() Stats`

Gets the processor's statistics.

```go
stats := processor.GetStats()
fmt.Printf("Cache hit ratio: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Cache size: %d\n", stats.CacheSize)
```

**Stats Struct**:

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
|------|------|------|
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

## Health Check

### GetHealthStatus

Signature: `func (p *Processor) GetHealthStatus() HealthStatus`

Gets the processor's health status.

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

**HealthStatus Struct**:

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

| Field | Type | Description |
|------|------|------|
| `Timestamp` | `time.Time` | Check time |
| `Healthy` | `bool` | Whether overall healthy |
| `Checks` | `map[string]CheckResult` | Details of each check |

## Extension Hooks

### AddHook

Signature: `func (p *Processor) AddHook(hook Hook)`

Adds an operation hook to the processor.

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

Hooks are called before and after each operation, useful for:
- Logging
- Performance monitoring
- Metrics collection
- Audit trailing

### SetLogger

Signature: `func (p *Processor) SetLogger(logger *slog.Logger)`

Sets the processor's logger. Used for debugging and runtime diagnostics.

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

Signature: `func (p *Processor) GetConfig() Config`

Gets a copy of the processor's current configuration. The returned configuration can be safely modified without affecting the processor.

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("Cache enabled: %v\n", cfg.EnableCache)
fmt.Printf("Max JSON size: %d\n", cfg.MaxJSONSize)
```

## Usage Recommendations

### Resource Management

```go
processor, _ := json.New()
defer processor.Close()  // Ensure resources are released

// Use processor...
```

### Performance Optimization

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

```go
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

## Related

- [Config](../config) - Configuration options (cache size, TTL, etc.)
- [Hook System](../../extensions/hooks) - Detailed hook usage guide
- [Interface Definitions](../interfaces) - Hook interfaces
