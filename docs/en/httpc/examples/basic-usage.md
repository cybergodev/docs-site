---
sidebar_label: "Basic Usage"
title: "Basic Usage - CyberGo HTTPC | Runnable Examples"
description: "HTTPC basics: all HTTP methods, query params/auth, XML/binary bodies, status checks and the Result triple, DefaultConfig, proxy, middleware, and downloads."
sidebar_position: 10
---

# Basic Usage

This page provides runnable examples of basic HTTPC usage: each HTTP method, request-body types, query parameters, authentication, response-status checks, and configuration presets.

## GET Requests

### Basic GET

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode()) // 200
	fmt.Println(result.Body())
}
```

### With Query Parameters

```go
result, err := httpc.Get("https://httpbin.org/get",
    httpc.WithQuery("name", "test"),
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{
        "limit": 10,
        "sort":  "desc",
    }),
)
```

### With Authentication

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

Beyond Bearer, authentication and request headers have three more common patterns.

```go
// Basic authentication
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBasicAuth("username", "password"),
)

// API key (as a custom header)
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithHeader("X-API-Key", "your-api-key"),
)

// Batch-set headers + a custom User-Agent
result, err = httpc.Get("https://api.example.com/me",
    httpc.WithHeaderMap(map[string]string{
        "X-API-Version": "v1",
        "X-Client-ID":   "client-123",
    }),
    httpc.WithUserAgent("MyApp/1.0"),
)
```

## POST Requests

### JSON Request Body

```go
data := map[string]any{
    "name":  "John",
    "email": "john@example.com",
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithJSON(data),
)
if err != nil {
    log.Fatal(err)
}

// Parse the JSON response
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### Form Submission

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### File Upload

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### Multi-Field Form

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

### XML Request Body

```go
type Person struct {
    XMLName xml.Name `xml:"person"`
    Name    string   `xml:"name"`
    Age     int      `xml:"age"`
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithXML(Person{Name: "Jane", Age: 28}),
)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.StatusCode()) // 200
```

### Plain Text and Binary

String request bodies are sent as `text/plain`; binary data requires an explicit MIME type:

```go
// Plain text: Content-Type is set to text/plain automatically
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithBody("Hello, this is plain text!"),
)

// Binary: Content-Type is an optional argument
pngHeader := []byte{0x89, 0x50, 0x4E, 0x47}
result, err = httpc.Post("https://httpbin.org/post",
    httpc.WithBinary(pngHeader, "image/png"),
)
```

### Forcing the Body Type (BodyKind)

`WithBody` infers the encoding from the input type; the second argument forces a specific kind:

```go
// map[string]string auto-detects as form encoding; force JSON encoding here
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithBody(map[string]string{"key": "value"}, httpc.BodyJSON),
)
```

## Other HTTP Methods

PUT, DELETE, HEAD, PATCH, OPTIONS, and the generic `Request` are all available. The example below demonstrates every method in turn:

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
		log.Fatal(err)
	}
	defer client.Close()

	// PUT: replace the resource entirely
	put, err := client.Put("https://httpbin.org/put",
		httpc.WithJSON(map[string]string{"name": "Jane", "status": "active"}),
		httpc.WithBearerToken("your-token"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("PUT:", put.StatusCode()) // Output: PUT: 200

	// DELETE: remove a resource
	del, err := client.Delete("https://httpbin.org/delete",
		httpc.WithHeader("X-Request-ID", "delete-123"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("DELETE:", del.StatusCode()) // Output: DELETE: 200

	// HEAD: fetch headers only (no body), ideal for probing existence and size
	head, err := client.Head("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("HEAD:", head.StatusCode())                                 // Output: HEAD: 200
	fmt.Println("Content-Type:", head.Response.Headers.Get("Content-Type")) // Output: Content-Type: application/json

	// PATCH: partial update (submit only the changed fields)
	patch, err := client.Patch("https://httpbin.org/patch",
		httpc.WithJSON(map[string]string{"status": "inactive"}),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("PATCH:", patch.StatusCode()) // Output: PATCH: 200

	// OPTIONS: discover the methods the server allows (same idea as a CORS preflight)
	opt, err := client.Options("https://httpbin.org/post")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("OPTIONS:", opt.StatusCode()) // Output: OPTIONS: 200
}
```

Method quick reference:

| Method | Has Body | Idempotent | Typical Use |
|--------|:---:|:---:|-------------|
| GET | No | Yes | Fetching resources |
| HEAD | No | Yes | Headers only (probe existence/size/cache metadata) |
| POST | Yes | No | Creating resources, submitting data |
| PUT | Yes | Yes | Replacing a resource entirely |
| PATCH | Yes | No | Partial updates |
| DELETE | No | Yes | Deleting resources |
| OPTIONS | No | Yes | Discovering allowed methods |

### Generic Request Method

When the HTTP method is only known at runtime (from configuration, a request builder, or proxy forwarding), call `Request(ctx, method, url, options...)`:

```go
ctx := context.Background()

for _, m := range []struct{ method, url string }{
    {"GET", "https://httpbin.org/get"},
    {"POST", "https://httpbin.org/post"},
    {"PUT", "https://httpbin.org/put"},
} {
    resp, err := client.Request(ctx, m.method, m.url,
        httpc.WithJSON(map[string]string{"key": "value"}),
    )
    if err != nil {
        log.Printf("%s error: %v", m.method, err)
        continue
    }
    fmt.Printf("%s %s -> %d\n", m.method, m.url, resp.StatusCode())
}
```

## Response Handling

The `*Result` returned by every request is a request/response/metadata triple. The three nested structs are allocated together and share a single block of memory:

| Group | Key Fields | Description |
|-------|------------|-------------|
| `result.Request` | `URL` / `Method` / `Headers` / `Cookies` | The request actually sent |
| `result.Response` | `StatusCode` / `Status` / `Proto` / `Headers` / `Body` / `RawBody` / `ContentLength` / `Cookies` | Response data |
| `result.Meta` | `Duration` / `Attempts` / `RedirectCount` / `RedirectChain` / `ProxyURL` | Execution metadata (retry count, redirect chain, etc.) |

### Status Checking

```go
result, err := client.Get("https://httpbin.org/get")
if err != nil {
    log.Fatal(err) // Transport-level error (DNS, timeout, connection failure, etc.)
}

switch {
case result.IsSuccess():     // 2xx
    fmt.Println("Success")
case result.IsRedirect():    // 3xx (when redirects are not followed)
    fmt.Println("Redirect to:", result.Response.Headers.Get("Location"))
case result.IsClientError(): // 4xx
    fmt.Println("Client error: check request parameters/auth")
    if result.StatusCode() == http.StatusTooManyRequests {
        fmt.Println("Rate limited, retry after:", result.Response.Headers.Get("Retry-After"))
    }
case result.IsServerError(): // 5xx
    fmt.Println("Server error: retrying may help")
}
```

:::tip err and status codes are two separate error layers
Transport-level failures (DNS, timeout, TLS) surface as `err != nil`. HTTP 4xx/5xx does **not** count as `err`: the response arrives normally, and the caller classifies it with methods like `IsSuccess()`.
:::

### Choosing Between Body / RawBody / String

| Method | Returns | Best For |
|--------|---------|----------|
| `result.Body()` | `string` (pre-read) | Reading text directly; no extra cost |
| `result.RawBody()` | `[]byte` (raw) | Feeding APIs that take a byte slice (hashing, re-decoding) |
| `result.String()` | Formatted summary | Debug printing (status, headers, body summary); the most expensive — keep it off hot paths |

```go
result, _ := client.Get("https://httpbin.org/get")

fmt.Println(len(result.Body()))        // Example output: 268 (body length)
fmt.Println(len(result.RawBody()))     // Example output: 268 (byte view of the same data)
fmt.Println(result.Meta.Attempts)      // Output: 1 (increases after retries)
fmt.Println(result.Meta.RedirectCount) // Output: 0 (greater than 0 if redirects were followed)
```

## Client Creation

### Custom Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

### Proxy Configuration

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## Middleware

### Logging + Recovery

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
}
cfg.Defaults.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### Request ID + Metrics

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.MetricsMiddleware(&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }}),
}

client, _ := httpc.New(cfg)
```

## File Download

```go
client, _ := httpc.NewDefault()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rDownloading: %.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nDownload complete: %d bytes, duration %v, average speed %.2f MB/s\n",
    result.BytesWritten,
    result.Duration,
    float64(result.AverageSpeed)/1024/1024,
)
```

## Domain Client

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Set session information
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Requests automatically include session headers and cookies
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## Next Steps

- [Advanced Examples](./advanced-usage) - Custom retry, middleware chains, concurrent downloads
- [Request & Response](../guides/request-response) - Request options in detail
- [Domain Client & Sessions](../guides/domain-session) - Session management
