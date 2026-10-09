---
sidebar_label: "Handler Pipeline & Custom Middleware"
title: "Handler Pipeline - CyberGo HTTPC | Middleware Chain"
description: "HTTPC handler pipeline: how the onion-model MiddlewareFunc chain is assembled and executed, the Chain combinator, and custom middleware examples."
sidebar_position: 1
---

# Handler & Middleware Chain

## Two-Layer Architecture

HTTPC request handling is a collaboration between two layers: the Layer 1 method API is a **thin wrapper**, and the real request-processing engine is the Layer 2 Handler pipeline. Every request resolves to "assemble and execute a Handler chain".

```text
HTTPC two-layer architecture
├── Layer 1  Method API (thin wrapper)
│     Package functions httpc.Get/Post/... + Client methods + request options
│     → internally unified through client.Request → executeRequest
│
└── Layer 2  Handler pipeline (request-processing engine)
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      MiddlewareFunc(Handler) onion chain → assembled → executed
```

When a client is configured with middleware, `executeRequest` applies the request options to a `RequestMutator` and hands it to `clientImpl.middlewareChain` for execution; without middleware it dispatches directly to the engine. This chain is the Handler that `buildMiddlewareChain` assembles once at `New()` time and caches on the `clientImpl.middlewareChain` field.

## Execution Flow In Detail

The complete path of a request from Layer 1 to Layer 2:

```text
httpc.Get(url, opts...)              ← Layer 1 package function
  → withDefault(ctx, "GET", url, opts)
    → clientImpl.Request(ctx, "GET", url, opts...)   ← default client singleton
      → clientImpl.executeRequest(ctx, "GET", url, opts)
          │
          ├─ closed? → ErrClientClosed
          │
          ├─ no middleware?
          │     → c.engine.Request(ctx, method, url, opts...)   ← direct to engine
          │
          └─ has middleware?
                → engineReq = acquireMiddlewareRequest()         ← from object pool
                → engineReq.SetMethod/SetURL/SetContext          ← write initial state
                → apply opts(engineReq) one by one               ← request options take effect
                → c.middlewareChain(ctx, engineReq)              ← enter the onion chain
                → Chain wraps layer by layer → finalHandler → c.engine.Request
                → defer releaseMiddlewareRequest(engineReq)      ← return to pool
```

Key details:

- **Object-pool reuse**: when middleware is present, `executeRequest` acquires a `*engine.Request` from the engine's shared object pool (via `acquireMiddlewareRequest()`), applies the request options, and passes it to the middleware chain as a `RequestMutator`. After the entire chain finishes **synchronously**, a `defer` returns the request object to the pool.
- **Direct connection with no middleware**: when no middleware is configured, pooling and chain assembly are skipped and the request options are passed straight to the engine — a zero-overhead fast path.
- **Built-in panic safety net**: `clientImpl.Request` ships with a `recover` that converts any unexpected panic along the execution path into an error, rather than crashing the caller. Combined with `RecoveryMiddleware`, this provides double protection.

## Middleware Chain Assembly Process

`buildMiddlewareChain` assembles the entire chain **once** at `New()` time and caches it on the `clientImpl.middlewareChain` field. Assembly happens in two steps:

```text
buildMiddlewareChain(middlewares):

  ① Build the finalHandler (terminal handler)
     finalHandler: func(ctx, req) → read all fields modified by middleware from req
                                    → forward to engine via a single option closure
                                    → return *engine.Response

  ② Chain(middlewares...)(finalHandler)
     Wrap layer by layer from back to front: final = mw[i](final)
     Slice [mwA, mwB, mwC] → mwA(mwB(mwC(finalHandler)))
```

The correspondence between slice order and execution order: a middleware **earlier** in the slice sits at the **outermost** layer of the chain (enters first, exits last); a middleware **later** in the slice sits right against `finalHandler` (the innermost layer). The `Chain` combinator walks the slice from the end backward (`for i := len-1; i >= 0; i--`), wrapping each middleware around the previous layer.

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

The core function signature for request processing. It receives a context and a request mutator, and returns a response mutator or an error. The terminal Handler at the end of the chain (`finalHandler`) is responsible for forwarding the middleware-rewritten request fields to the underlying engine to actually issue the network request.

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

The middleware function signature: it receives the "next Handler" and returns a wrapped Handler. A middleware can insert logic before and after calling `next` (rewriting the request, logging the response, recovering from panics, etc.), forming an onion model: the first middleware is the outermost layer — it enters first and exits last.

## Onion Model Execution Order

```text
Request flow →

  ┌─ Middleware A (outer, first to run) ────────────────────┐
  │  ┌─ Middleware B (middle) ──────────────────────────┐  │
  │  │  ┌─ Middleware C (inner, last to run) ───────┐  │  │
  │  │  │                                         │  │  │
  │  │  │  finalHandler → engine.Request → network │  │  │
  │  │  │                                         │  │  │
  │  │  └──────────────── response ←──────────────┘  │  │
  │  └──────────────────── response ←──────────────────┘  │
  └──────────────────────── response ←──────────────────────┘

  ← Response flow

  Request phase:  A → B → C → finalHandler (outside-in)
  Response phase: finalHandler → C → B → A (inside-out)
```

Middlewares are configured in the `MiddlewareConfig.Middlewares` slice; a middleware **earlier** in the slice sits at the **outer** layer of the chain.

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

Combines multiple middlewares into a single middleware. The returned combinator takes the final Handler and nests the middlewares outside-in in the order provided: the first middleware in the slice wraps the outermost layer (executed first), the last sits right against the final Handler. HTTPC uses it internally to assemble `MiddlewareConfig.Middlewares` into a chain.

```go
// The two forms are equivalent: Chain composes then injects once,
// versus manual nesting layer by layer
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// Equivalent to manual nesting
chain := mwA(mwB(mwC(finalHandler)))
```

:::tip Uses of Chain
`Chain` is mainly used internally by HTTPC in `buildMiddlewareChain`, but you can also use it inside a custom middleware to pack multiple sub-middlewares into one, enabling middleware reuse and composition.
:::

## finalHandler Terminal Handler

`finalHandler` is the **terminal Handler** of the middleware chain — after all middlewares have run, it forwards the request fields modified by middleware to the underlying engine to actually issue the network request. It is the bridge between Layer 2 and the engine in the two-layer architecture.

finalHandler works in three steps:

```text
finalHandler(ctx, req):

  ① Resolve the context: req.Context() first, falling back to the chain ctx when nil

  ② Type-assert to *engine.Request and extract engine-specific hooks:
       - OnRequest callback (fired before the request is sent)
       - OnResponse callback (fired after the response is received)
       - AllowPrivateIPs (per-request SSRF override)
     These three hooks are not on the RequestMutator interface (their signatures
     reference internal types; exposing them would cause an import cycle),
     so they are read via type assertion

  ③ Call c.engine.Request(ctx, method, url, optionClosure)
     optionClosure forwards all mutable fields of req to a new engine request in one go:
       headers / queryParams / body / timeout / maxRetries /
       cookies / followRedirects / maxRedirects / allowPrivateIPs /
       streamBody / onRequest / onResponse
```

:::warning Boundary of the type assertion
The callbacks (`OnRequest`/`OnResponse`) and the per-request SSRF override (`AllowPrivateIPs`) live on the concrete type `*engine.Request`, not on the `RequestMutator` interface. `finalHandler` reads these hooks via type assertion. If a custom middleware **replaces** `req` with a non-`*engine.Request` type, the assertion fails and these hooks are **silently skipped**. All built-in middlewares mutate the request in place (never replace), so the assertion always succeeds.
:::

## Built-in Middleware

HTTPC ships with 7 ready-to-use middleware factories, injected into the client via `MiddlewareConfig.Middlewares`. Each factory accepts a `*XxxConfig` pointer; passing `nil` uses the default configuration.

| Middleware | Factory signature | Purpose |
|--------|----------|------|
| Recovery | `RecoveryMiddleware()` | Catches panics in the chain and converts them to errors with stack traces |
| Logging | `LoggingMiddleware(config *LoggingConfig)` | Logs method/sanitized URL/status code/duration |
| RequestID | `RequestIDMiddleware(config *RequestIDConfig)` | Injects an `X-Request-ID` header (crypto/rand) |
| Timeout | `TimeoutMiddleware(config *TimeoutMiddlewareConfig)` | Middleware-level timeout control |
| Header | `HeaderMiddleware(config *HeaderConfig)` | Adds static headers to every request |
| Metrics | `MetricsMiddleware(config *MetricsConfig)` | Callback with metrics data after the request completes |
| Audit | `AuditMiddleware(config *AuditConfig)` | Security audit events (finance/healthcare/government) |

For each middleware's config struct, default constructors, and detailed usage, see [Built-in Middleware](../client-config/middleware).

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),                          // Outermost: panic backstop
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}),
}
```

## Custom Middleware Examples

### Example 1: Request Header Injection Middleware

Injects an API-key header into every request. Demonstrates the request-preprocessing pattern **before** `next(ctx, req)`.

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// apiKeyMiddleware injects an X-API-Key auth header into every request
func apiKeyMiddleware(key string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// Inject the auth header via RequestMutator.SetHeader (before next = request preprocessing)
			req.SetHeader("X-API-Key", key)
			// Call next to continue the chain; the modified request propagates to finalHandler
			return next(ctx, req)
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		apiKeyMiddleware("my-secret-api-key"),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.StatusCode())
	// Output: 200
}
```

### Example 2: Response Header Injection Middleware

Appends the processing duration to the response. Demonstrates the response post-processing pattern **after** `next(ctx, req)` — reading and modifying the response via `ResponseMutator`.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// responseTimeMiddleware appends the processing duration to the response headers
func responseTimeMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// Call next first to let the request continue
			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// After next = response post-processing: append duration via ResponseMutator.SetHeader
			resp.SetHeader("X-Response-Time-Ms",
				fmt.Sprintf("%d", time.Since(start).Milliseconds()))
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		responseTimeMiddleware(),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Response.Headers.Get("X-Response-Time-Ms"))
	// Sample output: 156
}
```

### Response Cache Middleware (Concept)

Response caching is a typical advanced use case for `ResponseMutator`: short-circuit on a cache hit for GET requests without calling `next`. However, constructing a complete cached response requires a custom type implementing all of `ResponseMutator`'s methods (31 read/write methods), which is substantial. The core pattern:

<!-- check-code: skip -->
```go
func cacheMiddleware(cache Cache) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// Cache only GET requests
			if req.Method() == "GET" {
				if cached, ok := cache.Get(req.URL()); ok {
					return cached, nil // Cache hit: short-circuit, do not call next
				}
			}
			// Miss: execute the request
			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// Cache the response (requires a custom ResponseMutator implementation)
			cache.Set(req.URL(), resp)
			return resp, nil
		}
	}
}
```

## Middleware Execution Contract

When writing custom middleware, observe the following contracts; violating them causes resource leaks or lost requests:

| Contract | Description |
|------|------|
| **Must call `next()`** | Not calling `next` means the request never goes out (except for short-circuiting middleware like a cache hit). The response returned by `next` is the final result of the downstream chain and the engine. |
| **Response must be returned or released** | The `resp` returned by `next` must be returned as-is (or passed back via a later `next`); otherwise the response leaks from the engine object pool. Returning `(nil, error)` while still holding an unreleased response causes a pool leak. |
| **Panics are caught by RecoveryMiddleware** | A panic inside a middleware is caught by `RecoveryMiddleware` (if configured) or by the default safety net in `clientImpl.Request` and converted to an error; it never propagates to the caller. |
| **Synchronous execution** | The middleware chain runs **synchronously** — when `next` returns, the entire inner chain is done. Asynchronous middleware is not supported; introducing it would cause data races with the object-pool reuse pattern. |
| **Do not replace the request object** | Custom middleware should **mutate `req` in place** (via `SetHeader`/`SetBody`, etc.), never replace `req` with a new object. Replacement breaks the type assertion in `finalHandler`, silently skipping callbacks and the SSRF override. |

:::warning Object-pool leak risk
`executeRequest` acquires a `*engine.Request` from the engine object pool for the middleware chain and returns it via `defer` after the chain returns. If a middleware returns the response from `next` but additionally holds a reference to it (e.g. stashing it in a global cache), that response will be reused after being returned to the pool, causing cross-request data leakage. A caching middleware must deep-copy the response data.
:::

## See Also

- [Built-in Middleware](../client-config/middleware) — 7 ready-to-use middleware factories such as Recovery/Logging/Timeout
- [Request & Response Mutators](./mutators) — full method contracts for `RequestMutator`/`ResponseMutator`
- [Interfaces](../types/interfaces) — type alias definitions for `Handler`/`MiddlewareFunc`
