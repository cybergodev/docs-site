---
sidebar_label: "Logger"
title: "Logger - CyberGo DD | Core Logger"
description: "CyberGo DD Logger core API: log output methods (Info/Warn/Error/Fatal), dynamic level management, Writer add/remove/replace, lifecycle control (Close/Flush), and chained field setting. The thread-safe, high-performance core entry-point type of the logging library."
sidebar_position: 2
---

# Logger

`Logger` is the core type of DD, providing thread-safe logging functionality.

## Creation

```go
// Via New
logger, _ := dd.New(dd.DefaultConfig())
```

```go
// Create with custom config
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## Logging Methods

### Basic Logs

| Method | Description |
|--------|-------------|
| `Debug(args ...any)` | Debug-level log |
| `Info(args ...any)` | Info-level log |
| `Warn(args ...any)` | Warn-level log |
| `Error(args ...any)` | Error-level log |
| `Fatal(args ...any)` | Fatal-level log (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `Log(level LogLevel, args ...any)` | Specified-level log |

### Formatted Logs

| Method | Description |
|--------|-------------|
| `Debugf(format string, args ...any)` | Formatted Debug |
| `Infof(format string, args ...any)` | Formatted Info |
| `Warnf(format string, args ...any)` | Formatted Warn |
| `Errorf(format string, args ...any)` | Formatted Error |
| `Fatalf(format string, args ...any)` | Formatted Fatal (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `Logf(level LogLevel, format string, args ...any)` | Formatted, specified level |

### Structured Logs

| Method | Description |
|--------|-------------|
| `DebugWith(msg string, fields ...Field)` | Structured Debug |
| `InfoWith(msg string, fields ...Field)` | Structured Info |
| `WarnWith(msg string, fields ...Field)` | Structured Warn |
| `ErrorWith(msg string, fields ...Field)` | Structured Error |
| `FatalWith(msg string, fields ...Field)` | Structured Fatal (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Structured, specified level |

```go
logger.InfoWith("request completed",
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

// Shortcut checks
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
// Preset fields, returns a LoggerEntry
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// Single field
entry := logger.WithField("env", "prod")
```

## Output Target Management

```go
// Add a Writer
_ = logger.AddWriter(os.Stderr)

// Remove a Writer
_ = logger.RemoveWriter(os.Stderr)

// Get the Writer count
count := logger.WriterCount()

// Set the write-error handler
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "write failed: %v\n", err)
})
```

## Context Integration

```go
// Add a context extractor
_ = logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// Replace all extractors
_ = logger.SetContextExtractors(extractor1, extractor2)

// Get the current extractors
extractors := logger.GetContextExtractors()
```

## Hook Management

```go
// Register a hook
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // Pre-log processing
    return nil
})

// Replace the hook registry
_ = logger.SetHooks(registry)

// Get the hook registry
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
// Flush buffers
_ = logger.Flush()

// Close the logger
_ = logger.Close()

// Graceful shutdown (with timeout)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// Check whether closed
closed := logger.IsClosed()

// Wait for filter goroutines to finish
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## Debug Output

| Method | Description |
|--------|-------------|
| `Print(args ...any)` | Output to the configured Writer (LevelInfo, subject to security filtering) |
| `Println(args ...any)` | Same behavior as Print (the underlying Log() already appends a newline) |
| `Printf(format string, args ...any)` | Formatted output (LevelInfo, subject to security filtering) |
| `JSON(data ...any)` | Compact-JSON output to stdout (includes caller info; does not go through security filtering) |
| `JSONF(format string, args ...any)` | Formatted compact-JSON output to stdout (includes caller info; does not go through security filtering) |
| `Text(data ...any)` | Pretty-printed output to stdout (no caller info; does not go through security filtering) |
| `Textf(format string, args ...any)` | Formatted text output to stdout (no caller info; does not go through security filtering) |

## Next Steps

- [LoggerEntry](./entry) -- Preset-field chaining
- [Config](./config) -- Config in depth
- [Output Targets](../output-integration/writers) -- FileWriter in depth
