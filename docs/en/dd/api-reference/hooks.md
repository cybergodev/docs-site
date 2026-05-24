---
title: "Hook System - CyberGo DD | HookRegistry"
description: "CyberGo DD lifecycle hooks API: custom callbacks for BeforeLog, AfterLog, OnRotate, OnError events via HookRegistry for log processing extensions."
---

# Hook System

DD provides an event-based hook system for inserting custom logic at key points in the log lifecycle.

## Hook Events

| Constant | String() | Trigger Timing |
|----------|----------|----------------|
| `HookBeforeLog` | `"BeforeLog"` | Before log write |
| `HookAfterLog` | `"AfterLog"` | After log write |
| `HookOnFilter` | `"OnFilter"` | During sensitive data filtering |
| `HookOnRotate` | `"OnRotate"` | During file rotation |
| `HookOnClose` | `"OnClose"` | When logger is closed |
| `HookOnError` | `"OnError"` | When an error occurs |

## HookRegistry

Hook registry, managing registration and triggering of all hooks. Thread-safe.

### Creation

```go
// Empty registry
reg := dd.NewHookRegistry()

// Create from configuration
reg := dd.NewHooksFromConfig(hooksConfig)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Add` | `(event HookEvent, hook Hook)` | Register hook |
| `Remove` | `(event HookEvent)` | Remove all hooks for event |
| `Trigger` | `(ctx, event, hookCtx) error` | Trigger all hooks for event |
| `Clear` | `()` | Clear all hooks |
| `ClearFor` | `(event HookEvent)` | Clear hooks for specified event |
| `SetErrorHandler` | `(handler HookErrorHandler)` | Set error handler |

### Registering Hooks

```go
reg := dd.NewHookRegistry()

// BeforeLog hook
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("About to write log:", hc.Message)
    return nil
})

// AfterLog hook
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate hook
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("File rotation completed",
        dd.String("new_file", hc.Message),
    )
    return nil
})
```

### Managing via Logger

```go
// Add single hook
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// Replace entire registry
_ = logger.SetHooks(reg)

// Get current registry
hooks := logger.GetHooks()
```

## HookContext

Hook context, providing detailed information about the event.

```go
type HookContext struct {
    Event          HookEvent      // Event type
    Level          LogLevel       // Log level
    Message        string         // Log message
    Fields         []Field        // Structured fields (after filtering)
    OriginalFields []Field        // Original fields (before filtering)
    Error          error          // Error information (OnError event)
    Timestamp      time.Time      // Event time
    Writer         io.Writer      // Target Writer (write-related events)
    Metadata       map[string]any // Additional metadata
}
```

## HooksConfig

Structured hook configuration, recommended for batch hook registration.

```go
type HooksConfig struct {
    BeforeLog    []Hook              // Pre-log write hooks
    AfterLog     []Hook              // Post-log write hooks
    OnFilter     []Hook              // Sensitive data filtering hooks
    OnRotate     []Hook              // File rotation hooks
    OnClose      []Hook              // Logger close hooks
    OnError      []Hook              // Write error hooks
    ErrorHandler HookErrorHandler    // Error handler
}
```

```go
cfg := dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // Pre-log processing
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        log.Printf("Hook error: %v\n", err)
    },
}
registry := dd.NewHooksFromConfig(cfg)
```

## Complete Example

### Metrics Collection

```go
reg := dd.NewHookRegistry()
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    logCount.Inc()
    logLevelCounter.WithLabelValues(hc.Level.String()).Inc()
    return nil
})
reg.Add(dd.HookOnError, func(ctx context.Context, hc *dd.HookContext) error {
    errorCount.Inc()
    return nil
})
_ = logger.SetHooks(reg)
```

## Next Steps

- [Logger](./logger) -- AddHook / SetHooks methods
- [Configuration](./config) -- HooksConfig configuration
- [Interface Definitions](./interfaces) -- Hook type definition
