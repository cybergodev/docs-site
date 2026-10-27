---
sidebar_label: "HTTP Integration"
title: "HTTP Integration - CyberGo html | Web Service Guide"
description: "CyberGo html with net/http: single-page fetch and extract, reader mode for LLM input, Processor singletons, concurrent fetching, and charset handling."
sidebar_position: 10
---

# HTTP Integration

CyberGo html ships no HTTP client; fetching is done by the caller with `net/http`, and the response body is handed to `Extract` or `ReadPage*`. The patterns below cover the common integrations.

## Basic Fetch & Extract

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

:::tip Limit the read size before buffering
`io.LimitReader` caps the body at 50MB (`DefaultMaxInputSize`), so an oversized page is never read into memory only to be rejected by the library:

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB
```

When the limit is hit, `io.LimitReader` **truncates silently** without an error, and the truncated HTML may be an incomplete document that still extracts successfully. To tell "exactly 50MB" from "more than 50MB", set the limit to `50*1024*1024+1` and check the length you read; on the server side, `http.MaxBytesReader` returns an error instead.
:::

## Feeding an LLM with Reader Mode

When a whole fetched page goes to an LLM, there is no need to call `Extract` and assemble Markdown yourself: `ReadPageToMarkdown` takes the HTTP response body directly and emits whole-page Markdown with inline links, keeping section headings (`Header`/`Main Content`/`Footer`, etc.) as structural signals.

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // resp from http.Get
if err != nil {
	log.Fatal(err)
}
md, err := html.ReadPageToMarkdown(body) // whole-page Markdown, including [text](URL)
if err != nil {
	log.Fatal(err)
}
```

Switch to `ReadPageToMarkdownText` when you want the whole-page output without links (the section layout stays the same and link labels are kept as plain words). Section rules, the `ReadResult` structure, and the preserve switches are in [Reader Mode](../core-features/reader-mode). `ReadPage*` does not use the cache, so cache the result in the caller when the same URL is fetched repeatedly.

## Configuring the HTTP Client

In production, configure timeouts and the connection pool explicitly. The `http.Get` above uses the **default client, which has no timeout** — a stuck server blocks the caller indefinitely, so it is fit only for demos and one-off scripts:

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
| `Timeout` | 10-30s | Covers connect, TLS handshake, and read/write end to end |
| `MaxIdleConns` | 10-50 | Global maximum idle connections |
| `MaxIdleConnsPerHost` | 5-10 | Maximum idle connections per host |
| `IdleConnTimeout` | 90s | How long an idle connection is kept |

## Processor Singleton + HTTP Service

In a web service, reuse a single Processor instance for every request:

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
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("Failed to encode response: %v", err)
	}
}

func main() {
	defer processor.Close()

	http.HandleFunc("/extract", extractHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning Input size limits
A web service must limit the request body size, or a malicious large upload will exhaust memory. `io.LimitReader` truncates silently while `http.MaxBytesReader` returns an error; pick whichever fits. The handler above caps the body at 10MB, below the default `MaxInputSize` (50MB), so the stricter of the two applies.
:::

## Concurrent URL Fetching

`Processor` is safe for concurrent use: share one instance to process several pages at once (the HTTP client is the same — reuse one timeout-configured client throughout):

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(client *http.Client, processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := client.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
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
client := &http.Client{Timeout: 15 * time.Second}

p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(client, p, urls) {
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
	client := &http.Client{Timeout: 15 * time.Second}

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
		body, err := fetchWithRetry(client, u, 2)
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

The library determines encoding from the HTML bytes alone (BOM, `<meta charset>`, UTF-8 validity, statistical sampling) and **does not read the HTTP `Content-Type` header**. When a response declares `charset=gbk` but the markup carries no `<meta charset>`, the library decodes the bytes as windows-1252: the text comes back mojibake with no error.

The reliable shape is to read the charset from the response header and pass it explicitly to `Config.Encoding`:

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

If the header carries no charset and the site is known to use GBK or another non-UTF-8 encoding, hard-code that encoding in `cfg.Encoding`. See [Encoding Detection](../core-features/encoding-detection).

## Best Practices

| Scenario | Recommendation |
|----------|---------------|
| Single page extraction | `http.Get()` + `html.Extract()` |
| Whole page to an LLM | `html.ReadPageToMarkdown()` / `ReadPageToMarkdownText()` |
| Web service | Processor singleton + `ExtractWithContext()` |
| Batch crawling | `processURLs()` + Processor reuse |
| Untrusted sources | `HighSecurityConfig()` + limit by `MaxInputSize` (10MB in that preset) |
| Uncertain encoding | Pass the charset from `Content-Type` explicitly; leave empty to rely on auto-detection |

## Next Steps

- [Reader Mode](../core-features/reader-mode) - Whole-page sections, `Render`, and the preserve switches
- [Processor Cache & Reuse](../performance/processor-cache) - Processor lifecycle management
- [Audit Pipeline](../security/audit-pipeline) - Production security monitoring
- [API Reference: Batch Processing](../../api-reference/modules/batch) - Complete batch API
- [Performance](../performance/performance) - Performance tuning tips
