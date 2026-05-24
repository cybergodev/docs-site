---
title: "Testing Helper - CyberGo DD | LoggerRecorder"
description: "CyberGo DD LoggerRecorder testing API: capture and assert log output, filter by level, validate fields, and count entries in unit tests."
---

# Testing Helper

DD provides `LoggerRecorder` for testing scenarios, capturing log entries for assertion.

## LoggerRecorder

Thread-safe log recorder for capturing and inspecting log output in tests.

:::warning Text Format Parsing Limitation
The text mode parser assumes the default time format (ISO 8601) and default level strings (DEBUG/INFO/WARN/ERROR/FATAL). If you customize `TimeFormat`, the text mode parsing may silently fail to extract level/timestamp. For custom formats, use JSON format (`FormatJSON`) instead, which can be set via `SetFormat`.
:::

### Creation

```go
recorder := dd.NewLoggerRecorder()
```

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Writer` | `() io.Writer` | Get io.Writer |
| `SetFormat` | `(format LogFormat)` | Set log format (for parsing) |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | Create Logger that writes to this recorder |
| `Entries` | `() []LogEntry` | Get all log entries |
| `Count` | `() int` | Entry count |
| `Clear` | `()` | Clear all entries |
| `HasEntries` | `() bool` | Whether there are entries |
| `LastEntry` | `() *LogEntry` | Most recent entry (nil-safe) |

### Assertion Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | Filter entries by level |
| `ContainsMessage` | `(msg string) bool` | Whether it contains specified message (exact or substring match) |
| `ContainsField` | `(key string) bool` | Whether it contains specified field |
| `GetFieldValue` | `(key string) any` | Get value of first matching field |

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
    logger, _ := rec.NewLogger(dd.DevelopmentConfig())

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

#### Structured Field Assertion

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

#### Last Log Entry

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

- [Logger](./logger) -- Logger complete methods
- [Structured Fields](./fields) -- Field constructors
- [Constants and Errors](./constants) -- LogLevel constants
