---
sidebar_label: "Tutorial"
title: "Hands-On Tutorial - CyberGo HTTPC | GitHub API"
description: "Thirty-minute tutorial building a GitHub API client with HTTPC package functions, WithQuery/WithJSON options, NewDomain, middleware, ClientError, concurrency."
sidebar_position: 10
---

# Hands-On Tutorial: Build a GitHub API Client

The examples below use the GitHub API to demonstrate HTTPC's core features. Reading them in order takes about 30 minutes; each section can also be dipped into on its own when needed. Consider skimming the [Core Concepts](../getting-started/concepts) page first for the big picture before diving in.

**You will learn:**

- Creating clients and using configuration presets
- How package-level functions relate to the default client
- Client instance lifecycle and default configuration
- Sending GET/POST requests and handling JSON responses
- Query parameters and common request options
- Using the domain client to manage an API base URL
- Adding middleware for logging and metrics
- Handling errors and retries
- The Result response object and automatic management

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

Key points:
- The package-level function `httpc.Get` requires no client creation — well suited for quick validation
- A Result is created fresh for each request and reclaimed by GC; no manual release needed

### Package-Level Functions and the Default Client

Package-level functions (`Get`/`Post`/`Request`, etc.) do not each send requests in isolation — they share a **lazily initialized default client**: a singleton is created on the first call, and every later package-level call reuses it. After being closed, the default client "self-heals" — the next package-level call rebuilds it automatically.

You can take over this default client:

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
For long-running services, manage the lifecycle with an explicit client as shown in "Creating and Configuring a Client Instance" below; the default client is a better fit for scripts and one-off requests.
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

Key points:
- `result.Unmarshal(&v)` parses the JSON response directly into a struct
- Define Go structs that correspond to the API response
- When the response body is empty, `Unmarshal` returns `ErrResponseBodyEmpty`; above 50MB it returns `ErrResponseBodyTooLarge`

## Creating and Configuring a Client Instance

Behind the package-level functions there is always a default client; to control configuration and lifecycle, create an instance explicitly with `New`:

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
- `New(cfg)` validates the configuration first, then takes a **deep copy** — modifying the original `cfg` variable after creation does not affect the client's behavior
- `Close()` releases the connection pool and transport resources; requests after the close return `ErrClientClosed`
- A client is safe for concurrent use (see "Concurrent Requests" below) and should be **kept long-lived and reused** — do not create one per request
- `NewDefault()` is equivalent to `New(DefaultConfig())`

### Configuration Presets

Instead of writing configuration from scratch every time, HTTPC offers five presets as starting points:

| Preset | Positioning | Key differences from DefaultConfig |
|--------|-------------|------------------------------------|
| `DefaultConfig()` | General default | 180s request timeout, 3 retries, 10MB response cap, follows redirects |
| `SecureConfig()` | Security first | Tighter timeouts (15s request, 5s dial/TLS), 5MB response cap, redirect following disabled, 1 retry |
| `PerformanceConfig()` | High throughput | Larger connection pool (100 idle / 20 per host), 50MB response cap, 500ms retry delay, cookies enabled |
| `TestingConfig()` | Tests only | Skips TLS verification, allows private IPs, disables URL/header validation (never use in production; calling it outside a test environment prints a warning) |
| `MinimalConfig()` | One-off requests | No retries, no redirect following, 1MB response cap, small connection pool |

Choose `SecureConfig()` for user-supplied URLs or security-sensitive scenarios; choose `PerformanceConfig()` for high-concurrency crawling or proxy scenarios.

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

Request options are `With*` functions: they can be combined freely and are appended after the URL in order:

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
- `WithQuery` values support `string`, numbers, booleans, and other common types; when a value is `nil` the parameter does **not** appear in the URL
- `WithTimeout` accepts 0–30 minutes; negative values return `ErrInvalidTimeout`; this timeout overrides `Timeouts.Request`
- `WithMaxRetries` accepts 0–10 and overrides `Retry.MaxRetries`
- See the [Request Options API](../api-reference/core/options) for the full list of options, and [Request and Response](./request-response) for request/response details

## Creating a Domain Client

All GitHub API endpoints live under `https://api.github.com`; a domain client saves you from repeating the URL:

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
- `NewDomain` creates a scoped client whose paths are relative to baseURL
- `SetHeader` sets persistent headers included with every request
- `WithHeader` passed as a request option applies only to that request
- The domain client manages cookies automatically

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

Key points:
- `WithJSON(data)` serializes automatically and sets the Content-Type
- `result.IsSuccess()` checks for a 2xx status code

## Adding Middleware

Add logging and request IDs to the client:

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

Key points:
- Middleware is configured in `MiddlewareConfig.Middlewares`
- `LoggingMiddleware` records request logs
- `RecoveryMiddleware` guards against panic crashes
- `RequestIDMiddleware` generates a unique ID for every request

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

Key points:
- HTTPC separates network errors from HTTP status codes
- `ClientError` provides error classification and a retryability check
- 408, 429, 500, 502, 503, 504 are retried automatically by default
- `Timeouts.Request` is the **total budget across all retries**, not the timeout of a single attempt

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
`PerformanceConfig()` provides a large connection pool suited to high-concurrency scenarios. A Result is created fresh per request and reclaimed by GC.
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
