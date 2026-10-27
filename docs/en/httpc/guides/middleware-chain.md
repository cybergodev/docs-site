---
sidebar_label: "Middleware Chain"
title: "Middleware Chain - CyberGo HTTPC | Onion Model Composition"
description: "HTTPC middleware chain: onion model and execution order, request and response phases, retry interaction, built-in middleware, Chain, and custom MiddlewareFunc."
sidebar_position: 80
---

# Middleware Chain

The middleware chain is HTTPC's request interception pipeline. Each middleware wraps the next handler and runs once in the request phase and once in the response phase.

## Onion Model

HTTPC middleware follows an onion model: requests travel from outer to inner, responses from inner to outer.

```text
Request →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
Response ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),                                      // Outermost: panic recovery
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}), // Second layer: logging
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),          // Innermost: request ID
}

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

Two core types (both exported aliases):

```go
// Handler handles an HTTP request and returns the response — the end of the chain is the engine
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)

// MiddlewareFunc wraps one Handler into a new Handler
type MiddlewareFunc func(Handler) Handler
```

`RequestMutator` / `ResponseMutator` expose all read/write methods for the request and the response, usable in both middleware phases.

### Complete Execution Order

The full pipeline a request passes through:

```text
client.Get(url, opts...)
   │
   ├─ 1. Apply request options (WithHeader/WithJSON/WithQuery/...)
   │
   ├─ 2. Middleware chain · request phase (outer → inner)
   │       Recovery → Logging → RequestID → ...
   │
   ├─ 3. Terminal handler: hands the middleware-mutated request fields to the engine
   │
   ├─ 4. Inside the engine: security validation → retry loop (exponential backoff) → transport send
   │
   └─ 5. Middleware chain · response phase (inner → outer)
           ... ← RequestID ← Logging ← Recovery
```

Key takeaways:

- **Request options run before middleware**: middleware sees a request with options already applied. It may override any field the options set (headers, query parameters, timeouts, redirect policy, etc.)
- **Options do not run twice**: the terminal handler copies the middleware-mutated request fields into a new engine request and sends that; the options are not re-run
- Client defaults such as `Defaults.Headers` / `Defaults.UserAgent` are applied when the engine builds the final request, only where the field is unset. A header with the same name set by middleware takes precedence.

### Middleware and Retries

The middleware chain wraps the **entire retry cycle**: however many times a logical request retries, middleware runs once and sees the response of the final attempt. `Meta.Attempts` reports the total number of attempts.

For per-attempt granularity, use the [`WithOnRequest`/`WithOnResponse` callbacks](./request-response#callbacks): they fire inside the engine on every attempt, retries included.

### Error Propagation and Short Circuits

- If any middleware returns an error, the chain stops immediately: inner middleware does not run, and the error is returned to the caller unchanged
- A middleware that returns a response (or an error) **without calling `next()`** is a short circuit. The response phase of outer middleware still runs (Recovery's defer, for example), while inner layers and the engine never execute. Cache hits and open circuit breakers are implemented this way
- When middleware returns both `(resp, err)`, the client releases the response as a fallback to avoid leaking the object pool. Discarding the response obtained from `next()` and returning `(nil, err)` does leak; never swallow the response (see the warning under custom middleware below)
- Panics have two lines of defense: `RecoveryMiddleware` recovers panics inside the chain, and the `Request` method has an additional default recover that converts any escaped panic into an error instead of crashing the process

## Built-in Middleware

### RecoveryMiddleware

Panic recovery to prevent process crashes:

```go
httpc.RecoveryMiddleware()
```

The panic value is converted into an error containing the stack trace. Place this middleware as the **outermost** layer of the chain so it protects every layer after it.

### LoggingMiddleware

Request and response logging, with credentials in the URL masked before logging:

```go
httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
}})
// Sample output: [HTTP] GET https://api.example.com/data -> 200 (150ms) (status code and duration are measured values, not fixed)
```

Passing a nil config, or a config with a nil `LogFunc`, disables logging and the middleware becomes a pass-through. Credentials embedded in the URL (`user:pass@host`) are scrubbed before logging.

### RequestIDMiddleware

Adds a unique ID to each request, generated with `crypto/rand`:

```go
httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()) // Default 32-char hex

// Custom generator
httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    HeaderName: "X-Request-ID",
    Generator:  func() string {
        return uuid.New().String()
    },
})
```

If the request already carries a header with the same name (for example, injected by an upstream gateway), the middleware **does not overwrite** the existing value, so tracing propagates end to end.

### TimeoutMiddleware

Middleware-level timeout enforced ahead of the client timeout:

```go
httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second})
```

The timeout derives from the request's own context, preserving any deadline or cancellation signal already set. Once it expires, the context is canceled and a timeout error is returned. A `Duration` of zero or negative disables the middleware, which becomes a pass-through.

:::warning Do not use for Download or streaming requests
`TimeoutMiddleware`'s `defer cancel()` fires immediately after the handler returns (once the response headers are received), which is before the response body has been read. The middleware therefore rejects streaming requests on entry: a `Download` or `WithStreamBody` request returns `TimeoutMiddleware is incompatible with streaming responses` without reaching the read stage.

For streaming and download scenarios, use the [`WithTimeout`](../api-reference/core/options#withtimeout) option instead.
:::

### HeaderMiddleware

Adds static headers to all requests:

```go
httpc.HeaderMiddleware(&httpc.HeaderConfig{Headers: map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
}})
```

The header map is CRLF-validated and defensively copied **when the middleware is created**, so mutating the passed-in map afterwards has no effect on the middleware. If validation fails, the middleware returns an error for every request. Existing headers with the same name are overwritten.

### MetricsMiddleware

Collects request metrics:

```go
httpc.MetricsMiddleware(&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
}})
```

Both the URL and the error passed to the callback are sanitized (URL credentials scrubbed, raw URLs inside error messages replaced with sanitized versions), so sensitive data does not reach the metrics system. When a request fails, `statusCode` is 0.

### AuditMiddleware

Security auditing for financial, medical, and other compliance scenarios:

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
}
httpc.AuditMiddleware(auditCfg)
```

When `OnAudit` is nil, the middleware passes requests through directly.

### Configuring Audit Options

`DefaultAuditConfig()` returns the default configuration; modify its fields to control header logging and error masking. Audit events are handed to `OnAudit` as structured `AuditEvent` values, and the output format is decided entirely by the callback (`json.Marshal(event)` yields JSON lines). `Format` is a reserved field with no effect:

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.IncludeHeaders = true
auditCfg.MaskHeaders = []string{"Authorization", "Cookie"}
auditCfg.SanitizeError = true
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    data, err := json.Marshal(event)
    if err != nil {
        log.Println("failed to serialize audit event:", err)
        return
    }
    log.Println(string(data))
}

httpc.AuditMiddleware(auditCfg)
```

`AuditEvent` carries the timestamp, method, sanitized URL, status code, duration, attempt count, redirect chain, and other fields. With `SanitizeError = true` (the default), the **raw request URL embedded in an error message** (including sensitive query values) is redacted while the error identity is preserved, so `errors.Is`/`errors.As` still classify the original error — the error is no longer replaced wholesale with `[sanitized]`. In JSON output the duration is emitted as the `durationMs` field (the millisecond count); `Duration` itself carries the `json:"-"` tag and is not serialized directly.

Audit events can extract SourceIP and UserID from the context:

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## Manual Chain Composition

Use the `Chain` function to compose middleware:

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

`Chain` wraps layer by layer from the last middleware forward, so **slice order = execution order from outer to inner**: the first element is the outermost layer, the first to see the request and the last to see the response. `Chain` merges multiple middleware into a single `MiddlewareFunc`, which is convenient for reuse as a library or for assembling combinations on demand.

## Custom Middleware

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // Request phase: modify the request
            req.SetHeader("Origin", origin)

            // Call the next handler
            resp, err := next(ctx, req)

            // Response phase: log or modify the response
            if resp != nil {
                log.Printf("Response status: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

A complete runnable example: a timing middleware that records duration and status:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware records the method, URL, status code, and duration of each request
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()

			// Request phase: read/modify the request as needed
			req.SetHeader("X-Client-Trace", "demo")

			// Call the next layer (eventually reaching the engine)
			resp, err := next(ctx, req)

			// Response phase: read/modify the response as needed
			status := 0
			if resp != nil {
				status = resp.StatusCode()
			}
			log.Printf("%s %s -> %d (%v)", req.Method(), req.URL(), status, time.Since(start))

			return resp, err
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		timingMiddleware(),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200
}
```

:::warning Do not swallow the response from next()
After `next()` returns a non-nil response, return it unchanged. Discarding the response and returning `(nil, err)` leaks the engine's object pool; returning `(resp, err)` together makes the client release the response as a fallback, but passing it through unchanged is still preferred.
:::

:::warning Middleware state and concurrency
A middleware instance is assembled once at client creation and is **shared by all concurrent requests**. Mutable state captured in the closure (counters, breaker thresholds, etc.) must be protected with a mutex, as in the circuit-breaker example below. Stateless middleware needs no extra handling.
:::

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

A short circuit that returns `(nil, err)` never called `next()`, so it holds no response that needs releasing and cannot leak. A short circuit can also return a synthesized response (a cache-hit scenario, for example): implement the `ResponseMutator` interface and return it, and the engine response is replaced as usual.

## Middleware Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
}
cfg.Defaults.UserAgent = "my-app/1.0"
cfg.Defaults.Headers = map[string]string{"X-App": "my-app"}
cfg.Security.FollowRedirects = true
cfg.Security.MaxRedirects = 10

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

Note the distinction between the two kinds of defaults: `Middleware.Middlewares` is the interception pipeline; `Defaults.*` are static defaults filled in when the engine builds the request. They apply only where the request leaves a field unset, so their priority is lower than options and middleware.

## Next Steps

- [Built-in Middleware API](../api-reference/client-config/middleware) - Complete middleware reference
- [Retry and Fault Tolerance](./retry-fault-tolerance) - Retry strategy guide
- [Security Overview](../security/) - Audit middleware security practices
