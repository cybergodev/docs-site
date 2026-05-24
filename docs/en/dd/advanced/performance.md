---
title: "Performance - CyberGo DD | Optimization Guide"
description: "CyberGo DD performance optimization: zero-allocation techniques, BufferedWriter, log sampling, level checking, sync.Pool reuse, and benchmarking."
---

# Performance Optimization

DD is designed for high performance. Here are recommendations for further optimizing logging performance.

## Zero-Allocation Optimization

DD minimizes memory allocations on hot paths:

- `IsLevelEnabled()` checks use atomic operations, lock-free
- Structured fields use pre-allocated buffers
- Avoids formatting messages when the log level doesn't match

## Level Checking

Check the level first on high-frequency paths to avoid unnecessary field construction:

```go
// Recommended: check level first
if logger.IsDebugEnabled() {
    logger.DebugWith("detailed info",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// Not recommended: always construct fields
logger.DebugWith("detailed info",
    dd.String("data", expensiveToString()),
)
```

## Buffered Writing

Use `BufferedWriter` to reduce I/O system calls:

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB buffer

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close automatically flushes
```

:::tip Buffer Size
4KB-16KB is recommended. Buffers that are too small won't effectively reduce system calls, while buffers that are too large increase memory usage and latency.
:::

## Log Sampling

Enable log sampling in high-throughput scenarios to reduce duplicate logs:

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // Always log the first 100 messages
    Thereafter: 10,     // Then log 1 out of every 10 messages
    Tick:       time.Minute, // Reset counters every minute
})

// Dynamic adjustment at runtime
cfg := logger.GetSampling()
```

## File Writing Optimization

### Reasonable Rotation Configuration

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// Default: 100MB / 30 days / 10 backups
```

- Files that are too small cause frequent rotation, increasing I/O
- Too many backups consume disk space
- Adjust parameters based on actual log volume

### Multi-File Separation

```go
// Separate by level
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer Management

### Dynamic Writer Addition/Removal

```go
// Add dynamically at runtime
logger.AddWriter(newWriter)

// Remove unneeded Writers
logger.RemoveWriter(oldWriter)
```

### Avoid Too Many Writers

Each Writer adds write latency. No more than 3-4 Writers is recommended.

## Field Optimization

### Use Typed Fields

```go
// Recommended: typed constructors
dd.Int("count", 42)
dd.String("name", "test")

// Avoid: Any (requires additional type assertion)
dd.Any("count", 42)
```

### Avoid Large Objects

```go
// Not recommended: logging large objects
logger.InfoWith("data", dd.Any("payload", hugeStruct))

// Recommended: log only key information
logger.InfoWith("data",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## Shutdown and Cleanup

```go
// Wait for filter goroutines to complete first
logger.WaitForFilterGoroutines(3 * time.Second)

// Graceful shutdown, wait for all buffer flushes
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## Next Steps

- [Output Targets](../api-reference/writers) -- FileWriter, BufferedWriter API
- [Configuration](../api-reference/config) -- Performance-related configuration options
- [Production Checklist](../security/production-checklist) -- Pre-launch checks
