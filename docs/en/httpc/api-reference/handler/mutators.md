---
sidebar_label: "Request & Response Mutators"
title: "Request & Response Mutators - CyberGo HTTPC | Mutator API"
description: "HTTPC middleware contracts: all read/write methods of RequestMutator and ResponseMutator, WithOnRequest/WithOnResponse options, and compilable examples."
sidebar_position: 20
---

# Request & Response Mutators

Middleware does not touch the underlying request/response objects directly; it reads and writes through **mutator** interfaces. Middleware always receives the full read-write mutator (`RequestMutator` / `ResponseMutator`); the read/write grouping below is for readability only.

```text
RequestMutator  =  Read methods  +  Write methods
ResponseMutator =  Read methods  +  Write methods
        ↑                                    ↑
  middleware rewrites the request      middleware reads/rewrites the response
  via RequestMutator                   via ResponseMutator
```

The `Handler` signature `func(ctx, RequestMutator) (ResponseMutator, error)` exposes exactly these two mutators as the middleware's entry and exit points.

## Request Mutator

### Read methods

The following methods read request data. Call them when middleware only needs to **inspect** request properties.

| Method | Return type | Description |
|------|----------|------|
| `Method()` | `string` | HTTP method |
| `URL()` | `string` | Request URL |
| `Headers()` | `map[string]string` | All request headers (key → single value) |
| `QueryParams()` | `map[string]any` | Query parameters |
| `Body()` | `any` | Request body |
| `Timeout()` | `time.Duration` | Request timeout |
| `MaxRetries()` | `int` | Max retry count |
| `Context()` | `context.Context` | Request context |
| `Cookies()` | `[]http.Cookie` | Request cookies |
| `FollowRedirects()` | `*bool` | Whether to follow redirects (nil means use the default) |
| `MaxRedirects()` | `*int` | Max redirect count (nil means use the default) |
| `StreamBody()` | `bool` | Whether to stream the request body |

### Write methods

The following methods modify request data. Call them when middleware only needs to **modify** request properties.

| Method | Description |
|------|------|
| `SetMethod(string)` | Set the HTTP method |
| `SetURL(string)` | Set the URL |
| `SetHeaders(map[string]string)` | Set all request headers (full replacement) |
| `SetHeader(key, value string)` | Set a single request header (add/modify) |
| `SetQueryParams(map[string]any)` | Set query parameters |
| `SetBody(any)` | Set the request body |
| `SetTimeout(time.Duration)` | Set the timeout |
| `SetMaxRetries(int)` | Set the max retry count |
| `SetContext(context.Context)` | Set the context |
| `SetCookies([]http.Cookie)` | Set cookies |
| `SetFollowRedirects(*bool)` | Set whether to follow redirects |
| `SetMaxRedirects(*int)` | Set the max redirect count |
| `SetStreamBody(bool)` | Set whether to stream |

### RequestMutator

`RequestMutator` is the read-write request mutator interface that httpc exposes, covering every method in the Read methods and Write methods tables above. It is composed from the two split interfaces `RequestReader` and `RequestWriter`, both exported by the `httpc` package as public type aliases (`httpc.RequestReader` / `httpc.RequestWriter`; full method tables in [Reader/Writer Split Interfaces](../types/interfaces)). Middleware inspects and rewrites request properties through it before the request is sent.

## Typical RequestMutator Operations in Middleware

| Scenario | Method combination | Description |
|----------|----------|------|
| Modify request headers | `SetHeader(key, val)` / `Headers()` + `SetHeader` | Inject auth headers, trace IDs, API version |
| Modify query parameters | `QueryParams()` → add/remove → `SetQueryParams` | Append common query parameters |
| Modify request body | `Body()` → transform → `SetBody` | Request-body compression, signature injection |
| Set timeout | `SetTimeout(d)` | Dynamically adjust timeout per request path |
| Set context | `SetContext(ctx)` | Middleware-level timeout (how `TimeoutMiddleware` works) |

```go
// Typical: read existing headers, append a custom header, write back
headers := req.Headers()
headers["X-Trace-ID"] = generateTraceID()
req.SetHeaders(headers)

// Equivalent (more concise)
req.SetHeader("X-Trace-ID", generateTraceID())
```

## Response Mutator

### Read methods

The following methods read response data.

| Method | Return type | Description |
|------|----------|------|
| `StatusCode()` | `int` | Status code |
| `Status()` | `string` | Status text (e.g. `"200 OK"`) |
| `Proto()` | `string` | Protocol version (e.g. `"HTTP/1.1"`) |
| `Headers()` | `http.Header` | Response headers |
| `Body()` | `string` | Response body (string) |
| `RawBody()` | `[]byte` | Response body (bytes) |
| `ContentLength()` | `int64` | Content length |
| `Duration()` | `time.Duration` | Request duration |
| `Attempts()` | `int` | Attempt count (including retries) |
| `Cookies()` | `[]*http.Cookie` | Response cookies |
| `RedirectChain()` | `[]string` | Redirect chain (URL of each hop) |
| `RedirectCount()` | `int` | Redirect count |
| `RequestHeaders()` | `http.Header` | Request headers actually sent |
| `RequestURL()` | `string` | Actual request URL (final URL after redirects) |
| `RequestMethod()` | `string` | Request method |

### Write methods

The following methods modify response data.

| Method | Description |
|------|------|
| `SetStatusCode(int)` | Set the status code |
| `SetStatus(string)` | Set the status text |
| `SetProto(string)` | Set the protocol version |
| `SetHeaders(http.Header)` | Set response headers (full replacement) |
| `SetBody(string)` | Set the response body |
| `SetRawBody([]byte)` | Set the response body (bytes) |
| `SetContentLength(int64)` | Set the content length |
| `SetDuration(time.Duration)` | Set the duration |
| `SetAttempts(int)` | Set the attempt count |
| `SetCookies([]*http.Cookie)` | Set cookies |
| `SetRedirectChain([]string)` | Set the redirect chain |
| `SetRedirectCount(int)` | Set the redirect count |
| `SetRequestHeaders(http.Header)` | Set request headers |
| `SetRequestURL(string)` | Set the request URL |
| `SetRequestMethod(string)` | Set the request method |
| `SetHeader(key string, values ...string)` | Set a single response header (add/modify) |

### ResponseMutator

`ResponseMutator` is the read-write response mutator interface that httpc exposes, covering every method in the Read methods and Write methods tables above. It is composed from the two split interfaces `ResponseReader` and `ResponseWriter`, both exported by the `httpc` package as public type aliases (`httpc.ResponseReader` / `httpc.ResponseWriter`; full method tables in [Reader/Writer Split Interfaces](../types/interfaces)). Middleware reads or rewrites the response through it after the request completes — commonly used for response caching, content transformation (e.g. JSON pretty-printing), encoding/decoding, and response filtering.

## Typical ResponseMutator Operations in Middleware

| Scenario | Method combination | Description |
|----------|----------|------|
| Read status code | `StatusCode()` | Conditional logging, error classification |
| Read response headers | `Headers()` | Extract `X-Request-ID`, `Content-Type` |
| Compute metrics | `Duration()` + `Attempts()` | Report duration, retry count |
| Trace redirects | `RedirectChain()` + `RedirectCount()` | Audit redirect paths |
| Modify response headers | `SetHeader(key, vals...)` | Append trace headers, security headers |

## Type Assertion: Accessing Engine-Specific Methods

The `RequestMutator` received by middleware is at runtime actually of type `*engine.Request` (the engine's concrete request struct). `finalHandler` reads three engine-specific hooks **not on the interface** from it via type assertion. Custom middleware that needs these hooks must do the same.

:::warning Interface boundary
The `OnRequest`/`OnResponse` callbacks and `AllowPrivateIPs` are not on the `RequestMutator` interface — their signatures reference types from the internal `engine` package (`*engine.Request`/`*engine.Response`), and exposing them on the public interface would cause an import cycle. Therefore they can only be accessed via `*engine.Request` type assertion.
:::

These engine-specific methods include:

| Method (only on `*engine.Request`) | Description |
|-------------------------------------|------|
| `OnRequest() func(*engine.Request) error` | Callback fired before the request is sent |
| `OnResponse() func(*engine.Response) error` | Callback fired after the response is received |
| `AllowPrivateIPs() *bool` | Per-request SSRF override |
| `SetOnRequest(func)` / `SetOnResponse(func)` | Set callbacks |
| `SetAllowPrivateIPs(*bool)` | Set the SSRF override |

The vast majority of middleware **does not** need type assertion — the `RequestMutator`/`ResponseMutator` interfaces already cover all common read/write operations. You only need to assert to the concrete type when you need callbacks or SSRF overrides.

## Request-Option Callbacks: WithOnRequest / WithOnResponse

Besides middleware, there is a pair of request options directly tied to the mutators: `WithOnRequest` fires a callback before the request is sent, with the `RequestMutator` as its parameter; `WithOnResponse` fires after the response is received, with the `ResponseMutator` as its parameter. You can get hold of the mutators for inspection or lightweight rewriting without writing any middleware.

<!-- check-code: skip -->
```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

| Option | Callback timing | Callback parameter | Error behavior |
|------|---------|---------|---------|
| `WithOnRequest` | Before the request is sent | `RequestMutator` | Any callback returning an error aborts the request |
| `WithOnResponse` | After the response is received | `ResponseMutator` | Any callback returning an error fails the request with that error |

Multiple callbacks can be registered in a chain and execute in order of addition; passing a nil callback returns an error when the option is applied (`"onRequest callback cannot be nil"` / `"onResponse callback cannot be nil"`).

:::tip Callbacks vs middleware
Callbacks have no `next`: they cannot short-circuit the request, nor wrap it at the response stage — they only suit "inspect + lightweight rewrite". When you need to control execution order, short-circuit, or wrap the response, write a middleware instead (see [Handler & Middleware Chain](./handler-chain)).
:::

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	defer func() { _ = client.Close() }()

	result, err := client.Get("https://httpbin.org/get",
		// Before the request is sent: inspect the request and inject
		// a header via RequestMutator
		httpc.WithOnRequest(func(req httpc.RequestMutator) error {
			fmt.Printf("Sending %s %s\n", req.Method(), req.URL())
			req.SetHeader("X-Trace-ID", "trace-42")
			return nil
		}),
		// After the response is received: read the status via
		// ResponseMutator
		httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
			fmt.Printf("Received status code %d\n", resp.StatusCode())
			return nil
		}),
	)
	if err != nil {
		log.Fatalf("request failed: %v", err)
	}
	fmt.Println("success:", result.IsSuccess())
	// Sample output:
	// Sending GET https://httpbin.org/get
	// Received status code 200
	// success: true
}
```

For the item-by-item reference of all request options, see [Request Options](../core/options).

## SanitizedURL Cache

Multiple middlewares may all need to log the sanitized URL (a URL with credentials removed). To avoid recomputing it, HTTPC caches the sanitized result on the request object so it is shared across middlewares for the same request.

```text
getOrComputeSanitizedURL(req):
  ① Does req implement the sanitizedURLer interface (SanitizedURL/SetSanitizedURL)?
     - *engine.Request implements this interface
  ② Cached? → return the cached value directly
  ③ Not cached? → compute SanitizeURL(req.URL()), cache it, return it
```

The built-in `LoggingMiddleware`, `MetricsMiddleware`, and `AuditMiddleware` all use `getOrComputeSanitizedURL` to share the sanitized result, so URL sanitization is **computed only once** across the entire chain. Custom middleware that logs URLs should use this mechanism too, rather than calling `req.URL()` directly (which may contain credentials).

:::tip URL sanitization
When logging URLs in a logging/metrics middleware, never use `req.URL()` directly — if the URL contains `user:pass@host` credentials, they will leak into the logs. The built-in middlewares automatically strip the credentials via `getOrComputeSanitizedURL`.
:::

## Example: Reading and Writing via Mutators

An authentication middleware that injects an auth header via `RequestMutator.SetHeader` and reads the response status code via `ResponseMutator.StatusCode`.

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// authMiddleware injects an auth header via RequestMutator
// and reads the status code via ResponseMutator
func authMiddleware(token string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// Write: set a request header via RequestMutator
			req.SetHeader("Authorization", "Bearer "+token)
			// Read: inspect the request method via RequestMutator
			fmt.Printf("Sending %s request\n", req.Method())

			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// Read: get the status code via ResponseMutator
			fmt.Printf("Received status code %d\n", resp.StatusCode())
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		authMiddleware("my-secret-token"),
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
	fmt.Println(result.IsSuccess())
	// Sample output:
	// Sending GET request
	// Received status code 200
	// true
}
```

## Practical Example: Request/Response Logging Middleware

A complete logging middleware that demonstrates the read/write capabilities of both `RequestMutator` and `ResponseMutator` — reading the request method/URL and the response status code/duration/retry info via mutators and formatting the output uniformly.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// loggingMiddleware reads full request and response info via mutators
// and formats the output
func loggingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()

			// Request phase: read request info
			log.Printf("[REQ] %s %s", req.Method(), req.URL())

			resp, err := next(ctx, req)
			duration := time.Since(start)

			if err != nil {
				// Error response: no status code to read
				log.Printf("[ERR] %s %s -> %v (%v)",
					req.Method(), req.URL(), err, duration)
				return nil, err
			}

			// Response phase: read status code, duration, retry
			// count, redirect chain
			log.Printf("[RESP] %s %s -> %d (%v, attempts=%d, redirects=%d)",
				req.Method(),
				req.URL(),
				resp.StatusCode(),
				duration,
				resp.Attempts(),
				resp.RedirectCount(),
			)
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		loggingMiddleware(),
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
	fmt.Println("status code:", result.StatusCode())
	// Sample output:
	// [REQ] GET https://httpbin.org/get
	// [RESP] GET https://httpbin.org/get -> 200 (123.456ms, attempts=1, redirects=0)
	// status code: 200
}
```

## See Also

- [Handler & Middleware Chain](./handler-chain) — overview of the two-layer architecture and the onion model
- [Built-in Middleware](../client-config/middleware) — HeaderMiddleware and others are ready-made examples that work via mutators
- [Request Options](../core/options) — WithOnRequest/WithOnResponse and all the other WithXxx options
- [Interfaces](../types/interfaces) — type alias definitions for the mutators
