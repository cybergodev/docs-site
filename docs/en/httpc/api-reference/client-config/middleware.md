---
sidebar_label: "Built-in Middleware"
title: "Middleware - CyberGo HTTPC | Seven Built-in Middleware"
description: "HTTPC middleware API: Chain composition, seven built-in middleware (Recovery, Logging, Timeout, Metrics, Audit), config structs, and AuditEvent."
sidebar_position: 50
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

Middleware is configured in `MiddlewareConfig.Middlewares` and executes in slice order. Each middleware factory accepts a `*XxxConfig` configuration pointer; pass `nil` to use the default config:

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

Panic-recovery middleware. Catches panics in the processing chain and converts them to errors containing stack traces. It shares the same conversion logic as the client's built-in panic safety net (the `Request` / download paths), so the public API never propagates a panic to the caller.

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

Request-logging middleware. Logs method, URL, status code, and duration. URLs are masked automatically (credentials removed). Pass `nil` to use [`DefaultLoggingConfig()`](#defaultloggingconfig) (logging disabled).

Output format:

- Success: `METHOD URL -> STATUS (DURATION)`
- Failure: `METHOD URL -> error: ERR (DURATION)`

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
| `LoggingConfig.LogFunc` | `nil` | Log output function; when nil, logging is disabled |

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
| `RequestIDConfig.HeaderName` | `"X-Request-ID"` | Request header name |
| `RequestIDConfig.Generator` | `nil` (crypto/rand) | ID generation function; when nil, uses a cryptographically secure generator |

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

Middleware-level timeout control. Pass `nil` to use [`DefaultTimeoutMiddlewareConfig()`](#defaulttimeoutmiddlewareconfig) (timeout disabled; middleware is a pass-through). When set to a positive value, the timeout takes effect before the client's built-in timeout; on timeout it cancels the context and returns an error.

The timeout context is derived from the **request's own** `Context()` (a cancel/deadline preset via `WithContext` is respected rather than overridden); the derived deadline is written back to the request object passed to the engine.

:::warning
`TimeoutMiddleware`'s `defer cancel()` fires immediately after the handler returns (once the response headers are received), before the response body has been read. The middleware therefore rejects streaming requests on entry: a `Download` or `WithStreamBody` request returns `TimeoutMiddleware is incompatible with streaming responses`.

For streaming/download scenarios, use [`WithTimeout`](../core/options#withtimeout) instead.
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
| `TimeoutMiddlewareConfig.Duration` | `0` | Timeout duration; zero or negative disables it |

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

Adds static headers to every request. Pass `nil` to use [`DefaultHeaderConfig()`](#defaultheaderconfig) (no headers; middleware is a pass-through).

Header safety is validated at creation time (CRLF injection protection), and a conflicting same-name header in the request is overwritten. The config map is **deep-copied** at creation time, so later changes to the caller's original map do not affect the middleware.

If a header fails validation, creation does not panic; instead the middleware returned returns that validation error for every request.

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
| `HeaderConfig.Headers` | `nil` (empty) | Static header key-value pairs; validated for safety at creation |

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

The callback receives the **sanitized** URL. If an error message embeds the original URL (with credentials), it is likewise replaced with the sanitized version, preventing credential leaks into metrics pipelines.

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
| `MetricsConfig.OnMetrics` | `nil` | Metrics callback; when nil, metrics collection is disabled |

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

`SourceIP` and `UserID` are extracted from the request context via [`SourceIPKey`](#audit-context-keys) and [`UserIDKey`](#audit-context-keys). `Attempts` (the actual attempt count) and `RedirectChain` (the redirect chain) are extracted automatically from the response.

The middleware renders nothing itself: the `AuditEvent` struct is handed to `OnAudit` as-is, and `Format` is a reserved field with no effect, so the output style (text, JSON, ...) is entirely the callback's decision.

#### AuditConfig

The audit middleware's configuration struct, with 5 fields:

- `OnAudit`: audit callback; the middleware is a no-op when nil.
- `Format`: reserved field with no effect — events reach `OnAudit` as `AuditEvent` values, and rendering is the callback's choice.
- `IncludeHeaders`: whether to record headers.
- `MaskHeaders`: header names to mask; defaults to the six standard sensitive headers, with matches replaced by `[REDACTED]`.
- `SanitizeError`: whether to redact raw request URLs (and sensitive query values) embedded in error messages; the redacted error still classifies through `errors.Is`/`errors.As`.

For the full type definition, field-by-field descriptions, and defaults, see [AuditConfig](../types/constants#auditconfig).

#### DefaultAuditConfig

```go
func DefaultAuditConfig() *AuditConfig
```

Returns the default audit config: `Format` stays `""` (the reserved field is not initialized), `IncludeHeaders` is `false`, `MaskHeaders` is the standard sensitive-header list, `SanitizeError` is `true`. Set the `OnAudit` field to enable the audit callback.

```go
// For JSON lines, serialize the AuditEvent inside the callback
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    data, err := json.Marshal(event)
    if err != nil {
        log.Printf("[AUDIT] marshal failed: %v", err)
        return
    }
    log.Printf("%s", data)
}
auditCfg.IncludeHeaders = true

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(auditCfg),
}
client, _ := httpc.New(cfg)
```

## Audit Types

### AuditEvent

The security-audit event generated by `AuditMiddleware` after each request/response cycle, with 12 fields: method, sanitized URL, status code, duration, attempts, redirect chain, and error, plus the context-injected `SourceIP`/`UserID` and optionally included request/response headers. For the full type definition and field-by-field details, see [AuditEvent](../types/constants#auditevent).

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

Custom JSON serialization, handling two special fields:

| Field | Conversion Rule |
|-------|----------------|
| `Duration` | Serialized as `durationMs` (integer milliseconds); the Go field carries the `json:"-"` tag, so no nanosecond `duration` is emitted |
| `Error` | Converts to `error` (error-message string), omitted when nil |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"attempts":0,"durationMs":150}
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
