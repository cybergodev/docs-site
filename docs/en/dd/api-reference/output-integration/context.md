---
sidebar_label: "Context"
title: "Context Integration - CyberGo DD | Context Integration"
description: "CyberGo DD context integration API: inject tracing identifiers via WithTraceID/WithSpanID/WithRequestID, with the ContextKey type-safe key and the ContextExtractor function type for automatic field extraction. Supports integration with distributed-tracing frameworks such as OpenTelemetry."
sidebar_position: 2
---

# Context Integration

DD supports integration with the Go standard library's `context.Context`, enabling automatic propagation of tracing information and extraction of context fields.

## ContextKey Type

`ContextKey` is a custom key type based on `string`, avoiding context-key collisions with other packages.

```go
type ContextKey string
```

Three predefined key constants correspond to TraceID / SpanID / RequestID:

| Constant | Type | Value |
|----------|------|-------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Injection and Reading

| Function | Signature | Description |
|----------|-----------|-------------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | Inject TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | Inject SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | Inject RequestID |
| `GetTraceID` | `(ctx context.Context) string` | Read TraceID (returns `""` if missing) |
| `GetSpanID` | `(ctx context.Context) string` | Read SpanID (returns `""` if missing) |
| `GetRequestID` | `(ctx context.Context) string` | Read RequestID (returns `""` if missing) |

The `With*` functions derive a new ctx based on `context.WithValue` (with the key being the corresponding `ContextKey` constant); the `Get*` functions retrieve the string value from the ctx. If the key does not exist or the value is not a string, they uniformly return an empty string.

### Usage Example

<!-- check-code: skip -->
```go
func handleRequest(ctx context.Context) {
    // Inject tracing info
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // Manually extract context fields and pass them into the log
    logger.InfoWith("processing request",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip Batch extraction
Manual `Get*` is suitable for one-off scenarios. If you need every log line to automatically carry **global/static** fields (such as service name or hostname), register a `ContextExtractor` on the Logger as shown below; the extractor runs on every `*With` call. Note: the extractor receives `context.Background()` and **cannot** automatically obtain request-scoped TraceIDs (see limitation below).
:::

## ContextExtractor

`ContextExtractor` is a function type that automatically extracts fields from `context.Context`, convenient for integrating with tracing frameworks such as OpenTelemetry and Jaeger.

```go
type ContextExtractor func(ctx context.Context) []Field
```

Extractors are held internally by the Logger in a thread-safe registry (`contextExtractorRegistry`, **private, not exposed**): executed in insertion order; reads take an `atomic.Pointer` lock-free fast path; any extractor panic is recovered and logged to stderr without crashing the application.

### Registering Extractors

The extractor type itself is defined in this file; registration/management APIs live on the Logger (core domain):

<!-- check-code: skip -->
```go
// Append an extractor (returns an error; nil extractors are rejected)
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// Replace all extractors in batch
_ = logger.SetContextExtractors(extractor1, extractor2)

// Read a snapshot of the currently registered extractors
extractors := logger.GetContextExtractors()
```

:::warning Context limitation (important)
Log methods (`Info`/`InfoWith`, etc.) do not accept a `context.Context` parameter; `ContextExtractor` is invoked internally with `context.Background()`, so it **cannot automatically extract** TraceID/SpanID from the request scope. The OTel example below only emits fields when a global span exists; to attach tracing IDs to each request, pass them manually via `WithFields()` (see [Distributed Tracing Integration](../../guides/context-tracing)).
:::

### OpenTelemetry Example

<!-- check-code: skip -->
```go
// Inject the trace_id / span_id of an OTel span into every log line
otelExtractor := dd.ContextExtractor(func(ctx context.Context) []dd.Field {
    span := trace.SpanFromContext(ctx)
    if !span.SpanContext().IsValid() {
        return nil
    }
    return []dd.Field{
        dd.String("trace_id", span.SpanContext().TraceID().String()),
        dd.String("span_id", span.SpanContext().SpanID().String()),
    }
})
_ = logger.AddContextExtractor(otelExtractor)
```

## Complete Examples

### HTTP Middleware

<!-- check-code: skip -->
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

<!-- check-code: skip -->
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

- [Logger](../core/logger) -- `AddContextExtractor` / `SetContextExtractors` / `GetContextExtractors`
- [Structured Fields](./fields) -- `Field` constructors and field validation
- [Config](../core/config) -- `Config.ContextExtractors`
