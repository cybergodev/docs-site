---
title: "Performance Optimization - HTTPC"
description: "HTTPC performance optimization guide: four preset comparison (Default/Secure/Performance/Minimal) and scenario selection, fine-tuning connection pool and timeout parameters based on presets, automatic Result object pooling to reduce GC pressure, high-concurrency request patterns, performance benchmarking methods, and common performance anti-pattern analysis."
---

# Performance Optimization

## Configuration Preset Comparison

| Metric | Default | Secure | Performance | Minimal |
|--------|---------|--------|-------------|---------|
| Request timeout | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | On | On | On | On |
| Cookies | Off | Off | On | Off |
| SSRF Protection | On | On | On | On |
| FollowRedirects | On | Off | On | Off |

## Scenario Selection

| Scenario | Recommended Preset | Adjustment Suggestion |
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

// Fine-tune on top of preset
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## Object Pool Reuse

HTTPC has a built-in Result object pool that automatically manages object lifecycle:

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result objects are automatically managed by the built-in object pool, GC handles cleanup
```

:::tip
In high-concurrency scenarios, object pool reuse significantly reduces GC pressure.
:::

## Performance Anti-Patterns

| Anti-Pattern | Cause | Correct Approach |
|-------------|-------|------------------|
| Creating client per request | Connections cannot be reused | Reuse client globally |
| Excessively large MaxResponseBodySize | Memory consumption | Set reasonable limits |
| Using result.String() in hot paths | String building overhead | Use Body() directly |

## Next Steps

- [Connection Pool and Proxy](./connection-pool) - Connection pool parameter selection, proxy and DoH configuration
- [Error Handling](./error-handling) - Layered timeout strategy
- [Security Overview](../security/) - Balancing security and performance
