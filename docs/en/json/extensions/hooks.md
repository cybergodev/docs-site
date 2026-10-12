---
sidebar_label: "Hook System"
title: "Hook System - CyberGo JSON | Intercept, Monitor & Audit"
description: "CyberGo JSON hook system: Hook interface, LoggingHook, TimingHook, ValidationHook, ErrorHook, and custom hooks — Before/After stages with HookContext."
sidebar_position: 20
---

# Hook System

Hooks let you insert custom logic before and after JSON operations — logging, performance monitoring, validation, and more.

:::tip Interface signature reference
For the complete type signatures (`Hook`, `HookContext`, `HookFunc`) see [Interface Definitions](../api-reference/interfaces#hook-interfaces). This page focuses on usage guidance and best practices.
:::

## The Hook Interface

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### Method Description

| Method | Description |
|--------|-------------|
| `Before(ctx HookContext) error` | Invoked before the operation; returning an error aborts it |
| `After(ctx HookContext, result any, err error) (any, error)` | Invoked after the operation; may modify the result or return an error |

---

## The HookContext Struct

HookContext provides contextual information about the operation.

```go
type HookContext struct {
    Operation string      // Operation type: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // Input JSON string (may be empty for marshal). Security warning: may contain sensitive data
    Path      string      // Target path (may be empty for marshal/unmarshal)
    Value     any         // Value for set operations
    Config    *Config     // Active configuration
    StartTime time.Time   // Operation start time
}
```

### Field Description

| Field | Type | Description |
|-------|------|-------------|
| `Operation` | `string` | Operation type; values described below |
| `JSONStr` | `string` | Input JSON string (**security warning: may contain sensitive data**) |
| `Path` | `string` | Target path expression |
| `Value` | `any` | Value for set operations |
| `Config` | `*Config` | The configuration in use |
| `StartTime` | `time.Time` | Operation start time (set before `After` fires; use it to compute duration) |

::: warning Current trigger points
Hooks currently fire on **`Get` / `Set` / `Delete`** (including the package-level wrappers `json.Get`/`json.Set`/`json.Delete`, which share the same Processor path internally). The `Encode`/`Marshal`/`Unmarshal` paths do **not** trigger hooks yet — the `marshal`/`unmarshal` values of `Operation` are reserved; do not rely on them.
:::

:::tip Do not log JSONStr
`JSONStr` may contain passwords, tokens, or PII. Log only `Operation` and `Path`; if you truly must inspect content, parse it at the specific path first and decide then.
:::

---

## The HookFunc Adapter

HookFunc is a struct adapter that lets functions act as hooks — handy when only Before or only After is needed.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### Example

```go
// Only After is needed
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Only Before is needed
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### Choosing Between Hook and HookFunc

| Dimension | Custom type implementing `Hook` | `HookFunc` adapter |
|-----------|----------------------------------|--------------------|
| Carrying state | Struct fields (logger, counters, buffers) | Closure captures |
| One-sided interception only | Must still implement both methods (the other side returns unchanged) | Fill only `BeforeFn` or `AfterFn` |
| Reuse and testing | Standalone type; easy to unit test and instantiate in multiple places | Defined inline; good for one-off logic |
| Best for | Complex/stateful hooks (audit, metric aggregation) | Lightweight hooks (tracing points, simple checks) |

Unset functions in `HookFunc` are no-ops: a missing `BeforeFn` lets the Before phase pass through; a missing `AfterFn` returns the result and error unchanged.

---

## Convenience Hook Factories

### LoggingHook

Creates a logging hook. The parameter only needs to implement `Info(msg string, args ...any)` — `*slog.Logger` satisfies it naturally, and any home-grown logging facade works too.

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

Full example (a custom logger via the minimal interface, verifying one operation triggers both Before + After logs):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// CountingLogger only needs an Info method to serve as LoggingHook's logger
type CountingLogger struct{ calls int }

func (l *CountingLogger) Info(msg string, args ...any) {
	l.calls++
}

func main() {
	logger := &CountingLogger{}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(json.LoggingHook(logger))

	_, err = p.Get(`{"name": "Alice"}`, "name")
	if err != nil {
		panic(err)
	}

	fmt.Println("Log calls:", logger.calls)
	// Output: Log calls: 2  (one each for Before and After)
}
```

### TimingHook

Creates a timing hook recording operation durations. The parameter only needs to implement `Record(op string, duration time.Duration)`, easy to plug into your own metrics system.

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

Full example (aggregating call counts by operation type):

```go
package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/cybergodev/json"
)

// MetricsRecorder implements the Record interface, counting per operation type
type MetricsRecorder struct {
	mu    sync.Mutex
	count map[string]int
}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.count[op]++
}

func main() {
	recorder := &MetricsRecorder{count: make(map[string]int)}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(json.TimingHook(recorder))

	if _, err := p.Get(`{"a": 1}`, "a"); err != nil {
		panic(err)
	}
	if _, err := p.Set(`{"a": 1}`, "b", 2); err != nil {
		panic(err)
	}

	fmt.Println("get timing records:", recorder.count["get"])
	fmt.Println("set timing records:", recorder.count["set"])
	// Output:
	// get timing records: 1
	// set timing records: 1
}
```

### ValidationHook

Creates a validation hook that checks input before the operation. The validator receives `(jsonStr, path)`; returning an error **aborts the operation** (the operation itself never runs).

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

Full example (blocking access to sensitive paths):

```go
package main

import (
	"errors"
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
		if strings.HasPrefix(path, "secret.") {
			return errors.New("access to sensitive path denied: " + path)
		}
		return nil
	}))

	_, err = p.Get(`{"name": "Alice", "secret": {"token": "t"}}`, "name")
	fmt.Println("Normal path rejected:", err != nil)

	_, err = p.Get(`{"name": "Alice", "secret": {"token": "t"}}`, "secret.token")
	fmt.Println("Sensitive path rejected:", err != nil)
	// Output:
	// Normal path rejected: false
	// Sensitive path rejected: true
}
```

### ErrorHook

`ErrorHook` is built on the After phase of `HookFunc` and intercepts errors: the handler runs only when the operation **actually failed** (`err != nil`); successful operations pass straight through. The error the handler returns **replaces** the original when propagated (useful to report and return as-is, or to convert into an externally safe error); returning `nil` swallows the error (the caller sees success) — use that only deliberately.

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Return the original or a transformed error
}))
```

Full example (attaching operation context to errors):

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
		return fmt.Errorf("[audit] op=%s path=%s: %w", ctx.Operation, ctx.Path, err)
	}))

	_, err = p.Get(`{"name": "Alice"}`, "missing")
	fmt.Println("Failed:", err != nil)
	fmt.Println("Context attached:", strings.HasPrefix(err.Error(), "[audit] op=get path=missing"))
	// Output:
	// Failed: true
	// Context attached: true
}
```

---

## Custom Hook Implementations

### Complete Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"log/slog"
	"time"
)

// A logging hook
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

	// Add the custom hook
	p.AddHook(&LoggingHook{logger: slog.Default()})

	// Use the processor...
	val, err := p.Get(`{"name": "test"}`, "name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val)
}
```

### Simplified with HookFunc

```go
// Only completion time needs recording
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## Configuring Hooks

### Adding via Config

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

### Adding via the Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

### Differences Between the Two Routes

| Dimension | `Config.Hooks` / `cfg.AddHook` | `Processor.AddHook` |
|-----------|--------------------------------|---------------------|
| When they take effect | Loaded once at `json.New(cfg)` **construction** (defensively copied) | Appended anytime at runtime |
| Mutating `Config` afterwards | Does not affect the created Processor | — |
| Concurrency safety | Single-threaded configuration before construction suffices | Concurrent calls protected by a mutex |
| Lifecycle | Lives with the Processor | Hook references are cleared and released at `Close()` |

Use `Config` for static assembly (all hooks known at startup); use `Processor.AddHook` for runtime enable/disable (e.g. feature-flag rollouts).

---

## Execution Order

### Before Hooks

- Run in **addition order**
- Any hook returning an error aborts the operation

### After Hooks

- Run in **reverse addition order**
- Every hook runs (even if a previous one returned an error)

```go
// Added in order: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// Execution order:
// Before: A.Before -> B.Before -> C.Before
// After:  C.After -> B.After -> A.After
```

### Result Rewriting and Panic Safety

- `Get`'s `After` may return a new result of any type; `Set`/`Delete` results are JSON **strings**, and a non-string return from `After` is treated as unmodified (the original string is kept) while errors still propagate normally.
- Hook **panics never take down the operation**: a Before-phase panic becomes a `hook panicked: ...` error aborting that operation; an After-phase panic is logged to structured logs (slog) and skipped, leaving the result untouched.
- A Processor with no registered hooks takes a lock-free fast path — the hook machinery adds no overhead.

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

### 5. Audit Logging (Full Walkthrough)

Record only the operation type, path, and outcome of write operations (`set`/`delete`) — never the `JSONStr` content itself:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

// AuditHook records write-operation audit entries (in-memory slice for the
// demo; replace with slog/a database in production)
type AuditHook struct {
	entries []string
}

func (h *AuditHook) Before(ctx json.HookContext) error {
	return nil // Audit only observes; never intercepts
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
	switch ctx.Operation {
	case "set", "delete":
		h.entries = append(h.entries,
			fmt.Sprintf("op=%s path=%s ok=%v", ctx.Operation, ctx.Path, err == nil))
	}
	return result, err
}

func main() {
	audit := &AuditHook{}

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()
	p.AddHook(audit)

	data := `{"env": "prod", "password": "hunter2", "token": "t-1"}`

	data, err = p.Set(data, "password", nil)
	if err != nil {
		panic(err)
	}
	data, err = p.Delete(data, "token")
	if err != nil {
		panic(err)
	}

	for _, e := range audit.entries {
		fmt.Println(e)
	}
	// Output:
	// op=set path=password ok=true
	// op=delete path=token ok=true
}
```

Production advice: swap `entries` for a `*slog.Logger` (`slog.Info("data modification", "op", ..., "path", ..., "success", ...)`) or asynchronous writes to an audit store; add a [`TimingHook`](#timinghook) when timing information is also needed.

---

## See Also

- [Interface Definitions](../api-reference/interfaces) - Extension interfaces
- [Schema Validation](../api-reference/schema) - Schema validation
- [Config](../api-reference/config) - Configuration options
