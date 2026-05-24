---
title: "Performance Optimization - HTTPC"
description: "HTTPC performance optimization: four preset comparison, scenario selection, pool tuning tips, ReleaseResult reuse, and common anti-patterns to avoid."
---

# Performance Optimization

## Preset Configuration Comparison

| Metric | Default | Secure | Performance | Minimal |
|--------|---------|--------|-------------|---------|
| Request timeout | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | Enabled | Enabled | Enabled | Enabled |
| Cookies | Disabled | Disabled | Enabled | Disabled |
| SSRF Protection | Enabled | Enabled | Enabled | Enabled |
| FollowRedirects | Enabled | Disabled | Enabled | Disabled |

## Scenario Selection

| Scenario | Recommended Preset | Adjustment Suggestions |
|----------|-------------------|----------------------|
| General web services | Default | - |
| Handling user-provided URLs | Secure | - |
| Internal microservices, high concurrency | Performance | Increase MaxIdleConns |
| One-off scripts | Minimal | - |
| File download service | Performance | Increase MaxResponseBodySize |
| Financial/medical APIs | Secure + custom | Add audit middleware |

```go
// High throughput scenario
client, _ := httpc.New(httpc.PerformanceConfig())

// Fine-tune on top of a preset
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## Object Pool Reuse

HTTPC has a built-in Result object pool. Use `ReleaseResult` to return objects:

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // Return to object pool
```

:::tip
In high-concurrency scenarios, `ReleaseResult` can significantly reduce GC pressure.
:::

## Performance Anti-Patterns

| Anti-Pattern | Reason | Correct Approach |
|-------------|--------|-----------------|
| Creating a client per request | Connections cannot be reused | Reuse a global client |
| Ignoring ReleaseResult | Increases GC pressure | Use defer to return |
| Overly large MaxResponseBodySize | High memory usage | Set reasonable limits |
| Using result.String() in hot paths | String construction overhead | Use Body() directly |

## Next Steps

- [Connection Pool and Proxy](./connection-pool) -- Connection pool parameter selection, proxy, and DoH configuration
- [Error Handling](./error-handling) -- Layered timeout strategies
- [Security Overview](../security/) -- Balancing security and performance
