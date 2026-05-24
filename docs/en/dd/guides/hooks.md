---
title: "Hook System - CyberGo DD | Lifecycle Hooks Practical Guide"
description: "CyberGo DD hook system guide: 6 lifecycle events (BeforeLog, AfterLog, OnFilter, OnRotate, OnClose, OnError), HookRegistry, and usage patterns."
---

# Hook System

Hooks allow you to inject custom logic at key points in the log lifecycle, such as before and after log writes, file rotation, or when errors occur.

## Hook Events

DD provides 6 lifecycle hook events:

| Event | Trigger Timing | Typical Use Case |
|-------|---------------|-----------------|
| `HookBeforeLog` | Before log formatting (fields already filtered) | Conditional skip, sampling control |
| `HookAfterLog` | After log write completes | Update metrics, send notifications |
| `HookOnFilter` | When security filtering triggers | Record redaction events, auditing |
| `HookOnRotate` | After file rotation completes | Notify ops team, upload old files |
| `HookOnClose` | Logger closes | Clean up resources, send final report |
| `HookOnError` | When a write error occurs | Alerting, graceful degradation |

## Quick Start

### Using HooksConfig

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("About to write: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, _ := dd.New(dd.Config{
    Hooks: hooks,
})
```

### Using HookRegistry

```go
registry := dd.NewHookRegistry()

// Register BeforeLog hook
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Skip certain processing for debug-level logs
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// Register OnRotate hook
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("File rotated: %s\n", hCtx.Metadata)
    return nil
})

logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## HookContext

Each hook receives a `HookContext` containing complete information about the current log entry:

```go
type HookContext struct {
    Event          HookEvent    // Triggered event type
    Level          LogLevel     // Log level
    Message        string       // Log message
    Fields         []Field      // Processed fields
    OriginalFields []Field      // Original fields (before filtering)
    Error          error        // Related error (for OnError)
    Timestamp      time.Time    // Timestamp
    Writer         io.Writer    // Target Writer
    Metadata       map[string]any // Additional metadata
}
```

## Common Scenarios

### Metrics Collection

```go
var (
    logCounter   atomic.Int64
    errorCounter atomic.Int64
)

registry := dd.NewHookRegistry()

registry.Add(dd.HookAfterLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    logCounter.Add(1)
    if hCtx.Level >= dd.LevelError {
        errorCounter.Add(1)
    }
    return nil
})

logger, _ := dd.New(dd.Config{Hooks: registry})
```

### Log Sampling

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // Only record 1 out of every 100 entries
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // Return error to prevent log write
        }
    }
    return nil
})
```

### File Rotation Notification

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Notify monitoring system
    monitoring.Alert("log_rotated", map[string]any{
        "file":     hCtx.Metadata["file"],
        "new_file": hCtx.Metadata["new_file"],
    })
    return nil
})
```

### Error Alerting

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Send alert
    alerting.Send(fmt.Sprintf("Log write failed: %v", hCtx.Error))
    return nil
})
```

## Error Handling

### Global Error Handler

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // May return an error
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("Hook %s execution failed: %v", event, err)
    },
})
```

### Aborting Logs in BeforeLog

When a `BeforeLog` hook returns an error, that log entry will not be written:

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Check condition, skip if not met
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // Prevent write
    }
    return nil // Allow write
})
```

:::warning Panics in Hooks
If a panic occurs in a hook function, DD automatically recovers and does not affect the main flow. The panic information is passed to the ErrorHandler.
:::

## Dynamic Registration

```go
// Register new hook at runtime
registry.Add(dd.HookAfterLog, newHookFunc)

// Remove at runtime (via HookRegistry methods)
```

## Next Steps

- [Audit Logging](./audit-logging) -- Security audit integration
- [Distributed Tracing](./context-tracing) -- Context integration
- [API Reference - Hooks](../api-reference/hooks) -- Hooks complete API
