---
title: "Testing Patterns - CyberGo DD | LoggerRecorder Examples"
description: "CyberGo DD testing patterns: LoggerRecorder in unit tests, message assertions, level filtering, field inspection, isolation, and concurrent safety."
---

# Testing Patterns

DD provides `LoggerRecorder` as a testing utility that captures logs in unit tests for assertion without writing to actual files or console.

## Basic Usage

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // Create a test logger recorder
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // Assert log content
    if !rec.ContainsMessage("User created") {
        t.Error("Expected log message 'User created'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## LoggerRecorder Methods

### Message Checking

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("Operation succeeded")
logger.Error("Operation failed")

// Check if a message exists
rec.ContainsMessage("Operation succeeded")  // true
rec.ContainsMessage("Operation failed")     // true

// Get all log entries
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### Level Filtering

```go
// Filter logs by specific level
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// Use DevelopmentConfig to capture all levels
rec2 := dd.NewLoggerRecorder()
logger2, _ := rec2.NewLogger(dd.DevelopmentConfig())
logger2.Debug("Debug info")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### Field Checking

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("Request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// Check field values
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// Note: field values are string type in text format
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## Testing Patterns

### Testing Service Layer

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // Happy path
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("Order created"))
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
        db:  &failingDB{}, // Simulate database error
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // Verify error was logged
    require.True(t, rec.ContainsMessage("Processing failed"))
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
    require.Equal(t, "Request completed", entry.Message)
    // Verify field values
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    // Note: field values are string type in text format
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

## Table-Driven Tests

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
            logFunc:  func(l *dd.Logger) { l.Debug("Debug info") },
            expected: "Debug info",
        },
        {
            name:     "Info level",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("General info") },
            expected: "General info",
        },
        {
            name:     "Error level",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("Error info") },
            expected: "Error info",
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

- [Web Service Integration](./web-service) -- HTTP service logging
- [API Reference - Recorder](../api-reference/recorder) -- LoggerRecorder complete API
- [Hook System](../guides/hooks) -- Lifecycle hooks
