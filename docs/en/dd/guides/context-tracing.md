---
sidebar_label: "Distributed Tracing"
title: "Distributed Tracing Integration - CyberGo DD | Context & Tracing Guide"
description: "CyberGo DD distributed-tracing integration guide: TraceID, SpanID, RequestID context propagation, ContextExtractor custom extractors, HTTP middleware integration, request-scoped logging, and integration with OpenTelemetry distributed-tracing systems."
sidebar_position: 7
---

# Distributed Tracing Integration

DD provides tracing-identifier utility functions based on `context.Context` (`WithTraceID`/`GetTraceID`, etc.) for correlating logs across a microservice architecture. Note: **DD's log methods do not accept a `context.Context` parameter**, so they cannot automatically extract TraceID from the request scope — you must attach tracing identifiers as fields via `WithFields()` (see [HTTP Middleware Integration](#http-middleware-integration)).

## Context Keys

DD predefines three context keys:

| Key | Description | Use |
|-----|-------------|-----|
| `ContextKeyTraceID` | Trace ID | Cross-service tracing; correlates an entire request chain |
| `ContextKeySpanID` | Span ID | Intra-service operation tracing |
| `ContextKeyRequestID` | Request ID | Unique identifier for a single request |

## Basic Usage

### Set and Get

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

### Why It Cannot Be "Auto-extracted" Into Logs

:::warning Current Limitation
DD's log methods (`Info`, `InfoWith`, etc.) do not directly accept a `context.Context` parameter. Context extractors are invoked internally with `context.Background()` (`logger.go:1414`), so they cannot directly read TraceID and similar values from the request-scoped context. The recommended approach is to pass fields manually (see HTTP middleware integration below).
:::

```go
// Context extractors are for static context fields preset in the config
// Note: because log methods do not accept ctx, GetTraceID and similar in an extractor
// cannot read request-scoped context values

// Recommended: pass tracing fields manually via WithFields
reqLog := logger.WithFields(
    dd.String("trace_id", traceID),
    dd.String("request_id", requestID),
)
reqLog.Info("processing request")
```

## HTTP Middleware Integration

### Basic Tracing Middleware

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Extract tracing identifiers from request headers or generate them
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

            // Create a request-scoped log Entry
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // Pass the Logger to handlers (use a custom-type key to avoid collisions)
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("request completed",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### Complete Request Tracing Example

<!-- check-code: skip -->
```go
package main

import (
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Get tracing info from context
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("query user",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // Business logic...

    h.log.InfoWith("query completed",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor Custom Extractors

`ContextExtractor` can extract fields from a context. Note: because log methods do not accept a ctx parameter, the extractor is invoked internally with `context.Background()`, suitable for:

- Extracting static fields from a global context or goroutine-local storage
- Combining with HTTP middleware to pass tracing fields to `WithFields` manually

### Custom Extractor Example

```go
// Custom extractor: attach static/global metadata to every log line
func tenantExtractor(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("service", "order-service"),
        dd.String("env", os.Getenv("APP_ENV")),
    }
}

// Register the extractor
logger.AddContextExtractor(tenantExtractor)
```

:::warning Context Limitation
`ContextExtractor` functions receive `context.Background()`, not the request-scoped context. To attach tracing IDs per request, use the `WithFields()` pattern above to create a request-scoped `LoggerEntry`.
:::

### Combining Multiple Extractors

```go
// Register multiple extractors to collect different global metadata
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("version", buildVersion),
    }
})

logger.AddContextExtractor(tenantExtractor)
```

## Cross-Service Propagation

In microservice calls, tracing identifiers propagate via HTTP headers:

```go
// Sender: inject tracing identifiers into request headers
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

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

## Request-scoped Logging Pattern

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
    rl.log.InfoWith("request completed",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## Next Steps

- [Hook System](./hooks) -- Lifecycle hook extensions
- [Audit Logging](./audit-logging) -- Security auditing
- [API Reference - Context](../api-reference/output-integration/context) -- Complete Context API
- [Web Service Example](../examples/web-service) -- Complete web service example
