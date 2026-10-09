---
sidebar_label: "Retry & Fault Tolerance"
title: "Retry & Fault Tolerance - CyberGo HTTPC | Backoff Strategy"
description: "HTTPC retries: exponential backoff with RetryConfig, auto-retry on 408/429/5xx, custom RetryPolicy, Retry-After parsing, and per-request WithMaxRetries."
sidebar_position: 8
---

# Retry and Fault Tolerance

Network requests are inherently unreliable — connections can drop, servers can be temporarily overloaded, and DNS resolution can time out. HTTPC ships with a smart retry engine that automatically handles transient failures so you can focus on business logic.

## Default Retry

HTTPC's default retry configuration is carefully tuned and works out of the box:

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Retry.MaxRetries = 3                   // Max 3 retries
	cfg.Retry.Delay = 1 * time.Second          // Initial delay 1s
	cfg.Retry.BackoffFactor = 2.0              // Exponential backoff factor 2x
	cfg.Retry.EnableJitter = true              // Enable jitter
	cfg.Retry.MaxRetryDelay = 30 * time.Second // Per-delay ceiling

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("success: %d", result.StatusCode())
}
```

The default retry delay sequence (without jitter): `1s -> 2s -> 4s` (multiplied by `BackoffFactor` each time).

### Retry Conditions

By default, the following errors trigger a retry:

| Condition | Retry | Notes |
|------|------|------|
| Network errors (connection refused, reset, EOF) | Yes | `ErrorTypeNetwork` + retryable syscall/message pattern |
| Timeout errors (dial, TLS, request timeout) | Yes | `ErrorTypeTimeout` |
| Retryable DNS failures (temporary/timeout) | Yes | `dnsErr.IsTemporary \|\| dnsErr.IsTimeout` |
| Response body read network errors | Yes | `net.OpError` on a read operation |
| 408 Request Timeout | Yes | `retryableStatusCodes` |
| 429 Too Many Requests | Yes | Combined with `Retry-After` header |
| 500 Internal Server Error | Yes | `retryableStatusCodes` |
| 502 Bad Gateway | Yes | `retryableStatusCodes` |
| 503 Service Unavailable | Yes | `retryableStatusCodes` |
| 504 Gateway Timeout | Yes | `retryableStatusCodes` |
| Other 4xx client errors (400/401/403/404…) | No | The client request was wrong; retrying is pointless |
| `context.Canceled` | No | Fast path, returned directly |
| `context.DeadlineExceeded` | No | Fast path, returned directly |
| TLS/certificate errors | No | Not transient; retrying is pointless |
| Configuration validation errors | No | Local bug; code must be fixed |

## Backoff Math In Detail

Using the defaults (`Delay=1s`, `BackoffFactor=2.0`, `MaxRetryDelay=30s`, `EnableJitter=true`), the delay for each retry is computed as follows.

### Base Delay Computation

```
attempt 0: 1s × 2.0^0 = 1s
attempt 1: 1s × 2.0^1 = 2s
attempt 2: 1s × 2.0^2 = 4s
attempt 3: 1s × 2.0^3 = 8s   (never reached when MaxRetries=3)
attempt 4: 1s × 2.0^4 = 16s
attempt 5: 1s × 2.0^5 = 32s -> hits the cap, truncated to 30s
```

### Applying the MaxRetryDelay Cap

Delays exceeding 30s are truncated: the 32s at `attempt 5` becomes 30s.

### Applying Jitter (+/-10%)

Jitter formula: `result = baseDelay ± 10%`, i.e. `result ∈ [baseDelay × 0.9, baseDelay × 1.1)`.

| Retry number | Base delay | With-jitter range |
|----------|----------|------------|
| 1st retry (attempt 0) | 1s | 0.9s – 1.1s |
| 2nd retry (attempt 1) | 2s | 1.8s – 2.2s |
| 3rd retry (attempt 2) | 4s | 3.6s – 4.4s |
| 4th retry (attempt 3) | 8s | 7.2s – 8.8s |
| 5th retry (attempt 4) | 16s | 14.4s – 17.6s |
| 6th retry (attempt 5) | 30s (after truncation) | 27s – 33s |

:::tip Why iterative multiplication instead of math.Pow
HTTPC uses a loop (`for i := 0; i < attempt; i++ { delay *= factor }`) rather than `math.Pow`. `math.Pow` calls transcendental functions (exp + log), far more expensive than a few float multiplies. The loop also checks `math.IsInf` to guard against overflow, falling back to `MaxRetryDelay` on overflow. On the retry hot path, this micro-optimization is worthwhile.
:::

:::warning Jitter is applied after the cap
Jitter is applied **after** `MaxRetryDelay` truncation. Therefore the actual range for `attempt 5` is 27s–33s and may exceed the 30s cap. This is a design choice — the purpose of jitter is to spread out retry timing, and slightly exceeding the cap is harmless, while guaranteeing no major deviation.
:::

## Retry-After Header Auto-Parsing

When a server returns 429 (Too Many Requests) or 503 (Service Unavailable), it usually attaches a `Retry-After` response header telling the client when to retry. HTTPC parses this header automatically, supporting both formats.

### delta-seconds Format

A plain integer meaning "retry after N seconds":

```
HTTP/1.1 429 Too Many Requests
Retry-After: 120
```

### HTTP-date Format

An RFC 1123 date meaning "retry at the specified time":

```
HTTP/1.1 503 Service Unavailable
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT
```

HTTPC supports both standard RFC1123 (`Fri, 31 Jul 2026 15:00:00 GMT`) and RFC1123Z with a numeric timezone (`Fri, 31 Jul 2026 15:00:00 +0800`).

### 60-Second Safety Cap

No matter how long the server specifies, HTTPC truncates the `Retry-After` delay to at most 60 seconds:

```
Retry-After: 120     ->  truncated to 60s (rather than waiting 120s)
Retry-After: 3600    ->  truncated to 60s
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT (2 hours away) ->  truncated to 60s
```

:::warning Why truncate
A malicious or misconfigured server may return an extremely large `Retry-After` value (e.g. `Retry-After: 999999`), causing the client to hang for a long time. The 60-second cap is a safety defense: even if the server asks for a 1-hour wait, HTTPC retries after at most 60 seconds. If your service has a sensible rate-limit policy (e.g. 60 per minute), the normal `Retry-After` value is well under 60s and is unaffected.
:::

### Priority

The `Retry-After` header takes **higher** priority than the exponential backoff delay. When the server returns a valid `Retry-After` value, that value is used directly (after truncation), skipping the backoff computation.

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Retry.MaxRetries = 3
	// Exponential backoff delays: 1s -> 2s -> 4s
	// But if the server returns Retry-After: 5, the first retry delay becomes 5s
	// (not exceeding the 60s safety cap)

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start := time.Now()
	_, err = client.Get("https://api.example.com/rate-limited")
	elapsed := time.Since(start)

	if err != nil {
		log.Printf("retries exhausted, total time %v: %v", elapsed, err)
	} else {
		log.Printf("success, total time %v", elapsed)
	}
}
```

:::tip Retry-After applies to all retryable status codes
`Retry-After` is not limited to 429/503 — it applies to responses with any retryable status code (408/429/500/502/503/504). As long as the response carries a `Retry-After` header, it is parsed and used.
:::

## Backoff Strategies

### Exponential Backoff (Default)

The most common strategy — delays grow by a factor, fast but not too aggressive:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 2.0
// Delay sequence: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (cap)
```

### Gentle Exponential Backoff

`PerformanceConfig()` uses a 1.5x factor for gentler growth, suited to high-throughput scenarios:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.5
cfg.Retry.Delay = 500 * time.Millisecond
// Delay sequence: 0.5s -> 0.75s -> 1.125s -> 1.6875s -> ...
```

### Fixed Delay

The same interval between every retry, suited to scenarios with an explicit retry interval requirement:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.0
// Delay sequence: 1s -> 1s -> 1s -> 1s ...
```

### Random Jitter

Enable jitter to add a ±10% random offset to the base delay, preventing the "thundering herd" — many clients failing at once and then retrying simultaneously, causing a secondary overload:

<!-- check-code: skip -->
```go
cfg.Retry.EnableJitter = true
// Five clients' retry timings are spread out:
// Client A: retries after 0.93s
// Client B: retries after 1.07s
// Client C: retries after 1.01s
// Client D: retries after 0.96s
// Client E: retries after 1.08s
```

:::tip Always enable jitter
Except in test scenarios (which need deterministic delays), production should always enable `EnableJitter = true`. This is a distributed-systems best practice that significantly reduces the risk of retry storms.
:::

## Custom RetryPolicy

Implementing the `RetryPolicy` interface gives you full control over retry behavior. The interface defines three methods:

<!-- check-code: skip -->
```go
type RetryPolicy interface {
    // Decide whether to retry. resp is the response (nil means the request errored); err is the error
    ShouldRetry(resp ResponseReader, err error, attempt int) bool

    // Return the delay before the next retry
    GetDelay(attempt int) time.Duration

    // Return the maximum retry count
    MaxRetries() int
}
```

:::warning Internal-type limitation
The `resp` parameter type of `RetryPolicy.ShouldRetry`, `ResponseReader`, is an internal interface (defined in the `internal/types` package) that external packages cannot reference directly. Therefore a custom `RetryPolicy` can only be implemented inside the `github.com/cybergodev/httpc` module. In most scenarios, the `RetryConfig` fields and `ProxyRotateOnStatus` configuration are sufficient — no custom policy needed.
:::

The example below shows a custom policy that retries only GET requests (compilable only inside the module):

<!-- check-code: skip -->
```go
// Note: ResponseReader is an internal type (internal/types package).
// This code can only compile within the github.com/cybergodev/httpc module.
// Most users should configure retries via RetryConfig and WithMaxRetries.

// GETOnlyRetryPolicy retries only GET requests, and only on network errors and 502/503/504
type GETOnlyRetryPolicy struct {
    maxAttempts int
}

func (p *GETOnlyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // Retry only GET requests (inferred indirectly via err/resp — non-idempotent ops not retried)
    if err != nil {
        return true // Retry network errors
    }
    if resp == nil {
        return false
    }
    code := resp.StatusCode()
    return code == 502 || code == 503 || code == 504
}

func (p *GETOnlyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1) // Linear growth: 1s, 2s, 3s...
}

func (p *GETOnlyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// Apply the custom policy
// cfg := httpc.DefaultConfig()
// cfg.Retry.CustomPolicy = &GETOnlyRetryPolicy{maxAttempts: 5}
```

## Per-Request Control

In addition to client-level configuration, you can override the retry count for a single request via `WithMaxRetries`:

```go
package main

import (
	"context"
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

	// Retry a single request 5 times (overriding the client default of 3)
	_, err = client.Get("https://api.example.com/data", httpc.WithMaxRetries(5))
	if err != nil {
		log.Printf("request failed: %v", err)
	}

	// Disable retries (e.g. for a non-idempotent POST)
	_, err = client.Post("https://api.example.com/create",
		httpc.WithJSON(map[string]string{"name": "test"}),
		httpc.WithMaxRetries(0),
	)

	// Combined with a context timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, err = client.Request(ctx, "GET", "https://api.example.com/data",
		httpc.WithMaxRetries(3),
	)
}
```

## Proxy Pool and Retry Interaction

When `ProxyRotateOnStatus` or `ProxyRotatePerRequest` is configured, HTTPC automatically raises `MaxRetries` to ensure every proxy in the pool is tried at least once. This is implemented by `calculateMaxRetries`:

```
effective MaxRetries = max(configured MaxRetries, len(ProxyPool) - 1)
(capped at maxRetryAttempts = 10)
```

**Example**: 5 proxies, configured `MaxRetries = 3`:

```
ProxyPool = [proxy1, proxy2, proxy3, proxy4, proxy5]
ProxyRotateOnStatus = [403]   // or ProxyRotatePerRequest = true
configured MaxRetries = 3

-> Auto-adjusted to 4 (= 5 - 1), ensuring all 5 proxies are each tried once
-> 1st request uses proxy1, fails with 403
-> 2nd request uses proxy2 (rotated), fails with 403
-> 3rd request uses proxy3, fails with 403
-> 4th request uses proxy4, fails with 403
-> 5th request uses proxy5, fails with 403
-> Retries exhausted (5 total attempts = 1 initial + 4 retries)
```

:::tip Why len(ProxyPool) - 1
The first request uses the first proxy and does not count as a retry. To try all N proxies, you need N - 1 retries. `calculateMaxRetries` raises `MaxRetries` to `len(ProxyPool) - 1` (if the original config is smaller), ensuring the intent (rotate through all proxies) is honored. If the user-configured `MaxRetries` is already large enough, it stays unchanged.
:::

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
		"http://proxy4:8080",
		"http://proxy5:8080",
	}
	cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
	cfg.Connection.ProxyRotateOnStatus = []int{403} // 403 triggers proxy rotation
	cfg.Retry.MaxRetries = 3                        // Auto-raised to 4 (= 5-1)

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Every 403 auto-rotates the proxy and retries; up to 5 proxies tried
	result, err := client.Get("https://protected-site.example.com/data")
	if err != nil {
		log.Printf("all proxies failed: %v", err)
		return
	}
	log.Printf("success (one proxy worked): %d", result.StatusCode())
}
```

## Retry Budget Considerations

Retries extend a request's total duration. When designing timeouts, you must budget for retry delays.

### Total Worst-Case Time Formula

```
total worst-case time = (MaxRetries + 1) × request timeout + Σ(per-retry delay caps)
```

Using the default config (`MaxRetries=3`, `Request=180s`, `Delay=1s`, `Backoff=2.0`, `Jitter`):

```
Request-timeout portion: 4 × 180s = 720s (initial + 3 retries, each waits up to 180s)
Retry-delay portion: 1.1 + 2.2 + 4.4 ≈ 7.7s (sum of the jitter upper bounds for 3 delays)
Total worst-case time: ≈ 727.7s (about 12 minutes)
```

### Ways to Shorten Total Duration

| Adjustment | Effect |
|------|------|
| Reduce `MaxRetries` | Fewer retries; total time drops linearly |
| Reduce `Timeouts.Request` | Each attempt fails faster |
| Reduce `Retry.Delay` | Shorter intervals between retries |
| Reduce `BackoffFactor` | Slower delay growth; earlier retries are faster |
| Override with `context.WithTimeout` | Precisely control the total ceiling of a single request |

:::warning Retry vs timeout conflict
The deadline set by `context.WithTimeout` is hard — even if retries are not exhausted, the context expiry terminates immediately. This means the actual retry count may be less than `MaxRetries`. If your application must "ensure N retries", make sure the context timeout is long enough:

<!-- check-code: skip -->
```go
// Reserve enough time: 3 retries + delays + per-request time
ctx, cancel := context.WithTimeout(context.Background(),
    3*requestTimeout + 10*time.Second)
```
:::

## Context Cancellation and Retries

HTTPC's retry engine has a fast path for context cancellation. When the cause of failure is `context.Canceled` or `context.DeadlineExceeded`, `isRetryableError` returns false immediately, skipping the full error-classification logic:

<!-- check-code: skip -->
```go
// Internal implementation (retry.go)
func (r *retryEngine) isRetryableError(err error) bool {
    // Fast path: context errors are not retryable — avoid full classification overhead
    if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
        return false
    }
    clientErr := classifyError(err, "", "", 0)
    // ...full classification logic
}
```

This means:

- **Manual cancellation** (`cancel()`): stops immediately, no retry
- **Context timeout**: stops immediately, no retry
- **In-flight request canceled**: cancellation does not trigger extra retries

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

	// Scenario 1: manual cancel — will not retry
	ctx1, cancel1 := context.WithCancel(context.Background())
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel1() // Manually cancel after 100ms
	}()

	_, err = client.Request(ctx1, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeContextCanceled {
			fmt.Println("request manually canceled; no retry triggered")
		}
	}

	// Scenario 2: context timeout — will not retry
	ctx2, cancel2 := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel2()

	_, err = client.Request(ctx2, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeTimeout {
			fmt.Println("request terminated by context timeout; no retry triggered")
		}
	}
}
```

## Error Handling and Retries

After retries are exhausted, the error is returned via `ClientError` with `Type` set to `ErrorTypeRetryExhausted` (or the original error type of the last attempt); the `Attempts` field records the total number of attempts:

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	_, err = client.Get("https://api.example.com/flaky")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			log.Printf("failure type: %s, attempts: %d",
				clientErr.Code(), clientErr.Attempts)
			if clientErr.Attempts > 1 {
				log.Println("(auto-retried but still failed)")
			}
		}
	}
}
```

## Best Practices

| Scenario | Recommended config |
|------|----------|
| API calls | `MaxRetries=3, Delay=1s, Backoff=2.0` (default) |
| Microservice communication | `MaxRetries=2, Delay=500ms, Backoff=2.0` (fast failure) |
| File downloads | `MaxRetries=5, Delay=2s, Backoff=2.0` (tolerate network fluctuation) |
| Idempotent operations (GET/PUT/DELETE) | Safe to retry freely |
| Non-idempotent operations (POST) | `WithMaxRetries(0)` or a custom `RetryPolicy` to narrow scope |
| Rate-limited APIs | Rely on automatic `Retry-After` parsing (built in) |
| Proxy-pool scenarios | Combine with `ProxyRotateOnStatus`; retry count auto-raised |

:::warning Retrying non-idempotent POST requests
By default, non-idempotent POST requests are also retried on retryable status codes (e.g. 500/502/503/504) or network errors. If the server cannot guarantee idempotency, duplicate submissions may cause side effects (e.g. duplicate resource creation). Options for precise control:
1. Use `WithMaxRetries(0)` on POST requests to disable retries entirely
2. Or implement a custom `RetryPolicy` that retries only on network errors (not HTTP status codes)
:::

## Next Steps

- [Error Handling](./error-handling) — Error classification and sentinel-error matching in depth
- [Configuration API](../api-reference/client-config/config) — Retry configuration field reference
- [Connection Pool & DNS](./connection-pool) — Connection reuse and DoH resolution
- [Proxy & Proxy Pool](./proxy) — Proxy pool configuration and rotation strategies
- [Interface Definitions](../api-reference/types/interfaces) — RetryPolicy interface reference
