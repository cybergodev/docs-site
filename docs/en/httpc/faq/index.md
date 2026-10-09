---
sidebar_label: "FAQ"
title: "FAQ - CyberGo HTTPC | Q&A"
description: "HTTPC FAQ: package functions vs Client, five config presets, HTTP/SOCKS5 proxy and DoH, cookie sessions, retries, errors.Is/As, and five-level timeout tuning."
sidebar_position: 1
---

# FAQ

## How do I choose between package-level functions and a Client instance?

**Answer:** Package-level functions (`httpc.Get`/`httpc.Post`, etc.) internally use a globally shared default client (`defaultClient`) that is lazily initialized on first call and auto-heals/rebuilds after being closed. They are suited for one-off requests, scripts, CLI tools, and other scenarios that do not need custom configuration.

```go
// Package-level function: simple and fast, shares the default client's connection pool
result, err := httpc.Get("https://api.example.com/data")
```

You should create an explicit Client instance when any of these apply:

- Custom configuration (timeouts, proxy, retry, TLS, etc.)
- Independent connection-pool lifecycle management
- Using a middleware chain (logging/audit/metrics/request ID)
- Multiple clients with different configurations coexisting

```go
// Explicit Client: full control over configuration and lifecycle
client, err := httpc.New(httpc.PerformanceConfig())
if err != nil {
    log.Fatal(err)
}
defer func() { _ = client.Close() }()

result, err := client.Get("https://api.example.com/data")
```

To make package-level functions use custom configuration, replace the global client with `SetDefaultClient` (the old one is closed automatically):

```go
customClient, _ := httpc.New(httpc.SecureConfig())
if err := httpc.SetDefaultClient(customClient); err != nil {
    log.Fatal(err)
}
// From now on all package-level functions use customClient
```

:::tip Production recommendation
For long-running services, prefer an explicit Client to avoid the implicit coupling of global state. Package-level functions are only for short-lived programs or quick prototyping.
:::

## How do I choose among the five configuration presets?

**Answer:** HTTPC provides five presets, arranged by security-vs-performance tradeoff:

| Preset | Timeout | Retries | Redirects | SSRF | Response cap | TLS verify | Applicable scenario |
|------|------|------|--------|------|----------|----------|----------|
| `SecureConfig()` | Strict (15s) | 1 | Disabled | Enabled | 5MB | Enabled | Handling user-provided URLs, finance/healthcare |
| `DefaultConfig()` | Moderate (180s) | 3 | Allowed | Enabled | 10MB | Enabled | General purpose |
| `PerformanceConfig()` | Longer (60s) | 3 | Allowed | Enabled | 50MB | Enabled | Internal microservices, high-concurrency APIs |
| `MinimalConfig()` | Moderate | 0 | Disabled | Enabled | 1MB | Enabled | One-off scripts, simple calls |
| `TestingConfig()` | Short (5s Dial) | 1 | Allowed | **Disabled** | Default | **Skipped** | Unit tests, local development |

Decision tree:

```
Are you handling user-provided URLs?
├── Yes → SecureConfig()
└── No → Do you need high throughput?
         ├── Yes → PerformanceConfig()
         └── No → Is it a one-off request?
                  ├── Yes → MinimalConfig()
                  └── No → DefaultConfig()
Test environment → TestingConfig()
```

:::warning TestingConfig security risk
`TestingConfig()` disables TLS verification and SSRF protection and prints a warning when used in a non-test environment. **Strictly prohibited in production** — restrict it to `*_test.go` files or local development.
:::

## How do I set up an HTTP/SOCKS5 proxy?

**Answer:** HTTPC provides three proxy methods, in priority order: `ProxyURL` > `ProxyPool` > `EnableSystemProxy`.

| Method | Field | Applicable scenario | Characteristics |
|------|------|----------|------|
| Single proxy | `ProxyURL` | Fixed proxy server | Highest priority, specified directly |
| Proxy pool | `ProxyPool` | Multi-proxy rotation, high availability | Supports rotation strategies and passive circuit-breaking |
| System proxy | `EnableSystemProxy` | Read environment variables | Lowest priority, follows system configuration |

```go
// Method 1: single proxy (supports http/https/socks5 protocols)
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://user:pass@proxy:1080"
client, _ := httpc.New(cfg)

// Method 2: system proxy (reads HTTP_PROXY/HTTPS_PROXY environment variables)
cfg.Connection.EnableSystemProxy = true

// Method 3: proxy pool (multi-proxy rotation + passive circuit-breaking)
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "socks5://proxy3:1080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
```

## How does proxy-pool rotation work?

**Answer:** The proxy pool rotates IPs through three mechanisms:

**1. Strategy rotation** (on each selection): `ProxyStrategyRoundRobin` selects proxies in sequential order, advancing to the next each time, so retries **naturally land on different IPs** with no extra configuration. `ProxyStrategyRandom` picks uniformly at random from healthy proxies.

**2. Per-request rotation** (on request start): set `ProxyRotatePerRequest = true`; at the start of each independent request, all idle connections are closed, forcing the Transport to re-evaluate the proxy pool. When disabled, HTTP connection reuse causes consecutive requests to the same host to reuse the previous request's proxy tunnel, bypassing strategy rotation. The trade-off is no connection reuse (each request establishes a new connection), but it guarantees per-request rotation. Useful for scraping/data collection targeting the same host — each request has a different source IP.

**3. Status-code-triggered rotation** (on response): set `ProxyRotateOnStatus` (e.g. `[]int{403}`); when the response returns one of these status codes and `Retry.MaxRetries > 0`, a retry is triggered, and strategy rotation ensures an IP switch. Useful for bypassing CF/WAF-style IP-level blocking.

In addition, the proxy pool has built-in **passive circuit-breaking and auto-recovery**: after consecutive connection failures (dial/TLS) reach `ProxyFailureThreshold` (default 3), the proxy is temporarily removed from the rotation pool and restored via half-open probing after `ProxyCooldown` (default 30s). Note that HTTP status codes do **not** trigger circuit-breaking — because blocking is often target-site-specific (a proxy blocked on one site may work fine on another).

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
cfg.Connection.ProxyFailureThreshold = 3   // Circuit-break after 3 consecutive connection failures
cfg.Connection.ProxyCooldown = 30 * time.Second // Half-open probe recovery after 30s
cfg.Connection.ProxyRotateOnStatus = []int{403} // Switch IP and retry on 403
cfg.Retry.MaxRetries = 3 // ProxyRotateOnStatus must be paired with retries
```

## How do I configure DoH?

**Answer:** DNS-over-HTTPS (DoH) can reduce DNS resolution latency and prevent DNS hijacking and cache poisoning. To enable:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // DNS response cache duration (default 5 minutes)
```

By default it uses three providers — Cloudflare, Google, and AliDNS (with priority-based fallback). If all DoH providers are unavailable, it automatically falls back to system DNS to ensure availability.

:::tip When to use DoH
DoH is suited for scenarios with high DNS-resolution-security requirements (e.g. preventing ISP DNS hijacking). Regular API calls do not need it — system DNS is usually sufficient, and DoH adds a small amount of resolution latency (the first query requires an HTTPS round trip).
:::

See [Connection Pool & DNS](../guides/connection-pool#dns-over-https).

## How do I manage cookie sessions?

**Answer:** HTTPC provides two layers of cookie management:

**1. Automatic management (DomainClient)**: the DomainClient created by `NewDomain` automatically enables cookies (`EnableCookies=true`) and embeds a SessionManager. After each request, `UpdateFromResult` automatically captures the response's `Set-Cookie`; before the next request, `prepareOptions` automatically injects them. Suited for scenarios like maintaining a login session.

**2. Manual management (SessionManager)**: when you need finer control, operate the `*SessionManager` returned by `dc.Session()` directly — set/delete/query cookies, switch security policies at runtime, or bulk-extract from responses.

```go
// Automatic management: the session is maintained automatically after login
dc, _ := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
defer func() { _ = dc.Close() }()

// Login (the response's Set-Cookie is captured automatically)
_, _ = dc.Request(ctx, "POST", "/login", httpc.WithJSON(loginData))

// Subsequent requests automatically carry the session cookies
result, _ := dc.Request(ctx, "GET", "/profile")
```

For a plain Client, setting `cfg.Connection.EnableCookies = true` enables automatic cookie-jar management, but cookies are not auto-extracted into a SessionManager.

See [Session Management](../api-reference/client-config/session).

## How do I configure retries?

**Answer:** HTTPC retries 3 times by default, and only retries **retryable transient errors**:

**Default retry conditions** (effective with no configuration):
- Network-layer errors: connection refused, connection reset, network unreachable, etc.
- Transport-layer timeouts: `net.OpError` timeout (**not** context deadline)
- Specific HTTP status codes: 408 (request timeout), 429 (rate limit), 500, 502, 503, 504

**Retry-After header parsing**: when a retryable response such as 429/503 is received and carries a `Retry-After` header, HTTPC automatically waits the delay indicated by the server (rather than computing its own backoff), avoiding added pressure on the server. The wait is **capped at 60s** — a malicious server cannot drag the client down with an oversized Retry-After value.

**Custom retry**: implement the `RetryPolicy` interface (the `ShouldRetry` + `GetDelay` methods) to replace the built-in logic and assign it to `cfg.Retry.CustomPolicy`. See the [Retry and Fault Tolerance guide](../guides/retry-fault-tolerance).

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5              // Max 5 retries (cap 10)
cfg.Retry.Delay = 2 * time.Second     // Initial delay
cfg.Retry.BackoffFactor = 2.0         // Exponential backoff factor
cfg.Retry.MaxRetryDelay = 60 * time.Second // Max single delay
cfg.Retry.EnableJitter = true         // Jitter (prevents thundering herd)
```

:::warning context cancellation is not retried
Failures triggered by `context.Canceled` and `context.DeadlineExceeded` are **never retried** — these represent the user's explicit cancellation/timeout intent, and retrying would violate that intent.
:::

See [Retry and Fault Tolerance](../guides/retry-fault-tolerance).

## How do I choose timeouts?

**Answer:** HTTPC provides a five-level timeout system, from broadest to narrowest scope:

| Timeout layer | Field | Default | Scope | Per-request override |
|--------|------|--------|--------|:----------:|
| Total request timeout | `TimeoutConfig.Request` | 180s | The entire process including retries | `WithTimeout()` |
| Dial timeout | `TimeoutConfig.Dial` | 10s | TCP connection establishment | No |
| TLS handshake timeout | `TimeoutConfig.TLSHandshake` | 10s | TLS handshake (HTTPS only) | No |
| Idle connection timeout | `TimeoutConfig.IdleConn` | 90s | How long a connection stays idle | No |
| Response header timeout | `TimeoutConfig.ResponseHeader` | 0 (disabled) | Waiting for response headers to arrive | **Cannot** be overridden |

**ResponseHeader special behavior**: defaults to 0 (disabled), in which case the context timeout from `TimeoutConfig.Request` or `WithTimeout()` is fully in charge. Setting a positive value enables a transport-level hard cap (defense against slowloris), but that value **overrides** `WithTimeout` (if ResponseHeader is shorter), applies to **all requests sharing the same client**, and cannot be overridden per request.

```go
// Recommended: context timeout (fine-grained control, per-request)
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, _ := client.Request(ctx, "GET", url)

// Request-option override (internally converted to a context timeout)
result, _ := client.Get(url, httpc.WithTimeout(30*time.Second))
```

:::warning TimeoutMiddleware is not suitable for Download
`TimeoutMiddleware` cancels the context immediately after the handler returns (`defer cancel()`), but Download's handler returns as soon as the response headers are received — the body has not been consumed yet, so the cancel triggers a "context canceled" on the first body byte. **Do not** wrap Download with TimeoutMiddleware; use `WithTimeout` instead (its deadline applies to the engine's overall context and covers body reads).
:::

## Why aren't 4xx/5xx returned as errors?

**Answer:** This is an HTTPC design philosophy: HTTP status codes are **application-layer semantics**, not transport-layer errors. A response returning 404 is entirely successful at the network layer — the TCP connection was established, the TLS handshake completed, the HTTP request was delivered, and the response came back correctly. Treating it as an error would conflate it with network-layer errors and complicate error handling.

Therefore HTTPC returns an error only on **network-layer failure** (connection refused, timeout, DNS failure, etc.); HTTP status codes are checked via `Result`:

```go
result, err := client.Get(url)
if err != nil {
    // Network-layer error (connection failure, timeout, etc.)
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("network error: %s", clientErr.Code())
    }
    return err
}

// HTTP status-code check
switch {
case result.IsSuccess():      // 2xx
    handleSuccess(result)
case result.IsClientError():  // 4xx
    log.Printf("client error: %d", result.StatusCode())
case result.IsServerError():  // 5xx
    log.Printf("server error: %d", result.StatusCode())
}
```

## How do I handle large-file downloads?

**Answer:** Use the `Download` method for streaming downloads, with support for progress callbacks, resumable transfers, SHA-256 checksums, and path-safety checks:

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
		log.Fatalf("failed to create client: %v", err)
	}
	defer func() { _ = client.Close() }()

	cfg := httpc.DefaultDownloadConfig()
	cfg.FilePath = "/tmp/large-file.zip"
	cfg.Overwrite = true
	cfg.ResumeDownload = true                            // Resumable: re-downloading after an interruption resumes from the breakpoint
	cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb924..." // Expected SHA-256
	cfg.ChecksumAlgorithm = httpc.ChecksumSHA256
	cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
		if total > 0 {
			fmt.Printf("\r%.1f%% (%s / %s, %s)",
				float64(downloaded)/float64(total)*100,
				httpc.FormatBytes(downloaded),
				httpc.FormatBytes(total),
				httpc.FormatSpeed(speed))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	result, err := client.Download(ctx, "https://example.com/large-file.zip", cfg)
	if err != nil {
		log.Fatalf("download failed: %v", err)
	}
	fmt.Printf("\ndownload complete: %s (%d bytes)\n", result.FilePath, result.BytesWritten)
}
```

:::tip Path safety
Download validates FilePath, rejecting directory paths (returns a file-open error) and unsupported checksum algorithms (rejected before touching the target file). Resumable download depends on the server supporting Range requests — if the server returns 200 instead of 206, HTTPC handles it correctly (starts over rather than truncating).
:::

## How do I do certificate pinning?

**Answer:** Certificate pinning verifies at TLS handshake time that the server's public key matches a pre-set fingerprint, defending against MITM attacks even if a trusted CA is compromised.

**SPKI hash generation steps** (using OpenSSL):

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

**Multiple-hash rotation**: passing multiple hashes supports key rotation — as long as the server's key matches **any one** of the pre-set hashes it passes. Always configure a backup hash so the client does not disconnect when the server rotates its key.

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // current key
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // backup key (for rotation)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, _ := httpc.New(cfg)
```

A Pinner instance can be safely shared by multiple Clients (it is concurrency-safe internally and is not deep-copied).

## Will a request be retried after context cancellation?

**Answer:** **No.** `context.Canceled` and `context.DeadlineExceeded` are not retryable — they represent the user's explicit cancellation or timeout intent, and retrying would violate that intent.

HTTPC's `IsRetryable()` method **checks context errors first**, before all other checks: as long as the Cause chain contains `context.Canceled` or `context.DeadlineExceeded`, it returns false immediately. Even if the error is classified as `ErrorTypeNetwork` (usually retryable), it is correctly identified as non-retryable due to the context-error check.

```go
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(100 * time.Millisecond)
    cancel() // Active cancellation
}()

_, err := client.Request(ctx, "GET", "https://example.com/slow")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        fmt.Println(clientErr.Type == httpc.ErrorTypeContextCanceled) // true
        fmt.Println(clientErr.IsRetryable())                          // false
    }
}
```

## Why doesn't MaxRedirects(0) disable redirects?

**Answer:** `MaxRedirects = 0` is the "unset" sentinel value, not "disable redirects". In `DefaultConfig()`, `MaxRedirects` defaults to 10. To truly disable redirects, use `WithFollowRedirects(false)` or set `Config.Defaults.FollowRedirects = false`:

```go
// Method 1: disable at config level
cfg := httpc.DefaultConfig()
cfg.Defaults.FollowRedirects = false
client, _ := httpc.New(cfg)

// Method 2: disable per request
result, _ := client.Get(url, httpc.WithFollowRedirects(false))
```

The `SecureConfig()` preset disables redirects by default (`FollowRedirects = false`) to prevent redirect-based SSRF attacks.

Full redirect behavior (following control, chain tracking, domain whitelist) is covered in the [Redirects guide](../guides/redirects).

## Why isn't an io.Reader request body size-validated?

**Answer:** `io.Reader` is a streaming interface with no way to know the data length in advance — there is no `Len()` method, and reading consumes the data. Therefore HTTPC **does not size-validate** request bodies of type `io.Reader`; the caller is responsible for controlling the data volume.

To limit upload size, wrap with the standard library's `io.LimitReader`:

```go
// Limit the upload to at most 1MB
limitedReader := io.LimitReader(unlimitedReader, 1024*1024)
result, err := client.Post(url, httpc.WithBody(limitedReader))
```

Or configure `SecurityConfig.MaxRequestBodySize` for a global upload cap (default 0 = unlimited):

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxRequestBodySize = 10 * 1024 * 1024 // Global 10MB cap
```

## How do I suppress security warnings?

**Answer:** Insecure configurations such as `TestingConfig()` print warnings via `log.Printf` when used in a non-test environment. To suppress them (e.g. for specific CI scenarios), redirect the warning output to `io.Discard`:

```go
// Suppress all security-warning output
httpc.SetSecurityWarnOutput(io.Discard)

cfg := httpc.TestingConfig() // No longer prints a warning
```

:::warning Controlled environments only
Suppressing security warnings only silences the output; it **does not** restore the disabled security features. Use it only in controlled environments (CI, containerized tests). In production, use `SecureConfig()` or `DefaultConfig()`.
:::

## How do I access internal services?

**Answer:** SSRF protection blocks private-IP connections by default (127.0.0.1, 10.x, 192.168.x, 169.254.x, etc.). There are two ways to access internal services:

```go
// Method 1: precise exemption (recommended) — allow only the specified CIDR ranges
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",     // VPC internal
    "100.64.0.0/10",  // Tailscale/VPN
}

// Method 2: fully disable (dangerous) — turns off all connection-level SSRF dial validation
cfg.Security.AllowPrivateIPs = true
```

:::warning Risk of AllowPrivateIPs
`AllowPrivateIPs = true` not only allows private IPs but **completely bypasses connection-level SSRF dial validation** (including localhost/loopback/link-local checks). Use it only when connecting to trusted internal services; **strictly prohibit** it when handling user-input URLs — use `SSRFExemptCIDRs` for precise exemptions instead.
:::

## How do I log requests?

**Answer:** Use `LoggingMiddleware` to add request logging; the URL is auto-sanitized to prevent credential leakage:

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        },
    }),
}
client, _ := httpc.New(cfg)
```

For compliance-grade auditing (recording request/response headers, redirect chains, source IP, user ID), use the more full-featured `AuditMiddleware`. See the [Built-in Middleware reference](../api-reference/client-config/middleware).

## How does HTTPC relate to net/http?

**Answer:** HTTPC is built on top of `net/http`, not a replacement for it. The underlying engine is still `http.Client` and `http.Transport` — HTTPC's own connection-pool manager creates and configures the `*http.Transport` (connection reuse, TLS, HTTP/2, and proxy selection are executed by the standard library), the redirect policy is injected via the `CheckRedirect` callback, and SSRF validation is wrapped into the dial function `DialContext`.

On top of that, HTTPC adds the parts the standard library lacks: a request-level option chain, pooled result objects (low allocation), a retry engine, a middleware chain, multi-layer security validation, and audit/logging middleware.

:::tip Ecosystem compatibility
Fully compatible with the standard-library ecosystem: `http.Cookie`, `tls.Config`, `context.Context`, `io.Reader`, and other types are used directly, with no adapter layer. Existing `tls.Config` knowledge (mTLS, custom CAs, cipher suites) migrates as-is to `Security.TLSConfig`.
:::

## Does the WithTimeout budget include retry time?

**Answer:** Yes. `WithTimeout` (and `Timeouts.Request`) is the **total budget covering all retry attempts and backoff waits**: the retry engine establishes a single deadline for the whole request instead of restarting the clock on each attempt.

```go
// Total budget of 30s: first attempt + up to 3 retries + backoff waits, 30s in total
result, err := client.Get(url, httpc.WithTimeout(30*time.Second))
```

Two caveats: backoff waits also consume the budget, so a budget that is too tight may not leave enough time to finish retrying; and `WithTimeout` is capped at 30 minutes — exceeding it returns `ErrInvalidTimeout`.

## Can retries cause duplicate POST submissions?

**Answer:** It can. HTTPC automatically retries 408/429/500/502/503/504 and network-layer transient errors **regardless of the request method** — POST is retried just like GET. If the first request already reached the server and was processed successfully (but the response was lost or timed out), the retry can cause duplicate creation or duplicate charges.

Mitigations (by priority):

```go
// 1. Server-side idempotency key (recommended): the business side
//    deduplicates via Idempotency-Key
client.Post(url,
    httpc.WithJSON(order),
    httpc.WithHeader("Idempotency-Key", orderID),
)

// 2. Disable retries per request on non-idempotent endpoints
client.Post(url, httpc.WithJSON(payment), httpc.WithMaxRetries(0))
```

Two additional notes: `io.Reader` request bodies are fully buffered to support retry replay (capped at 100MB, exceeding it errors out), so the body sent on retry is identical to the first one; and `context.Canceled`/`DeadlineExceeded` are never retried, so an active cancellation cannot trigger a duplicate submission. See [Retry and Fault Tolerance](../guides/retry-fault-tolerance).

## Do I need to close the response body manually?

**Answer:** No (and there is no close entry point either). The `Result` returned by regular requests (`Get`/`Post`/`Request`, etc.) holds **already-read and copied bytes** — HTTPC performs the read, the drain (up to 10MB, to facilitate connection reuse), and the close internally, and the underlying connection is managed by the pool.

```go
result, err := client.Get(url)
if err != nil {
    log.Fatal(err)
}
fmt.Println(len(result.RawBody())) // Bytes already in memory, no unclosed handles
```

Do not read large files into memory with regular requests — use `Download` (streams to disk, progress callbacks, resumable). `WithStreamBody` only takes effect on the `Download` path: when used via regular request methods, the response is still fully read into `Result` and the stream closed. See the [File Transfer guide](../guides/file-transfer).

## Why isn't my proxy working?

**Answer:** Troubleshoot in the following order (every item is source-verifiable behavior):

**1. Priority conflicts.** `ProxyURL` > `ProxyPool` > `EnableSystemProxy` — when several are set, only the highest priority takes effect; once `ProxyURL` is configured, the proxy pool is never consulted again.

**2. Connection reuse bypassed proxy selection.** Consecutive requests to the same host reuse established connections (including an HTTP proxy's CONNECT tunnel), so the proxy-selection function is not triggered again. When you need a **different egress IP per request**, set:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{"http://proxy1:8080", "http://proxy2:8080"}
cfg.Connection.ProxyRotatePerRequest = true // Close idle connections per request, forcing proxy re-selection
```

**3. When the system proxy is probed.** `EnableSystemProxy` probes the proxy address once, at client **construction time** (for the SSRF exemption). If the environment variables only later point to a localhost proxy (e.g. `127.0.0.1:7890`), that proxy may be blocked by SSRF protection — for dynamic local proxies, use an explicit `ProxyURL` instead (http/https/socks5/socks5h supported).

**4. Proxy-pool circuit breaking.** A proxy whose consecutive connection failures reach `ProxyFailureThreshold` (default 3) is removed from rotation and restored by half-open probing after `ProxyCooldown` (default 30s); when all proxies are broken, it degrades to picking the earliest one to recover rather than failing outright. If proxies stay unavailable, check the circuit-breaking threshold and cooldown settings.

See [Proxy & Proxy Pool](../guides/proxy).

## Why can't I access localhost even after exempting 127.0.0.0/8?

**Answer:** The pre-validation layer's localhost-hostname check runs **before** the CIDR exemption: when the URL host is `localhost`, `127.x.x.x`, `::1`, or similar, the request is rejected outright without ever reaching exemption matching. `SSRFExemptCIDRs` can only open up non-loopback private ranges (e.g. `10.0.0.0/8`).

When you genuinely need loopback access (e.g. a local health check):

```go
// Per-request exemption (recommended): only this request skips SSRF
// validation; the client's overall policy is unchanged
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

See the [known boundaries of SSRF protection](../security/ssrf).

## Why is the URL in error messages masked?

**Answer:** HTTPC automatically sanitizes URLs that end up in error messages, logs, and audit events: credentials are replaced with `***:***`, sensitive query parameters such as `token`/`password`/`api_key` are replaced with `[REDACTED]`, and the fragment is removed entirely.

```go
// When the request https://user:pass@example.com/api?token=secret fails,
// what appears in the error message is https://***:***@example.com/api?token=[REDACTED]
```

This prevents "second-hand leakage": even if the failed request itself is harmless, once the raw URL lands in a log-aggregation system (ELK, Sentry), the credentials become a fresh leak surface. The behavior is built in and cannot be disabled — nor should it be.

## More Resources

- [Quick Start](../getting-started/) - Get started in 5 minutes
- [Tutorial](../guides/tutorial) - A step-by-step complete example
- [Configuration API](../api-reference/client-config/config) - Complete configuration reference
- [Error Types](../api-reference/types/errors) - ClientError and error classification in depth
- [Error Handling](../guides/error-handling) - Error handling guide
