---
sidebar_label: "Tutorial"
title: "Hands-On Tutorial - CyberGo HTTPC | GitHub API"
description: "A GitHub API tutorial for HTTPC: client presets, WithQuery/WithJSON options, NewDomain clients, middleware, ClientError classification, and concurrency."
sidebar_position: 10
---

# Hands-On Tutorial: Build a GitHub API Client

This tutorial is an end-to-end HTTPC example built around the GitHub API, covering client creation, request options, domain clients, middleware, and error handling. Read [Core Concepts](../getting-started/concepts) first if needed; each section also stands alone.

**Scope:**

- Creating clients and using configuration presets
- How package-level functions relate to the default client
- Client instance lifecycle and default configuration
- Sending GET/POST requests and parsing JSON responses
- Query parameters and common request options
- Managing an API base URL with a domain client
- Middleware for logging and request IDs
- Error classification and retries
- The Result response object

## Basic Request

Install the dependency and create `main.go`:

```bash
go get github.com/cybergodev/httpc
```

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://api.github.com/repos/golang/go")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode()) // 200
	fmt.Println(result.Body())       // JSON response
}
```

Key points: `httpc.Get` needs no client and suits quick validation; each `Result` is allocated per request and reclaimed by the GC.

### Package-Level Functions and the Default Client

Package-level functions (`Get`/`Post`/`Request`, etc.) share a **lazily initialized default client**: it is created on the first call and reused by later calls. After the default client is closed, the next call rebuilds it; see [Core Concepts](../getting-started/concepts) for the creation and rebuild rules.

Callers can take over this default client:

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Customize the configuration and set it as the default client
	// (the old default client is closed automatically)
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := httpc.SetDefaultClient(client); err != nil {
		log.Fatal(err)
	}

	// From now on, every package-level function uses this client
	result, err := httpc.Get("https://api.github.com/repos/golang/go")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200

	// Release the default client before the program exits
	if err := httpc.CloseDefaultClient(); err != nil {
		log.Fatal(err)
	}
}
```

:::tip
Long-running services should manage the lifecycle with an explicit client, as shown in "Creating and Configuring a Client Instance" below. The default client fits scripts and one-off requests.
:::

## Parsing JSON Responses

```go
type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

result, err := httpc.Get("https://api.github.com/repos/golang/go")
if err != nil {
    log.Fatal(err)
}

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("Language: %s\n", repo.Language)
fmt.Printf("Description: %s\n", repo.Description)
```

Key points: `result.Unmarshal(&v)` decodes the JSON response into a struct whose fields correspond to the API response. An empty body returns `ErrResponseBodyEmpty`; a body above 50MB returns `ErrResponseBodyTooLarge`.

## Creating and Configuring a Client Instance

Package-level functions always sit on a default client. To control configuration and lifecycle, create an instance explicitly with `New`:

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Timeouts.Dial = 5 * time.Second
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err) // config validation failures (e.g. an invalid timeout) surface here
	}
	defer client.Close()

	result, err := client.Get("https://api.github.com/repos/golang/go",
		httpc.WithUserAgent("my-github-app/1.0"),
	)
	if err != nil {
		if errors.Is(err, httpc.ErrClientClosed) {
			log.Fatal("Client closed: ", err)
		}
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200
}
```

Key points:

- `New(cfg)` validates the configuration and then deep-copies it, so later changes to the original `cfg` do not affect the client
- `Close()` releases the connection pool and transport resources; requests after the close return `ErrClientClosed`
- A client is safe for concurrent use (see "Concurrent Requests") and should stay long-lived and reused
- `NewDefault()` is equivalent to `New(DefaultConfig())`

### Configuration Presets

HTTPC provides five presets as starting points, so configuration need not be written from scratch each time:

| Preset | Positioning | Key differences from DefaultConfig |
|--------|-------------|------------------------------------|
| `DefaultConfig()` | General default | 180s request timeout, 3 retries, 10MB response cap, follows redirects |
| `SecureConfig()` | Security first | Tighter timeouts (15s request, 5s dial/TLS), 5MB response cap, redirect following disabled, 1 retry |
| `PerformanceConfig()` | High throughput | Larger connection pool (100 idle / 20 per host), 50MB response cap, 500ms retry delay, cookies enabled |
| `TestingConfig()` | Tests only | Skips TLS verification, allows private IPs, disables URL/header validation (never use in production; calling it outside a test environment prints a warning) |
| `MinimalConfig()` | One-off requests | No retries, no redirect following, 1MB response cap, small connection pool |

See [Performance Optimization](./performance#preset-comparison) for a full comparison of the five presets and guidance on choosing one.

### Default Configuration at a Glance

Key defaults of `DefaultConfig()` (see the [Configuration API](../api-reference/client-config/config) for the full set of fields):

| Setting | Default | Description |
|---------|---------|-------------|
| `Timeouts.Request` | 180s | Overall request timeout (covers all retry attempts) |
| `Timeouts.Dial` / `Timeouts.TLSHandshake` | 10s / 10s | TCP connection / TLS handshake timeout |
| `Timeouts.IdleConn` | 90s | How long idle connections are kept alive |
| `Connection.MaxIdleConns` / `MaxConnsPerHost` | 50 / 10 | Idle connection pool / per-host connection cap |
| `Retry.MaxRetries` / `Delay` / `BackoffFactor` | 3 / 1s / 2.0 | Retry count, initial delay, backoff factor (jitter on by default; single delay capped at 30s) |
| `Security.MaxResponseBodySize` | 10MB | Response body size cap |
| `Security.MaxDecompressedBodySize` | 100MB | Decompressed response body cap |
| `Defaults.UserAgent` | `httpc/1.0` | Default User-Agent |
| `Security.FollowRedirects` / `MaxRedirects` | true / 10 | Redirect following policy |

## Query Parameters and Request Options

Request options are `With*` functions. They can be combined and are appended after the URL in the order given:

```go
client, _ := httpc.NewDefault()
defer client.Close()

// Query parameters: set them one by one, or in bulk with a Map
result, err := client.Get("https://api.github.com/search/repositories",
    httpc.WithQuery("q", "language:go"),
    httpc.WithQuery("sort", "stars"),
    httpc.WithQueryMap(map[string]any{
        "order": "desc",
        "page":  1,
    }),
)

// Per-request overrides of client defaults: timeout and retries
result, err = client.Get("https://api.github.com/repos/golang/go",
    httpc.WithTimeout(10*time.Second),
    httpc.WithMaxRetries(1),
)
```

Key points:

- `WithQuery` accepts `string`, numeric, boolean, and other types; a `nil` value is omitted from the URL
- `WithTimeout` must be greater than 0 and at most 30 minutes; zero and negative values return `ErrInvalidTimeout`. `WithNoTimeout()` removes the timeout, and the option overrides `Timeouts.Request`
- `WithMaxRetries` accepts 0–10 and overrides `Retry.MaxRetries`

See the [Request Options API](../api-reference/core/options) for the full list, and [Request and Response](./request-response) for request/response details.

## Creating a Domain Client

Every GitHub API endpoint lives under `https://api.github.com`; a domain client avoids repeating that prefix:

```go
client, err := httpc.NewDomainDefault("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// Request paths are relative to baseURL
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
```

Key points:

- `NewDomain` / `NewDomainDefault` creates a domain client whose request paths are relative to baseURL
- `SetHeader` sets persistent headers sent with every request; `WithHeader` applies only to the current request
- A DomainClient embeds a `SessionManager` that injects session headers and cookies before a request and writes back `Set-Cookie` after the response; this session store is independent of `Connection.EnableCookies`

## Sending Data (Create Issue)

```go
type CreateIssueRequest struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}

newIssue := CreateIssueRequest{
    Title: "Bug report",
    Body:  "Found a bug in the API response",
}

result, err := client.Post("/repos/owner/repo/issues",
    httpc.WithJSON(newIssue),
)
if err != nil {
    log.Fatal(err)
}

if !result.IsSuccess() {
    log.Fatalf("Creation failed: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d created: %s\n", created.Number, created.URL)
```

Key points: `WithJSON(data)` serializes the body automatically and sets `Content-Type`; `result.IsSuccess()` checks for a 2xx status code.

## Adding Middleware

Add logging and request-ID middleware to a client:

```go
// Configure middleware
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }}),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
}

// Pass the config to NewDomain to create a domain client with middleware
client, err := httpc.NewDomain("https://api.github.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

Key points: middleware is configured in `cfg.Middleware.Middlewares`, and the slice order is the outer-to-inner execution order. `LoggingMiddleware` records request logs, `RecoveryMiddleware` catches panics, and `RequestIDMiddleware` generates a unique ID per request. See [Middleware Chain](./middleware-chain) for the model.

## Error Handling and Retry

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("Request timed out, retry later")
        case httpc.ErrorTypeNetwork:
            log.Println("Network error")
        case httpc.ErrorTypeTLS:
            log.Println("TLS error")
        default:
            log.Printf("HTTP error: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("This error is retryable")
        }
    }
    return
}

// Handle HTTP status codes
switch {
case result.IsSuccess():
    // 2xx success
case result.StatusCode() == 401:
    log.Println("Token expired or invalid")
case result.IsClientError():
    log.Printf("Client error: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Server error: %d (attempted %d times, including the first request)",
        result.StatusCode(), result.Meta.Attempts)
}
```

Configure the retry strategy:

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

Key points: HTTPC handles network errors and HTTP status codes separately. `ClientError` provides error classification and an `IsRetryable()` check; 408, 429, 500, 502, 503, and 504 are retried automatically by default. `Timeouts.Request` is the total budget across all retry attempts; see [Retry and Fault Tolerance](./retry-fault-tolerance).

## File Download (Download a Release Package)

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rDownload progress: %.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(
    context.Background(),
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nDownload complete: %s (%d bytes)\n",
    result.FilePath,
    result.BytesWritten,
)
```

## Concurrent Requests

Fetch several repositories at once:

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, err := httpc.New(httpc.PerformanceConfig())
    if err != nil {
        return err
    }
    defer client.Close()

    results := make([]*httpc.Result, len(repos))
    errs := make([]error, len(repos))

    var wg sync.WaitGroup
    for i, name := range repos {
        wg.Add(1)
        go func(idx int, repo string) {
            defer wg.Done()
            r, err := client.Request(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s", repo))
            results[idx] = r
            errs[idx] = err
        }(i, name)
    }
    wg.Wait()

    for i, err := range errs {
        if err != nil {
            return err
        }

        var repo Repo
        results[i].Unmarshal(&repo)
        fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
    }
    return nil
}
```

:::tip
`PerformanceConfig()` provides a large connection pool for high-concurrency scenarios. A `Result` is allocated per request and reclaimed by the GC.
:::

## Complete Example

The complete code integrating the examples above:

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cybergodev/httpc"
)

type Repo struct {
	FullName    string `json:"full_name"`
	Description string `json:"description"`
	Stars       int    `json:"stargazers_count"`
	Language    string `json:"language"`
}

func main() {
	token := os.Getenv("GITHUB_TOKEN")

	cfg := httpc.DefaultConfig()
	cfg.Retry.MaxRetries = 3
	cfg.Retry.Delay = 1 * time.Second
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
			log.Printf("[HTTP] "+format, args...)
		}}),
		httpc.RecoveryMiddleware(),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Fetch repository information
	result, err := client.Get("https://api.github.com/repos/golang/go",
		httpc.WithHeader("Authorization", "Bearer "+token),
	)
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.IsRetryable() {
			log.Fatal("Request failed (after retries):", err)
		}
		log.Fatal(err)
	}

	if result.IsSuccess() {
		var repo Repo
		result.Unmarshal(&repo)
		fmt.Printf("✅ %s\n", repo.FullName)
		fmt.Printf("   ⭐ %d | Language: %s\n", repo.Stars, repo.Language)
		fmt.Printf("   %s\n", repo.Description)
		fmt.Printf("   Duration: %s (attempted %d times, including the first request)\n",
			result.Meta.Duration, result.Meta.Attempts)
	}
}
```

## Next Steps

- [Request and Response](./request-response) - The complete request options reference
- [Middleware Chain](./middleware-chain) - Custom middleware development
- [Retry and Fault Tolerance](./retry-fault-tolerance) - Advanced retry strategies
- [Domain Client and Sessions](./domain-session) - Session state management
- [Performance Optimization](./performance) - Production tuning
- [Configuration API](../api-reference/client-config/config) - All configuration fields and presets
- [Production Checklist](../security/production-checklist) - Security best practices
