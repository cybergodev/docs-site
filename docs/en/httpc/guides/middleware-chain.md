---
title: "Middleware Chain - CyberGo HTTPC | Onion-Model Chains"
description: "HTTPC middleware chain guide: onion-model execution, eight built-in middleware, Chain composition, custom MiddlewareFunc, and a circuit-breaker example."
---

# Middleware Chain

## Onion Model

HTTPC middleware follows an onion model -- requests go from outer to inner, responses from inner to outer:

```text
Request ->  Recovery  ->  Logging  ->  RequestID  -> Handler
                                                              |
Response <-  Recovery  <-  Logging  <-  RequestID  <- Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // Outermost: panic recovery
    httpc.LoggingMiddleware(log.Printf), // Second layer: logging
    httpc.RequestIDMiddleware("X-Request-ID", nil), // Innermost: request ID
}

client, _ := httpc.New(cfg)
```

## Built-in Middleware

### RecoveryMiddleware

Panic recovery to prevent process crashes:

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

Request/response logging with automatic URL masking:

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// Output: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

Adds a unique ID to each request, generated with `crypto/rand`:

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // Default 32-char hex

// Custom generator
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

Middleware-level timeout enforced before the client timeout:

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

Adds static headers to all requests:

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

Collects request metrics:

```go
httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
})
```

### AuditMiddleware

Security auditing for financial, medical, and other compliance scenarios:

```go
httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})
```

### AuditMiddlewareWithConfig

Configurable audit middleware:

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

Audit events support extracting SourceIP and UserID from context:

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## Manual Chain Composition

Use the `Chain` function to compose middleware:

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

## Custom Middleware

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // Request phase: modify request
            req.SetHeader("Origin", origin)

            // Call next handler
            resp, err := next(ctx, req)

            // Response phase: log or modify response
            if resp != nil {
                log.Printf("Response status: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

### Short-Circuit Middleware

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

## Middleware Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Middleware = &httpc.MiddlewareConfig{
    Middlewares: []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
    },
    UserAgent:       "my-app/1.0",
    Headers:         map[string]string{"X-App": "my-app"},
    FollowRedirects: true,
    MaxRedirects:    10,
}

client, _ := httpc.New(cfg)
```

## Next Steps

- [Middleware API](../api-reference/middleware) - Complete middleware reference
- [Retry and Fault Tolerance](./retry-fault-tolerance) - Retry strategy guide
- [Security Overview](../security/) - Audit middleware security practices
