---
title: "FAQ - CyberGo DD | Frequently Asked Questions"
description: "CyberGo DD FAQ: configuration tuning, performance optimization, sensitive data filtering, audit logging, file rotation, error handling, and hook usage."
---

# Frequently Asked Questions

## Basic Usage

### What is the difference between the global logger and a custom logger?

The **global logger** is used directly via package-level functions like `dd.Info()`, suitable for simple scenarios. A **custom logger** is created via `dd.New()`, supporting independent configuration and lifecycle management.

```go
// Global logger
dd.Info("Global log")

// Custom logger
logger, _ := dd.New(dd.JSONConfig())
logger.Info("Independent log")
```

### How to initialize the global logger at program startup?

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
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
dd.SetDefault(logger)
```

### What happens with Fatal level logs?

`Fatal` / `Fatalf` / `FatalWith` call `os.Exit(1)` after outputting the log. You can customize this behavior via `FatalHandler`.

## Configuration

### How to output to both console and file?

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
// Or JSON format
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### How to dynamically change the log level?

```go
_ = logger.SetLevel(dd.LevelDebug)  // Runtime modification (returns error)
_ = dd.SetLevel(dd.LevelDebug)      // Modify global logger level
```

### How to configure file rotation policy?

Configure via `FileWriter`:

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB, 30 days, 10 backups
)
```

## Performance

### Will logging affect program performance?

DD is designed for high performance:
- Zero-allocation optimization on hot paths
- Atomic level checks, lock-free
- Sensitive data filtering runs in separate goroutines
- Optional buffered writing to reduce I/O

### How to optimize for high-throughput scenarios?

1. Use `BufferedWriter` to reduce I/O
2. Check level before constructing fields
3. Consider enabling log sampling
4. Avoid using `Any` fields on high-frequency paths

See [Performance Optimization](./advanced/performance).

## Security

### How does sensitive data filtering work?

`SensitiveDataFilter` uses regex pattern matching to automatically replace matched sensitive values with `[REDACTED]` before log writing. For small inputs, filtering runs synchronously. For large inputs (>10KB), filtering runs in a separate goroutine with timeout protection (50ms default).

### How to customize sensitive data patterns?

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### How to ensure logs are not tampered with?

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
- `ErrNilWriter` -- nil Writer was passed
- `ErrLoggerClosed` -- Logger is closed
- `ErrMaxWritersExceeded` -- Writer count exceeded

### How to handle write failures?

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // Custom handling
    metrics.WriteErrors.Inc()
})
```

## Testing

### How to capture logs in tests?

Use `LoggerRecorder`:

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("Expected log not found")
}
```

See [Test Helper](./api-reference/recorder).

## Next Steps

- [Quick Start](./getting-started) -- Getting started guide
- [API Reference](./api-reference/) -- Complete API
- [Production Checklist](./security/production-checklist) -- Pre-launch checks
