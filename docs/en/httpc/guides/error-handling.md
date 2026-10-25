---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo HTTPC | Types & Sentinel Matching"
description: "Handle HTTPC errors: ErrorType classes, ClientError fields and IsRetryable checks, errors.Is/As sentinel matching, retry exhaustion, and context timeouts."
sidebar_position: 60
---

# Error Handling

HTTPC wraps request failures uniformly as `ClientError`, which carries the error classification, a retryability check, and request context. Combined with `errors.Is`/`errors.As`, sentinel errors can be matched directly, or errors can be handled by category.

## ErrorType Complete Reference

HTTPC defines 12 error types covering failure scenarios from the network layer to the application layer:

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
| `ErrorTypeHTTP` | `HTTP_ERROR` | HTTP status code error | Assigned by the classifier when the error message contains `HTTP 4xx`/`HTTP 5xx` (a normal 4xx/5xx response is not an error) | By status code |
| `ErrorTypeUnknown` | `UNKNOWN_ERROR` | Unclassified error | Other unmatched exceptions | No |

:::tip Full rules for retryability
`IsRetryable()` is more fine-grained than the table suggests:

- `ErrorTypeDNS` is retryable only when `net.DNSError` is flagged temporary or timeout.
- `ErrorTypeNetwork` checks `syscall.Errno` (`ECONNREFUSED`/`ECONNRESET`/`EPIPE`/`ETIMEDOUT`/`ENETUNREACH`/`EHOSTUNREACH`) and error-message patterns.
- `ErrorTypeResponseRead` retries only network errors from `read`/`readfrom` operations.

See "Implementation Details of Retryability" below.
:::

## Error Classification Decision Tree

A non-nil error entering the engine goes through the same classification flow, matched top-to-bottom by priority; the first hit wins:

```text
Error err
├─ errors.Is(err, context.Canceled)          → ContextCanceled "request was canceled"
├─ errors.Is(err, context.DeadlineExceeded)  → Timeout "request timed out"
├─ Pool exhausted (internal sentinel ErrPoolExhausted)  → Network "connection pool exhausted"
├─ *url.Error (unwrapped first; classify by the inner error)
│   ├─ Message contains "http2" + "invalid" → Validation "invalid HTTP/2 request header"
│   ├─ Message contains "parse" / "invalid url" / "missing protocol" → Validation "URL validation failed"
│   └─ Otherwise run the inner error through the branches below
├─ *net.DNSError                             → DNS "DNS resolution timed out / failed"
├─ *net.OpError                              → Network "network operation timed out / failed"
├─ net.Error                                 → Timeout (timeout) / Network (other)
└─ Error-message pattern matching (case-insensitive, selected)
    ├─ "stopped after … redirect"            → Validation "redirect limit exceeded"
    ├─ "circular redirect"                   → Validation "circular redirect detected"
    ├─ "redirect blocked"                    → Validation "redirect blocked by policy"
    ├─ "connection refused / reset / closed", "broken pipe" → Network
    ├─ "no such host"                        → DNS
    ├─ "tls" / "ssl" + "handshake"           → TLS
    ├─ "certificate", "x509"                 → Certificate
    ├─ "transport", "protocol error"         → Transport
    ├─ "failed to read response body", "unexpected eof"   → ResponseRead
    ├─ "http 4xx" / "http 5xx"               → HTTP (status code extracted as well)
    └─ "timeout" / "timed out" (without "context")        → Timeout
```

:::tip Already-classified errors are not wrapped again
When the error chain already contains a `ClientError` (e.g. an engine error returned by middleware), the classifier reuses its fields and only fills in the URL, method, and attempt count; no additional wrapping layer is added. A single `errors.As` hit on the outermost error yields the full context.
:::

## ClientError Fields In Detail

`ClientError` carries the full context of a request failure:

| Field | Type | Purpose |
|------|------|------|
| `Type` | `ErrorType` | Error classification, for `switch` branching |
| `Message` | `string` | Human-readable error description |
| `Cause` | `error` | Underlying original error, supports `errors.Unwrap` chain |
| `URL` | `string` | The request URL (sanitized, see below) |
| `Method` | `string` | HTTP method (GET/POST/...) |
| `Attempts` | `int` | Number of attempts made (including the first); > 1 when retries are exhausted |
| `StatusCode` | `int` | HTTP status code; populated only for `ErrorTypeHTTP`, 0 for other classifications |
| `Host` | `string` | Target hostname (for circuit breakers, etc.) |
| `ProxyURL` | `string` | Redacted URL of the proxy used for the final attempt; empty for direct connections, pre-dispatch errors, and system-proxy mode |

### Error() Output Format

`ClientError.Error()` emits a fixed format (URL already sanitized):

```text
METHOD url: message: cause (attempt N)
```

Concrete example:

```text
GET https://api.example.com/data: network error occurred: dial tcp 1.2.3.4:443: connect: connection refused (attempt 4)
```

`Unwrap()` returns `Cause`, so unwrapping through the wrapper works: `errors.Is(err, context.DeadlineExceeded)`, `errors.As(err, &opErr)` (to extract `*net.OpError`). Logging `err` directly already includes the method, sanitized URL, cause chain, and attempt count.

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
`IsRetryable()` reports whether the error is worth retrying, and HTTPC's retry engine uses the same check. With `Retry.MaxRetries` configured, a network or timeout error reaching the caller means retries are already exhausted. Upper layers (circuit breakers, task queues) can use `IsRetryable()` to decide whether to send another request.
:::

## Implementation Details of Retryability

Below the type classification, `IsRetryable()` applies a second, cause-level layer of checks; this is where the retryability differences between types come from.

### Network Errors: syscall and Message Patterns

`ErrorTypeNetwork` inspects the error cause layer by layer; a hit at any layer marks the error retryable:

| Check layer | Retryable condition |
|-------------|----------------------|
| `net.OpError.Timeout()` | Timeout → retry |
| `syscall.Errno` (POSIX) | `ECONNREFUSED` / `ECONNRESET` / `EPIPE` / `ETIMEDOUT` / `ENETUNREACH` / `EHOSTUNREACH` |
| Windows WSA error codes | 10054 (connection reset) / 10060 (connection timed out) / 10061 (connection refused) / 10051 (network unreachable) / 10065 (host unreachable) |
| Error-message patterns | `connection reset` / `eof` / `connection closed` / `broken pipe` / `network error` / `transport failed` |
| Other `net.Error` | Retry by default (server-initiated disconnects, EOF, and other transient faults) |

:::tip Why Windows needs a dedicated WSA mapping table
Since Go 1.25, POSIX-style `syscall.E*` constants on Windows carry a `1<<29` offset (e.g. `ECONNREFUSED = 536870934`), while the network stack returns raw WSA codes (e.g. `WSAECONNREFUSED = 10061`); the two encodings never compare equal.

HTTPC includes a WSA code mapping table so that retry decisions on Windows match Unix.
:::

### DNS: Retryable Only When Temporary/Timeout

`ErrorTypeDNS` is retryable only when `net.DNSError` is flagged `IsTemporary` or `IsTimeout`. Permanent failures such as a nonexistent domain (NXDOMAIN) do not consume retry attempts.

### Response Body Reads: Retry Read Operations Only

`ErrorTypeResponseRead` retries only read-type network errors: `net.OpError` with the operation name `read` / `readfrom`, or an error message containing eof / connection / timeout. File errors and write errors are excluded.

### HTTP Status Codes

`ErrorTypeHTTP` consults the retryable-status table directly: 408/429/500/502/503/504 (including extension codes injected by `ProxyRotateOnStatus`). When `StatusCode` is missing (= 0), it falls back to the `HTTP 4xx` / `HTTP 5xx` prefixes in the error message.

## Sentinel Errors Complete Reference

HTTPC defines the following sentinel error variables, matchable with `errors.Is`:

| Sentinel variable | Trigger condition | Recommended handling |
|----------|----------|----------|
| `ErrClientClosed` | Using a client after `client.Close()` | Initialize a new Client or fix lifecycle management |
| `ErrNilConfig` | The Config pointer passed to `New()` is nil | Use `DefaultConfig()` for defaults |
| `ErrInvalidHeader` | Header validation failed (control characters or illegal format) | Fix the header value and retry |
| `ErrInvalidTimeout` | Timeout value is negative, zero, or exceeds the 30-minute cap | Use a valid value; call `WithNoTimeout()` to remove the timeout |
| `ErrInvalidRetry` | Invalid retry config (MaxRetries outside 0–10, BackoffFactor outside 1.0–10.0) | Fix retry parameters |
| `ErrInvalidMaxRedirects` | Invalid redirect limit: per-request `WithMaxRedirects` is negative or above 50, or config-level `Security.MaxRedirects` is negative or above 50 | Move it into the 0–50 range |
| `ErrInvalidConnection` | Invalid connection config (pool size out of range, malformed proxy URL) | Fix connection parameters |
| `ErrInvalidSecurity` | Invalid security config: a response/decompressed/request body size limit out of range, an invalid TLS version or min > max, a malformed CIDR in `SSRFExemptCIDRs`, an invalid `SensitiveHeaders` entry, or an unknown `TLSFingerprint` preset / one combined with `TLSConfig` | Fix security parameters |
| `ErrInvalidMiddleware` | `Defaults.UserAgent` exceeds 512 characters or contains control characters (the name is historical and does **not** cover middleware configuration; an invalid redirect limit reports `ErrInvalidMaxRedirects`) | Fix `Defaults.UserAgent` |
| `ErrEmptyFilePath` | Download requested without a file path | Set `DownloadConfig.FilePath` |
| `ErrFileExists` | Target file exists and `Overwrite=false`, `ResumeDownload=false` | Enable overwrite or resume, or change the path |
| `ErrResponseBodyEmpty` | Calling `Unmarshal()` and similar on an empty response body | Check `RawBody` before parsing |
| `ErrResponseBodyTooLarge` | The body parsed by `Result.Unmarshal` exceeds the 50MB JSON limit | Stream the data or parse it yourself |

The engine-side `MaxResponseBodySize` limit on reading a response body does not wrap this sentinel: an oversize request ends with an `ErrorTypeResponseRead` `ClientError` whose message reads `failed to read response body: response body exceeds limit of N bytes`, so match it by message.

:::tip Config errors vs runtime errors
The `ErrInvalid*` family (`ErrInvalidHeader`/`ErrInvalidTimeout`/`ErrInvalidRetry`/`ErrInvalidConnection`/`ErrInvalidSecurity`/`ErrInvalidMiddleware`) is configuration-level: usually returned by `New()` validation. They can also surface on the request path, but only from an **invalid option**, never from server behavior — `WithHeader`/`WithHeaderMap` return `ErrInvalidHeader`, `WithTimeout` returns `ErrInvalidTimeout`, `WithMaxRedirects` returns `ErrInvalidMaxRedirects`, and `WithBasicAuth`/`WithBearerToken` return `ErrInvalidCredentials`. These fail while options are applied, before any request is sent.

Runtime errors are handled through `ClientError` classification.
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
		fmt.Println("Unmarshal body exceeds the 50MB limit; stream it instead")
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

`ClientError.Error()` strips sensitive information from the URL: a URL containing a username and password (such as `https://user:pass@host/path`) is sanitized to `https://***:***@host/path`, so credentials never appear in logs or error messages.

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
Sanitization removes `user:pass@host` credentials and also handles sensitive query parameters (such as `token`, `key`, `secret`). URLs without credentials or sensitive parameters take a fast path that skips parsing, avoiding `url.Parse` overhead.
:::

## Panic Recovery Safety Net

`Request()` and `Download()` include a panic safety net: an unexpected panic from the engine, transport, TLS library, or middleware is caught and converted into a **plain `error`** (`panic recovered: <reason>` plus the full stack trace), so the caller's process does not crash.

:::warning A recovered panic is not a `ClientError`
The fallback recover sits at the outermost layer of `clientImpl.Request`/`Download`, and the converted error is **never re-classified** — `errors.As(err, &clientErr)` will not match it, and it has no `Code()`/`IsRetryable()`. `RecoveryMiddleware` behaves the same way (it also calls `panicToError`). When classification matters, inspect the error yourself or match the underlying cause with `errors.Is`.
:::

<!-- check-code: skip -->
```go
// Internal implementation of client.go (conceptual)
func (c *clientImpl) Request(ctx context.Context, method, url string, ...) (*Result, error) {
    defer func() {
        if r := recover(); r != nil {
            result = nil
            err = panicToError(r) // Plain error, not re-classified
        }
    }()
    // ... normal request logic
}
```

:::warning The safety net does not replace middleware recovery
The built-in safety net is the last line of defense: it turns a panic into an error rather than a crash. When middleware itself can panic, use `RecoveryMiddleware()` as well; it catches panics earlier in the chain and keeps fuller logging context:

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

HTTPC's retry engine handles retryable errors automatically; the application layer can use that to avoid duplicate retries. Full retry conditions and backoff policy are in [Retry and Fault Tolerance](./retry-fault-tolerance).

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
`isRetryableError` checks `context.Canceled` and `context.DeadlineExceeded` first and returns false on a match, skipping the full classification.
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

`err != nil` means no response was obtained (network-layer failure); a 4xx/5xx status on `Result` means a response arrived with a non-2xx status.

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

When a service keeps failing, a circuit breaker pauses requests to avoid cascading failures and wasted resources:

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

When the primary service is unavailable, fall back to a cache or a default value:

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

// Layer 2: middleware-enforced timeout (applies before the client's built-in timeout)
timeoutMW := httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{
    Duration: 30 * time.Second,
})

// Layer 3: per-request override (WithTimeout overrides only the client default;
// the middleware timeout derives from the request's own Context(), and a
// shorter middleware timeout cannot be extended by WithTimeout)
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// Layer 4: context timeout (most precise; recommended for critical paths)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url)
```

:::warning ResponseHeader timeout vs WithTimeout interaction
When `Timeouts.ResponseHeader = 0` (default), the transport layer does not enforce a response-header timeout, and `WithTimeout` has full control. When set to a positive value (e.g. `SecureConfig()`'s 10s), it is enforced at the transport layer for all requests, and `WithTimeout` cannot extend it. See the [Configuration API](../api-reference/client-config/config) for the rationale.
:::

## Next Steps

- [Retry and Fault Tolerance](./retry-fault-tolerance) — Backoff algorithm details and custom retry strategies
- [Error Types API](../api-reference/types/errors) — Complete reference for error types and sentinel variables
- [Middleware Chain](./middleware-chain) — Unified error handling with middleware
- [Configuration API](../api-reference/client-config/config) — Timeout and security configuration reference
