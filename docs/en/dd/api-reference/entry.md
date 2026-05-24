---
title: "LoggerEntry - CyberGo DD | Preset Field Logger"
description: "CyberGo DD LoggerEntry API: create chained loggers with preset fields, immutable WithFields composition, context binding, and level inheritance for tracing."
---

# LoggerEntry

`LoggerEntry` is a logger with preset fields. Each `WithFields` call returns a new immutable Entry.

## Creation

```go
// Create from Logger
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// Create via global Logger
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// Single field shortcut
entry := logger.WithField("request_id", "req-123")
```

## Chaining

```go
// Append fields (returns new Entry, original Entry unchanged)
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// New fields override same-named old fields
entry := base.WithField("svc", "gateway")  // svc becomes "gateway"
```

:::tip Immutability
Each `WithFields` / `WithField` call returns a new `LoggerEntry`. The original Entry is not affected and is safe for concurrent use.
:::

## Log Methods

All Logger log methods are also available on Entry. Output logs automatically carry preset fields:

### Basic Logging

| Method | Description |
|--------|-------------|
| `Debug(args ...any)` | Debug level |
| `Info(args ...any)` | Info level |
| `Warn(args ...any)` | Warn level |
| `Error(args ...any)` | Error level |
| `Fatal(args ...any)` | Fatal level |
| `Log(level LogLevel, args ...any)` | Specified level |

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
| `DebugWith(msg string, fields ...Field)` | Structured Debug (merges preset fields) |
| `InfoWith(msg string, fields ...Field)` | Structured Info |
| `WarnWith(msg string, fields ...Field)` | Structured Warn |
| `ErrorWith(msg string, fields ...Field)` | Structured Error |
| `FatalWith(msg string, fields ...Field)` | Structured Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Structured specified level |

### Print Methods

| Method | Description |
|--------|-------------|
| `Print(args ...any)` | Output to Writer (LevelInfo, security filtered) |
| `Println(args ...any)` | Identical to Print |
| `Printf(format string, args ...any)` | Formatted output (LevelInfo, security filtered) |

### Field Chaining

| Method | Description |
|--------|-------------|
| `WithFields(fields ...Field) *LoggerEntry` | Append fields, returns new Entry |
| `WithField(key string, value any) *LoggerEntry` | Add single field, returns new Entry |

## Usage Examples

### HTTP Request Logging

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("Request started")

    // Processing logic...

    reqLog.WithField("status", 200).Info("Request completed")
}
```

### Service Component Logging

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("Service started")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("Connection established")
dbLog.ErrorWith("Query failed", dd.Err(err))
```

## Next Steps

- [Logger](./logger) -- Logger instance methods
- [Structured Fields](./fields) -- Field constructors
- [Package Functions](./functions) -- Global logging functions
