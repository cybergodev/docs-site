---
title: "HTTP Integration - HTML"
description: "HTTP client integration guide for CyberGo HTML, covering fetch-and-extract with net/http, batch processing, timeout control, and production deployment."
---

# HTTP Integration

The HTML library does not include an HTTP client — it integrates seamlessly with the standard library `net/http`. This guide demonstrates common integration patterns.

## Basic Fetch & Extract

The simplest pattern: fetch a page, extract content.

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"

    "github.com/cybergodev/html"
)

func main() {
    resp, err := http.Get("https://example.com/article")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        log.Fatalf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatal(err)
    }

    result, err := html.Extract(body)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Title:", result.Title)
    fmt.Println("Words:", result.WordCount)
}
```

:::tip Optimization
Limit input size to prevent memory issues:

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB
```
:::

## Configuring HTTP Client

For production, configure reasonable timeouts and connection pool parameters:

```go
client := &http.Client{
    Timeout: 15 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `Timeout` | 10-30s | Covers connect+TLS+read/write |
| `MaxIdleConns` | 10-50 | Global max idle connections |
| `MaxIdleConnsPerHost` | 5-10 | Per-host max idle connections |
| `IdleConnTimeout` | 90s | Idle connection keep-alive time |

## Processor Singleton + HTTP Service

In web services, reuse a single Processor instance for all requests:

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    body, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
    if err != nil {
        http.Error(w, "read failed", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning Input Validation
Always limit request body size in web services to prevent malicious large file attacks. Use `io.LimitReader` or `http.MaxBytesReader`.
:::

## Concurrent URL Fetching

Leverage Processor's concurrency safety for efficient multi-page processing:

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := http.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, _ := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            result, err := processor.Extract(body)
            results[idx] = URLResult{URL: u, Result: result, Error: err}
        }(i, url)
    }

    wg.Wait()
    return results
}
```

Usage example:

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(p, urls) {
    if r.Error != nil {
        log.Printf("%s: error - %v", r.URL, r.Error)
        continue
    }
    fmt.Printf("%s: %s (%d words)\n", r.URL, r.Result.Title, r.Result.WordCount)
}
```

## Fetch with Retry

Handle network instability:

```go
func fetchWithRetry(client *http.Client, url string, maxRetries int) ([]byte, error) {
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            lastErr = err
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("server error: HTTP %d", resp.StatusCode)
            resp.Body.Close()
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
        }

        body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
        resp.Body.Close()
        if err != nil {
            return nil, err
        }
        return body, nil
    }

    return nil, fmt.Errorf("failed after %d retries: %w", maxRetries, lastErr)
}
```

:::tip Retry Strategy
- Don't retry 4xx errors (client issues)
- Retry 5xx and network errors
- Use exponential backoff: 1s, 2s, 4s
- Set max retry count (usually 3)
:::

## Batch + Context Cancellation

Use context-aware batch processing for large URL sets, supporting timeout cancellation:

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
    // Set total timeout
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    // Fetch all pages
    pages := make([][]byte, len(urls))
    for i, u := range urls {
        select {
        case <-ctx.Done():
            fmt.Println("Fetch timeout, cancelled")
            return
        default:
            body, err := fetchWithRetry(http.DefaultClient, u, 2)
            if err != nil {
                log.Printf("Skipping %s: %v", u, err)
                continue
            }
            pages[i] = body
        }
    }

    // Batch extract
    batch := processor.ExtractBatchWithContext(ctx, pages)
    fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)
}
```

## Encoding Handling

HTTP responses may use non-UTF-8 encoding. The HTML library auto-detects and handles this:

```go
// Even GBK-encoded responses are correctly extracted
resp, _ := http.Get("https://example.cn/page")
body, _ := io.ReadAll(resp.Body)
result, _ := html.Extract(body) // Auto-detect encoding
```

You can also extract encoding from the `Content-Type` header:

```go
charset := "utf-8" // Parse from Content-Type
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if idx := strings.Index(ct, "charset="); idx != -1 {
        charset = ct[idx+8:]
    }
}

cfg := html.DefaultConfig()
cfg.Encoding = charset
result, _ := html.Extract(body, cfg)
```

## Best Practices

| Scenario | Recommendation |
|----------|---------------|
| Single page extraction | `http.Get()` + `html.Extract()` |
| Web service | Processor singleton + `ExtractWithContext()` |
| Batch crawling | `processURLs()` + Processor reuse |
| Untrusted sources | `HighSecurityConfig()` + `io.LimitReader()` |
| Uncertain encoding | Rely on auto-detection, or specify from Content-Type |

## Next Steps

- [Cache & Reuse](./processor-cache) - Processor lifecycle management
- [Audit Pipeline](./audit-pipeline) - Production security monitoring
- [API Reference: Batch Processing](../api-reference/batch) - Complete batch API
- [Performance](../advanced/performance) - Performance tuning tips
