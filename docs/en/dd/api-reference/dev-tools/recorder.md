---
sidebar_label: "Recorder"
title: "Test Helper - CyberGo DD | LoggerRecorder"
description: "Complete API documentation for the CyberGo DD LoggerRecorder test helper, designed for unit-test scenarios. Captures and asserts on log output, supporting per-level entry filtering, structured-field value validation, entry-count statistics, and in-order assertions. Significantly improves the efficiency and readability of log-related unit tests."
sidebar_position: 2
---

# Test Helper

DD provides `LoggerRecorder` for test scenarios, capturing log entries for assertions.

## LoggerRecorder

Thread-safe log recorder for capturing and inspecting log output in tests.

:::warning Text-format parsing limitation
The text-mode parser assumes the default time format (ISO 8601) and the default level strings (DEBUG/INFO/WARN/ERROR/FATAL). If you customized `TimeFormat`, text mode may not correctly extract the level and timestamp. For custom formats, prefer JSON (`FormatJSON`), settable via `SetFormat`.
:::

### Creation

```go
recorder := dd.NewLoggerRecorder()
```

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Writer` | `() io.Writer` | Get the io.Writer |
| `SetFormat` | `(format LogFormat)` | Set the log format (for parsing) |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | Create a Logger that writes to this recorder |
| `Entries` | `() []LogEntry` | Get all log entries |
| `Count` | `() int` | Entry count |
| `Clear` | `()` | Clear all entries |
| `HasEntries` | `() bool` | Whether there are entries |
| `LastEntry` | `() *LogEntry` | Most recent entry (nil-safe) |

### Assertion Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | Filter entries by level |
| `ContainsMessage` | `(msg string) bool` | Whether it contains the specified message (exact or substring match) |
| `ContainsField` | `(key string) bool` | Whether it contains the specified field |
| `GetFieldValue` | `(key string) any` | Get the value of the first matching field |

### Usage Examples

#### Basic Test

```go
func TestLogger(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("hello")
    logger.Warn("warning")

    if rec.Count() != 2 {
        t.Errorf("expected 2 entries, got %d", rec.Count())
    }

    if !rec.ContainsMessage("hello") {
        t.Error("should contain 'hello'")
    }
}
```

#### Level Assertion

```go
func TestLogLevel(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    // Note: the Recorder parses the level from the ISO 8601 timestamp;
    // DevelopmentConfig's time format ("15:04:05.000") is incompatible,
    // so use DefaultConfig and manually set DEBUG.
    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelDebug
    logger, _ := rec.NewLogger(cfg)

    logger.Debug("debug")
    logger.Info("info")
    logger.Error("error")

    errors := rec.EntriesAtLevel(dd.LevelError)
    if len(errors) != 1 {
        t.Errorf("expected 1 error, got %d", len(errors))
    }

    debugs := rec.EntriesAtLevel(dd.LevelDebug)
    if len(debugs) != 1 {
        t.Errorf("expected 1 debug, got %d", len(debugs))
    }
}
```

#### Structured-Field Assertion

```go
func TestStructuredLog(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.InfoWith("user login",
        dd.String("user", "admin"),
        dd.String("ip", "192.168.1.1"),
    )

    if !rec.ContainsField("user") {
        t.Error("should contain 'user' field")
    }

    user := rec.GetFieldValue("user")
    if user != "admin" {
        t.Errorf("expected user=admin, got %v", user)
    }
}
```

#### Last Entry

```go
func TestLastEntry(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("first")
    logger.Error("second")

    last := rec.LastEntry()
    if last.Level != dd.LevelError {
        t.Errorf("expected Error level, got %v", last.Level)
    }
    if last.Message != "second" {
        t.Errorf("expected 'second', got %s", last.Message)
    }
}
```

## LogEntry

Captured log entry structure.

```go
type LogEntry struct {
    Level     LogLevel
    Message   string
    Fields    []Field
    Timestamp time.Time
    Format    LogFormat
    RawOutput string
}
```

## Next Steps

- [Logger](../core/logger) -- Full Logger methods
- [Structured Fields](../output-integration/fields) -- Field constructors
- [Constants & Errors](./constants) -- LogLevel constants
