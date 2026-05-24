---
title: "Distributed Tracing - CyberGo DD | Context Guide"
description: "CyberGo DD distributed tracing: TraceID, SpanID, RequestID propagation, ContextExtractor, HTTP middleware, and OpenTelemetry integration."
---

# Distributed Tracing Integration

DD supports automatic propagation of tracing identifiers (TraceID, SpanID, RequestID) through `context.Context`, enabling end-to-end log correlation in microservice architectures.

## Context Keys

DD predefines three context keys:

| Key | Description | Purpose |
|-----|-------------|---------|
| `ContextKeyTraceID` | Trace ID | Cross-service tracing, correlating a complete request chain |
| `ContextKeySpanID` | Span ID | Intra-service operation tracking |
| `ContextKeyRequestID` | Request ID | Unique identifier for a single request |

## Basic Usage

### Setting and Getting

```go
ctx := context.Background()

// Set tracing identifiers
ctx = dd.WithTraceID(ctx, "trace-abc123")
ctx = dd.WithSpanID(ctx, "span-def456")
ctx = dd.WithRequestID(ctx, "req-789")

// Get tracing identifiers
traceID := dd.GetTraceID(ctx)    // "trace-abc123"
spanID := dd.GetSpanID(ctx)      // "span-def456"
requestID := dd.GetRequestID(ctx) // "req-789"
```

### Extraction via WithFields

Since DD's log methods do not accept a `context.Context` parameter, the recommended pattern is to pass tracing IDs via `WithFields()` on a request-scoped `LoggerEntry`:

```go
// Extract tracing IDs from context and add to LoggerEntry
reqLog := logger.WithFields(
    dd.String("trace_id", dd.GetTraceID(ctx)),
    dd.String("span_id", dd.GetSpanID(ctx)),
    dd.String("request_id", dd.GetRequestID(ctx)),
)

// All logs from this entry include the tracing fields
reqLog.Info("Processing request")
```

### Using ContextExtractor

`ContextExtractor` functions are called with `context.Background()` for each log entry. They are useful for extracting global or goroutine-local state, not per-request context:

```go
// Register context extractor for global/static fields
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("service", "my-service"),
    }
})
```

## HTTP Middleware Integration

### Basic Tracing Middleware

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Extract or generate tracing identifiers from request headers
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            // Inject into context
            ctx := r.Context()
            ctx = dd.WithTraceID(ctx, traceID)
            ctx = dd.WithRequestID(ctx, requestID)

            // Create request-scoped log Entry
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // Pass Logger to handler (use custom type key to avoid collisions)
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("Request completed",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### Complete Request Tracing Example

```go
package main

import (
    "context"
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Get tracing information from context
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("Query user",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // Business logic...

    h.log.InfoWith("Query completed",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor Custom Extractors

`ContextExtractor` functions receive `context.Background()` and are called for every log entry. They are best suited for adding global metadata, not per-request context:

```go
// Custom extractor: add static/goroutine-local metadata to every log
func tenantExtractor(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("service", "order-service"),
        dd.String("env", os.Getenv("APP_ENV")),
    }
}

// Register extractor
logger.AddContextExtractor(tenantExtractor)
```

:::warning Context Limitation
ContextExtractor functions receive `context.Background()`, not the per-request context. For per-request tracing IDs, use the `WithFields()` pattern shown above to create a request-scoped `LoggerEntry`.
:::

### Combining Multiple Extractors

```go
// Register multiple extractors for different global metadata
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("version", buildVersion),
    }
})

logger.AddContextExtractor(tenantExtractor)
```

## Cross-Service Propagation

In microservice calls, tracing identifiers are propagated through HTTP headers:

```go
// Sender: inject tracing identifiers into request headers
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

    // Propagate tracing identifiers
    if traceID := dd.GetTraceID(ctx); traceID != "" {
        req.Header.Set("X-Trace-ID", traceID)
    }
    if reqID := dd.GetRequestID(ctx); reqID != "" {
        req.Header.Set("X-Request-ID", reqID)
    }

    return http.DefaultClient.Do(req)
}
```

## Request-Scoped Logging Pattern

```go
type RequestLogger struct {
    log    *dd.LoggerEntry
    ctx    context.Context
    start  time.Time
}

func NewRequestLogger(logger *dd.Logger, r *http.Request) *RequestLogger {
    ctx := r.Context()
    ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))
    ctx = dd.WithRequestID(ctx, r.Header.Get("X-Request-ID"))

    return &RequestLogger{
        log: logger.WithFields(
            dd.String("trace_id", dd.GetTraceID(ctx)),
            dd.String("request_id", dd.GetRequestID(ctx)),
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        ),
        ctx:   ctx,
        start: time.Now(),
    }
}

func (rl *RequestLogger) Info(msg string, fields ...dd.Field) {
    rl.log.InfoWith(msg, fields...)
}

func (rl *RequestLogger) Finish(status int) {
    rl.log.InfoWith("Request completed",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## Next Steps

- [Hook System](./hooks) -- Lifecycle hook extensions
- [Audit Logging](./audit-logging) -- Security auditing
- [API Reference - Context](../api-reference/context) -- Context complete API
- [Web Service Example](../examples/web-service) -- Complete web service example
