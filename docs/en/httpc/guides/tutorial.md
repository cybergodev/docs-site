---
title: Tutorial - HTTPC
description: Build a GitHub REST API client in this hands-on tutorial, learning HTTPC configuration presets, request options, domain clients, middleware, and error handling in 30 minutes.
---

# Tutorial: Building a GitHub API Client

Build a GitHub API client to connect the core concepts of HTTPC. Takes about 30 minutes.

**What you will learn:**

- Creating clients and configuration presets
- Sending GET/POST requests and handling JSON responses
- Using domain clients to manage API base URLs
- Adding middleware for logging and metrics
- Handling errors and retries
- Optimizing performance with object pool reuse

## Step 1: Basic Request

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
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON response
}
```

Key points:
- The package-level function `httpc.Get` requires no client creation, ideal for quick validation
- `defer httpc.ReleaseResult(result)` returns the result to the object pool

## Step 2: Parsing JSON Responses

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
defer httpc.ReleaseResult(result)

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("Language: %s\n", repo.Language)
fmt.Printf("Description: %s\n", repo.Description)
```

Key points:
- `result.Unmarshal(&v)` directly parses the JSON response into a struct
- Define Go structs that correspond to the API response

## Step 3: Creating a Domain Client

All GitHub API endpoints are under `https://api.github.com`. Use a domain client to avoid repeating the URL:

```go
client, err := httpc.NewDomain("https://api.github.com")
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
defer httpc.ReleaseResult(result)
```

Key points:
- `NewDomain` creates a scoped client where paths are relative to the baseURL
- `SetHeader` sets persistent request headers, automatically included with every request
- `WithHeader` is passed as a request option, only effective for the current request
- Domain clients automatically manage cookies

## Step 4: Sending Data (Creating an Issue)

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
defer httpc.ReleaseResult(result)

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
- `WithJSON(data)` automatically serializes and sets Content-Type
- `result.IsSuccess()` checks for 2xx status codes

## Step 5: Adding Middleware

Add logging and request IDs to the client:

```go
// Configure middleware
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// Pass config to NewDomain to create a domain client with middleware
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
defer httpc.ReleaseResult(result)

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

Key points:
- Middleware is configured in `Config.Middleware.Middlewares`
- `LoggingMiddleware` records request logs
- `RecoveryMiddleware` prevents panic crashes
- `RequestIDMiddleware` generates a unique ID for each request

## Step 6: Error Handling and Retries

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
            log.Println("This error can be automatically retried")
        }
    }
    return
}
defer httpc.ReleaseResult(result)

// Handle HTTP status codes
switch {
case result.IsSuccess():
    // 2xx success
case result.StatusCode() == 401:
    log.Println("Token expired or invalid")
case result.IsClientError():
    log.Printf("Client error: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Server error: %d (auto-retried %d times)",
        result.StatusCode(), result.Meta.Attempts)
}
```

Configure retry strategy:

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

Key points:
- HTTPC separates network errors from HTTP status codes
- `ClientError` provides error classification and retryability assessment
- Automatically retries on 408, 429, 500, 502, 503, 504 by default

## Step 7: File Download (Downloading a Release Package)

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rDownload progress: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions(
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nDownload complete: %s (%s)\n",
    result.FilePath,
    httpc.FormatBytes(result.BytesWritten),
)
```

## Step 8: Concurrent Requests

Fetch multiple repositories simultaneously:

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, _ := httpc.New(httpc.PerformanceConfig())
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
        httpc.ReleaseResult(results[i])
    }
    return nil
}
```

:::tip
`PerformanceConfig()` provides a large connection pool configuration, suitable for high-concurrency scenarios. Remember to use `ReleaseResult` correctly in concurrent code.
:::

## Complete Example

The complete code integrating the above steps:

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
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        httpc.RecoveryMiddleware(),
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Fetch repository info
    result, err := client.Get("https://api.github.com/repos/golang/go",
        httpc.WithHeader("Authorization", "Bearer "+token),
    )
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && clientErr.IsRetryable() {
            log.Fatal("Request failed (retried):", err)
        }
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | Language: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   Duration: %s (retried %d times)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## Next Steps

- [Request and Response](./request-response) - Complete request options reference
- [Middleware Chain](./middleware-chain) - Custom middleware development
- [Retry and Fault Tolerance](./retry-fault-tolerance) - Advanced retry strategies
- [Performance Optimization](../advanced/performance) - Production tuning
- [Production Checklist](../security/production-checklist) - Security best practices
