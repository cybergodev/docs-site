---
sidebar_label: "LoggerEntry"
title: "LoggerEntry - CyberGo DD | Preset-Field Logger"
description: "Complete API documentation for CyberGo DD's LoggerEntry type, used to create chained loggers with preset fields. Passing at least one field returns a new immutable Entry instance (passing none returns the original Entry), supporting field accumulation and composition, context-bound propagation, and level inheritance. Suitable for request-scoped log tracing and context correlation."
sidebar_position: 3
---

# LoggerEntry

`LoggerEntry` is a logger with preset fields; passing at least one field returns a new immutable Entry.

## Creation

```go
// From a Logger
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// Via the global Logger
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// Single-field shortcut
entry := logger.WithField("request_id", "req-123")
```

## Chained Calls

```go
// Append fields (returns a new Entry; the original is unchanged)
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// New fields overwrite same-named old fields
entry := base.WithField("svc", "gateway")  // svc becomes "gateway"
```

:::tip Immutability
When at least one field is passed, `WithFields` / `WithField` return a new `LoggerEntry`; the original Entry is unaffected and safe for concurrent use. Calling `WithFields()` with no fields is a no-op optimization that returns the original Entry directly.
:::

## Logging Methods

All Logger logging methods are also available on the Entry; emitted logs automatically carry the preset fields:

### Basic Logs

| Method | Description |
|--------|-------------|
| `Debug(args ...any)` | Debug level |
| `Info(args ...any)` | Info level |
| `Warn(args ...any)` | Warn level |
| `Error(args ...any)` | Error level |
| `Fatal(args ...any)` | Fatal level (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `Log(level LogLevel, args ...any)` | Specified level |

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
| `DebugWith(msg string, fields ...Field)` | Structured Debug (merges preset fields) |
| `InfoWith(msg string, fields ...Field)` | Structured Info |
| `WarnWith(msg string, fields ...Field)` | Structured Warn |
| `ErrorWith(msg string, fields ...Field)` | Structured Error |
| `FatalWith(msg string, fields ...Field)` | Structured Fatal (by default calls os.Exit(1), **deferred functions will not run**; customizable via FatalHandler) |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Structured, specified level |

### Print Methods

| Method | Description |
|--------|-------------|
| `Print(args ...any)` | Output to the Writer (LevelInfo, subject to security filtering) |
| `Println(args ...any)` | Same behavior as Print |
| `Printf(format string, args ...any)` | Formatted output (LevelInfo, subject to security filtering) |

### Field Chaining

| Method | Description |
|--------|-------------|
| `WithFields(fields ...Field) *LoggerEntry` | Append fields, returns a new Entry |
| `WithField(key string, value any) *LoggerEntry` | Add a single field, returns a new Entry |

## Usage Examples

### HTTP Request Logging

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("request started")

    // Handling logic...

    reqLog.WithField("status", 200).Info("request completed")
}
```

### Service Component Logging

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("service started")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("connected")
dbLog.ErrorWith("query failed", dd.Err(err))
```

## Next Steps

- [Logger](./logger) -- Logger instance methods
- [Structured Fields](../output-integration/fields) -- Field constructors
- [Package Functions](./functions) -- Global log functions
