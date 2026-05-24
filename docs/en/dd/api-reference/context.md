---
title: "Context Integration - CyberGo DD | Context Integration"
description: "CyberGo DD context API: TraceID, SpanID, RequestID propagation, ContextExtractor interface, and OpenTelemetry integration for distributed tracing."
---

# Context Integration

DD supports Go standard library `context.Context` integration for automatic propagation of tracing information and context field extraction.

## Built-in Context Keys

| Function | Signature | Description |
|----------|-----------|-------------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | Add TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | Add SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | Add RequestID |
| `GetTraceID` | `(ctx context.Context) string` | Get TraceID |
| `GetSpanID` | `(ctx context.Context) string` | Get SpanID |
| `GetRequestID` | `(ctx context.Context) string` | Get RequestID |

### Usage Example

```go
func handleRequest(ctx context.Context) {
    // Inject tracing information
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // Manually extract context fields into log
    logger.InfoWith("Processing request",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip Batch Extraction
Use `ContextExtractor` with `Config.ContextExtractors` to enable automatic extraction. Extractors run on every log call. See the [ContextExtractor](#contextextractor) section below for details.
:::

## ContextExtractor

Context extractors are used to automatically extract fields from `context.Context`.

```go
type ContextExtractor func(ctx context.Context) []Field
```

### Registering Extractors

```go
// Via Logger method
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// Batch replacement
logger.SetContextExtractors(extractor1, extractor2)

// Get current extractors
extractors := logger.GetContextExtractors()
```

## Context Key Constants

| Constant | Type | Value |
|----------|------|-------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Complete Example

### HTTP Middleware

```go
func tracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        if traceID == "" {
            traceID = generateTraceID()
        }
        ctx := dd.WithTraceID(r.Context(), traceID)
        ctx = dd.WithRequestID(ctx, generateRequestID())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### gRPC Interceptor

```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, _ := metadata.FromIncomingContext(ctx)
    ctx = dd.WithTraceID(ctx, md.Get("trace-id")[0])
    ctx = dd.WithRequestID(ctx, md.Get("request-id")[0])

    dd.InfoWith("gRPC request",
        dd.String("method", info.FullMethod),
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
    return handler(ctx, req)
}
```

## Next Steps

- [Logger](./logger) -- AddContextExtractor method
- [Interface Definitions](./interfaces) -- ContextExtractor type definition
- [Structured Fields](./fields) -- Field constructors
