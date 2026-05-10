---
title: Getting Started - HTTPC
description: Get started with the HTTPC secure HTTP client library in five minutes, covering module installation, GET/POST requests, client configuration, JSON parsing, and error handling.
---

# Getting Started

## Installation

```bash
go get github.com/cybergodev/httpc
```

## Basic Requests

No need to create a client. Use package-level functions directly:

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
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // Response body
}
```

Supported HTTP methods: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

## Creating a Client

Create a client instance when you need custom configuration:

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

### Configuration Presets

| Preset | Use Case | Characteristics |
|--------|----------|-----------------|
| `DefaultConfig()` | General use | Secure defaults, SSRF protection enabled |
| `SecureConfig()` | Security-sensitive scenarios | Disables auto-redirect, strict timeouts |
| `PerformanceConfig()` | High throughput | Large connection pool, longer timeouts, cookies enabled |
| `TestingConfig()` | Test environments | Disables security checks and HTTP/2, short timeouts |
| `MinimalConfig()` | Lightweight requests | No retries, no redirects |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

## Response Handling

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// Status check
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// JSON parsing
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

## Sending Data

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// Form
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// With authentication
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

## Error Handling

HTTPC distinguishes between **network-level errors** and **HTTP status codes**:

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("Error code: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTP status codes need manual checking
switch {
case result.IsSuccess():
    // 2xx success
case result.IsClientError():
    log.Printf("Client error: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Server error: %d", result.StatusCode())
}
```

:::tip
4xx/5xx responses are not returned as `error`. Check them using methods like `result.IsSuccess()`. See [Error Handling](./advanced/error-handling) for details.
:::

## Next Steps

- **[Tutorial](./guides/tutorial)** - Build a GitHub API client in 30 minutes
- **[Request and Response](./guides/request-response)** - Complete request options and response handling
- **[Basic Usage](./examples/basic-usage)** - Practical examples for GET/POST/middleware
- **[Cheatsheet](./cheatsheet)** - Quick reference for common operations
- **[Security](./security/)** - Security best practices
