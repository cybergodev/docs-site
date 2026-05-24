---
title: "Hook System - CyberGo JSON | API Reference"
description: "CyberGo JSON hook system complete reference: Hook interface definition, LoggingHook logging, TimingHook performance timing, ValidationHook data validation, ErrorHook error handling, and custom hook implementation, supporting custom logic insertion before and after JSON operations."
---

# Hook System

Hooks allow inserting custom logic before and after JSON operations, enabling logging, performance monitoring, validation, and more.

## Hook Interface

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### Method Description

| Method | Description |
|--------|-------------|
| `Before(ctx HookContext) error` | Called before the operation; returning an error aborts the operation |
| `After(ctx HookContext, result any, err error) (any, error)` | Called after the operation; can modify the result or return an error |

---

## HookContext Struct

HookContext provides context information about the operation.

```go
type HookContext struct {
    Operation string      // Operation type: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // Input JSON string (may be empty during marshal)
    Path      string      // Target path (may be empty during marshal/unmarshal)
    Value     any         // Value for set operations
    Config    *Config     // Active configuration
    StartTime time.Time   // Operation start time
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Operation` | `string` | Operation type, values: `get`, `set`, `delete`, `marshal`, `unmarshal` |
| `JSONStr` | `string` | Input JSON string |
| `Path` | `string` | Target path expression |
| `Value` | `any` | Value for set operations |
| `Config` | `*Config` | Currently used configuration |
| `StartTime` | `time.Time` | Operation start time |

---

## HookFunc Adapter

HookFunc is a struct adapter that allows using functions as Hooks. Suitable for scenarios where only Before or After is needed.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### Example

```go
// Only need After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Only need Before
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

---

## Convenience Hook Factory Functions

### LoggingHook

Creates a logging Hook.

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### TimingHook

Creates a timing Hook that records operation duration.

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

### ValidationHook

Creates a validation Hook that validates input before operations.

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

### ErrorHook

Creates an error handling Hook that intercepts and handles errors.

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Return original or transformed error
}))
```

---

## Custom Hook Implementation

### Complete Example

```go
package main

import (
    "fmt"
    "log/slog"
    "time"
    "github.com/cybergodev/json"
)

// Logging Hook
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "op", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err)
    return result, err
}

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()
    
    // Add custom Hook
    p.AddHook(&LoggingHook{logger: slog.Default()})
    
    // Use processor...
    val, err := p.Get(`{"name": "test"}`, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val)
}
```

### Simplified with HookFunc

```go
// Only need to record completion time
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## Configuring Hooks

### Via Config

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### Via Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

---

## Execution Order

### Before Hooks

- Executed in **addition order**
- Any Hook returning an error aborts the operation

### After Hooks

- Executed in **reverse addition order**
- Every Hook executes (even if previous ones return errors)

```go
// Addition order: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// Execution order:
// Before: A.Before -> B.Before -> C.Before
// After:  C.After -> B.After -> A.After
```

---

## Best Practices

### 1. Logging

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. Performance Monitoring

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. Input Validation

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. Error Tracking

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. Audit Logging

```go
type AuditHook struct {
    auditLogger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if ctx.Operation == "set" || ctx.Operation == "delete" {
        h.auditLogger.Info("data modification",
            "operation", ctx.Operation,
            "path", ctx.Path,
            "success", err == nil)
    }
    return result, err
}
```

---

## See Also

- [Interfaces](./interfaces) - Extension interfaces
- [Validator](./validator) - Validators
- [Config](./config) - Configuration options
