---
sidebar_label: "Performance"
title: "Performance - CyberGo HTTPC | Presets & Concurrency"
description: "HTTPC performance guide: presets compared, idle-connection derivation, semaphore concurrency, timeout budgets, zero-alloc hot paths, and anti-patterns."
sidebar_position: 110
---

# Performance Optimization

HTTPC is designed for high performance from the ground up: connection-pool reuse, HTTP/2 multiplexing, object pooling, and single-allocation result objects. In most scenarios, using a preset configuration directly delivers excellent performance; when further tuning is needed, understanding the underlying mechanics lets you target the right lever.

## Preset Comparison

HTTPC provides 5 preset configurations, each systematically tuned for a different scenario. The tables below list the exact values of key fields by category for side-by-side selection.

### Timeout Configuration

| Field | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `Timeouts.Request` | 180s | 15s | 60s | 180s | 180s |
| `Timeouts.Dial` | 10s | 5s | 15s | 5s | 5s |
| `Timeouts.TLSHandshake` | 10s | 5s | 15s | 5s | 5s |
| `Timeouts.ResponseHeader` | 0 (disabled) | 10s | 0 (disabled) | 0 (disabled) | 0 (disabled) |
| `Timeouts.IdleConn` | 90s | 30s | 120s | 30s | 30s |

### Connection Configuration

| Field | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxIdleConns` | 50 | 20 | 100 | 10 | 10 |
| `MaxConnsPerHost` | 10 | 5 | 20 | 5 | 2 |
| `EnableHTTP2` | On | On | On | **Off** | On |
| `EnableCookies` | Off | Off | On | On | Off |
| `EnableDoH` | Off | Off | Off | Off | Off |

### Security Configuration

| Field | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxResponseBodySize` | 10MB | 5MB | 50MB | 10MB | 1MB |
| `MaxDecompressedBodySize` | 100MB | 100MB | 100MB | 100MB | 100MB |
| `ValidateURL` | On | On | On | **Off** | On |
| `ValidateHeaders` | On | On | On | **Off** | On |
| `StrictContentLength` | On | On | Off | On | On |
| `AllowPrivateIPs` | false | false | false | **true** | false |
| `InsecureSkipVerify` | false | false | false | **true** | false |

### Retry Configuration

| Field | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxRetries` | 3 | 1 | 3 | 1 | 0 |
| `Delay` | 1s | 2s | 500ms | 100ms | 0 |
| `BackoffFactor` | 2.0 | 2.0 | 1.5 | 2.0 | 1.0 |
| `MaxRetryDelay` | 30s | 30s | 30s | 30s | 30s |
| `EnableJitter` | On | On | On | Off | Off |

### Request Defaults

| Field | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `FollowRedirects` | On | **Off** | On | On | **Off** |
| `MaxRedirects` | 10 | 10 | 10 | 10 | 10 |
| `UserAgent` | `httpc/1.0` | `httpc/1.0` | `httpc/1.0` | `httpc-test/1.0` | `httpc/1.0` |

:::warning Never use TestingConfig in production
`TestingConfig()` disables URL/header validation, TLS certificate verification, and SSRF protection — it is for local development and testing only. It emits a security warning when called in a non-test environment. Use `SecureConfig()` or `DefaultConfig()` in production.
:::

## Scenario Selection

| Scenario | Recommended preset | Adjustment suggestion |
|------|----------|----------|
| General web services | Default | — |
| Handling user-provided URLs | Secure | — |
| Internal microservices, high concurrency | Performance | Increase `MaxIdleConns` with the backend count |
| One-off scripts | Minimal | — |
| File download service | Performance | Increase `MaxResponseBodySize` |
| Financial/medical APIs | Secure + custom | Add audit middleware |
| Local dev / unit testing | Testing | Never deploy to production |

<!-- check-code: skip -->
```go
// High-throughput scenario — use the preset directly
client, _ := httpc.New(httpc.PerformanceConfig())

// Fine-tune individual fields on top of the preset
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## Concurrency Model: One Client Serves All Goroutines

HTTPC's `Client` and `DomainClient` are both **concurrency-safe** — any method may be called by multiple goroutines simultaneously, and the library ships dedicated concurrency integration tests (`internal/concurrency`) that exercise the public API under high concurrency. The correct concurrency pattern is therefore simple:

```text
Create 1 Client at the global/service level
        │
        ├── goroutine 1 ──┐
        ├── goroutine 2 ──┼── sharing the same connection pool and object pool
        └── goroutine N ──┘
```

How concurrency relates to the connection pool:

| Scenario | Behavior |
|------|------|
| Concurrency ≤ `MaxConnsPerHost` (HTTP/1.1) | Each request owns one connection; no queuing |
| Concurrency > `MaxConnsPerHost` (HTTP/1.1) | Excess requests **queue** at the transport layer waiting for a free connection (no error, but latency rises) |
| HTTP/2 enabled (default) | Requests to the same host share a single multiplexed connection; `MaxConnsPerHost` is rarely the bottleneck |

:::tip Two ways to tune the concurrency cap
- **Control the client side**: raise `Connection.MaxConnsPerHost` to ≥ peak concurrency (for HTTP/1.1 workloads);
- **Control the caller side**: use a buffered channel as a semaphore to limit concurrency (the complete example below), proactively protecting the downstream service.
The two are often combined: the semaphore throttles to what the downstream can bear, and the pool is sized to the semaphore limit.
:::

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
	// Local mock server: every request takes a fixed 50ms
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // allow connecting to the 127.0.0.1 local test server
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	const (
		total       = 20
		maxInFlight = 5 // semaphore: at most 5 requests in flight at once
	)

	sem := make(chan struct{}, maxInFlight)
	var wg sync.WaitGroup
	var okCount int64
	start := time.Now()

	for i := 0; i < total; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}        // acquire the semaphore
			defer func() { <-sem }() // release the semaphore

			result, err := client.Get(server.URL)
			if err != nil {
				return
			}
			if result.IsSuccess() {
				atomic.AddInt64(&okCount, 1)
			}
		}()
	}
	wg.Wait()

	fmt.Printf("%d/%d succeeded in %v (serial would take ~%v)\n",
		okCount, total, time.Since(start), total*50*time.Millisecond)
	// Sample output: 20/20 succeeded in ~250ms (serial would take ~1s) — 5-way concurrency yields ~5x throughput
}
```

When fetching large batches of independent URLs, another common pattern is the **worker pool**: a fixed number of worker goroutines consume from a jobs channel, naturally capping concurrency at the worker count with no semaphore needed. For a complete implementation, see the [Advanced Examples](../examples/advanced-usage).

## Connection Pool Tuning Internals

The connection pool is the core of HTTP client performance. HTTPC's pool is built on the Go standard library's `http.Transport`, but adds auto-computation logic and secure defaults on top.

### Idle Connection Auto-Computation

`MaxIdleConnsPerHost` (the per-host idle connection cap) does not need to be set manually — HTTPC derives it from `MaxConnsPerHost`:

```text
idle conns = MaxConnsPerHost / 2, clamped to [2, 10]
```

Specific rules (`calculateIdleConnsPerHost`):

| MaxConnsPerHost | Auto idle conns | Notes |
|-----------------|---------------|-------|
| 0 (unlimited) | 10 | Uses the upper-bound default |
| 1 | 1 | Floor of 2 applied first, then pulled back to 1 by "no more than max conns" |
| 2 | 2 | Exactly the floor |
| 5 | 2 | Half rounds down to the floor |
| 10 | 5 | Default preset |
| 20 | 10 | Performance preset, hits the cap |
| 100 | 10 | Above the cap, uses 10 |

:::tip Why MaxConnsPerHost / 2
Idle connections are a "cache of connections" — established but temporarily unused. Setting them to half the max connections strikes a balance between "reuse existing connections" (cache hit) and "create new connections" (a fresh handshake on cache miss), preventing idle connections from tying up too many server-side resources.
:::

### TCP Keep-Alive

HTTPC's connection pool uses a fixed 30-second TCP keep-alive interval (`defaultKeepAlive = 30 * time.Second`). Once a connection is established, the OS periodically sends keep-alive probes to detect dead connections. The `IdleConn` timeout controls how long idle connections live in the pool (90s for Default); the two work together.

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// High-QPS microservice scenario: enlarge the pool
	cfg := httpc.PerformanceConfig()
	cfg.Connection.MaxIdleConns = 200         // Global idle connection cap
	cfg.Connection.MaxConnsPerHost = 50       // Max conns per host (idle auto-computed to 10)
	cfg.Timeouts.IdleConn = 300 * time.Second // Idle conns live longer, higher reuse rate

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Hot-path requests reuse pooled connections directly
	for i := 0; i < 100; i++ {
		result, err := client.Get("https://api.example.com/data")
		if err != nil {
			log.Printf("request %d failed: %v", i, err)
			continue
		}
		fmt.Printf("request %d: %d\n", i, result.StatusCode())
	}
}
```

## HTTP/2 Performance Advantages

HTTP/2 is enabled by default (`EnableHTTP2 = true`), providing three major performance gains:

| Feature | HTTP/1.1 | HTTP/2 |
|------|----------|--------|
| Multiplexing | One connection per request | Multiple requests share one connection |
| Header compression | Plaintext, resent every time | HPACK-compressed headers |
| Connection reuse | Keep-alive, serial | Parallel streams |

:::tip HTTP/2 and the connection pool
HTTP/2 multiplexing lets a single TCP connection carry multiple simultaneous requests, drastically reducing connection-setup overhead. Under high concurrency to the same host, HTTP/2 throughput far exceeds HTTP/1.1. It only falls back to HTTP/1.1 when using `TestingConfig()` (which explicitly disables HTTP/2) or when the connection does not support ALPN negotiation.
:::

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// HTTP/2 is enabled in the default configuration
	cfg := httpc.DefaultConfig()
	cfg.Connection.EnableHTTP2 = true // true by default; explicit for clarity

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Concurrent requests to an HTTP/2-capable host (most CDNs/cloud services)
	// A single TCP connection is reused; no new connection per request
	start := time.Now()
	for i := 0; i < 10; i++ {
		result, err := client.Get("https://http2.golang.org/")
		if err != nil {
			log.Printf("request %d failed: %v", i, err)
			continue
		}
		// Proto() returns the protocol version, e.g. "HTTP/2.0"
		fmt.Printf("request %d: %s, status %d\n", i, result.Proto(), result.StatusCode())
	}
	fmt.Printf("10 requests took: %v\n", time.Since(start))
}
```

## Memory Optimization Mechanisms

HTTPC applies multiple layers of memory optimization; the core idea is to reduce heap allocations and reuse objects.

### resultBundle Single Allocation

Every request returns a `*Result` carrying three nested structs: `RequestInfo` (request info), `ResponseInfo` (response info), and `RequestMeta` (metadata such as duration). The traditional approach allocates separately for the Result and each nested struct — four heap allocations. HTTPC packs them into a single `resultBundle`, so one heap allocation covers everything:

```text
Traditional: 4 separate allocations (Result + RequestInfo + ResponseInfo + RequestMeta)
HTTPC: 1 allocation (resultBundle); Result's three pointers reference the same memory block
```

The caller receives a `*Result` whose `Request`, `Response`, and `Meta` fields (pointers) reference the corresponding structs inside the bundle — fully transparent. Because the caller may hold `*Result` long-term, an object pool is not appropriate here (pooling would cause data races); it is reclaimed by GC instead.

### Engine Object Pool

HTTPC's engine layer makes extensive use of `sync.Pool` to reuse short-lived objects, reducing GC pressure:

| Pooled object | Purpose | Notes |
|----------|------|------|
| `engine.Response` | Response object | Returned to the pool after a request, reused by the next one |
| `engine.Request` | Request object | Same as above |
| `strings.Builder` | String building | URL building, error formatting, Config serialization |
| `http.Header` | HTTP header map | Request/response header processing |
| `bytes.Buffer` | JSON/multipart encoding | Pre-allocated by initial capacity |
| `time.Timer` | Retry timer | Avoids frequent timer creation |
| gzip/flate reader | Decompression | Reuses decompressors |

:::tip Division of labor: object pool vs resultBundle
Engine-internal objects (Response/Request/Builder) have short lifetimes and complete their borrow-return cycle within a single request, so they are good fits for pooling. The `*Result` returned to the caller has an unpredictable lifetime, so it uses single allocation + GC reclamation. The two complement each other, each playing to its strength.
:::

### Low-Allocation Hot Paths

Beyond object pooling, the request hot path carries a set of targeted de-allocation optimizations:

| Optimization | Mechanism |
|--------|------|
| Batch header deep-copy | `CloneHeader` counts all values first and allocates one shared backing array in a single shot — turning "one allocation per header (N total)" into 1 |
| Zero-allocation query escaping | Strings that need no escaping are **returned as-is** (zero allocation); when escaping is needed, bytes are written through a pooled buffer |
| Direct numeric query writes | `int`/`float64`/`bool` and other numeric values are written straight into the builder via `strconv.Append*`, with no intermediate strings |
| Request-header ownership transfer | For ordinary requests and the download path, the header map on the engine Response is **ownership-transferred** to `Result` rather than cloned |
| Inline redirect-chain array | The first 8 redirects are recorded in an inline fixed-size array inside a pooled object; an overflow slice is allocated only beyond 8 — the vast majority of requests never allocate for the redirect chain |
| Retry-sleep timer reuse | The `time.Timer` used for retry backoff is pooled and reused, avoiding repeated Timer creation under high-frequency retries |
| Pool capacity guards | Objects above a threshold are **not returned** to the pool (e.g. header maps > 64 entries, query-builder capacity > 4096), preventing large objects from lingering in pools and inflating memory |

### Internal Metrics and Health

The engine internally collects per-request metrics with **pure atomic operations** (lock-free): total requests, success/failure counts, and a smoothed latency maintained with the moving-average formula `new average = (old average x 9 + this latency) / 10`; an error rate below 10% counts as healthy. These metrics drive the engine's own health assessment and are **not exposed as public API** — for application-level request metrics, use `MetricsMiddleware` (see the [middleware reference](../api-reference/client-config/middleware)), which reports by method/URL/status code/duration and plugs directly into monitoring systems such as Prometheus.

### You Don't Need to Worry About Any of This

The optimizations above are fully transparent to the caller. You just use the API normally; connection reuse, object pooling, and single allocation all happen automatically:

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

	// Result is created fresh per request and reclaimed by GC — no manual release
	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}

	// On hot paths prefer RawBody() over Body()
	// RawBody() returns the raw byte slice; Body() returns a pre-stored string; String() is debug formatting (highest overhead)
	data := result.RawBody()
	fmt.Printf("response size: %d bytes\n", len(data))
	fmt.Printf("request duration: %v\n", result.Meta.Duration)
}
```

## Workload Tuning Examples

### Timeout Budgets

The four transport-layer timeouts (`Dial`, `TLSHandshake`, `ResponseHeader`, and the implicit body transfer) are all governed by `Timeouts.Request` as the **total budget**. When adjusting presets, keep the hierarchical relationship "sum of parts ≤ total budget" to avoid invalid configurations such as a dial timeout longer than the overall timeout:

```text
Timeouts.Request (total budget, default 180s)
 ├── Timeouts.Dial           dial (default 10s)
 ├── Timeouts.TLSHandshake   TLS handshake (default 10s)
 ├── Timeouts.ResponseHeader response-header wait (0 for Default/Performance = no transport-layer limit)
 └── response body transfer  all remaining time is available
```

| Workload | Request | Dial/TLS | Notes |
|----------|---------|----------|-------|
| Intranet microservices | 5–10s | 1–2s | Fail fast and hand errors to upstream retry/circuit breaking |
| Public internet APIs | 30s | 5s | Balances cross-network latency with occasional slow responses |
| AI / long tasks | 300s+ | 10s | Long response bodies consume the remaining budget |
| Large file downloads | 0 (control via context) | 15s | Let `Download`'s ctx govern total time; `WithTimeout` governs a single request |

:::warning Interaction between ResponseHeader and WithTimeout
The `Default`/`Performance` presets set `ResponseHeader` to 0 (not enforced at the transport layer), giving `WithTimeout()` full control over slow responses; the `Secure` preset sets it to 10s as a defense against slowloris-class attacks. If you manually narrow `ResponseHeader`, be aware that it may cut off a slow response before `WithTimeout` does.
:::

### AI API Long Polling

AI inference APIs can take many minutes to respond, so the timeout limits need to be relaxed:

<!-- check-code: skip -->
```go
// An AI API may need 5–15 minutes to respond — don't get cut off by the default 180s timeout
result, err := httpc.Post("https://api.ai.example.com/v1/completions",
    httpc.WithJSON(payload),
    httpc.WithTimeout(900*time.Second), // 15 minutes
)
```

:::warning Why Default's ResponseHeader is 0
`TimeoutConfig.ResponseHeader = 0` means the transport layer does not enforce a response-header timeout; the context-level timeout (`TimeoutConfig.Request` or `WithTimeout`) controls everything uniformly. This ensures `WithTimeout()` has full control over long-running responses. For transport-layer defense against slowloris attacks, use `SecureConfig()` (which sets it to 10s).
:::

### Microservice High QPS

High-frequency calls between internal microservices need a large connection pool:

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.PerformanceConfig()
	// Tune the pool to the number of backend instances
	cfg.Connection.MaxIdleConns = 300   // Total idle connections
	cfg.Connection.MaxConnsPerHost = 30 // Per backend instance
	// Microservice responses are usually fast — shorten timeouts for fast failure
	cfg.Timeouts.Request = 10 * time.Second
	cfg.Retry.Delay = 200 * time.Millisecond
	cfg.Retry.BackoffFactor = 2.0
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start := time.Now()
	// High-frequency requests reuse the pool — no TCP/TLS re-establishment
	for i := 0; i < 50; i++ {
		result, err := client.Get("http://user-service:8080/api/users")
		if err != nil {
			log.Printf("request %d failed: %v", i, err)
			continue
		}
		_ = result
	}
	fmt.Printf("50 requests took: %v\n", time.Since(start))
}
```

### Large File Download (Streaming)

For large files, use `Download()`: it enables streaming mode automatically, the response body flows from the network straight to disk, memory use is independent of file size, and resumable downloads and checksums are supported:

```go
package main

import (
	"context"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.PerformanceConfig()
	cfg.Security.MaxResponseBodySize = 500 * 1024 * 1024 // 500MB cap

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	dcfg := httpc.DefaultDownloadConfig()
	dcfg.FilePath = "/tmp/large-file.zip"
	dcfg.ResumeDownload = true // resumable download

	result, err := client.Download(
		context.Background(),
		"https://example.com/large-file.zip",
		dcfg,
	)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("download complete: %d bytes", result.BytesWritten)
}
```

:::warning Do not use WithStreamBody on ordinary request methods
`WithStreamBody(true)` only works for paths like `Download` that consume the engine response directly. Setting it on ordinary methods such as `Get`/`Post`/`Request` still reads the whole response body into `Result` and closes the underlying stream — the returned `Result` has an empty body and the caller never sees the stream. The correct entry point for consuming large response bodies is `Download` (see [File Upload and Download](./file-transfer)).
:::

### Crawler and Proxy Pool

Crawler scenarios rotate IPs via a proxy pool. HTTPC automatically raises the retry count so that every proxy is tried at least once (see [Retry and Fault Tolerance](./retry-fault-tolerance#proxy-pool-and-retry-interaction)):

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
    "http://proxy4:8080",
    "http://proxy5:8080",
}
cfg.Connection.ProxyRotateOnStatus = []int{403} // 403 triggers proxy rotation
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
// MaxRetries is automatically raised to 4 (proxy count - 1), ensuring all 5 proxies are tried
```

## Performance Anti-Patterns

| Anti-pattern | Cause | Correct approach |
|--------|------|----------|
| Creating a Client per request | Connections can't be reused; TCP/TLS handshake every time | Reuse a single Client instance globally |
| Overly large `MaxResponseBodySize` | Needlessly raises the memory ceiling | Set it to the actual response size |
| Using `result.String()` on hot paths | Extra string-building overhead | Use `result.Body()` or `result.RawBody()` |
| Connection pool too small | High concurrency exhausts connections; requests queue | Tune `MaxConnsPerHost` to concurrency |
| `WithStreamBody` on ordinary requests | The returned Result has an empty body and the stream is unreachable | Route large response bodies through `Download` |
| Disabling HTTP/2 | Degrades to serial HTTP/1.1 requests | Keep it on by default |
| Ignoring `Close()` | Connection leak | `defer client.Close()` |
| Globally shared but not reused | Repeatedly creating/destroying the Client | Create once, hold long-term |
| Brute-forcing rate limits with goroutine count | Overwhelms the downstream, triggers 429/circuit breaking | Control in-flight requests with a semaphore or worker pool |

:::warning The Client must be reused
The foundation of HTTP performance is connection reuse. Creating a Client per request means going through the TCP three-way handshake + TLS handshake every time — latency jumps from sub-millisecond to tens of milliseconds. In microservice scenarios, inject the Client as a singleton into the service struct so it lives as long as the service.
:::

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// Anti-pattern demo: creating a Client per request
func main() {
	start := time.Now()

	for i := 0; i < 5; i++ {
		// WRONG: new Client every iteration — connections can't be reused
		client, err := httpc.NewDefault()
		if err != nil {
			log.Fatal(err)
		}
		result, err := client.Get("https://httpbin.org/get")
		client.Close() // Closed every time; the pool is drained
		if err != nil {
			log.Printf("request %d failed: %v", i, err)
			continue
		}
		_ = result
	}
	// 5 requests take far longer than the reuse approach
	fmt.Printf("anti-pattern took: %v\n", time.Since(start))

	// CORRECT: reuse the Client
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start = time.Now()
	for i := 0; i < 5; i++ {
		result, err := client.Get("https://httpbin.org/get")
		if err != nil {
			log.Printf("request %d failed: %v", i, err)
			continue
		}
		_ = result
	}
	fmt.Printf("reuse pattern took: %v\n", time.Since(start))
}
```

## Next Steps

- [Connection Pool & DNS](./connection-pool) — Connection pool parameter details and DoH resolution
- [Proxy & Proxy Pool](./proxy) — Proxy pool configuration and rotation strategies
- [Error Handling](./error-handling) — Layered timeout strategy and error classification
- [Retry and Fault Tolerance](./retry-fault-tolerance) — Backoff algorithm details and retry budgets
- [Security Overview](../security/) — Balancing security and performance
