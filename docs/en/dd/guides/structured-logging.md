---
sidebar_label: "Structured Logging"
title: "Structured Logging - CyberGo DD | Fields and Chaining"
description: "CyberGo DD structured logging: 20+ type-safe field constructors, Field chaining, LoggerEntry immutability, naming conventions, and best practices."
sidebar_position: 2
---

# Structured Logging

Structured logging records contextual information through key-value pair fields, making logs machine-parseable, searchable, and analyzable. DD provides type-safe field constructors and a flexible chaining mechanism.

## Field Constructors

DD provides 20+ type-safe field constructors:

### Basic Types

```go
dd.InfoWith("user registration",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### Time-Related

```go
dd.InfoWith("scheduled task executed",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### Integer Type Family

```go
dd.InfoWith("packet processing",
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
dd.ErrorWith("critical error", dd.ErrWithStack(err))
```

### Any Type

```go
// Any type, formatted via fmt.Sprintf
dd.InfoWith("request payload", dd.Any("body", requestBody))
```

:::warning Performance Note
`Any` uses reflection and is slower than type-specific constructors. Prefer concrete types on high-frequency code paths.
:::

## Chaining

### Logger to Entry

```go
// Create an Entry with preset fields
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry automatically carries preset fields
reqLog.Info("service started")
reqLog.Warn("high memory usage")
reqLog.ErrorWith("request failed",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry to Entry (Multi-Level Nesting)

```go
// Service level
svcLog := logger.WithFields(dd.String("service", "order"))

// Module level (inherits service-level fields)
dbLog := svcLog.WithFields(dd.String("module", "database"))

// Operation level (inherits all parent fields)
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("query completed",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// Fields: service=order module=database operation=query rows=42 elapsed=10ms
```

### Package-Level Function Chaining

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("application started")
```

## Field Naming Conventions

DD supports configurable field naming conventions with automatic checking during development:

### Built-in Conventions

```go
// snake_case (recommended, most universal)
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

When enabled, non-compliant field names produce warnings in the log output:

```go
logger.InfoWith("test",
    dd.String("UserName", "alice"),   // PascalCase → warning
    dd.String("user_name", "alice"),  // snake_case → normal
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

### Service Layered Logging

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
    s.log.InfoWith("creating user",
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
// Method 1: Check level first
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("debug data", dd.Any("data", data))
}

// Method 2: Use WithFields lazy evaluation
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields only constructs fields, no I/O overhead
// Only when Info/Error etc. are actually called does the log get written
```

## Output Formats

### Text Format (Default)

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 request completed method=GET status=200 elapsed=150ms
```

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
{"timestamp":"2026-04-16T21:16:48+08:00","level":"info","caller":"main.go:13","message":"request completed","fields":{"method":"GET","status":200}}
```

## Next Steps

- [File Output and Rotation](./file-output) -- Writing logs to files
- [Sensitive Data Filtering](./sensitive-filtering) -- Automatic redaction of sensitive information
- [API Reference - Fields](../api-reference/output-integration/fields) -- All field constructors
- [API Reference - LoggerEntry](../api-reference/core/entry) -- Entry complete methods
