---
sidebar_label: "Logger"
title: "Logger - CyberGo DD | Core Logger"
description: "CyberGo DD Logger core API: output methods (Info/Warn/Error/Fatal), dynamic level control, writer management, Close/Flush lifecycle, and chained fields."
sidebar_position: 2
---

# Logger

`Logger` is the core type of DD, providing thread-safe logging functionality. It implements every method of the [LogProvider](./interfaces) interface, plus a few extension methods beyond the interface.

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `Debug` | `(args ...any)` | Debug-level log |
| `Info` | `(args ...any)` | Info-level log |
| `Warn` | `(args ...any)` | Warn-level log |
| `Error` | `(args ...any)` | Error-level log |
| `Fatal` | `(args ...any)` | Fatal-level log (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `Log` | `(level LogLevel, args ...any)` | Specified-level log |

### Formatted Logs

| Method | Signature | Description |
|--------|-----------|-------------|
| `Debugf` | `(format string, args ...any)` | Formatted Debug |
| `Infof` | `(format string, args ...any)` | Formatted Info |
| `Warnf` | `(format string, args ...any)` | Formatted Warn |
| `Errorf` | `(format string, args ...any)` | Formatted Error |
| `Fatalf` | `(format string, args ...any)` | Formatted Fatal (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `Logf` | `(level LogLevel, format string, args ...any)` | Formatted, specified level |

### Structured Logs

| Method | Signature | Description |
|--------|-----------|-------------|
| `DebugWith` | `(msg string, fields ...Field)` | Structured Debug |
| `InfoWith` | `(msg string, fields ...Field)` | Structured Info |
| `WarnWith` | `(msg string, fields ...Field)` | Structured Warn |
| `ErrorWith` | `(msg string, fields ...Field)` | Structured Error |
| `FatalWith` | `(msg string, fields ...Field)` | Structured Fatal (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `LogWith` | `(level LogLevel, msg string, fields ...Field)` | Structured, specified level |

```go
logger.InfoWith("request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## Level Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetLevel` | `() LogLevel` | Get the current log level |
| `SetLevel` | `(level LogLevel) error` | Set the log level |
| `IsLevelEnabled` | `(level LogLevel) bool` | Check whether the specified level is enabled |
| `IsDebugEnabled` | `() bool` | Check whether Debug is enabled |
| `IsInfoEnabled` | `() bool` | Check whether Info is enabled |
| `IsWarnEnabled` | `() bool` | Check whether Warn is enabled |
| `IsErrorEnabled` | `() bool` | Check whether Error is enabled |
| `IsFatalEnabled` | `() bool` | Check whether Fatal is enabled |
| `SetLevelResolver` | `(resolver LevelResolver)` | Set a dynamic level resolver (nil disables it; overrides `Level` while active) |
| `GetLevelResolver` | `() LevelResolver` | Get the dynamic level resolver |

```go
level := logger.GetLevel()                    // Get current level
_ = logger.SetLevel(dd.LevelDebug)            // Set level
enabled := logger.IsLevelEnabled(dd.LevelInfo) // Check level

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `WithFields` | `(fields ...Field) *LoggerEntry` | Create a [LoggerEntry](./entry) with preset fields |
| `WithField` | `(key string, value any) *LoggerEntry` | Create an entry with a single preset field (equivalent to `WithFields` with one field) |

```go
// Preset fields, returns a LoggerEntry
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// Single field (equivalent to WithFields with one field)
entry2 := logger.WithField("env", "prod")
```

## Output Target Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddWriter` | `(writer io.Writer) error` | Add an output Writer (more than 100 total returns `ErrMaxWritersExceeded`) |
| `RemoveWriter` | `(writer io.Writer) error` | Remove an output Writer (not found returns `ErrWriterNotFound`) |
| `WriterCount` | `() int` | Get the Writer count |
| `SetWriteErrorHandler` | `(handler WriteErrorHandler)` | Set the write-error callback |

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddContextExtractor` | `(extractor ContextExtractor) error` | Append a context extractor |
| `SetContextExtractors` | `(extractors ...ContextExtractor) error` | Replace all context extractors |
| `GetContextExtractors` | `() []ContextExtractor` | Get the current context extractors |

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddHook` | `(event HookEvent, hook Hook) error` | Register a single hook (see [Hooks](./hooks)) |
| `SetHooks` | `(registry *HookRegistry) error` | Replace the entire hook registry |
| `GetHooks` | `() *HookRegistry` | Get the current hook registry |

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `SetSampling` | `(config *SamplingConfig)` | Enable/disable sampling at runtime (pass `nil` to disable; the config is copied, so mutating the argument does not affect the logger) |
| `GetSampling` | `() *SamplingConfig` | Get a copy of the sampling config (`nil` when sampling is not enabled) |

```go
// Set sampling config
logger.SetSampling(&dd.SamplingConfig{
    // Sampling parameters
})

// Get sampling config
cfg := logger.GetSampling()
```

## Security Configuration

| Method | Signature | Description |
|--------|-----------|-------------|
| `SetSecurityConfig` | `(config *SecurityConfig)` | Atomically replace the security config at runtime (cloned internally; see [Security Filtering](../security-audit/security)) |
| `GetSecurityConfig` | `() *SecurityConfig` | Get the current security config |

```go
// Set security config
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// Get security config
sec := logger.GetSecurityConfig()
```

## Field Validation

| Method | Signature | Description |
|--------|-----------|-------------|
| `SetFieldValidation` | `(config *FieldValidationConfig)` | Set the field-validation config |
| `GetFieldValidation` | `() *FieldValidationConfig` | Get the field-validation config |

```go
// Set field validation
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// Get validation config
validation := logger.GetFieldValidation()
```

## Lifecycle

| Method | Signature | Description |
|--------|-----------|-------------|
| `Flush` | `() error` | Flush Writers that implement [Flusher](./interfaces#flusher) |
| `Close` | `() error` | Close the logger: triggers OnClose hooks, waits for filter goroutines, flushes then closes all Writers (CAS-guarded; safe to call repeatedly) |
| `Shutdown` | `(ctx context.Context) error` | Graceful close with timeout (recommended in production): marks closed → triggers OnClose hooks → waits for in-flight operations → flushes and closes all Writers within the timeout; on timeout returns `context.DeadlineExceeded` while teardown continues in the background without leaking Writers |
| `IsClosed` | `() bool` | Check whether the logger is closed |
| `WaitForFilterGoroutines` | `(timeout time.Duration) bool` | Wait for in-flight security-filter goroutines (returns `false` on timeout) |
| `ActiveFilterGoroutines` | `() int32` | Number of currently active filter goroutines |

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `Print` | `(args ...any)` | Output to the configured Writer (LevelInfo, subject to security filtering) |
| `Println` | `(args ...any)` | Same behavior as Print (the underlying Log() already appends a newline) |
| `Printf` | `(format string, args ...any)` | Formatted output (LevelInfo, subject to security filtering) |
| `JSON` | `(data ...any)` | Compact-JSON output to stdout (includes caller info; does not go through security filtering) |
| `JSONF` | `(format string, args ...any)` | Formatted compact-JSON output to stdout (includes caller info; does not go through security filtering) |
| `Text` | `(data ...any)` | Pretty-printed output to stdout (no caller info; does not go through security filtering) |
| `Textf` | `(format string, args ...any)` | Formatted text output to stdout (no caller info; does not go through security filtering) |

## Next Steps

- [LoggerEntry](./entry) -- Preset-field chaining
- [Config](./config) -- Config in depth
- [Output Targets](../output-integration/writers) -- FileWriter in depth
