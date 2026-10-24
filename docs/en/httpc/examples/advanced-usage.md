---
sidebar_label: "Advanced Usage"
title: "Advanced Examples - CyberGo HTTPC | Production Code"
description: "HTTPC advanced examples: RetryPolicy retries, callbacks, middleware chains, domain clients, cookie sessions, worker pools, and HMAC signing middleware."
sidebar_position: 20
---

# Advanced Examples

This page provides runnable examples for advanced HTTPC scenarios: custom retry policies, timeout and retry combinations, request/response callbacks, a full middleware chain, a REST client wrapper, and concurrency control.

## Custom Retry Strategy

Retry only on 502/503/504 with a fixed delay:

:::tip Type Publicly Exported
The `resp` parameter type `ResponseReader` in RetryPolicy.ShouldRetry is exported by the `httpc` package as a public type alias (`httpc.ResponseReader`), so external packages can reference it directly. A custom `RetryPolicy` can be implemented in any business package, and the example below compiles as-is. When a custom `RetryPolicy` is not needed, configure the `RetryConfig` fields instead.
:::

```go
// ResponseReader is publicly exported by the httpc package (httpc.ResponseReader).
// This example compiles in any package that imports github.com/cybergodev/httpc.

type selectiveRetry struct {
    maxAttempts int
    baseDelay   time.Duration
}

// Determine whether to retry
func (p *selectiveRetry) ShouldRetry(resp httpc.ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    if err != nil {
        return true // Retry on network errors
    }
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

func (p *selectiveRetry) GetDelay(attempt int) time.Duration {
    return p.baseDelay * time.Duration(attempt+1)
}

func (p *selectiveRetry) MaxRetries() int {
    return p.maxAttempts
}

// Apply the custom strategy
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &selectiveRetry{maxAttempts: 5, baseDelay: time.Second}
```

The alternative when no custom strategy is needed — configure via `RetryConfig`:

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
	cfg.Retry.MaxRetries = 5
	cfg.Retry.Delay = 500 * time.Millisecond
	cfg.Retry.BackoffFactor = 1.5
	cfg.Retry.EnableJitter = true

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/unstable")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode())
}
```

## Combining Timeouts and Retries

The three layers of time control cover different scopes: the context manages the total budget for the whole group of attempts, `WithTimeout` caps a single attempt, and `WithMaxRetries` limits the number of attempts.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// ctx 30s: total budget covering all retries and backoff waits
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Post("https://httpbin.org/post",
		httpc.WithJSON(map[string]string{"data": "important"}),
		httpc.WithContext(ctx),            // Total budget
		httpc.WithTimeout(10*time.Second), // Per-attempt cap
		httpc.WithMaxRetries(3),           // At most 3 retries
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode())               // Output: 200
	fmt.Println("Attempts:", result.Meta.Attempts) // Output: Attempts: 1 (increases after failed retries)
	fmt.Println("Total duration:", result.Meta.Duration)
}
```

To disable retries (for example, for a non-idempotent create operation), declare it explicitly with `WithMaxRetries(0)`:

```go
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]string{"action": "create"}),
    httpc.WithMaxRetries(0), // No retries: avoid duplicate creation
)
```

## Complete Middleware Chain

```go
package main

import (
	"encoding/json"
	"log"
	"sync/atomic"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Request counter
	var requestCount int64

	// Metrics collection
	metricsMiddleware := httpc.MetricsMiddleware(
		&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
			atomic.AddInt64(&requestCount, 1)
			log.Printf("[METRICS] %s %s -> %d (%v)", method, url, statusCode, duration)
		}},
	)

	// Audit logging (JSON format)
	auditCfg := httpc.DefaultAuditConfig()
	auditCfg.Format = "json"
	auditCfg.IncludeHeaders = true
	auditCfg.MaskHeaders = []string{"Authorization", "Cookie"}
	auditCfg.SanitizeError = true
	auditCfg.OnAudit = func(event httpc.AuditEvent) {
		data, _ := json.Marshal(event)
		log.Printf("[AUDIT] %s", data)
	}
	auditMiddleware := httpc.AuditMiddleware(auditCfg)

	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(), // Panic recovery
		httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}), // Enforced timeout
		httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),                           // Request ID
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
			log.Printf("[HTTP] "+format, args...)
		}}),
		metricsMiddleware,
		auditMiddleware,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	_, err = client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Total requests: %d", atomic.LoadInt64(&requestCount))
}
```

## Request/Response Callbacks

When a full middleware is not needed, the two per-request callbacks `WithOnRequest` / `WithOnResponse` cover lightweight observation and debugging. The request callback receives a mutable request before it is sent; the response callback receives a readable response once it completes:

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

	onRequest := func(req httpc.RequestMutator) error {
		fmt.Printf("[Request] %s %s (carrying %d headers)\n",
			req.Method(), req.URL(), len(req.Headers()))
		return nil // Returning a non-nil error aborts the request
	}

	onResponse := func(resp httpc.ResponseMutator) error {
		fmt.Printf("[Response] %d %s, took %v, %d attempts\n",
			resp.StatusCode(), resp.Status(), resp.Duration(), resp.Attempts())
		return nil
	}

	result, err := client.Get("https://httpbin.org/get",
		httpc.WithOnRequest(onRequest),
		httpc.WithOnResponse(onResponse),
		httpc.WithQuery("test", "callbacks"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Status:", result.StatusCode()) // Output: Status: 200
}
```

Division of labor with middleware: callbacks are **single-request** hooks (logging, debugging, simple metrics); composable, short-circuiting pipeline processing across all requests belongs to the [middleware chain](../guides/middleware-chain).

## REST API Client Wrapper

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

type APIClient struct {
	dc httpc.DomainClienter
}

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func NewAPIClient(baseURL, token string) (*APIClient, error) {
	dc, err := httpc.NewDomainDefault(baseURL)
	if err != nil {
		return nil, err
	}
	if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
		dc.Close()
		return nil, err
	}
	if err := dc.SetHeader("Accept", "application/json"); err != nil {
		dc.Close()
		return nil, err
	}

	return &APIClient{dc: dc}, nil
}

func (c *APIClient) GetUser(ctx context.Context, id int) (*User, error) {
	result, err := c.dc.Request(ctx, "GET", fmt.Sprintf("/users/%d", id))
	if err != nil {
		return nil, err
	}

	if !result.IsSuccess() {
		return nil, fmt.Errorf("API error: %d", result.StatusCode())
	}

	var user User
	if err := result.Unmarshal(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *APIClient) CreateUser(ctx context.Context, name string) (*User, error) {
	result, err := c.dc.Request(ctx, "POST", "/users",
		httpc.WithJSON(map[string]string{"name": name}),
	)
	if err != nil {
		return nil, err
	}

	var user User
	if err := result.Unmarshal(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *APIClient) Close() error {
	return c.dc.Close()
}

func main() {
	api, err := NewAPIClient("https://api.example.com", "my-token")
	if err != nil {
		log.Fatal(err)
	}
	defer api.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create a user
	user, err := api.CreateUser(ctx, "Alice")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created: %+v\n", user)

	// Get the user
	user, err = api.GetUser(ctx, user.ID)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Fetched: %+v\n", user)
}
```

## Domain Client (Custom Configuration)

Besides `NewDomainDefault(baseURL)`, `NewDomain(baseURL, cfg)` accepts a full `Config`: presets, timeouts, retries, and proxies are all customizable. The domain client manages session headers and cookies automatically, and a single request can temporarily override session headers:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Customize field by field on top of the default config
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 15 * time.Second
	cfg.Retry.MaxRetries = 2
	cfg.Defaults.UserAgent = "domain-client-demo/1.0"

	dc, err := httpc.NewDomain("https://httpbin.org", cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	fmt.Println("Base URL:", dc.URL())  // Output: Base URL: https://httpbin.org
	fmt.Println("Domain:", dc.Domain()) // Output: Domain: httpbin.org

	// Session headers: automatically carried by every request to this domain
	if err := dc.SetHeaders(map[string]string{
		"X-API-Version": "v1",
		"X-Client-ID":   "client-123",
	}); err != nil {
		log.Fatal(err)
	}

	// Override a session header for a single request without touching the persistent session
	resp, err := dc.Get("/get",
		httpc.WithHeader("X-API-Version", "v2"), // Effective for this request only
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Request status:", resp.StatusCode())     // Output: Request status: 200
	fmt.Println("Session headers:", len(dc.GetHeaders())) // Output: Session headers: 2

	// Inject session cookies manually; response cookies are merged into the session automatically too
	if err := dc.SetCookies([]*http.Cookie{
		{Name: "session", Value: "abc123"},
	}); err != nil {
		log.Fatal(err)
	}

	resp2, err := dc.Get("/cookies") // Session cookies are sent with the request automatically
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Second request:", resp2.StatusCode()) // Output: Second request: 200

	// Session() returns the underlying SessionManager (used standalone in the next section)
	session := dc.Session()
	session.UpdateFromResult(resp2) // Merge this response's cookies into the session
	fmt.Println("Session cookies:", len(session.GetCookies()))
}
```

:::warning Relative paths and option side effects
A relative `path` (such as `/get`) is joined with the baseURL automatically; a full URL (with scheme) is used as-is. The domain client also executes request options **twice** (once to capture session state, once for the actual request), so options with side effects such as counters or nonces should not be passed in.
:::

## Advanced Cookie Usage

### Four Ways to Send Cookies

```go
// 1. WithCookies (full http.Cookie struct, with attributes; a single cookie is a one-element slice)
result, err := client.Get("https://httpbin.org/cookies",
    httpc.WithCookies([]http.Cookie{{
        Name:     "auth_token",
        Value:    "xyz789",
        Path:     "/api",
        Expires:  time.Now().Add(24 * time.Hour),
        Secure:   true,
        HttpOnly: true,
    }}),
)

// 2. A cookie string (copied straight from browser DevTools)
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieString("cookie1=value1; cookie2=value2"),
)

// 3. A cookie map
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieMap(map[string]string{
        "theme": "dark",
        "lang":  "en",
    }),
)

// 4. Combining several approaches
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieString("session=abc123"),
    httpc.WithCookies([]http.Cookie{{Name: "manual", Value: "cookie"}}),
)
```

### Reading Response Cookies and Automatic Management

```go
result, _ := client.Get("https://httpbin.org/response-headers?Set-Cookie=session=abc123")

fmt.Println(len(result.Response.Cookies))       // Example output: 1 (cookies carried by the response)
if c := result.GetCookie("session"); c != nil { // Exact lookup by name
    fmt.Println(c.Value) // Output: abc123
}
fmt.Println(result.HasCookie("nonexistent")) // Output: false

// Automatic cross-request management: with the cookie jar enabled, response cookies are stored automatically and replayed on later requests
cfg := httpc.DefaultConfig()
cfg.Connection.EnableCookies = true
jarClient, _ := httpc.New(cfg)
defer jarClient.Close()

_, _ = jarClient.Get("https://httpbin.org/cookies/set?session=xyz789") // Cookie stored in the jar
resp, _ := jarClient.Get("https://httpbin.org/cookies")                 // Replayed automatically
fmt.Println(resp.StatusCode()) // Output: 200
```

For session-level cookies and security validation (`WithSecureCookie` + `StrictCookieSecurityConfig`), see [Domain Client & Sessions](../guides/domain-session).

## Standalone SessionManager Sessions

A session (persistent headers + cookies) is not tied to the domain client: it can be created standalone and injected into any request. It fits scenarios such as multiple identities against the same service, or manually orchestrated request options:

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/httpc"
)

func main() {
	session, err := httpc.NewSessionManagerDefault()
	if err != nil {
		log.Fatal(err)
	}

	// Persistent headers: applied to every request that goes through this session
	if err := session.SetHeader("Authorization", "Bearer my-token"); err != nil {
		log.Fatal(err)
	}
	if err := session.SetHeaders(map[string]string{
		"X-API-Version": "v2",
		"X-Client-ID":   "session-demo",
	}); err != nil {
		log.Fatal(err)
	}

	// Persistent cookies
	if err := session.SetCookies([]*http.Cookie{
		{Name: "session_id", Value: "abc123"},
		{Name: "preferences", Value: "theme_dark"},
	}); err != nil {
		log.Fatal(err)
	}

	fmt.Println("Session headers:", len(session.GetHeaders())) // Output: Session headers: 3
	fmt.Println("Session cookies:", len(session.GetCookies())) // Output: Session cookies: 2

	if c := session.GetCookie("session_id"); c != nil {
		fmt.Printf("Found cookie: %s = %s\n", c.Name, c.Value) // Output: Found cookie: session_id = abc123
	}

	// Selective deletion and full clearing
	session.DeleteHeader("X-API-Version")
	session.DeleteCookie("preferences")
	fmt.Println("After deletion, headers/cookies:", len(session.GetHeaders()), "/", len(session.GetCookies()))
	// Output: After deletion, headers/cookies: 2 / 1

	session.ClearHeaders()
	session.ClearCookies()
	fmt.Println("After clearing, headers/cookies:", len(session.GetHeaders()), "/", len(session.GetCookies()))
	// Output: After clearing, headers/cookies: 0 / 0
}
```

## Concurrent Downloads

```go
package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"

	"github.com/cybergodev/httpc"
)

func main() {
	urls := map[string]string{
		"file1.zip": "https://example.com/files/file1.zip",
		"file2.zip": "https://example.com/files/file2.zip",
		"file3.zip": "https://example.com/files/file3.zip",
	}

	client, _ := httpc.NewDefault()
	defer client.Close()

	var successCount int64
	var totalBytes int64
	var wg sync.WaitGroup

	for filename, url := range urls {
		wg.Add(1)
		go func(name, u string) {
			defer wg.Done()

			cfg := httpc.DefaultDownloadConfig()
			cfg.FilePath = "/tmp/" + name
			cfg.Overwrite = true
			cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
				fmt.Printf("\r%s: %.1f%% (%s/s)", name,
					float64(downloaded)/float64(total)*100,
					float64(speed)/1024/1024)
			}

			result, err := client.Download(context.Background(), u, cfg)
			if err != nil {
				log.Printf("%s download failed: %v", name, err)
				return
			}

			atomic.AddInt64(&successCount, 1)
			atomic.AddInt64(&totalBytes, result.BytesWritten)
			fmt.Printf("\n%s complete: %d\n", name, result.BytesWritten)
		}(filename, url)
	}

	wg.Wait()
	fmt.Printf("\nDownloads complete: %d/%d, total %d\n",
		successCount, len(urls), totalBytes)
}
```

## Concurrent Requests: Worker Pools and Semaphores

When fetching batches of URLs, a worker pool fixes concurrency at the worker count, while the semaphore pattern lets the workload flex dynamically but caps how many requests are in flight at once. Both use a single `Client` (HTTPC's Client is safe for concurrent use, and its connection pool is reused across goroutines):

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Local mock server: each request takes 20ms
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(20 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // Allow the 127.0.0.1 local server
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	const (
		numWorkers = 5
		numJobs    = 20
	)

	jobs := make(chan string, numJobs)
	results := make(chan int, numJobs)

	// A fixed number of workers consume the jobs: concurrency stays at numWorkers
	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range jobs {
				resp, err := client.Get(url)
				if err != nil {
					log.Printf("Request failed: %v", err)
					results <- 0
					continue
				}
				results <- resp.StatusCode()
			}
		}()
	}

	start := time.Now()
	for i := 0; i < numJobs; i++ {
		jobs <- fmt.Sprintf("%s/api/item/%d", server.URL, i)
	}
	close(jobs)
	wg.Wait()
	close(results)

	var okCount int64
	for status := range results {
		if status >= 200 && status < 300 {
			okCount++
		}
	}
	fmt.Printf("worker pool: %d/%d succeeded in %v (serial would take about %v)\n",
		okCount, numJobs, time.Since(start), numJobs*20*time.Millisecond)
	// Example output: worker pool: 20/20 succeeded in about 90ms (serial would take about 400ms)

	// Semaphore pattern: goroutines can be many, but at most maxInFlight requests are in flight
	const maxInFlight = 3
	sem := make(chan struct{}, maxInFlight)
	var wg2 sync.WaitGroup
	var okCount2 int64
	start = time.Now()

	for i := 0; i < numJobs; i++ {
		wg2.Add(1)
		go func(id int) {
			defer wg2.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			resp, err := client.Get(fmt.Sprintf("%s/api/request/%d", server.URL, id))
			if err != nil {
				return
			}
			if resp.IsSuccess() {
				atomic.AddInt64(&okCount2, 1)
			}
		}(i)
	}
	wg2.Wait()
	fmt.Printf("semaphore: %d/%d succeeded in %v\n", okCount2, numJobs, time.Since(start))
	// Example output: semaphore: 20/20 succeeded in about 140ms
}
```

:::tip Matching concurrency to the connection pool
In HTTP/1.1 scenarios, when the worker count or semaphore limit stays above `Connection.MaxConnsPerHost`, requests queue at the transport layer and total throughput stops improving. With HTTP/2 (enabled by default) the same host shares a multiplexed connection and is less affected. See [Performance](../guides/performance).
:::

## Structured Error Handling

A `ClientError` carries the category (`Code()`/`Type`), retryability (`IsRetryable()`), and request context (URL/Method/Attempts/StatusCode). Extract it with `errors.As` and branch by category:

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// A 1-nanosecond timeout: reliably triggers a timeout error for the demo
	_, err = client.Get("https://httpbin.org/get",
		httpc.WithTimeout(1*time.Nanosecond),
	)
	if err == nil {
		log.Fatal("expected timeout error")
	}

	// errors.Is: sentinel error checks (context errors propagate through Unwrap)
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		fmt.Println("Request timed out; consider a larger timeout or check the network")
	case errors.Is(err, context.Canceled):
		fmt.Println("Request canceled")
	}

	// errors.As: extract the structured error
	var clientErr *httpc.ClientError
	if errors.As(err, &clientErr) {
		fmt.Println("Code:", clientErr.Code())             // Output: Code: TIMEOUT
		fmt.Println("Method:", clientErr.Method)           // Output: Method: GET
		fmt.Println("Attempts:", clientErr.Attempts)       // Output: Attempts: 1
		fmt.Println("Retryable:", clientErr.IsRetryable()) // Output: Retryable: false

		switch clientErr.Code() {
		case "TIMEOUT":
			fmt.Println("-> Branch: timeout, retry with a larger budget")
		case "NETWORK_ERROR", "DNS_ERROR":
			fmt.Println("-> Branch: network/DNS failure, check connectivity")
		case "TLS_ERROR", "CERTIFICATE":
			fmt.Println("-> Branch: certificate issue, verify the CA and system clock")
		case "RETRY_EXHAUSTED":
			fmt.Println("-> Branch: retries exhausted, switch to fallback logic")
		}
	}
}
```

HTTP status-code errors (4xx/5xx responses classified as `HTTP_ERROR`) also carry `clientErr.StatusCode`; the `Cause` field keeps the underlying error so `errors.Unwrap` can drill further down. For the complete error classification table, see [Error Handling](../guides/error-handling) and [Error Types](../api-reference/types/errors).

## Saving Responses to Disk: SaveToFile and Download

When the response body is already in memory, `SaveToFile` writes it to disk; for large files, `Download` streams to disk with progress, resumption, and checksum support:

```go
package main

import (
	"context"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Body already in memory: write it straight to disk (the path goes through the same safety checks as Download)
	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}
	if err := result.SaveToFile("response.json"); err != nil {
		log.Fatal(err)
	}

	// Large files: Download streams to disk + SHA-256 verification (a mismatch deletes the file automatically)
	cfg := httpc.DefaultDownloadConfig()
	cfg.FilePath = "large-file.bin"
	cfg.Overwrite = true
	cfg.Checksum = "SHA-256 hex from a trusted source such as the release manifest"

	if _, err := client.Download(
		context.Background(), // Pass Background when no cancellation/timeout is needed — never nil
		"https://example.com/large-file.bin",
		cfg,
	); err != nil {
		log.Fatal(err)
	}
	log.Println("Saved to disk")
}
```

## Default Client Management

Behind the package-level functions (`httpc.Get` and friends) sits a lazily initialized default client. `SetDefaultClient` swaps in an instance with custom configuration (the old instance is closed automatically), after which all package-level calls use the new configuration:

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// Start from the default config and change only what you need
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 5 * time.Second
	cfg.Retry.MaxRetries = 0

	customClient, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	// Make it the default client: package-level functions now all use the new configuration (the old default client is closed automatically)
	if err := httpc.SetDefaultClient(customClient); err != nil {
		log.Fatal(err)
	}

	result, err := httpc.Get("https://httpbin.org/get") // Uses the 5s timeout and 0 retries
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // Output: 200

	// Cleanup: close the default client to release the connection pool
	if err := httpc.CloseDefaultClient(); err != nil {
		log.Fatal(err)
	}
}
```

Typical scenarios: customizing global behavior once at application startup, or switching configuration per environment (development/production).

`SetDefaultClient` only accepts clients created by `httpc.New`, and it rejects an already-closed instance. A swap closes the old default client and aborts its in-flight requests (concurrent callers observe connection errors), so call it only at startup or during a quiescent window, never under live traffic. For lazy creation and recreation of the default client, see [Core Concepts](../getting-started/concepts).

## Custom Middleware: Request Signing

```go
package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func SigningMiddleware(secret string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			timestamp := time.Now().Unix()
			message := fmt.Sprintf("%s%s%d", req.Method(), req.URL(), timestamp)

			mac := hmac.New(sha256.New, []byte(secret))
			mac.Write([]byte(message))
			signature := hex.EncodeToString(mac.Sum(nil))

			req.SetHeader("X-Timestamp", fmt.Sprintf("%d", timestamp))
			req.SetHeader("X-Signature", signature)

			return next(ctx, req)
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		SigningMiddleware("my-secret-key"),
	}

	client, _ := httpc.New(cfg)
	defer client.Close()

	result, err := client.Get("https://api.example.com/protected")
	if err != nil {
		log.Fatal(err)
	}
	log.Println(result.StatusCode())
}
```

## Next Steps

- [Middleware Chain](../guides/middleware-chain) - Middleware architecture in depth
- [Retry & Fault Tolerance](../guides/retry-fault-tolerance) - Custom retry strategies
- [Domain Client & Sessions](../guides/domain-session) - Sessions and cookies in depth
- [File Upload & Download](../guides/file-transfer) - Download semantics and checksums
- [Performance](../guides/performance) - Concurrency models and tuning
- [Testing Guide](../guides/testing) - httptest and Doer mocks
