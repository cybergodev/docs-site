---
sidebar_label: "Handler & Middleware Chain"
title: "Handler & Middleware Chain - CyberGo HTTPC | Pipeline"
description: "HTTPC two-layer architecture: Layer 1 method APIs assemble a MiddlewareFunc onion chain of Handlers, with the Chain combinator and a custom middleware example."
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

```text
Request flow →

[Middleware A] → [Middleware B] → [Middleware C] → finalHandler → engine
                                                                   ↓
Response flow ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ↓
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

## Custom Middleware Example

A complete timing middleware that records the elapsed time before and after the request, injected into the client via `MiddlewareConfig.Middlewares`.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware records the elapsed time of each request
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// Call the next Handler so the request continues down the chain
			resp, err := next(ctx, req)
			fmt.Printf("%s %s -> elapsed %v\n", req.Method(), req.URL(), time.Since(start))
			return resp, err
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				timingMiddleware(),
			},
		},
	})
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.StatusCode())
	// Sample output:
	// GET https://httpbin.org/get -> elapsed 123.456ms
	// 200
}
```

:::tip
The `resp` returned by a middleware must be passed back unchanged (or via a later `next` call); otherwise the response leaks from the engine object pool. Returning `(nil, error)` while still holding an unreleased response causes a pool leak.
:::

## See Also

- [Built-in Middleware](../client-config/middleware) — 8 ready-to-use middleware factories such as Recovery/Logging/Timeout
- [Request & Response Mutators](./mutators) — full method contracts for `RequestMutator`/`ResponseMutator`
- [Interfaces](../types/interfaces) — type alias definitions for `Handler`/`MiddlewareFunc`
