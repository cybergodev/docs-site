---
sidebar_label: "Performance"
title: "Performance Tuning - CyberGo DD | High-Performance Logging"
description: "A complete performance-tuning guide for the CyberGo DD logging library, covering low-allocation optimization, BufferedWriter buffered-write configuration, log-sampling strategy and frequency control, early level-check to avoid wasteful allocations, sync.Pool object-pool reuse, and benchmark-analysis methods, helping you achieve extreme logging performance in high-concurrency scenarios."
sidebar_position: 1
---

# Performance Tuning

DD is designed for high performance; here are suggestions for further optimizing logging performance.

## Low-Allocation Optimization

DD minimizes memory allocations on hot paths:

- `IsLevelEnabled()` checks use atomic operations, lock-free
- Structured fields use pre-allocated buffers
- Avoids formatting messages when the log level does not match

## Level Checks

On hot paths, check the level first to avoid unnecessary field construction:

```go
// Recommended: check level first
if logger.IsDebugEnabled() {
    logger.DebugWith("detailed info",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// Not recommended: always build fields
logger.DebugWith("detailed info",
    dd.String("data", expensiveToString()),
)
```

## Buffered Writes

Use `BufferedWriter` to reduce I/O syscalls:

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB buffer

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close auto-flushes
```

:::tip Buffer Size
4KB-16KB is recommended. Too small a buffer fails to effectively reduce syscalls; too large a buffer increases memory usage and latency.
:::

## Log Sampling

For high-throughput scenarios, enable log sampling to reduce repeated logs:

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // First 100 entries all logged
    Thereafter: 10,     // After that, 1 of every 10
    Tick:       time.Minute, // Reset the counter every minute
})

// Adjust dynamically at runtime
cfg := logger.GetSampling()
```

## File-Write Optimization

### Reasonable Rotation Configuration

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// Defaults: 100MB / 30 days / 10 backups
```

- Too-small files cause frequent rotation and more I/O
- Too many backups consume disk space
- Tune parameters based on actual log volume

### Multi-file Separation

```go
// Separate by level
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer Management

### Dynamically Add/Remove Writers

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

// Avoid: Any (needs an extra type assertion)
dd.Any("count", 42)
```

### Avoid Large Objects

```go
// Not recommended: logging a large object
logger.InfoWith("data", dd.Any("payload", hugeStruct))

// Recommended: log only key information
logger.InfoWith("data",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## Shutdown and Cleanup

```go
// Wait for filter goroutines to finish
logger.WaitForFilterGoroutines(3 * time.Second)

// Graceful shutdown; waits for all buffers to flush
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## Next Steps

- [Output Targets](../api-reference/output-integration/writers) -- FileWriter, BufferedWriter API
- [Config](../api-reference/core/config) -- Performance-related config options
- [Production Checklist](../security/production-checklist) -- Pre-launch checks
