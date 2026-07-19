---
sidebar_label: "Middleware"
title: "Middleware - CyberGo HTTPC | Built-in Middleware"
description: "HTTPC middleware API reference: Chain onion-model composition and eight built-in middleware (Recovery, Logging, Timeout, Metrics, Audit) plus audit config."
sidebar_position: 5
---

# Middleware

:::tip Architecture Overview
This page is the **built-in middleware reference**. For the overall Handler pipeline architecture, the onion model, and writing custom middleware, see [Handler Pipeline / Handler & Middleware Chain](../handler/handler-chain).
:::

HTTPC uses an onion-model middleware architecture, wrapping request handling logic via `MiddlewareFunc`.

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Middleware is configured in `MiddlewareConfig.Middlewares` and executes in order:

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
            httpc.LoggingMiddleware(log.Printf),
            httpc.RequestIDMiddleware("X-Request-ID", nil),
        },
    },
})
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

Combines multiple middleware into a single middleware. Executes in the order passed; the last middleware calls the final Handler when done.

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
)
```

## Built-in Middleware

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

Panic recovery middleware. Catches panics in the processing chain and converts them to errors with stack traces.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
        },
    },
})
```

### LoggingMiddleware

```go
func LoggingMiddleware(log func(format string, args ...any)) MiddlewareFunc
```

Request logging middleware. Logs method, URL, status code, and duration. URLs are automatically masked (credentials removed).

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.LoggingMiddleware(log.Printf),
        },
    },
})
// Output example: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(headerName string, generator func() string) MiddlewareFunc
```

Adds a unique ID to each request. Defaults to a 32-character hex ID generated with `crypto/rand`. If the request already has a header with the same name, the original value is preserved (not overwritten).

| Parameter | Description |
|-----------|-------------|
| `headerName` | Header name, e.g. `"X-Request-ID"` |
| `generator` | Custom ID generation function; pass `nil` for the default cryptographically secure generator |

```go
// Use default generator
middleware := httpc.RequestIDMiddleware("X-Request-ID", nil)

// Use custom generator
middleware := httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

:::tip
The default generator uses `crypto/rand`, producing unpredictable IDs suitable for security-sensitive scenarios.
:::

### TimeoutMiddleware

```go
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc
```

Middleware-level timeout control. Takes effect before the client's built-in timeout; cancels context and returns an error on timeout.

:::warning Do not use for Download or streaming requests
`TimeoutMiddleware`'s `defer cancel()` fires immediately after the handler returns (i.e., once the response headers are received), so for `Download` or `WithStreamBody` requests it cancels the context before the response body is read, producing a "context canceled" error. For streaming/download scenarios, use [`WithTimeout`](../core/options#withtimeout).
:::

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.TimeoutMiddleware(10 * time.Second),
        },
    },
})
```

### HeaderMiddleware

```go
func HeaderMiddleware(headers map[string]string) MiddlewareFunc
```

Adds static headers to every request. Header security is validated at creation time (CRLF injection protection). Conflicts with existing same-name headers will overwrite them.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.HeaderMiddleware(map[string]string{
                "X-API-Version": "v2",
                "X-Client":      "myapp/1.0",
            }),
        },
    },
})
```

### MetricsMiddleware

```go
func MetricsMiddleware(onMetrics func(method, url string, statusCode int, duration time.Duration, err error)) MiddlewareFunc
```

Metrics collection middleware. Invokes the callback after each request completes, passing method, URL, status code, duration, and error.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.MetricsMiddleware(func(method, url string, status int, d time.Duration, err error) {
                metrics.Record(method, status, d, err)
            }),
        },
    },
})
```

### AuditMiddleware

```go
func AuditMiddleware(onAudit func(event AuditEvent)) MiddlewareFunc
```

Security audit middleware, suitable for financial, medical, government, and other compliance scenarios. By default, records request/response metadata (method, URL, status code, duration, retries, etc.) with automatic URL masking; for full headers use [`AuditMiddlewareWithConfig`](#auditmiddlewarewithconfig) with `IncludeHeaders: true`.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddleware(func(event httpc.AuditEvent) {
                log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
                    event.Method, event.URL, event.StatusCode,
                    event.Duration, event.UserID, event.SourceIP)
            }),
        },
    },
})
```

### AuditMiddlewareWithConfig

```go
func AuditMiddlewareWithConfig(onAudit func(event AuditEvent), config *AuditMiddlewareConfig) MiddlewareFunc
```

Configurable security audit middleware.

```go
config := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
                data, _ := json.Marshal(event)
                auditLog.Write(data)
            }, config),
        },
    },
})
```

## Audit Types

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`              // Masked (credentials removed)
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

Security audit event.

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

Custom JSON serialization, handling two special fields:

| Field | Conversion Rule |
|-------|----------------|
| `Duration` | Adds `durationMs` (integer milliseconds), preserves original `duration` field (nanoseconds) |
| `Error` | Converts to `error` (error message string), omitted when nil |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"attempts":0,"durationMs":150}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text" (default) or "json"
    IncludeHeaders bool     // Whether to include request/response headers
    MaskHeaders    []string // Header names to mask
    SanitizeError  bool     // Whether to mask error messages
}
```

| Field | Default | Description |
|-------|---------|-------------|
| Format | `"text"` | Output format |
| IncludeHeaders | `false` | Whether to record headers |
| MaskHeaders | `["Authorization", "Cookie", ...]` | Standard sensitive header list |
| SanitizeError | `true` | Error messages replaced with `[sanitized]` |

### DefaultAuditMiddlewareConfig

```go
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig
```

Returns default audit configuration.

### Audit Context Keys

Pass audit information via request context:

```go
// Set source IP
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// Set user ID
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| Constant | Type | Description |
|----------|------|-------------|
| `SourceIPKey` | `auditContextKey` | Source IP context key |
| `UserIDKey` | `auditContextKey` | User ID context key |

## See Also

- [Interface Definitions](../types/interfaces) - MiddlewareFunc, Handler type definitions
- [Middleware Chain](../../guides/middleware-chain) - Middleware usage guide
- [Constants and Types](../types/constants) - AuditEvent, AuditMiddlewareConfig types
