---
sidebar_label: "Retry & Fault Tolerance"
title: "Retry & Fault Tolerance - CyberGo HTTPC | Backoff Strategy"
description: "HTTPC retries: exponential backoff with jitter, auto-retry on 408/429/5xx, Retry-After parsing with a 60s cap, shared timeout budgets, WithMaxRetries."
sidebar_position: 70
---

# Retry and Fault Tolerance

Retry is HTTPC's automatic recovery mechanism for transient failures: when a request fails with a network error, a timeout, or a retryable status code, the engine resends it under the configured backoff policy until it succeeds or the budget runs out.

## Default Retry

The retry parameters of `DefaultConfig()` are:

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
| Other 4xx client errors (400/401/403/404…) | No | The request was invalid; retrying does not help |
| `context.Canceled` | No | Fast path, returned directly |
| `context.DeadlineExceeded` | No | Fast path, returned directly |
| TLS/certificate errors | No | Not transient; retrying does not help |
| Configuration validation errors | No | Local bug; the code must be fixed |

### Configuration Validation

`ValidateConfig`, called internally by `New`, validates the retry parameters and returns `ErrInvalidRetry` when a value is out of range:

| Field | Valid range | Default |
|------|----------|------|
| `MaxRetries` | 0–10 | 3 |
| `Delay` | 0–30min | 1s |
| `BackoffFactor` | 1.0–10.0 | 2.0 |
| `MaxRetryDelay` | 0–30min | 30s |
| `EnableJitter` | Boolean | true |

`WithMaxRetries(n)` applies the same 0–10 check at the request level and returns an error when the value is out of range. Passing 0 or a negative value for `Delay` / `BackoffFactor` makes the engine fall back to the defaults (1s / 2.0) without an error; set an explicit valid value when a specific delay is required.

## Backoff Math In Detail

Using the defaults (`Delay=1s`, `BackoffFactor=2.0`, `MaxRetryDelay=30s`, `EnableJitter=true`), the delay for each retry is computed as follows.

### Base Delay Computation

```text
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
HTTPC uses a loop (`for i := 0; i < attempt; i++ { delay *= factor }`) rather than `math.Pow`. `math.Pow` calls transcendental functions (exp and log), which cost more than a few float multiplies. The loop also checks `math.IsInf` to guard against overflow, falling back to `MaxRetryDelay` on overflow. This path sits on every retry.
:::

:::warning Jitter is applied after the cap
Jitter is applied **after** `MaxRetryDelay` truncation, so the actual wait range for `attempt 5` is 27s–33s, up to about 10% above the 30s cap. Jitter exists to spread out retry timing, and the overshoot is bounded by the jitter percentage.
:::

## Retry-After Header Auto-Parsing

When a server returns 429 (Too Many Requests) or 503 (Service Unavailable), the response can carry a `Retry-After` header stating when a retry may occur. HTTPC parses this header automatically, supporting both formats.

### delta-seconds Format

A plain integer meaning "retry after N seconds":

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 120
```

### HTTP-date Format

An RFC 1123 date meaning "retry at the specified time":

```http
HTTP/1.1 503 Service Unavailable
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT
```

HTTPC supports both standard RFC1123 (`Fri, 31 Jul 2026 15:00:00 GMT`) and RFC1123Z with a numeric timezone (`Fri, 31 Jul 2026 15:00:00 +0800`).

### 60-Second Safety Cap

No matter how long the server specifies, HTTPC truncates the `Retry-After` delay to at most 60 seconds:

```text
Retry-After: 120     ->  truncated to 60s (rather than waiting 120s)
Retry-After: 3600    ->  truncated to 60s
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT (2 hours away) ->  truncated to 60s
```

:::warning Why truncate
A malicious or misconfigured server may return an extremely large `Retry-After` value (e.g. `Retry-After: 999999`), which would leave the client waiting for a long time. The 60-second cap covers that case: if the server asks for a one-hour wait, HTTPC retries after at most 60 seconds. This cap takes precedence over `MaxRetryDelay`, and jitter is applied after truncation.
:::

### Priority

The `Retry-After` header takes priority over the exponential backoff delay. When the server returns a valid `Retry-After` value, HTTPC uses that value directly (after truncation) and skips the backoff computation.

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
`Retry-After` is not limited to 429/503; it applies to 408/429/500/502/503/504 responses. When the response carries a `Retry-After` header, the value is parsed and used.
:::

## Backoff Strategies

### Exponential Backoff (Default)

Delays multiply by `BackoffFactor` on each retry, growing quickly at first and then flattening:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 2.0
// Delay sequence: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (cap)
```

### Gentle Exponential Backoff

`PerformanceConfig()` uses a `BackoffFactor` of 1.5, which grows more slowly than the default:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.5
cfg.Retry.Delay = 500 * time.Millisecond
// Delay sequence: 0.5s -> 0.75s -> 1.125s -> 1.6875s -> ...
```

### Fixed Delay

With `BackoffFactor = 1.0` every retry waits the same interval, for scenarios that require a fixed retry interval:

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.0
// Delay sequence: 1s -> 1s -> 1s -> 1s ...
```

### Random Jitter

Jitter adds a ±10% random offset to the base delay, spreading out retry timing after a simultaneous failure so that many clients do not retry at the same moment and cause a secondary overload:

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

:::tip Enable jitter in production
Outside tests that need deterministic delays, set `EnableJitter = true` in production to reduce the risk of many clients retrying at the same time.
:::

## Custom RetryPolicy

Implementing the `RetryPolicy` interface gives full control over retry behavior. The interface defines three methods:

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

:::tip Type publicly exported
The `resp` parameter type of `RetryPolicy.ShouldRetry`, `ResponseReader`, is exported by the `httpc` package as a public type alias (`httpc.ResponseReader`), so external packages can reference it directly. A custom `RetryPolicy` can be implemented in any business package.

Needs covered by the `RetryConfig` fields and `ProxyRotateOnStatus` do not require a custom policy.
:::

The example below shows a custom policy that retries only GET requests, usable as-is in any business package that imports `httpc`:

<!-- check-code: skip -->
```go
// ResponseReader is publicly exported by the httpc package (httpc.ResponseReader).
// This example compiles in any package that imports github.com/cybergodev/httpc.

// GETOnlyRetryPolicy retries only GET requests, and only on network errors and 502/503/504
type GETOnlyRetryPolicy struct {
    maxAttempts int
}

func (p *GETOnlyRetryPolicy) ShouldRetry(resp httpc.ResponseReader, err error, attempt int) bool {
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

Beyond client-level configuration, `WithMaxRetries` overrides the retry count for a single request:

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

When the per-request `WithMaxRetries` is unset, the engine uses the client configuration (or `MaxRetries()` of a `CustomPolicy`). Internally, `-1` is the "unset" sentinel, distinguishing an unconfigured value from an explicit 0 (disabled).

## Request Bodies and Retries

Retries require the request body to be **replayable**. The engine handles body types differently:

| Request body type | Retry behavior |
|------------|----------|
| `[]byte` / `string` / struct / `map` / `*FormData` | The reader is rebuilt on every attempt; replayable |
| `io.Reader` | Read fully into memory **before** the retry path is entered for the first time, then replayed byte by byte |
| `io.Reader` over 100MB | Fails immediately: `retry not supported for streaming bodies exceeding ...` |

:::warning Large streaming bodies and retries are mutually exclusive
An `io.Reader` request body is buffered into memory on the retry path, capped at 100MB (guarding against OOM). A stream above that cap must be split into separate uploads, or retries must be disabled for the request with `WithMaxRetries(0)`:

<!-- check-code: skip -->
```go
// Large file upload: disable retries to avoid the 100MB memory buffer
_, err := client.Post("https://api.example.com/upload",
    httpc.WithBody(largeReader),
    httpc.WithMaxRetries(0),
)
```
:::

Each attempt rebuilds the full request: headers, query parameters, and cookies are deep-copied and isolated between attempts. The `WithOnRequest` callback fires before every attempt and can refresh a token that is about to expire:

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Runs before every retry attempt
	_, err = client.Get("https://api.example.com/data",
		httpc.WithOnRequest(func(req httpc.RequestMutator) error {
			log.Printf("starting attempt: %s %s", req.Method(), req.URL())
			return nil
		}),
	)
	if err != nil {
		log.Printf("request failed: %v", err)
	}
}
```

## Retry Execution Flow

The engine runs one full "request + retry" cycle as follows:

```text
1. Resolve the retry budget: per-request WithMaxRetries unset (sentinel -1) -> fall back to CustomPolicy or the client config
2. Create the total-budget context: take the earlier of WithTimeout / Timeouts.Request and the existing context deadline
   -- covers all attempts and backoff waits, not one timeout per attempt
3. io.Reader request body -> buffer in memory (<=100MB, larger fails immediately)
4. Loop attempt = 0 .. MaxRetries:
   a. Rebuild the request on each attempt (headers/query/cookies deep-copied, OnRequest triggered)
   b. Network error -> classify as ClientError -> IsRetryable && ShouldRetry?
      - not retryable / attempts exhausted -> return the error (original type kept, Attempts = attempts made)
      - context canceled/timed out -> return immediately, no retry
   c. Response received -> ShouldRetry(resp) and attempts remain?
      - yes -> compute the delay (use Retry-After when present, truncated to 60s; otherwise exponential backoff)
            -> discard the intermediate response -> wait -> next attempt
      - no (including attempts exhausted) -> return the response (status code as-is, no error)
5. Context expires during the backoff wait -> terminate immediately, return a timeout error
```

:::tip Observe the retry process with HTTPC_DEBUG
With the `HTTPC_DEBUG=1` environment variable set, the engine prints the status code, retryability decision, and backoff delay of each attempt to stderr. Debugging retry counts or retryability decisions needs no additional logging middleware.
:::

## Proxy Pool and Retry Interaction

When `ProxyRotateOnStatus` or `ProxyRotatePerRequest` is configured, HTTPC raises `MaxRetries` so that every proxy in the pool is tried at least once. The adjustment is performed by `calculateMaxRetries`:

```text
effective MaxRetries = max(configured MaxRetries, len(ProxyPool) - 1)
(capped at maxRetryAttempts = 10)
```

**Example**: 5 proxies, configured `MaxRetries = 3`:

```text
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
The first request uses the first proxy and does not count as a retry, so trying all N proxies needs N - 1 retries. `calculateMaxRetries` raises `MaxRetries` to `len(ProxyPool) - 1` when the configured value is smaller and leaves it unchanged when it is larger. See [Proxy and Proxy Pools](./proxy) for the rotation and budget interaction.
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

### Proxy Connection Failures Force a Retry

With proxy rotation enabled (`ProxyRotateOnStatus` / `ProxyRotatePerRequest`), a connection failure to the proxy itself (dial failure, TLS failure) does not go through the regular retryable classification. Instead it forces the next retry and switches to the next proxy. Proxies that are permanently dead, such as a wrong port or an unreachable host, are removed by the combination of forced retries and consecutive-failure circuit breaking. See [Proxy and Proxy Pools](./proxy).

## Retry Budget Considerations

Retries extend a request's total duration. HTTPC's timeout is a total budget shared across all retry attempts.

Before the first attempt the engine creates a timeout context covering the entire retry loop, and both network requests and backoff waits are charged against that same budget, so no attempt receives a fresh full timeout.

### Total Worst-Case Time Formula

```text
total worst-case time ≈ min(Timeouts.Request, WithTimeout / context deadline)
```

With the default config (`MaxRetries=3`, `Request=180s`, `Delay=1s`, `Backoff=2.0`, `EnableJitter=true`): regardless of retry count and backoff duration, the whole "initial request + 3 retries + all backoff" takes at most about 180s.

Once the budget is exhausted, remaining attempts fail immediately with `ErrorTypeTimeout`, and requests waiting in backoff are woken up and terminated.

### Ways to Shorten Total Duration

| Adjustment | Effect |
|------|------|
| Reduce `MaxRetries` | Fewer retries; the budget is left for effective attempts |
| Reduce `Timeouts.Request` | Directly compresses the total budget ceiling |
| Reduce `Retry.Delay` | Shorter intervals; more of the budget goes to the requests themselves |
| Reduce `BackoffFactor` | Slower delay growth; earlier retries happen sooner |
| Override with `context.WithTimeout` | Precisely control this request's total budget |

:::warning Total budget vs retry count
The total budget is hard: once it is exhausted the request terminates immediately even if retries remain, so the actual retry count is below `MaxRetries`. The default 180s accommodates 3 retries plus roughly 7.7s of backoff; with a 5s timeout and default retries, little budget remains after the first backoff (about 1s).

To ensure N retries, reserve N+1 request durations plus the sum of backoff delays:

<!-- check-code: skip -->
```go
// Reserve enough time: 3 retries + delays + per-request time
ctx, cancel := context.WithTimeout(context.Background(),
    4*requestTimeout + 10*time.Second)
```
:::

## Context Cancellation and Retries

HTTPC's retry engine takes a fast path for context cancellation: when the failure cause is `context.Canceled` or `context.DeadlineExceeded`, `isRetryableError` returns false immediately, skipping the full error-classification logic:

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

- Manual cancellation (`cancel()`): stops immediately, no retry
- Context timeout: stops immediately, no retry
- An in-flight request that is canceled does not trigger extra retries

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

After retries are exhausted, the error is returned as a `ClientError`. `Type` keeps the original classification of the last failure (e.g. `ErrorTypeNetwork`, `ErrorTypeTimeout`), and `Attempts` records the total number of attempts:

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
| File downloads | Caller-controlled retries: `Download` runs once and does not enter the retry loop, so `MaxRetries` has no effect on it |
| Idempotent operations (GET/PUT/DELETE) | Retryable |
| Non-idempotent operations (POST) | Executed once by default (no retries); opt in explicitly with [`WithRetryNonIdempotent`](../api-reference/core/options#withretrynonidempotent) |
| Rate-limited APIs | Rely on automatic `Retry-After` parsing (built in) |
| Proxy-pool scenarios | Combine with `ProxyRotateOnStatus`; retry count auto-raised |

:::warning Retrying non-idempotent POST requests
By default, non-idempotent methods (POST, PATCH, and custom methods) execute exactly once and are never retried: the engine zeroes their retry budget. A timeout or a retryable 5xx may arrive after the server has already committed the operation, so replaying the body would cause side effects such as duplicate orders or duplicate payments.

To enable retries for a single request, pass [`WithRetryNonIdempotent(true)`](../api-reference/core/options#withretrynonidempotent); the client-level switch is `Retry.RetryNonIdempotent`, and the request-level option overrides it. Use it only for endpoints that tolerate replay, or guard them with an idempotency key. A custom `RetryPolicy` is likewise consulted only for idempotent methods and cannot enable POST retries on its own.
:::

## Next Steps

- [Error Handling](./error-handling) — Error classification and sentinel-error matching in depth
- [Configuration API](../api-reference/client-config/config) — Retry configuration field reference
- [Connection Pool & DNS](./connection-pool) — Connection reuse and DoH resolution
- [Proxy & Proxy Pool](./proxy) — Proxy pool configuration and rotation strategies
- [Interface Definitions](../api-reference/types/interfaces) — RetryPolicy interface reference
