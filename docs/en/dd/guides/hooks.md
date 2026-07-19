---
sidebar_label: "Hook System"
title: "Hook System - CyberGo DD | Lifecycle Hooks Guide"
description: "CyberGo DD hook system guide: 6 lifecycle events (BeforeLog, AfterLog, OnFilter, OnRotate, OnClose, OnError), the HookRegistry registry, the HookContext context, and common extension scenarios."
sidebar_position: 6
---

# Hook System

Hooks let you inject custom logic at key points of the log lifecycle, such as before/after log writes, file rotation, and error occurrences.

## Hook Events

DD provides 6 lifecycle hook events:

| Event | When Triggered | Typical Use |
|-------|----------------|-------------|
| `HookBeforeLog` | Before a log is formatted (fields already filtered) | Conditional skip, sampling |
| `HookAfterLog` | After a log write completes | Update metrics, send notifications |
| `HookOnFilter` | When a field value is redacted (message-text redaction does not trigger this; the hook receives only the field key, not the original value) | Record redaction events, audit |
| `HookOnRotate` | After file rotation completes | Notify ops, upload old files |
| `HookOnClose` | When the Logger closes | Clean up resources, send final reports |
| `HookOnError` | When a write error occurs | Alerting, graceful degradation |

## Quick Start

### Using HooksConfig

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("about to write: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, err := dd.New(dd.Config{
    Hooks: hooks,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Using HookRegistry

```go
registry := dd.NewHookRegistry()

// Register a BeforeLog hook
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Skip some processing for debug-level logs
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// Register an OnRotate hook
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("file rotated: %s\n", hCtx.Metadata)
    return nil
})

logger, err := dd.New(dd.Config{
    Hooks: registry,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## HookContext

Each hook receives a `HookContext` containing complete information about the current log:

```go
type HookContext struct {
    Event          HookEvent    // Triggered event type
    Level          LogLevel     // Log level
    Message        string       // Log message
    Fields         []Field      // Processed fields
    OriginalFields []Field      // Original fields (before filtering)
    Error          error        // Related error (OnError)
    Timestamp      time.Time    // Timestamp
    Writer         io.Writer    // Target Writer
    Metadata       map[string]any // Attached metadata
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

logger, err := dd.New(dd.Config{Hooks: registry})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Log Sampling

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // Keep 1 of every 100
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // Returning an error prevents the log from being written
        }
    }
    return nil
})
```

### File-Rotation Notification

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Notify the monitoring system
    monitoring.Alert("log_rotated", map[string]any{
        "path": hCtx.Metadata["path"],
    })
    return nil
})
```

### Error Alerting

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Send an alert
    alerting.Send(fmt.Sprintf("log write failed: %v", hCtx.Error))
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
        log.Printf("hook %s failed: %v", event, err)
    },
})
```

### BeforeLog Aborting a Log

When a `BeforeLog` hook returns an error, the log entry is not written:

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Check a condition; skip if not met
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // Prevents writing
    }
    return nil // Allow writing
})
```

:::warning Panics in Hooks
If a hook function panics, DD recovers automatically without affecting the main flow. The panic value is passed to the ErrorHandler.
:::

## Dynamic Registration

```go
// Register a new hook at runtime
registry.Add(dd.HookAfterLog, newHookFunc)

// Remove at runtime (via HookRegistry methods)
```

:::warning registry cloning
When creating a Logger, the passed-in `registry` is cloned (after `dd.New(dd.Config{Hooks: registry})`, the Logger holds a copy); subsequent modifications to the original `registry` do not affect the already-created Logger. To change hooks of an **already-created Logger** at runtime, use `logger.AddHook(event, hook)` (internal Clone-Modify-Store).
:::

## Next Steps

- [Audit Logging](./audit-logging) -- Security audit integration
- [Distributed Tracing](./context-tracing) -- Context integration
- [API Reference - Hooks](../api-reference/security-audit/hooks) -- Complete hook API
