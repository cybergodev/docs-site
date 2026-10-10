---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo HTTPC | 5-Minute Setup"
description: "HTTPC quick start: go get install, GET/POST requests, five config presets, JSON parsing, Bearer Token auth, and ClientError classification in 5 minutes."
sidebar_position: 10
---

# Quick Start

## Installation

```bash
# 1. Create a project and initialize a Go module (skip this step if you already have one)
mkdir httpc-demo && cd httpc-demo
go mod init example.com/httpc-demo

# 2. Add the dependency
go get github.com/cybergodev/httpc
```

Import it in your code:

```go
import "github.com/cybergodev/httpc"
```

HTTPC requires Go 1.26 or later; apart from `golang.org/x/sys` it has no other third-party dependencies, and you can send your first request without any configuration.

## Basic Requests

No client needed — use the package-level functions directly:

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
	fmt.Println(result.Body())       // Response body
}
```

Supported HTTP methods: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

### What Just Happened

- Package-level functions use a **lazily-initialized shared default client** internally — created on the first call, reused afterwards, and safe for concurrent use;
- The returned `*Result` aggregates the status code, response headers, response body, and request metadata (duration, attempts, redirect chain);
- `err != nil` indicates a **network-layer error** only (connection failure, timeout, TLS error, etc.); 4xx/5xx status codes must be checked yourself via methods like `result.IsSuccess()`;
- The default configuration ships TLS 1.2+, SSRF protection, a 10MB response-body cap, and up to 3 smart retries — no extra setup required.

## Creating a Client

When you need custom configuration, create a client instance:

```go
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

A client holds resources such as the connection pool, so remember to call `Close()` when done. Long-running services usually create one client for the lifetime of the process and share it globally — `Client` is safe for concurrent use, so there is no need to create one per request or per goroutine.

### Configuration Presets

| Config | Use Case | Characteristics |
|--------|----------|-----------------|
| `DefaultConfig()` | General scenarios | Secure defaults, SSRF protection enabled |
| `SecureConfig()` | Security-sensitive scenarios | Disables auto-redirects, strict timeouts |
| `PerformanceConfig()` | High-throughput scenarios | Large connection pool, long timeouts, cookies enabled |
| `TestingConfig()` | Test environments | Disables security checks and HTTP/2, cookies enabled |
| `MinimalConfig()` | Lightweight requests | No retries, no redirects |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

You can also set defaults that apply to every request (User-Agent, default headers, redirect policy):

```go
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers["Authorization"] = "Bearer " + token
cfg.Defaults.FollowRedirects = false

client, err := httpc.New(cfg)
```

## Response Handling

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}

// Status checks
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

Parse into a custom struct:

```go
var repo struct {
    Name  string `json:"name"`
    Stars int    `json:"stargazers_count"`
}
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}
```

Inspect request metadata:

```go
result.Meta.Duration       // Total duration (including retry waits)
result.Meta.Attempts       // Attempts made (first try + retries)
result.Meta.RedirectChain  // Chain of redirect URLs followed
result.Meta.ProxyURL       // Proxy used for this request (empty for direct or system proxy)
```

:::tip
`Unmarshal` returns `ErrResponseBodyEmpty` when the response body is empty, and `ErrResponseBodyTooLarge` when it exceeds 50MB.
:::

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

```go
// Query parameters
result, err := client.Get("https://httpbin.org/get",
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{"limit": 10, "sort": "desc"}),
)
```

```go
// File upload (multipart/form-data)
result, err := client.Post("https://httpbin.org/post",
    httpc.WithFile("file", "report.pdf", fileBytes),
)
```

## Error Handling

HTTPC distinguishes **network-layer errors** from **HTTP status codes**:

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("Error code: %s", clientErr.Code())
    }
    log.Fatal(err)
}

// HTTP status codes must be checked manually
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
4xx/5xx responses are not returned as `error`; check them via methods like `result.IsSuccess()`. See [Error Handling](../guides/error-handling) for details.
:::

## Your First Complete Program

Here is a complete example you can run directly with `go run`: it queries repository information from the GitHub API and covers creating a client, setting headers, timeout control, status checking, and JSON parsing:

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// Repo maps the GitHub API repository response
type Repo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Stars       int    `json:"stargazers_count"`
}

func main() {
	// 1. Create a client (default config: TLS 1.2+, SSRF protection, up to 3 retries)
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 2. Send the request: default headers + per-request timeout
	result, err := client.Get("https://api.github.com/repos/golang/go",
		httpc.WithUserAgent("httpc-demo/1.0"),
		httpc.WithTimeout(15*time.Second),
	)
	if err != nil {
		log.Fatal(err) // Network-layer error (connection/timeout/TLS, etc.)
	}

	// 3. Check the HTTP status code (4xx/5xx are not errors; check manually)
	if !result.IsSuccess() {
		log.Fatalf("HTTP error: %d", result.StatusCode())
	}

	// 4. Parse the JSON into a struct
	var repo Repo
	if err := result.Unmarshal(&repo); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%s: %s (%d stars)\n", repo.Name, repo.Description, repo.Stars)
	fmt.Printf("Duration %v, attempts %d\n", result.Meta.Duration, result.Meta.Attempts)
}

// Output (star count and duration vary with the real API):
// go: The Go programming language (124000 stars)
// Duration 350ms, attempts 1
```

## Common First-Step Scenarios

### Calling a JSON API (auth + query parameters)

```go
result, err := client.Get("https://api.example.com/v1/issues",
    httpc.WithBearerToken(token),                                   // Bearer auth
    httpc.WithQueryMap(map[string]any{"state": "open", "page": 2}), // Query parameters
    httpc.WithHeader("Accept", "application/json"),
)
```

### Requests with Timeouts and Retries

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second // Overall timeout budget (includes all retries)
	cfg.Retry.MaxRetries = 3                // Up to 3 retries (0 disables)
	cfg.Retry.Delay = time.Second           // Initial backoff of 1s
	cfg.Retry.BackoffFactor = 2.0           // Backoff ×2 each retry (1s -> 2s -> 4s)
	cfg.Retry.EnableJitter = true           // Jitter to avoid thundering herds

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// httpbin's /status/503 always returns 503 (a retryable status code)
	result, err := client.Get("https://httpbin.org/status/503")
	if err != nil {
		log.Fatal(err) // Network-layer error
	}

	// 503 is retryable: once retries are exhausted the last response is returned (not an error)
	fmt.Println("Status code:", result.StatusCode()) // 503
	fmt.Println("Attempts:", result.Meta.Attempts)   // 4 (first try + 3 retries)
}

// Output:
// Status code: 503
// Attempts: 4
```

### Accessing Local or Intranet Services

The default configuration blocks connections to private/reserved addresses such as `127.0.0.1`, `10.x`, and `192.168.x` (SSRF protection). There are three ways to open access for local development:

```go
// Option 1: per-request exemption (recommended; smallest blast radius)
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// Option 2: exempt specific intranet CIDRs (e.g. Tailscale, VPC)
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
client, _ := httpc.New(cfg)

// Option 3: testing preset (local development/testing only; never use in production)
client, _ = httpc.New(httpc.TestingConfig())
```

See [SSRF Protection](../security/ssrf) for details.

## Next Steps

**Learning path**

- **[Core Concepts](./concepts)** - The two-layer architecture, configuration system, and request lifecycle
- **[Request & Response](../guides/request-response)** - Complete request options and response handling
- **[Migrating from net/http](../guides/migration)** - Map standard-library experience item by item

**Dig deeper by topic**

- **[Retry & Fault Tolerance](../guides/retry-fault-tolerance)** - Backoff strategies, custom retries, and proxy-pool interaction
- **[Middleware Chain](../guides/middleware-chain)** - Logging, metrics, audit, and custom middleware
- **[Connection Pool & DNS](../guides/connection-pool)** - Connection-pool tuning and DoH
- **[Proxy & Proxy Pool](../guides/proxy)** - Single proxy, system proxy, pool rotation, and circuit breaking
- **[File Upload & Download](../guides/file-transfer)** - Downloads, resumable transfers, and file upload
- **[Domain Client & Sessions](../guides/domain-session)** - DomainClient and cookie session management
- **[Redirects](../guides/redirects)** - Follow policy and the domain whitelist
- **[Performance](../guides/performance)** - Tuning checklist and scenario presets
- **[Testing Guide](../guides/testing)** - TestingConfig and mock approaches

**More resources**

- **[Tutorial](../guides/tutorial)** - Build a GitHub API client in 30 minutes
- **[Cheat Sheet](./cheatsheet)** - Quick reference for common operations
- **[Basic Examples](../examples/basic-usage)** - Runnable minimal examples
- **[API Reference Overview](../api-reference/)** - Index of all public APIs
- **[Security](../security/)** - Security best practices and the production checklist
