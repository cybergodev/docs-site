---
sidebar_label: "FAQ"
title: "FAQ - CyberGo DD | Frequently Asked Questions"
description: "CyberGo DD FAQ on basic usage, configuration and file rotation, performance, sensitive-data filtering and tamper protection, error handling, and testing."
sidebar_position: 1
---

# Frequently Asked Questions

## Basic Usage

### What is the difference between the global logger and a custom logger?

The **global logger** is used directly via package-level functions such as `dd.Info()`, suitable for simple scenarios. A **custom logger** is created via `dd.New()`, supporting independent configuration and lifecycle management.

```go
// Global logger
dd.Info("global log")

// Custom logger
logger, _ := dd.New(dd.JSONConfig())
logger.Info("independent log")
```

### How do I initialize the global logger at program startup?

```go
func init() {
    err := dd.InitDefault(dd.JSONConfig())
    if err != nil {
        log.Fatal(err)
    }
}
```

Or via `SetDefault`:

```go
cfg := dd.DefaultConfig()
cfg.Format = dd.FormatJSON
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.json"),
}
logger, _ := dd.New(cfg)
dd.SetDefault(logger)
```

### What happens with Fatal-level logs?

`Fatal` / `Fatalf` / `FatalWith` call `os.Exit(1)` after emitting the log (**deferred functions will not run**; internally it first tries to `Close()` to flush pending logs, waiting up to 5 seconds). You can customize the exit behavior via `FatalHandler`; for resource cleanup, use `ErrorWith` + an explicit `Shutdown(ctx)` instead.

## Configuration

### How do I output to both console and file?

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
logger, _ := dd.New(cfg)

// Or JSON format
cfg = dd.DefaultConfig()
cfg.Format = dd.FormatJSON
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.json"),
}
logger, _ = dd.New(cfg)
```

### How do I dynamically change the log level?

```go
_ = logger.SetLevel(dd.LevelDebug)  // Modify at runtime (returns an error)
_ = dd.SetLevel(dd.LevelDebug)      // Modify the global logger's level
```

### How do I configure the file-rotation strategy?

Configure via `FileWriter`:

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB, 30 days, 10 backups
)
```

## Performance

### Will logging affect program performance?

DD is designed for high performance:
- Low-allocation optimization on hot paths
- Atomic level checks, lock-free
- Sensitive-data filtering for large inputs (>=10KB) runs in a separate goroutine with timeout protection; small inputs are processed synchronously
- Optional buffered writes to reduce I/O

### How do I optimize for high-throughput scenarios?

1. Use `BufferedWriter` to reduce I/O
2. Check the level before building fields
3. Consider enabling log sampling
4. Avoid `Any` fields on hot paths

See [Performance Tuning](../advanced/performance).

## Security

### How does sensitive-data filtering work?

`SensitiveDataFilter` uses regex pattern matching to automatically replace matching sensitive values with `[REDACTED]` before the log is written. Small inputs are processed synchronously; for large inputs the regex scan runs in a separate goroutine, but the **caller blocks waiting for the result** (the wait scales with input size — a fixed 50ms for inputs up to 32KB, then +200ms per additional 32KB; on timeout it returns `[REDACTED]`).

### How do I customize sensitive-data patterns?

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### How do I ensure logs are not tampered with?

Use `IntegritySigner` to HMAC-sign logs:

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
sig := signer.Sign(logMessage)
// Verify: signer.Verify(signedEntry)
```

## Error Handling

### Why does AddWriter return an error?

Possible reasons:
- `ErrNilWriter` -- a nil Writer was passed
- `ErrLoggerClosed` -- the logger is closed
- `ErrMaxWritersExceeded` -- the writer count exceeds the limit

### How do I handle write failures?

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // Custom handling
    metrics.WriteErrors.Inc()
})
```

## Testing

### How do I capture logs in tests?

Use `LoggerRecorder`:

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("expected log not found")
}
```

See [Test Helper](../api-reference/dev-tools/recorder).

## Next Steps

- [Quick Start](../getting-started/) -- Getting started guide
- [API Reference](../api-reference/) -- Complete API
- [Production Checklist](../guides/security/production-checklist) -- Pre-launch checks
