---
sidebar_label: "Built-in Middleware"
title: "Middleware - CyberGo HTTPC | Seven Built-in Middleware"
description: "HTTPC middleware API: Chain composition, seven built-in middleware (Recovery, Logging, Timeout, Metrics, Audit), config structs, and AuditEvent."
sidebar_position: 5
---

# Middleware

:::tip
This page is the **built-in middleware reference**. For the overall Handler-pipeline architecture, the onion model, and writing custom middleware, see [Handler Pipeline / Handler & Middleware Chain](../handler/handler-chain).
:::

HTTPC uses an onion-model middleware architecture, wrapping request-handling logic via `MiddlewareFunc`.

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Middleware is configured in `MiddlewareConfig.Middlewares` and executes in order. Each middleware factory accepts a `*XxxConfig` configuration pointer; pass `nil` to use the default config:

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
}
client, err := httpc.New(cfg)
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

Combines multiple middleware into a single middleware. Executes in the order passed; the last middleware calls the final Handler when done.

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
)
```

## Built-in Middleware

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

Panic-recovery middleware. Catches panics in the processing chain and converts them to errors containing stack traces.

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
}
client, _ := httpc.New(cfg)
```

### LoggingMiddleware

```go
func LoggingMiddleware(config *LoggingConfig) MiddlewareFunc
```

Request-logging middleware. Logs method, URL, status code, and duration. URLs are automatically masked (credentials removed). Pass `nil` to use [`DefaultLoggingConfig()`](#defaultloggingconfig) (logging disabled).

#### LoggingConfig

```go
type LoggingConfig struct {
    // LogFunc receives a formatted log message (similar to log.Printf).
    // When nil, logging is disabled.
    LogFunc func(format string, args ...any)
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `LogFunc` | `nil` | Log output function; when nil, logging is disabled |

#### DefaultLoggingConfig

```go
func DefaultLoggingConfig() *LoggingConfig
```

Returns a default config with logging disabled. Set the `LogFunc` field to enable logging.

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
}
client, _ := httpc.New(cfg)
// Output example: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(config *RequestIDConfig) MiddlewareFunc
```

Adds a unique ID to each request. Pass `nil` to use [`DefaultRequestIDConfig()`](#defaultrequestidconfig) (`"X-Request-ID"` header + `crypto/rand` generator). If the request already has a header with the same name, the original value is preserved (not overwritten).

:::tip
The default generator uses `crypto/rand`, producing unpredictable IDs suitable for security-sensitive scenarios.
:::

#### RequestIDConfig

```go
type RequestIDConfig struct {
    // HeaderName is the HTTP header name for the request ID.
    // Default: "X-Request-ID".
    HeaderName string

    // Generator produces the request ID string. When nil, a cryptographically
    // secure random generator is used (crypto/rand, 16-byte hex-encoded).
    Generator func() string
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `HeaderName` | `"X-Request-ID"` | Request header name |
| `Generator` | `nil` (crypto/rand) | ID generation function; when nil, uses a cryptographically secure generator |

#### DefaultRequestIDConfig

```go
func DefaultRequestIDConfig() *RequestIDConfig
```

Returns the default config: `HeaderName` is `"X-Request-ID"`, `Generator` is nil (falls back to `crypto/rand` at runtime).

```go
// Using default config
middleware := httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig())

// Using a custom header name
middleware := httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    HeaderName: "X-Correlation-ID",
})

// Using a custom generator
middleware := httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    Generator: func() string {
        return uuid.New().String()
    },
})
```

### TimeoutMiddleware

```go
func TimeoutMiddleware(config *TimeoutMiddlewareConfig) MiddlewareFunc
```

Middleware-level timeout control. Pass `nil` to use [`DefaultTimeoutMiddlewareConfig()`](#defaulttimeoutmiddlewareconfig) (timeout disabled; middleware is a pass-through). If set to a positive value, it takes effect before the client's built-in timeout; on timeout it cancels the context and returns an error.

:::warning
`TimeoutMiddleware`'s `defer cancel()` fires immediately after the handler returns (i.e. once the response headers are received), so for `Download` or `WithStreamBody` requests it cancels the context before the response body is read, producing a "context canceled" error. For streaming/download scenarios, use [`WithTimeout`](../core/options#withtimeout) instead.
:::

#### TimeoutMiddlewareConfig

```go
type TimeoutMiddlewareConfig struct {
    // Duration is the maximum time allowed for the request. Zero or negative
    // disables the timeout (the middleware passes the request through unchanged).
    // Default: 0 (disabled).
    Duration time.Duration
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `Duration` | `0` | Timeout duration; zero or negative disables it |

The type name includes `Middleware` to distinguish it from the client-level `TimeoutConfig` in `types.go`.

#### DefaultTimeoutMiddlewareConfig

```go
func DefaultTimeoutMiddlewareConfig() *TimeoutMiddlewareConfig
```

Returns a default config with timeout disabled. Set `Duration` to a positive value to enable the timeout.

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{
        Duration: 10 * time.Second,
    }),
}
client, _ := httpc.New(cfg)
```

### HeaderMiddleware

```go
func HeaderMiddleware(config *HeaderConfig) MiddlewareFunc
```

Adds static headers to every request. Pass `nil` to use [`DefaultHeaderConfig()`](#defaultheaderconfig) (no headers; middleware is a pass-through). Header safety is validated at creation time (CRLF injection protection); conflicts with existing same-name headers will overwrite them.

#### HeaderConfig

```go
type HeaderConfig struct {
    // Headers contains the static headers to add to every request. Existing headers
    // with the same key are overwritten. Headers are validated for safety at middleware
    // creation time (CRLF injection protection).
    // Default: empty (no headers added; middleware is a pass-through).
    Headers map[string]string
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `Headers` | `nil` (empty) | Static header key-value pairs; validated for safety at creation |

#### DefaultHeaderConfig

```go
func DefaultHeaderConfig() *HeaderConfig
```

Returns a default config with no headers.

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.HeaderMiddleware(&httpc.HeaderConfig{
        Headers: map[string]string{
            "X-API-Version": "v2",
            "X-Client":      "myapp/1.0",
        },
    }),
}
client, _ := httpc.New(cfg)
```

### MetricsMiddleware

```go
func MetricsMiddleware(config *MetricsConfig) MiddlewareFunc
```

Metrics-collection middleware. Invokes the callback after each request completes, passing method, URL, status code, duration, and error. Pass `nil` to use [`DefaultMetricsConfig()`](#defaultmetricsconfig) (metrics disabled).

#### MetricsConfig

```go
type MetricsConfig struct {
    // OnMetrics is called after each request completes, receiving request metrics.
    // When nil, metrics collection is disabled.
    OnMetrics func(method, url string, statusCode int, duration time.Duration, err error)
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `OnMetrics` | `nil` | Metrics callback; when nil, metrics collection is disabled |

#### DefaultMetricsConfig

```go
func DefaultMetricsConfig() *MetricsConfig
```

Returns a default config with metrics disabled. Set the `OnMetrics` field to enable metrics collection.

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.MetricsMiddleware(&httpc.MetricsConfig{
        OnMetrics: func(method, url string, status int, d time.Duration, err error) {
            metrics.Record(method, status, d, err)
        },
    }),
}
client, _ := httpc.New(cfg)
```

### AuditMiddleware

```go
func AuditMiddleware(config *AuditConfig) MiddlewareFunc
```

Security-audit middleware, suitable for financial, medical, government, and other compliance scenarios. Records request/response metadata (method, URL, status code, duration, retries, etc.) with automatic URL masking. The callback is provided via `config.OnAudit`; when nil, the middleware is a no-op. Pass `nil` to use [`DefaultAuditConfig()`](#defaultauditconfig).

`SourceIP` and `UserID` are extracted from the request context via [`SourceIPKey`](#audit-context-keys) and [`UserIDKey`](#audit-context-keys).

#### AuditConfig

```go
type AuditConfig struct {
    // OnAudit receives an AuditEvent after each request/response cycle completes.
    // When nil, the middleware is a no-op.
    OnAudit func(event AuditEvent)

    // Format specifies the output format: "text" (default) or "json"
    Format string

    // IncludeHeaders includes request/response headers in the audit log
    IncludeHeaders bool

    // MaskHeaders is a list of header names to mask (e.g. "Authorization", "Cookie")
    MaskHeaders []string

    // SanitizeError removes sensitive information from error messages
    SanitizeError bool
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `OnAudit` | `nil` | Audit callback; when nil, the middleware is a no-op |
| `Format` | `"text"` | Output format |
| `IncludeHeaders` | `false` | Whether to record headers |
| `MaskHeaders` | `["Authorization", "Cookie", ...]` | Standard sensitive-header list |
| `SanitizeError` | `true` | Error messages replaced with `[sanitized]` |

#### DefaultAuditConfig

```go
func DefaultAuditConfig() *AuditConfig
```

Returns the default audit config: `Format` is `"text"`, `IncludeHeaders` is `false`, `MaskHeaders` is the standard sensitive-header list, `SanitizeError` is `true`. Set the `OnAudit` field to enable the audit callback.

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
        event.Method, event.URL, event.StatusCode,
        event.Duration, event.UserID, event.SourceIP)
}
auditCfg.Format = "json"
auditCfg.IncludeHeaders = true

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(auditCfg),
}
client, _ := httpc.New(cfg)
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

Security-audit event.

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

Custom JSON serialization, handling two special fields:

| Field | Conversion Rule |
|-------|----------------|
| `Duration` | Adds `durationMs` (integer milliseconds), preserves the original `duration` field (nanoseconds) |
| `Error` | Converts to `error` (error-message string), omitted when nil |

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

### Audit Context Keys

Pass audit information via the request context:

```go
// Set source IP
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// Set user ID
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| Constant | Type | Description |
|----------|------|-------------|
| `SourceIPKey` | `auditContextKey` | Source-IP context key |
| `UserIDKey` | `auditContextKey` | User-ID context key |

## See Also

- [Interface Definitions](../types/interfaces) - MiddlewareFunc, Handler type definitions
- [Middleware Chain](../../guides/middleware-chain) - Middleware usage guide
- [Constants and Types](../types/constants) - AuditEvent, AuditConfig types
