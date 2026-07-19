---
sidebar_label: "Core Concepts"
title: "Core Concepts - CyberGo DD | Architecture & Design"
description: "Deep dive into the core architecture and design philosophy of the CyberGo DD logging library, including the relationship and lifecycle of Logger and LoggerEntry, type-safe usage patterns for structured Field, the complete log-processing pipeline, the four-layer progressive interface design, and the thread-safe concurrency model, helping you build a systematic understanding of the DD library."
sidebar_position: 1
---

# Core Concepts

Understanding DD's core concepts is the foundation for using the library effectively. This chapter introduces the Logger hierarchy, the field system, the processing pipeline, and the interface hierarchy.

## Logger Hierarchy

DD's logging revolves around three core types:

```text
Logger (logger)
  │
  ├── Direct use -> logger.Info("message")
  │
  └── WithFields() -> LoggerEntry (Entry with preset fields)
                        │
                        └── entry.Info("message")  // Automatically carries preset fields
```

### Logger

`Logger` is the core logger, created by `dd.New()`:

```go
logger, err := dd.New(dd.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

logger.Info("service started")
logger.InfoWith("request processed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

Each Logger has its own configuration, output targets, security filter, and lifecycle, and can be safely shared across modules.

### LoggerEntry

`LoggerEntry` is created via `WithFields()` and is an immutable preset-field container:

```go
// Create an Entry with preset fields
requestLog := logger.WithFields(
    dd.String("service", "user-api"),
    dd.String("version", "2.1.0"),
)

// Each call automatically carries the preset fields
requestLog.Info("service started")
// Output: ... service started service=user-api version=2.1.0

requestLog.InfoWith("user login",
    dd.String("user", "alice"),
)
// Output: ... user login service=user-api version=2.1.0 user=alice
```

:::tip Immutable design
Each call to `WithFields()` creates a new `LoggerEntry`; existing Entries are unaffected. This means you can safely reuse the same Entry across goroutines.
:::

### Global Logger

DD provides a global logger suitable for simple scenarios or quick prototyping:

```go
// Use package-level functions directly (via the global Logger)
dd.Info("global log")

// Equivalent to
dd.Default().Info("global log")
```

## Field System

### Field Type

`Field` is the basic unit of structured logs, consisting of key-value pairs:

```go
// Field constructors cover all common types
dd.String("method", "GET")           // String
dd.Int("status", 200)                // Integer
dd.Float64("latency", 0.123)         // Floating point
dd.Bool("success", true)             // Boolean
dd.Duration("elapsed", 150*time.Millisecond) // Duration
dd.Time("timestamp", time.Now())     // Timestamp
dd.Err(err)                          // Error (key is fixed to "error")
dd.ErrWithKey("db_error", err)       // Error (custom key)
dd.Any("data", payload)              // Any type
```

### Field Chaining

Fields can be propagated through the Logger and Entry layers:

```go
// Layer 1: service-level fields
serviceLog := logger.WithFields(
    dd.String("service", "api-gateway"),
)

// Layer 2: request-level fields (appended to service-level)
requestLog := serviceLog.WithFields(
    dd.String("request_id", "req-001"),
    dd.String("path", "/api/users"),
)

// Layer 3: actual log (more fields appended)
requestLog.InfoWith("processing complete",
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)
// Output includes: service=api-gateway request_id=req-001 path=/api/users status=200 elapsed=50ms
```

## Log Processing Pipeline

Each log goes through the following processing flow:

```text
User calls logger.InfoWith("msg", fields...)
       │
       ▼
  (1) Level check --- Level not enabled -> return immediately (zero overhead)
       │
       ▼
  (2) Security filtering --- Sensitive data in message and fields -> [REDACTED]
       │
       ▼
  (3) Context extraction -- Calls registered extractors to attach static/global fields (invoked with context.Background(); cannot read request-scoped TraceID)
       │
       ▼
  (4) BeforeLog hook
       │
       ▼
  (5) Formatting --- Text format or JSON format
       │
       ▼
  (6) Security size limit --- Truncated if exceeds Security.MaxMessageSize (0 means no limit)
       │
       ▼
  (7) Write ---- Output to one or more Writers
       │
       ▼
  (8) AfterLog hook
       │
       ▼
  (9) Fatal handling -- LevelFatal only: asynchronously Close the Logger first (up to 5s wait, triggers OnClose hook and flushes the writer), then calls os.Exit(1) or a custom FatalHandler
```

:::info Performance Design
The level check (step 1) uses atomic operations without locking, at nearly zero cost. Security filtering (step 2) has timeout protection to avoid blocking the main flow for long (large inputs are guaranteed to return within ~50ms worst case via a goroutine + timeout). Fatal handling (step 9) asynchronously triggers the Logger's Close (including flush and OnClose hook), waiting up to 5s; deferred functions in the user's main still do not run, but the Logger's own Close is called.
:::

## Interface Hierarchy

DD defines four interfaces supporting precise dependency injection:

```text
CoreLogger                    <- Basic logging: Debug/Info/Warn/Error/Fatal + WithFields
    │
    ├── LevelLogger           <- Level management: GetLevel/SetLevel/IsLevelEnabled (embeds CoreLogger)
    │
    └── ConfigurableLogger    <- Config management: Writer/security/context/hooks (embeds CoreLogger)

LogProvider                   <- Full feature set: a standalone flat interface containing all methods
```

```go
// Only need basic logging? Inject CoreLogger
type Service struct {
    log dd.CoreLogger
}

// Need dynamic level adjustment? Inject LevelLogger
type Handler struct {
    log dd.LevelLogger
}
```

:::tip Best Practice
In constructors, accept the smallest necessary interface rather than the concrete type. This makes your code easier to test and more flexible.
:::

## Thread-Safety Model

A core design principle of DD: **safe concurrent use across goroutines, with no extra synchronization**.

| Component | Safety mechanism |
|-----------|------------------|
| Logger | All methods are safe for concurrent use |
| LoggerEntry | Immutable; read-only after creation |
| Config | Clone() method for safe copying |
| Writers | Atomic pointers; lock-free reads |
| SensitiveDataFilter | Read/write separation; independent goroutine |
| HookRegistry | RWMutex guarding registration and reads (the Logger holds its pointer via `atomic.Value`) |

```go
// Safe: multiple goroutines share the same Logger
var logger *dd.Logger  // Initialize once

func handleRequest(w http.ResponseWriter, r *http.Request) {
    // Safe: concurrent calls
    logger.InfoWith("request received",
        dd.String("path", r.URL.Path),
        dd.String("method", r.Method),
    )
}
```

## Output Target System

DD supports three output targets that can be combined freely:

```go
logger, err := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),                    // Console
        dd.FileOutput("logs/app.log"),         // File (auto-rotating)
        dd.CustomOutput(customWriter),         // Custom io.Writer
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

Built-in Writer components:

| Component | Use |
|-----------|-----|
| `FileWriter` | File writing + size/time rotation + compression |
| `BufferedWriter` | Buffered writes, reducing I/O count |
| `MultiWriter` | Multi-target fan-out, writing to multiple Writers |

## Next Steps

- [Structured Logging](./structured-logging) -- Field usage in depth
- [File Output & Rotation](./file-output) -- File logging configuration
- [Sensitive Data Filtering](./sensitive-filtering) -- Security filtering in practice
- [API Reference](../api-reference/) -- Complete API documentation
