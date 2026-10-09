---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo HTTPC | Types & Sentinel Matching"
description: "Handle HTTPC errors: ErrorType classes, ClientError fields and IsRetryable checks, errors.Is/As sentinel matching, retry exhaustion, and context timeouts."
sidebar_position: 7
---

# Error Handling

HTTPC wraps all errors uniformly as `ClientError`, providing type classification, retryability checks, and rich context. Combined with the Go standard library's `errors.Is`/`errors.As`, you can match sentinel errors precisely or handle them flexibly by category.

## ErrorType Complete Reference

HTTPC defines 12 error types covering every failure scenario from the network layer to the application layer:

| ErrorType | Code() | Meaning | Typical Scenario | Retryable |
|-----------|--------|------|----------|--------|
| `ErrorTypeNetwork` | `NETWORK_ERROR` | Network-layer error | Connection refused, connection reset, broken pipe | Depends on cause |
| `ErrorTypeTimeout` | `TIMEOUT` | Timeout | Dial timeout, request timeout, context deadline | Yes |
| `ErrorTypeContextCanceled` | `CONTEXT_CANCELED` | Context canceled | `ctx.Cancel()` was called | No |
| `ErrorTypeDNS` | `DNS_ERROR` | DNS resolution failure | Domain does not exist, DNS server failure | Retryable when temporary/timeout |
| `ErrorTypeTLS` | `TLS_ERROR` | TLS handshake error | Unsupported protocol version, cipher negotiation failure | No |
| `ErrorTypeCertificate` | `CERTIFICATE_ERROR` | Certificate verification failure | Expired certificate, invalid signature, untrusted CA | No |
| `ErrorTypeTransport` | `TRANSPORT_ERROR` | HTTP transport-layer error | Protocol error, transport interrupted | Yes |
| `ErrorTypeResponseRead` | `RESPONSE_READ_ERROR` | Response body read error | EOF from connection drop, read timeout | Depends on cause |
| `ErrorTypeRetryExhausted` | `RETRY_EXHAUSTED` | Retries exhausted | Still failing after reaching `MaxRetries` | No |
| `ErrorTypeValidation` | `VALIDATION_ERROR` | Request validation failure | Illegal URL format, control characters in headers | No |
| `ErrorTypeHTTP` | `HTTP_ERROR` | HTTP status code error | 4xx/5xx response | By status code |
| `ErrorTypeUnknown` | `UNKNOWN_ERROR` | Unclassified error | Other unmatched exceptions | No |

:::tip Full rules for retryability
`IsRetryable()` is more fine-grained than the table suggests: `ErrorTypeDNS` is only retryable when `net.DNSError` is flagged temporary or timeout; `ErrorTypeNetwork` checks `syscall.Errno` (`ECONNREFUSED`/`ECONNRESET`/`EPIPE`/`ETIMEDOUT`/`ENETUNREACH`/`EHOSTUNREACH`) and error-message patterns; `ErrorTypeResponseRead` retries only on network errors from read operations (`read`/`readfrom`). See "Retryability Check" below.
:::

## ClientError Fields In Detail

The `ClientError` struct carries the full context of a request failure:

| Field | Type | Purpose |
|------|------|------|
| `Type` | `ErrorType` | Error classification, for `switch` branching |
| `Message` | `string` | Human-readable error description |
| `Cause` | `error` | Underlying original error, supports `errors.Unwrap` chain |
| `URL` | `string` | The request URL (sanitized, see below) |
| `Method` | `string` | HTTP method (GET/POST/...) |
| `Attempts` | `int` | Number of attempts made (including the first); > 1 when retries are exhausted |
| `StatusCode` | `int` | HTTP status code (only set for `ErrorTypeHTTP`) |
| `Host` | `string` | Target hostname (for circuit breakers, etc.) |

### Error Type Checking

```go
package main

import (
	"errors"
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

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			switch clientErr.Type {
			case httpc.ErrorTypeTimeout:
				log.Printf("request timed out (tried %d times): %v", clientErr.Attempts, err)
			case httpc.ErrorTypeNetwork:
				log.Printf("network error: %v", err)
			case httpc.ErrorTypeDNS:
				log.Printf("DNS resolution failed: %v", err)
			case httpc.ErrorTypeTLS:
				log.Printf("TLS handshake failed: %v", err)
			case httpc.ErrorTypeCertificate:
				log.Printf("certificate verification failed: %v", err)
			case httpc.ErrorTypeRetryExhausted:
				log.Printf("still failing after %d retries: %v", clientErr.Attempts, err)
			case httpc.ErrorTypeValidation:
				log.Printf("request validation failed: %v", err)
			case httpc.ErrorTypeContextCanceled:
				log.Printf("request canceled: %v", err)
			default:
				log.Printf("other error [%s]: %v", clientErr.Code(), err)
			}
		}
		return
	}
	fmt.Printf("success: %d\n", result.StatusCode())
}
```

### Retryability Check

`IsRetryable()` combines the error type and the underlying cause to decide whether the error is worth retrying:

```go
package main

import (
	"errors"
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

	_, err = client.Get("https://api.example.com/data")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			if clientErr.IsRetryable() {
				fmt.Println("retryable error; upper layer may retry later")
			} else {
				fmt.Printf("non-retryable error [%s]; manual intervention needed\n", clientErr.Code())
			}
		}
	}
}
```

:::warning IsRetryable vs automatic retry
`IsRetryable()` answers "is this error worth retrying?" and is also used by HTTPC's internal retry engine. If you have configured automatic retries via `Retry.MaxRetries`, then by the time the error reaches your handler, a network/timeout error means retries are already exhausted. `IsRetryable()` is mainly for upper-layer decisions (e.g. circuit breakers, task queues).
:::

## Sentinel Errors Complete Reference

HTTPC defines the following sentinel error variables, matchable precisely via `errors.Is`:

| Sentinel variable | Trigger condition | Recommended handling |
|----------|----------|----------|
| `ErrClientClosed` | Using a client after `client.Close()` | Initialize a new Client or fix lifecycle management |
| `ErrNilConfig` | The Config pointer passed to `New()` is nil | Use `DefaultConfig()` for defaults |
| `ErrInvalidHeader` | Header validation failed (control characters or illegal format) | Fix the header value and retry |
| `ErrInvalidTimeout` | Timeout value is negative or exceeds the 30-minute cap | Adjust to the valid range `[0, 30min]` |
| `ErrInvalidRetry` | Invalid retry config (MaxRetries outside 0–10, BackoffFactor outside 1.0–10.0) | Fix retry parameters |
| `ErrInvalidConnection` | Invalid connection config (pool size out of range, malformed proxy URL) | Fix connection parameters |
| `ErrInvalidSecurity` | Invalid security config (response body size limit out of range) | Fix security parameters |
| `ErrInvalidMiddleware` | Invalid middleware config (redirect count over 50, UserAgent too long or contains control characters) | Fix middleware parameters |
| `ErrEmptyFilePath` | Download requested without a file path | Set `DownloadConfig.FilePath` |
| `ErrFileExists` | Target file exists and `Overwrite=false`, `ResumeDownload=false` | Enable overwrite or resume, or change the path |
| `ErrResponseBodyEmpty` | Calling `Unmarshal()` and similar on an empty response body | Check `RawBody` before parsing |
| `ErrResponseBodyTooLarge` | Response body exceeds `MaxResponseBodySize` | Raise the limit or switch to a paginated API |

:::tip Config errors vs runtime errors
The `ErrInvalid*` family (`ErrInvalidHeader`/`ErrInvalidTimeout`/`ErrInvalidRetry`/`ErrInvalidConnection`/`ErrInvalidSecurity`/`ErrInvalidMiddleware`) are configuration-validation errors returned at `New()` time and should never appear on the request hot path. Runtime errors are handled via `ClientError` classification.
:::

```go
package main

import (
	"errors"
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

	result, err := client.Get("https://api.example.com/data")

	switch {
	case errors.Is(err, httpc.ErrClientClosed):
		fmt.Println("client is closed; recreate it")
	case errors.Is(err, httpc.ErrResponseBodyTooLarge):
		fmt.Println("response body too large; consider raising MaxResponseBodySize")
	case errors.Is(err, httpc.ErrResponseBodyEmpty):
		fmt.Println("response body empty; check RawBody before calling parsing methods")
	case errors.Is(err, httpc.ErrInvalidHeader):
		fmt.Println("invalid header; fix and retry")
	}

	if result != nil {
		fmt.Printf("status code: %d\n", result.StatusCode())
	}
}
```

## Automatic URL Sanitization

`ClientError.Error()` automatically strips sensitive information from the URL. URLs containing a username/password (such as `https://user:pass@host/path`) are sanitized to `https://***:***@host/path`, ensuring credentials are never leaked into logs and error messages:

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

	// URL carries credentials
	result, err := client.Get("https://admin:s3cret@api.example.com/data")
	if err != nil {
		// Credentials are auto-sanitized in the error message:
		// "GET https://***:***@api.example.com/data: network error occurred"
		fmt.Println(err)
	}
	if result != nil {
		fmt.Println(result.StatusCode())
	}
}
```

:::tip Scope of sanitization
Sanitization removes not only `user:pass@host` credentials but also sensitive query parameters (such as `token`, `key`, `secret`, etc.). For URLs without credentials or sensitive parameters, a fast path skips parsing to avoid unnecessary `url.Parse` overhead.
:::

## Panic Recovery Safety Net

HTTPC builds a panic safety net into the `Request()` and `Download()` methods. Any unexpected panic (from the engine, transport, TLS library, or middleware) is caught and converted into a `ClientError` instead of crashing the caller's process:

<!-- check-code: skip -->
```go
// Internal implementation of client.go (conceptual)
func (c *clientImpl) Request(ctx context.Context, method, url string, ...) (*Result, error) {
    defer func() {
        if r := recover(); r != nil {
            result = nil
            err = panicToError(r) // Converted to ClientError
        }
    }()
    // ... normal request logic
}
```

:::warning The safety net does not replace middleware recovery
The built-in safety net is the last line of defense — it turns a panic into an error rather than a crash. But if your middleware may trigger panics, consider additionally using `RecoveryMiddleware()` — it catches panics earlier in the chain and provides richer logging context:

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),       // Middleware-layer panic recovery
    httpc.LoggingMiddleware(nil),     // Logging
    httpc.MetricsMiddleware(nil),     // Metrics
}
```
:::

## Automatic Retry and Errors

HTTPC's retry engine automatically handles retryable errors internally. Knowing which errors are auto-retried helps you avoid redundant retries at the application layer.

### Auto-Retried Errors

| Condition | Retried | Notes |
|------|----------|------|
| Network errors (connection refused, reset, EOF) | Yes | Matched by `isRetryableNetworkMessage` |
| Dial/request timeout | Yes | `ErrorTypeTimeout` |
| Temporary/timeout DNS failure | Yes | `dnsErr.IsTemporary \|\| dnsErr.IsTimeout` |
| Response body read network error | Yes | `net.OpError` on a read operation |
| Retryable HTTP status codes | Yes | 408/429/500/502/503/504 |
| Status codes in `ProxyRotateOnStatus` | Yes | e.g. 403 triggers proxy rotation |

### Non-Retried Errors

| Condition | Retried | Notes |
|------|----------|------|
| `context.Canceled` | No | Fast path, returned directly |
| `context.DeadlineExceeded` | No | Fast path, returned directly |
| TLS handshake failure | No | `ErrorTypeTLS` is not retryable |
| Certificate verification failure | No | `ErrorTypeCertificate` is not retryable |
| Configuration validation error | No | `ErrorTypeValidation` is not retryable |
| Other 4xx client errors | No | e.g. 400/401/403/404 |

:::tip Context cancellation is a fast path
`isRetryableError` checks `context.Canceled` and `context.DeadlineExceeded` before classification — if they match, it returns false immediately, skipping the full error-classification logic. This avoids wasting resources on retry checks when the context is already canceled.
:::

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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := client.Request(ctx, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			if clientErr.Type == httpc.ErrorTypeContextCanceled {
				// Context timed out or was manually canceled — not auto-retried
				fmt.Println("request canceled (timeout or manual cancel); will not retry")
			} else if clientErr.Type == httpc.ErrorTypeTimeout {
				fmt.Println("request timed out; auto-retries still failed")
			}
		}
		return
	}
	fmt.Println(result.StatusCode())
}
```

## Error Handling Best Practices

### 1. Distinguish Client Errors from Server Errors

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

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		// Network-layer error — connection, TLS, DNS, etc.
		log.Printf("network-layer error: %v", err)
		return
	}

	// HTTP-layer error — response received but status code is not 2xx
	if result.IsClientError() {
		// 4xx: the client request was wrong (bad params, insufficient permissions, etc.)
		log.Printf("client error: %d", result.StatusCode())
	} else if result.IsServerError() {
		// 5xx: server failure (retries exhausted, upstream still unavailable)
		log.Printf("server error: %d", result.StatusCode())
	} else {
		fmt.Printf("success: %d\n", result.StatusCode())
	}
}
```

### 2. Circuit Breaker Pattern

When a service keeps failing, a circuit breaker temporarily stops requests to avoid cascading failures and wasted resources:

<!-- check-code: skip -->
```go
type CircuitBreaker struct {
    mu           sync.Mutex
    failures     int
    threshold    int           // Consecutive-failure threshold
    cooldown     time.Duration // Breaker cooldown
    trippedAt    time.Time
}

func (cb *CircuitBreaker) Allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.trippedAt) < cb.cooldown {
            return false // Tripped — reject requests
        }
        cb.failures = 0 // Cooldown elapsed — reset
    }
    return true
}

func (cb *CircuitBreaker) Record(err error) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if err != nil {
        cb.failures++
        if cb.failures >= cb.threshold {
            cb.trippedAt = time.Now()
        }
    } else {
        cb.failures = 0 // Success resets the counter
    }
}

// Combine with IsRetryable when in use
func requestWithBreaker(client httpc.Client, cb *CircuitBreaker, url string) error {
    if !cb.Allow() {
        return fmt.Errorf("circuit breaker open")
    }
    result, err := client.Get(url)
    cb.Record(err)
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && !clientErr.IsRetryable() {
            cb.Record(nil) // Non-retryable errors don't count as service failures
        }
        return err
    }
    _ = result
    return nil
}
```

### 3. Fallback / Degradation

When the primary service is unavailable, fall back to a cache or default value:

<!-- check-code: skip -->
```go
package main

import (
    "errors"
    "log"

    "github.com/cybergodev/httpc"
)

func fetchWithFallback(client httpc.Client, url string, fallback []byte) []byte {
    result, err := client.Get(url)
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) {
            switch clientErr.Type {
            case httpc.ErrorTypeTimeout, httpc.ErrorTypeRetryExhausted:
                log.Printf("primary service unavailable, using fallback data: %v", err)
                return fallback
            case httpc.ErrorTypeValidation:
                // Validation errors are local bugs — do not degrade
                log.Fatalf("request configuration error: %v", err)
            }
        }
        log.Printf("unknown error, using fallback data: %v", err)
        return fallback
    }
    return result.RawBody()
}
```

### 4. Unified Handling via Middleware

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		httpc.LoggingMiddleware(&httpc.LoggingConfig{
			LogFunc: func(format string, args ...any) {
				log.Printf("[HTTP] "+format, args...)
			},
		}),
		httpc.MetricsMiddleware(&httpc.MetricsConfig{
			OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
				if err != nil {
					log.Printf("[METRICS] %s %s failed: %v (took %v)", method, url, err, duration)
				} else {
					log.Printf("[METRICS] %s %s -> %d (took %v)", method, url, statusCode, duration)
				}
			},
		}),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("status code: %d", result.StatusCode())
}
```

### 5. Layered Timeouts

HTTPC provides multiple levels of timeout control, from coarse to fine:

<!-- check-code: skip -->
```go
// Layer 1: client default timeout (global ceiling for all requests)
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 30 * time.Second

// Layer 2: middleware-enforced timeout (overrides the default)
timeoutMW := httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{
    Duration: 30 * time.Second,
})

// Layer 3: per-request override (WithTimeout overrides middleware and default)
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// Layer 4: context timeout (most precise; recommended for critical paths)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url)
```

:::warning ResponseHeader timeout vs WithTimeout interaction
When `Timeouts.ResponseHeader = 0` (default), the transport layer does not enforce a response-header timeout, and `WithTimeout` has full control. But if set to a positive value (e.g. `SecureConfig()`'s 10s), it is enforced at the transport layer for all requests, and `WithTimeout` cannot extend it — this is by design to defend against slowloris attacks. For long-response scenarios like AI APIs, keep `ResponseHeader = 0`.
:::

## Next Steps

- [Retry and Fault Tolerance](./retry-fault-tolerance) — Backoff algorithm details and custom retry strategies
- [Error Types API](../api-reference/types/errors) — Complete reference for error types and sentinel variables
- [Middleware Chain](./middleware-chain) — Unified error handling with middleware
- [Configuration API](../api-reference/client-config/config) — Timeout and security configuration reference
