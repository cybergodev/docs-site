---
sidebar_label: "Handler & Middleware Chain"
title: "Handler Pipeline - CyberGo HTTPC | Middleware Chain"
description: "HTTPC handler pipeline: how the onion-model MiddlewareFunc chain is assembled and executed, the Chain combinator, and custom middleware examples."
sidebar_position: 10
---

# Handler & Middleware Chain

The Handler pipeline is HTTPC's request-processing engine: the method API assembles a `MiddlewareFunc` chain and runs it, and the end of the chain hands the request to the engine. This page covers the pipeline types, execution order, and the Mutator contract.

## Pipeline Exported Symbols Overview

All exported symbols related to the Handler pipeline and where they live in this reference:

| Exported symbol | Category | Description | Detailed reference |
|----------|------|------|----------|
| `Handler` | Function type alias | Core request-handling signature | [Handler](#handler) below |
| `MiddlewareFunc` | Function type alias | Middleware signature | [MiddlewareFunc](#middlewarefunc) below |
| `Chain` | Combinator function | Combines multiple middlewares into a single one | [Chain](#chain) below |
| `RecoveryMiddleware` / `LoggingMiddleware` / `RequestIDMiddleware` / `TimeoutMiddleware` / `HeaderMiddleware` / `MetricsMiddleware` / `AuditMiddleware` | Middleware factories (7) | Built-in middleware factories | [Built-in Middleware](../client-config/middleware) |
| `LoggingConfig`/`DefaultLoggingConfig`, `RequestIDConfig`/`DefaultRequestIDConfig`, `TimeoutMiddlewareConfig`/`DefaultTimeoutMiddlewareConfig`, `HeaderConfig`/`DefaultHeaderConfig`, `MetricsConfig`/`DefaultMetricsConfig` | Config structs and default constructors (5 pairs) | Per-middleware configuration and defaults | [Built-in Middleware](../client-config/middleware) |
| `AuditEvent` (incl. the `MarshalJSON` method), `AuditConfig`/`DefaultAuditConfig` | Audit types and configuration | Security audit events and configuration | [Constants and Types](../types/constants) |
| `SourceIPKey` / `UserIDKey` | Context key constants | Source-IP and user-ID keys for audit events | [Constants and Types](../types/constants) |

## Two-Layer Architecture

HTTPC request handling is a collaboration between two layers: the Layer 1 method API is a **lightweight wrapper**, and the request-processing engine is the Layer 2 Handler pipeline. Every request resolves to "assemble and execute a Handler chain".

```text
HTTPC two-layer architecture
├── Layer 1  Method API (lightweight wrapper)
│     Package functions httpc.Get/Post/... + Client methods + request options
│     → internally unified through client.Request → executeRequest
│
└── Layer 2  Handler pipeline (request-processing engine)
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      MiddlewareFunc(Handler) onion chain → assembled → executed
```

When a client is configured with middleware, `executeRequest` applies the request options to a `RequestMutator` and hands it to `clientImpl.middlewareChain` for execution; without middleware the request goes directly to the engine. This chain is assembled once by `buildMiddlewareChain` at `New()` time and cached on the `clientImpl.middlewareChain` field.

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
- **Direct connection with no middleware**: when no middleware is configured, pooling and chain assembly are skipped and the request options go straight to the engine (a fast path with no extra overhead).
- **Built-in panic safety net**: `clientImpl.Request` ships with a `recover` that converts any unexpected panic along the execution path into an error instead of crashing the caller. Combined with `RecoveryMiddleware`, this provides double protection.

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

The core function signature for request processing, and a type alias of the internal `types.Handler` (defined in `types.go`). It receives a context and a request mutator, and returns a response mutator or an error. The terminal Handler at the end of the chain (`finalHandler`) forwards the middleware-rewritten request fields to the underlying engine, which issues the network request.

| Parameter/return | Type | Description |
|-------------|------|------|
| `ctx` | `context.Context` | Chain context; `finalHandler` prefers `req.Context()` and falls back to it when nil |
| `req` | `RequestMutator` | Request mutator through which middleware reads and writes request fields (method contract in [Request & Response Mutators](./mutators)) |
| Returns `resp` | `ResponseMutator` | Response mutator; `nil` means the request produced no response (error or short-circuit) |
| Returns `err` | `error` | Non-nil means the request failed; propagates outward through the chain to the caller |

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

The middleware function signature, and a type alias of the internal `types.MiddlewareFunc` (defined in `types.go`). It receives the "next Handler" and returns a wrapped Handler. A middleware can insert logic before and after calling `next` (rewriting the request, logging the response, recovering from panics, etc.), forming an onion model: the first middleware is the outermost layer and both enters first and exits last.

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

Combines multiple middlewares into a single middleware. The returned combinator takes the final Handler and nests the middlewares outside-in in the order provided: the first middleware in the slice wraps the outermost layer (executed first), the last sits right against the final Handler. `nil` entries are skipped silently (treated as no-ops), so a nil never breaks chain assembly. HTTPC uses this combinator internally to assemble `MiddlewareConfig.Middlewares` into a chain.

`Chain` is the only exported chain-assembly API in HTTPC; there is no mutable chain builder such as `Append`/`Use`. The whole chain is assembled once by `buildMiddlewareChain` at `New()` time and cached on the `clientImpl.middlewareChain` field; middlewares cannot be added or removed afterwards. For runtime-dynamic behavior, implement conditional logic inside a middleware rather than modifying the chain structure.

```go
// The two forms are equivalent: Chain composes then injects once,
// versus manual nesting layer by layer
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// Equivalent to manual nesting
chain := mwA(mwB(mwC(finalHandler)))
```

:::tip Uses of Chain
`Chain` is used mainly by HTTPC internally in `buildMiddlewareChain`. A custom middleware can also use it to pack several sub-middlewares into one, enabling middleware reuse and composition.
:::

## finalHandler Terminal Handler

`finalHandler` is the **terminal Handler** of the middleware chain: after all middlewares have run, it forwards the request fields they modified to the underlying engine, which issues the network request. It is the bridge between Layer 2 and the engine in the two-layer architecture.

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
The callbacks (`OnRequest`/`OnResponse`), the per-request SSRF override (`AllowPrivateIPs`), and the NoTimeout and `RetryNonIdempotent` overrides live on the concrete type `*engine.Request`, not on the `RequestMutator` interface; after a successful assertion, `finalHandler` forwards these fields to the engine along with every interface field.

If a custom middleware **replaces** `req` with a non-`*engine.Request` type, the assertion fails and an interface-accessor fallback path runs instead: those four per-request overrides plus the sanitized-URL cache are **silently skipped**, and only the interface fields (headers, queryParams, body, timeout, maxRetries, cookies, followRedirects, maxRedirects, streamBody) are still forwarded. All built-in middlewares mutate the request in place (never replace), so the assertion always succeeds.
:::

## Built-in Middleware

HTTPC ships 7 middleware factories, injected into the client via `MiddlewareConfig.Middlewares`. Each factory accepts a `*XxxConfig` pointer; passing `nil` uses the default configuration.

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

## Custom Middleware Full Specification

A custom middleware is a factory function returning a `MiddlewareFunc`, with three closure layers: the outermost captures configuration parameters (runs once at middleware creation), the middle wraps a Handler (runs once at chain assembly), and the innermost handles the request (runs per request).

<!-- check-code: skip -->
```go
func myMiddleware(/* outer: capture config parameters */) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler { // middle: wrap the Handler
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// ① Pre phase: inspect/rewrite the request via req before calling next
			resp, err := next(ctx, req) // ② Execute: synchronously run the inner chain to the network request
			if err != nil {
				return nil, err
			}
			// ③ Post phase: read/rewrite the response via resp after next returns
			return resp, nil
		}
	}
}
```

### Two-Phase Semantics

| Phase | Position | Operable objects | Typical uses |
|------|------|-----------|---------|
| Pre (request phase) | Before calling `next` | All write methods of `req` (SetHeader/SetURL/SetBody/SetTimeout/SetContext...) | Inject auth headers/trace IDs, rewrite URL and query parameters, set timeouts dynamically per path |
| Execute | The `next(ctx, req)` call site | —— | Synchronously execute the inner chain until `finalHandler` issues the network request and returns |
| Post (response phase) | After `next` returns | All read/write methods of `resp`, plus `err` | Record status code/duration/retry count, append response headers, report by error type |
| Short-circuit | Without calling `next` | A self-constructed return value | Return directly on cache hit, exit early on policy rejection (requires your own `ResponseMutator` implementation; see [Response Cache Middleware (Concept)](#response-cache-middleware-concept)) |

### Error Semantics

- **Returning an error in the pre phase**: the request is never sent; `(nil, err)` propagates outward through the chain and ultimately to the caller.
- **Returning an error in the post phase**: the error likewise propagates outward. If a middleware both holds the response returned by `next` and returns an error, the `executeRequest` safety net releases that response on its behalf (preventing pool leaks), but this behavior should not be relied upon.
- **Context passing**: `finalHandler` prefers `req.Context()` (falling back to the chain's `ctx` when nil). Middleware that derives timeout/cancellation contexts must write them back via `req.SetContext`; `TimeoutMiddleware` calls `SetContext` before invoking `next`.

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
| **Synchronous execution** | The middleware chain runs **synchronously**: when `next` returns, the entire inner chain is done. Asynchronous middleware is not supported; introducing it would cause data races with the object-pool reuse pattern. |
| **Do not replace the request object** | Custom middleware should **mutate `req` in place** (via `SetHeader`/`SetBody`, etc.), never replace `req` with a new object. Replacement breaks the type assertion in `finalHandler`, silently skipping callbacks and the SSRF override. |

:::warning Object-pool leak risk
`executeRequest` acquires a `*engine.Request` from the engine object pool for the middleware chain and returns it via `defer` after the chain returns. If a middleware returns the response from `next` but additionally holds a reference to it (e.g. stashing it in a global cache), that response will be reused after being returned to the pool, causing cross-request data leakage. A caching middleware must deep-copy the response data.
:::

## See Also

- [Built-in Middleware](../client-config/middleware) — 7 middleware factories such as Recovery/Logging/Timeout
- [Request & Response Mutators](./mutators) — full method contracts for `RequestMutator`/`ResponseMutator`
- [Interfaces](../types/interfaces) — type alias definitions for `Handler`/`MiddlewareFunc`
