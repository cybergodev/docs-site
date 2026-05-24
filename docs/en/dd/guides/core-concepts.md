---
title: "Core Concepts - CyberGo DD | Architecture Design"
description: "CyberGo DD core architecture: Logger and LoggerEntry lifecycle, structured Field patterns, processing pipeline, interfaces, and concurrency model."
---

# Core Concepts

Understanding DD's core concepts is the foundation for effective use of this library. This chapter covers the Logger hierarchy, field system, processing pipeline, and interface layers.

## Logger Hierarchy

DD's logging revolves around three core types:

```text
Logger (Log Recorder)
  │
  ├── Direct use → logger.Info("message")
  │
  └── WithFields() → LoggerEntry (Entry with preset fields)
                        │
                        └── entry.Info("message")  // Automatically carries preset fields
```

### Logger

`Logger` is the core log recorder, created by `dd.New()`:

```go
logger, _ := dd.New(dd.DefaultConfig())
defer logger.Close()

logger.Info("Service started")
logger.InfoWith("Request processed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

Each Logger has independent configuration, output targets, security filters, and lifecycle, and can be safely shared across modules.

### LoggerEntry

`LoggerEntry` is created through `WithFields()` and is an immutable preset field container:

```go
// Create an Entry with preset fields
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// Each call automatically carries preset fields
requestLog.Info("Service started")
// Output: ... Service started service=user-api version=2.1.0

requestLog.InfoWith("User login",
    dd.String("user", "alice"),
)
// Output: ... User login service=user-api version=2.1.0 user=alice
```

:::tip Immutable Design
Each call to `WithFields()` creates a new `LoggerEntry`, leaving the original Entry unaffected. This means you can safely reuse the same Entry across different goroutines.
:::

### Global Logger

DD provides a global logger suitable for simple scenarios or quick prototyping:

```go
// Use package-level functions directly (via global Logger)
dd.Info("Global log")

// Equivalent to
dd.Default().Info("Global log")
```

## Field System

### Field Types

`Field` is the fundamental unit of structured logging, composed of key-value pairs:

```go
// Field constructors cover all common types
dd.String("method", "GET")           // String
dd.Int("status", 200)                // Integer
dd.Float64("latency", 0.123)         // Float
dd.Bool("success", true)             // Boolean
dd.Duration("elapsed", 150*time.Millisecond) // Duration
dd.Time("timestamp", time.Now())     // Timestamp
dd.Err(err)                          // Error (key is always "error")
dd.ErrWithKey("db_error", err)       // Error (custom key)
dd.Any("data", payload)              // Any type
```

### Field Chain Propagation

Fields can be propagated layer by layer between Logger and Entry:

```go
// Layer 1: Service-level fields
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// Layer 2: Request-level fields (appended to service-level)
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// Layer 3: Actual log (appending more fields)
requestLog.InfoWith("Processing completed",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// Output includes: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## Log Processing Pipeline

Each log entry goes through the following processing flow:

```text
User calls logger.InfoWith("msg", fields...)
       │
       ▼
  ① Level check ─── Level not enabled → return immediately (zero overhead)
       │
       ▼
  ② Security filtering ─── Sensitive data in messages and fields → [REDACTED]
       │
       ▼
  ③ Context extraction ── Extract TraceID/SpanID etc. from registered extractors
       │
       ▼
  ④ BeforeLog hook ── Can modify fields or abort logging
       │
       ▼
  ⑤ Formatting ──── Text format or JSON format
       │
       ▼
  ⑥ Security size limit ─── Truncate if exceeds Security.MaxMessageSize (0 means no limit)
       │
       ▼
  ⑦ Write ────── Output to one or more Writers
       │
       ▼
  ⑧ AfterLog hook
       │
       ▼
  ⑨ Fatal handling ── Only LevelFatal, calls os.Exit or custom FatalHandler
```

:::info Performance Design
The level check (step 1) uses atomic operations without locking, resulting in nearly zero overhead. Security filtering (step 2) processes small inputs synchronously and uses independent goroutines with timeout protection for large inputs, without blocking the main flow.
:::

## Logger Type

The `Logger` type provides the full set of logging capabilities:

```go
// Basic logging
logger.Info("message")
logger.InfoWith("message", dd.String("key", "value"))

// Level management
logger.GetLevel()
logger.SetLevel(dd.LevelDebug)
logger.IsDebugEnabled()

// Configuration management
logger.AddWriter(w)
logger.SetSecurityConfig(cfg)
logger.AddContextExtractor(ext)
logger.AddHook(dd.HookBeforeLog, hook)

// Lifecycle
logger.Close()
logger.Shutdown(ctx)
logger.Flush()
```

:::tip Best Practice
Share a single `*dd.Logger` across your application. All methods are safe for concurrent use. Use `WithFields()` to create request-scoped `LoggerEntry` instances with contextual fields.
:::

## Thread Safety Model

A core design principle of DD: **safe for concurrent use across multiple goroutines, no additional synchronization needed**.

| Component | Safety Mechanism |
|-----------|-----------------|
| Logger | All methods are safe for concurrent calls |
| LoggerEntry | Immutable, read-only after creation |
| Config | Clone() method for safe copying |
| Writers | Atomic pointers, lock-free reads |
| SensitiveDataFilter | Read-write separation, dedicated goroutine |
| HookRegistry | Mutex-protected registration, atomic read execution |

```go
// Safe: multiple goroutines share the same Logger
var logger *dd.Logger  // Initialize once

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // Safe: concurrent calls
    logger.InfoWith("Request received",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## Output Target System

DD supports three output targets that can be freely combined:

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // Console
        dd.FileOutput("logs/app.log"),         // File (auto-rotation)
        dd.CustomOutput(customWriter),         // Custom io.Writer
    },
})
```

Built-in Writer components:

| Component | Purpose |
|-----------|---------|
| `FileWriter` | File writing + size/time rotation + compression |
| `BufferedWriter` | Buffered writing, reducing I/O operations |
| `MultiWriter` | Multi-target dispatch, writing to multiple Writers |

## Next Steps

- [Structured Logging](./structured-logging) -- Field usage in detail
- [File Output and Rotation](./file-output) -- File logging configuration
- [Sensitive Data Filtering](./sensitive-filtering) -- Security filtering in practice
- [API Reference](../api-reference/) -- Complete API documentation
