---
sidebar_label: "Structured Logging"
title: "Structured Logging - CyberGo DD | Fields & Chaining"
description: "CyberGo DD structured logging guide, covering 20 type-safe field constructors, the Field chaining pattern, LoggerEntry immutable design, field-naming conventions and validation rules, plus structured-logging best practices and common usage patterns to help you use high-performance structured logging effectively in your project."
sidebar_position: 2
---

# Structured Logging

Structured logging records context information as key-value field pairs, making logs parseable, searchable, and analyzable. DD provides type-safe field constructors and a flexible chaining mechanism.

## Field Constructors

DD provides 20 type-safe field constructors:

### Basic Types

```go
dd.InfoWith("user registration",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### Time-related

```go
dd.InfoWith("scheduled task executed",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### Integer Family

```go
dd.InfoWith("packet processed",
    dd.Int8("flags", 0x0F),
    dd.Int32("seq", 1001),
    dd.Int64("total_bytes", 1<<20),
    dd.Uint16("port", 8080),
    dd.Uint32("src_ip", 0xC0A80101),
)
```

### Error Handling

```go
// Default key is "error"
dd.ErrorWith("query failed", dd.Err(err))

// Custom key
dd.ErrorWith("database error", dd.ErrWithKey("db_error", dbErr))

// With stack trace
dd.ErrorWith("severe error", dd.ErrWithStack(err))
```

### Any Type

```go
// Any type, formatted via fmt.Sprintf
dd.InfoWith("request payload", dd.Any("body", requestBody))
```

:::warning Performance Note
`Any` has no extra overhead for primitive types (int/string/bool/time, etc.); for complex types like struct/map/slice, the filtering and formatting stages require reflection and are slower than type-specific constructors. Prefer concrete types on hot paths.
:::

## Chaining

### Logger -> Entry

```go
// Create an Entry with preset fields
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry automatically carries preset fields
reqLog.Info("service started")
reqLog.Warn("memory usage high")
reqLog.ErrorWith("request failed",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry -> Entry (Multi-layer Nesting)

```go
// Service-level
svcLog := logger.WithFields(dd.String("service", "order"))

// Module-level (inherits service-level fields)
dbLog := svcLog.WithFields(dd.String("module", "database"))

// Operation-level (inherits all upper-layer fields)
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("query completed",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// Fields: service=order module=database operation=query rows=42 elapsed=10ms
```

### Package-level Function Chaining

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("application started")
```

## Field Naming Conventions

DD supports configurable field-naming conventions that are automatically checked during development:

### Built-in Conventions

```go
// snake_case (recommended; most universal)
cfg := dd.StrictSnakeCaseConfig()

// camelCase
cfg := dd.StrictCamelCaseConfig()

// No restriction (default)
cfg := dd.DefaultFieldValidationConfig()
```

### Enabling in Configuration

```go
logger, err := dd.New(dd.Config{
    FieldValidation: dd.StrictSnakeCaseConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

Once enabled, non-conforming field names produce an error (Strict mode) or warning (Warn mode) on **stderr**; the log line itself is unaffected:

```go
logger.InfoWith("test",
    dd.String("UserName", "alice"),   // PascalCase -> triggers an stderr error (log is still written)
    dd.String("user_name", "alice"),  // snake_case -> OK
)
```

## Common Patterns

### HTTP Request Logging

```go
func loggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            reqLog := logger.WithFields(
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
                dd.String("user_agent", r.UserAgent()),
            )

            next.ServeHTTP(w, r)

            reqLog.InfoWith("request completed",
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}
```

### Service-Layered Logging

```go
type UserService struct {
    log *dd.LoggerEntry
}

func NewUserService(logger *dd.Logger) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
    }
}

func (s *UserService) CreateUser(ctx context.Context, name string) error {
    s.log.InfoWith("create user",
        dd.String("name", name),
    )

    if err := s.validate(name); err != nil {
        s.log.ErrorWith("user creation failed",
            dd.String("name", name),
            dd.Err(err),
        )
        return err
    }

    return nil
}
```

### Conditional Logging (Avoiding Unnecessary Computation)

```go
// Option 1: check level first
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("debug data", dd.Any("data", data))
}

// Option 2: use WithFields' lazy-computation property
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields only constructs fields, no I/O cost
// Only an actual call to Info/Error etc. writes the log
```

## Output Format

### Text Format (Default)

```text
[2026-04-16T21:16:48+08:00   INFO] logger.go:1567 request completed method=GET status=200 elapsed=150ms
```

:::info caller field note
The `caller` field records the call site; when called via `*Logger` methods (e.g. `logger.InfoWith(...)`), the caller resolves to an internal library call frame (e.g. `logger.go:1567`); when called via package-level functions (e.g. `dd.InfoWith`), it resolves to user code.
:::

### JSON Format

```go
logger, err := dd.New(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
logger.InfoWith("request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

```json
{"timestamp":"2026-04-16T21:16:48+08:00","level":"INFO","caller":"logger.go:1567","message":"request completed","fields":{"method":"GET","status":200}}
```

## Next Steps

- [File Output & Rotation](./file-output) -- Writing logs to files
- [Sensitive Data Filtering](./sensitive-filtering) -- Auto-redacting sensitive information
- [API Reference - Fields](../api-reference/output-integration/fields) -- All field constructors
- [API Reference - LoggerEntry](../api-reference/core/entry) -- Complete Entry methods
