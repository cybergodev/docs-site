---
sidebar_label: "Testing Patterns"
title: "Testing Patterns - CyberGo DD | LoggerRecorder Test Examples"
description: "CyberGo DD testing-patterns examples, detailing the complete usage of LoggerRecorder in unit and integration tests, including log-message assertions, level-filter tests, field-value checks, multi-case isolation, concurrency-safety tests, and a full set of tips and best practices for improving test coverage. Applicable to log testing in any Go project."
sidebar_position: 4
---

# Testing Patterns

DD provides `LoggerRecorder` as a test helper that captures logs for assertions in unit tests, without actually writing to files or the console.

## Basic Usage

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // Create a test logger
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // Assert log content
    if !rec.ContainsMessage("create user") {
        t.Error("Expected log message 'create user'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## LoggerRecorder Methods

### Message Inspection

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("operation succeeded")
logger.Error("operation failed")

// Check whether a message is present
rec.ContainsMessage("operation succeeded")  // true
rec.ContainsMessage("operation failed")  // true

// Get all log entries
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### Level Filtering

```go
// Inspect only logs at a specific level
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// Use DEBUG level to capture all levels
// Note: the Recorder parses the level from the ISO 8601 timestamp; DevelopmentConfig's
// time format is incompatible, so use DefaultConfig and manually set DEBUG.
rec2 := dd.NewLoggerRecorder()
devCfg := dd.DefaultConfig()
devCfg.Level = dd.LevelDebug
logger2, _ := rec2.NewLogger(devCfg)
logger2.Debug("debug info")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### Field Inspection

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// Check field values
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// Note: in text format, field values are of string type
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## Test Patterns

### Testing the Service Layer

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // Happy path
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("order created"))
    require.True(t, rec.ContainsField("user_id"))
    require.Equal(t, "user-1", rec.GetFieldValue("user_id"))

    // Verify no error logs
    errors := rec.EntriesAtLevel(dd.LevelError)
    require.Empty(t, errors)
}
```

### Testing Error Handling

```go
func TestService_DatabaseError(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &Service{
        log: logger,
        db:  &failingDB{}, // Simulate a database error
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // Verify the error was logged
    require.True(t, rec.ContainsMessage("processing failed"))
    require.True(t, rec.ContainsField("error"))
    require.Contains(t, rec.GetFieldValue("error"), "database connection refused")

    // Verify level is Error
    errorEntries := rec.EntriesAtLevel(dd.LevelError)
    require.NotEmpty(t, errorEntries)
}
```

### Testing Structured Logging

```go
func TestMiddleware_LogsRequestFields(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    handler := LoggingMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/api/users", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    // Verify all expected fields
    entries := rec.EntriesAtLevel(dd.LevelInfo)
    require.Len(t, entries, 1)

    entry := entries[0]
    require.Equal(t, "request completed", entry.Message)
    // Verify field values (note: in text format, field values are of string type)
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    require.Equal(t, "200", rec.GetFieldValue("status"))
}
```

### Test Isolation

```go
func TestSuite(t *testing.T) {
    t.Run("ScenarioA", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // Independent recorder per test
        logger, _ := rec.NewLogger()
        // Test logic...
    })

    t.Run("ScenarioB", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // Independent recorder
        logger, _ := rec.NewLogger()
        // Test logic...
    })
}
```

## Table-driven Tests

```go
func TestLogLevel_Behavior(t *testing.T) {
    tests := []struct {
        name     string
        level    dd.LogLevel
        logFunc  func(*dd.Logger)
        expected string
    }{
        {
            name:     "Debug level",
            level:    dd.LevelDebug,
            logFunc:  func(l *dd.Logger) { l.Debug("debug info") },
            expected: "debug info",
        },
        {
            name:     "Info level",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("general info") },
            expected: "general info",
        },
        {
            name:     "Error level",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("error info") },
            expected: "error info",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := dd.NewLoggerRecorder()
            cfg := dd.DefaultConfig()
            cfg.Level = tt.level
            logger, _ := rec.NewLogger(cfg)

            tt.logFunc(logger)

            if !rec.ContainsMessage(tt.expected) {
                t.Errorf("Expected message %q", tt.expected)
            }
        })
    }
}
```

## Next Steps

- [Web Service Integration](./web-service) -- HTTP service log integration
- [API Reference - Recorder](../api-reference/dev-tools/recorder) -- Complete LoggerRecorder API
- [Hook System](../guides/hooks) -- Lifecycle hooks
