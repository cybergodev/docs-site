---
title: "Logger - CyberGo DD | Core Logger"
description: "CyberGo DD Logger API: log output methods (Info/Warn/Error/Fatal), dynamic level and Writer management, lifecycle control, and chained field setup."
---

# Logger

`Logger` is the core type of DD, providing thread-safe logging capabilities.

## Creation

```go
// Create via New
logger, _ := dd.New(dd.DefaultConfig())

// Create with custom config
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## Log Methods

### Basic Logging

| Method | Description |
|--------|-------------|
| `Debug(args ...any)` | Debug level log |
| `Info(args ...any)` | Info level log |
| `Warn(args ...any)` | Warn level log |
| `Error(args ...any)` | Error level log |
| `Fatal(args ...any)` | Fatal level log (default calls os.Exit(1), customizable via FatalHandler) |
| `Log(level LogLevel, args ...any)` | Log at specified level |

### Formatted Logging

| Method | Description |
|--------|-------------|
| `Debugf(format string, args ...any)` | Formatted Debug |
| `Infof(format string, args ...any)` | Formatted Info |
| `Warnf(format string, args ...any)` | Formatted Warn |
| `Errorf(format string, args ...any)` | Formatted Error |
| `Fatalf(format string, args ...any)` | Formatted Fatal |
| `Logf(level LogLevel, format string, args ...any)` | Formatted specified level |

### Structured Logging

| Method | Description |
|--------|-------------|
| `DebugWith(msg string, fields ...Field)` | Structured Debug |
| `InfoWith(msg string, fields ...Field)` | Structured Info |
| `WarnWith(msg string, fields ...Field)` | Structured Warn |
| `ErrorWith(msg string, fields ...Field)` | Structured Error |
| `FatalWith(msg string, fields ...Field)` | Structured Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Structured specified level |

```go
logger.InfoWith("Request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## Level Management

```go
level := logger.GetLevel()                    // Get current level
_ = logger.SetLevel(dd.LevelDebug)            // Set level
enabled := logger.IsLevelEnabled(dd.LevelInfo)// Check level

// Quick checks
logger.IsDebugEnabled()
logger.IsInfoEnabled()
logger.IsWarnEnabled()
logger.IsErrorEnabled()
logger.IsFatalEnabled()

// Dynamic level resolver
logger.SetLevelResolver(func(ctx context.Context) dd.LogLevel {
    if isDebug {
        return dd.LevelDebug
    }
    return dd.LevelInfo
})
resolver := logger.GetLevelResolver()
```

## Field Chaining

```go
// Preset fields, returns LoggerEntry
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// Single field
entry := logger.WithField("env", "prod")
```

## Output Target Management

```go
// Add Writer
_ = logger.AddWriter(os.Stderr)

// Remove Writer
_ = logger.RemoveWriter(os.Stderr)

// Get Writer count
count := logger.WriterCount()

// Set write error handler
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "Write failed: %v\n", err)
})
```

## Context Integration

```go
// Add context extractor
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// Replace all extractors
logger.SetContextExtractors(extractor1, extractor2)

// Get current extractors
extractors := logger.GetContextExtractors()
```

## Hook Management

```go
// Register hook
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // Pre-log processing
    return nil
})

// Replace hook registry
_ = logger.SetHooks(registry)

// Get hook registry
hooks := logger.GetHooks()
```

## Sampling Control

```go
// Set sampling config
logger.SetSampling(&dd.SamplingConfig{
    // Sampling parameters
})

// Get sampling config
cfg := logger.GetSampling()
```

## Security Configuration

```go
// Set security config
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// Get security config
sec := logger.GetSecurityConfig()
```

## Field Validation

```go
// Set field validation
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// Get validation config
validation := logger.GetFieldValidation()
```

## Lifecycle

```go
// Flush buffer
_ = logger.Flush()

// Close logger
_ = logger.Close()

// Graceful shutdown (with timeout)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// Check if closed
closed := logger.IsClosed()

// Wait for filter goroutines to complete
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## Debug Output

| Method | Description |
|--------|-------------|
| `Print(args ...any)` | Output to configured Writer (LevelInfo, security filtered) |
| `Println(args ...any)` | Identical to Print (Log() already adds newline) |
| `Printf(format string, args ...any)` | Formatted output (LevelInfo, security filtered) |
| `JSON(data ...any)` | JSON format debug output to stdout (no security filtering) |
| `JSONF(format string, args ...any)` | Formatted JSON debug output to stdout (no security filtering) |
| `Text(data ...any)` | Text format debug output to stdout (no security filtering) |
| `Textf(format string, args ...any)` | Formatted text debug output to stdout (no security filtering) |

## Next Steps

- [LoggerEntry](./entry) -- Preset field chaining
- [Configuration](./config) -- Config in detail
- [Output Targets](./writers) -- FileWriter in detail
