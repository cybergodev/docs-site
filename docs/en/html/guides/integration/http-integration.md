---
sidebar_label: "HTTP Integration"
title: "HTTP Integration - CyberGo html | Web Service Guide"
description: "CyberGo html with net/http: single-page fetch and extract, concurrent URL fetching, Processor singleton, exponential backoff, batch cancellation, charset handling."
sidebar_position: 10
---

# HTTP Integration

The html library does not ship an HTTP client; pass the response body you fetched with `net/http` to `Extract`. The patterns below cover the common integrations.

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

:::tip Bound the read
`io.LimitReader` caps the body at 50MB (`DefaultMaxInputSize`), so an oversized page is truncated before it is read into memory rather than after the library rejects it:

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
package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/html"
)

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

`Processor` is safe for concurrent use, so several pages can be processed at once:

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
- Do not retry 4xx (except 408 and 429): retrying will not change the result
- Retry 5xx and network errors
- Double the backoff each attempt (1s, 2s, 4s) and cap it
- Set a retry limit; 3 attempts is typical
:::

## Batch + Context Cancellation

Give the whole batch one deadline; items not yet started when it fires count as `Cancelled`:

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Collect only successfully fetched pages: nil or empty input is extracted as an
	// empty document, so mixing failures into the batch reports them as successes.
	pages := make([][]byte, 0, len(urls))
	for _, u := range urls {
		if ctx.Err() != nil {
			log.Println("Fetch deadline reached, stopping")
			break
		}
		body, err := fetchWithRetry(http.DefaultClient, u, 2)
		if err != nil {
			log.Printf("Skipping %s: %v", u, err)
			continue
		}
		pages = append(pages, body)
	}

	batch := processor.ExtractBatchWithContext(ctx, pages)
	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
		batch.Success, batch.Failed, batch.Cancelled)
}
```

A fetch failure and an extraction failure are different things: the caller records the former (the `log.Printf` above), and only the latter lands in `BatchResult.Failed`.

## Encoding Handling

The library determines encoding from the HTML bytes alone (BOM, `<meta charset>`, UTF-8 validity, statistical sampling). It does **not** read the HTTP `Content-Type` header. When a response declares `charset=gbk` but the markup carries no `<meta charset>`, the library decodes the bytes as windows-1252: the text comes back mojibake with no error.

Read the charset from the response header and pass it explicitly:

```go
resp, err := http.Get("https://example.cn/page")
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
if err != nil {
    log.Fatal(err)
}

cfg := html.DefaultConfig()
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if _, params, err := mime.ParseMediaType(ct); err == nil {
        cfg.Encoding = params["charset"] // Empty leaves auto-detection in charge
    }
}

result, err := html.Extract(body, cfg)
if err != nil {
    log.Fatal(err)
}
```

If the header carries no charset and the site is known to use GBK or another non-UTF-8 encoding, set `cfg.Encoding` to that encoding directly. See [Encoding Detection](../core-features/encoding-detection).

## Best Practices

| Scenario | Recommendation |
|----------|---------------|
| Single page extraction | `http.Get()` + `html.Extract()` |
| Web service | Processor singleton + `ExtractWithContext()` |
| Batch crawling | `processURLs()` + Processor reuse |
| Untrusted sources | `HighSecurityConfig()` + `io.LimitReader()` |
| Uncertain encoding | Pass the charset from `Content-Type` explicitly; leave empty to auto-detect |

## Next Steps

- [Processor & Cache](../performance/processor-cache) - Processor lifecycle management
- [Audit Pipeline](../security/audit-pipeline) - Production security monitoring
- [API Reference: Batch Processing](../../api-reference/modules/batch) - Complete batch API
- [Performance](../performance/performance) - Performance tuning tips
