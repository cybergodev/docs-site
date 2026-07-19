---
sidebar_label: "HookRegistry"
title: "Hook System - CyberGo DD | HookRegistry"
description: "Complete API documentation for CyberGo DD's lifecycle hook system. Register custom callbacks on key events such as before/after log writes (BeforeLog/AfterLog), file rotation (OnRotate), and error occurrence (OnError). Provides the HookRegistry registry and a flexible logging-extension mechanism."
sidebar_position: 1
---

# Hook System

DD provides an event-based hook system that allows inserting custom logic at key points of the log lifecycle.

## Hook Events

| Constant | String() | When triggered |
|----------|----------|----------------|
| `HookBeforeLog` | `"BeforeLog"` | Before a log is written |
| `HookAfterLog` | `"AfterLog"` | After a log is written |
| `HookOnFilter` | `"OnFilter"` | When sensitive data is filtered |
| `HookOnRotate` | `"OnRotate"` | When a file is rotated |
| `HookOnClose` | `"OnClose"` | When the logger is closed |
| `HookOnError` | `"OnError"` | When an error occurs |

## Hook Function Types

### Hook

```go
type Hook func(ctx context.Context, hookCtx *HookContext) error
```

Hook function signature. Invoked when a log-lifecycle event is triggered.

- When a `BeforeLog` hook returns an error, **the log entry is not written**.
- For other events, a returned error by default stops subsequent hook execution; if an error handler is set (see `HookErrorHandler`), the error is instead passed to the handler and all hooks still execute.
- Panics inside hooks are caught by `HookRegistry` and converted to errors, avoiding application crashes.

### HookErrorHandler

```go
type HookErrorHandler func(event HookEvent, hookCtx *HookContext, err error)
```

Hook error-handler signature.

Parameters:

- `event`: the hook event type that triggered the error
- `hookCtx`: the context passed to the hook
- `err`: the error returned by the hook (or converted from a panic)

Once an error handler is set (via `HookRegistry.SetErrorHandler` or `HooksConfig.ErrorHandler`), `Trigger` runs all hooks instead of stopping on the first error; each error is passed to the handler. **Exception**: for the `BeforeLog` event, even with a handler set, a returned error still prevents the log from being written. The handler itself should not panic; if it does, the panic is recovered and printed to stderr.

## HookRegistry

Hook registry, managing hook registration and triggering. Thread-safe.

### Creation

```go
// Empty registry
reg := dd.NewHookRegistry()

// From config
reg := dd.NewHooksFromConfig(hooksConfig)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Add` | `(event HookEvent, hook Hook)` | Register a hook |
| `Remove` | `(event HookEvent)` | Remove all hooks for an event |
| `Trigger` | `(ctx, event, hookCtx) error` | Trigger all hooks for an event |
| `Clear` | `()` | Clear all hooks |
| `ClearFor` | `(event HookEvent)` | Clear hooks for the specified event |
| `SetErrorHandler` | `(handler HookErrorHandler)` | Set the error handler |

### Registering Hooks

```go
reg := dd.NewHookRegistry()

// BeforeLog hook
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("about to write log:", hc.Message)
    return nil
})

// AfterLog hook
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate hook
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("file rotation completed",
        dd.String("path", hc.Metadata["path"].(string)),
    )
    return nil
})
```

### Managing via Logger

```go
// Add a single hook
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// Replace the entire registry
_ = logger.SetHooks(reg)

// Get the current registry
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
    Error          error          // Error info (OnError event)
    Timestamp      time.Time      // Event time
    Writer         io.Writer      // Target Writer (write-related events)
    Metadata       map[string]any // Extra metadata
}
```

## HooksConfig

Structured hook configuration, recommended for batch hook registration.

```go
type HooksConfig struct {
    BeforeLog    []Hook              // Pre-write hooks
    AfterLog     []Hook              // Post-write hooks
    OnFilter     []Hook              // Hooks for sensitive-data filtering
    OnRotate     []Hook              // Hooks for file rotation
    OnClose      []Hook              // Hooks for logger close
    OnError      []Hook              // Hooks for write errors
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
        log.Printf("hook error: %v\n", err)
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

- [Logger](../core/logger) -- AddHook / SetHooks methods
- [Config](../core/config) -- HooksConfig configuration
- [Interfaces](../core/interfaces) -- Hook type definitions
