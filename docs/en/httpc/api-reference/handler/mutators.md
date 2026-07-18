---
sidebar_label: "Request & Response Mutators"
title: "Request & Response Mutators - CyberGo HTTPC | Interfaces"
description: "HTTPC middleware contracts: RequestMutator and ResponseMutator expose all read/write methods for requests and responses, with a compilable header and status code example."
sidebar_position: 2
---

# Request & Response Mutators

Middleware does not touch the underlying request/response objects directly; it reads and writes through **mutator** interfaces. Middleware always receives the full read-write mutator (`RequestMutator` / `ResponseMutator`); the read/write grouping below is for readability only and does not represent separate exported interfaces.

```text
RequestMutator  = Read methods  + Write methods
ResponseMutator = Read methods + Write methods
        ↑                                    ↑
  middleware rewrites the request         middleware reads/rewrites the response
  via RequestMutator                      via ResponseMutator
```

The `Handler` signature `func(ctx, RequestMutator) (ResponseMutator, error)` exposes exactly these two mutators as the middleware's entry and exit points.

## Request Mutator

### Read methods

The following methods read request data. Call them when middleware only needs to **inspect** request properties.

| Method | Return type | Description |
|--------|-------------|-------------|
| `Method()` | `string` | HTTP method |
| `URL()` | `string` | Request URL |
| `Headers()` | `map[string]string` | All request headers |
| `QueryParams()` | `map[string]any` | Query parameters |
| `Body()` | `any` | Request body |
| `Timeout()` | `time.Duration` | Request timeout |
| `MaxRetries()` | `int` | Max retry count |
| `Context()` | `context.Context` | Request context |
| `Cookies()` | `[]http.Cookie` | Request cookies |
| `FollowRedirects()` | `*bool` | Whether to follow redirects |
| `MaxRedirects()` | `*int` | Max redirect count |
| `StreamBody()` | `bool` | Whether to stream the request body |

### Write methods

The following methods modify request data. Call them when middleware only needs to **modify** request properties.

| Method | Description |
|--------|-------------|
| `SetMethod(string)` | Set the HTTP method |
| `SetURL(string)` | Set the URL |
| `SetHeaders(map[string]string)` | Set all request headers |
| `SetHeader(key, value string)` | Set a single request header |
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

The read-write request mutator, covering all methods in the Read methods and Write methods tables above. The internal read/write sub-interfaces live in the `internal/types` package and are not exported separately; externally they are accessed uniformly as `RequestMutator`. Middleware inspects and rewrites request properties through it before the request is sent.

## Response Mutator

### Read methods

The following methods read response data.

| Method | Return type | Description |
|--------|-------------|-------------|
| `StatusCode()` | `int` | Status code |
| `Status()` | `string` | Status text |
| `Proto()` | `string` | Protocol version |
| `Headers()` | `http.Header` | Response headers |
| `Body()` | `string` | Response body (string) |
| `RawBody()` | `[]byte` | Response body (bytes) |
| `ContentLength()` | `int64` | Content length |
| `Duration()` | `time.Duration` | Request duration |
| `Attempts()` | `int` | Attempt count (including retries) |
| `Cookies()` | `[]*http.Cookie` | Response cookies |
| `RedirectChain()` | `[]string` | Redirect chain |
| `RedirectCount()` | `int` | Redirect count |
| `RequestHeaders()` | `http.Header` | Request headers |
| `RequestURL()` | `string` | Request URL |
| `RequestMethod()` | `string` | Request method |

### Write methods

The following methods modify response data.

| Method | Description |
|--------|-------------|
| `SetStatusCode(int)` | Set the status code |
| `SetStatus(string)` | Set the status text |
| `SetProto(string)` | Set the protocol version |
| `SetHeaders(http.Header)` | Set response headers |
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
| `SetHeader(key string, values ...string)` | Set a single response header |

### ResponseMutator

The read-write response mutator, covering all methods in the Read methods and Write methods tables above. The internal read/write sub-interfaces live in the `internal/types` package and are not exported separately; externally they are accessed uniformly as `ResponseMutator`. Middleware reads or rewrites the response through it after the request completes — useful for response caching, content transformation (e.g. JSON pretty-printing), encoding/decoding, and response filtering.

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
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				authMiddleware("my-secret-token"),
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
	fmt.Println(result.IsSuccess())
	// Sample output:
	// Sending GET request
	// Received status code 200
	// true
}
```

## See Also

- [Handler & Middleware Chain](./handler-chain) — overview of the two-layer architecture and the onion model
- [Built-in Middleware](../client-config/middleware) — HeaderMiddleware and others are ready-made examples that work via mutators
- [Interfaces](../types/interfaces) — type alias definitions for the mutators
