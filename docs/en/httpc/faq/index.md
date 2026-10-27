---
sidebar_label: "FAQ"
title: "FAQ - CyberGo HTTPC | Q&A"
description: "HTTPC FAQ: package functions vs Client, five config presets, HTTP/SOCKS5 proxy and DoH, cookie sessions, retries, errors.Is/As, five-level timeout tuning."
sidebar_position: 10
---

# FAQ

This page groups HTTPC's common questions by topic, each with a direct answer and a link to the detailed page; answers follow the source behavior.

## How do I choose between package-level functions and a Client instance?

**Answer:** Package-level functions (`httpc.Get`/`httpc.Post`, etc.) share a single internally managed default client that is created on first call and recreated on the next call after being closed. Use them for one-off requests, scripts, and CLI tools that need no custom configuration. For the default client's lifecycle, see [Core Concepts](../getting-started/concepts).

```go
// Package-level function: simple and fast, shares the default client's connection pool
result, err := httpc.Get("https://api.example.com/data")
```

Create an explicit Client instance when any of the following applies:

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

To make package-level functions use custom configuration, replace the default client with `SetDefaultClient`. The swap closes the old client and aborts its in-flight requests, so call it at startup:

```go
customClient, _ := httpc.New(httpc.SecureConfig())
if err := httpc.SetDefaultClient(customClient); err != nil {
    log.Fatal(err)
}
// From now on all package-level functions use customClient
```

:::tip Production recommendation
For long-running services, prefer an explicit Client to avoid the implicit coupling of global state. Package-level functions fit short-lived programs and prototypes.
:::

## How do I choose among the five configuration presets?

**Answer:** HTTPC provides five presets, arranged by security-vs-performance tradeoff. For the full comparison and selection criteria, see [Performance](../guides/performance).

| Preset | Timeout | Retries | Redirects | SSRF | Response cap | TLS verify | Applicable scenario |
|------|------|------|--------|------|----------|----------|----------|
| `SecureConfig()` | Strict (15s) | 1 | Disabled | Enabled | 5MB | Enabled | Handling untrusted URLs, finance/healthcare |
| `DefaultConfig()` | Moderate (180s) | 3 | Allowed | Enabled | 10MB | Enabled | General purpose |
| `PerformanceConfig()` | Fast-fail (60s; dial/TLS 15s) | 3 | Allowed | Enabled | 50MB | Enabled | Internal microservices, high-concurrency APIs |
| `MinimalConfig()` | Moderate | 0 | Disabled | Enabled | 1MB | Enabled | One-off scripts, simple calls |
| `TestingConfig()` | Short (5s Dial) | 1 | Allowed | **Disabled** | Default | **Skipped** | Unit tests, local development |

Decision tree:

```text
Are you handling untrusted URLs?
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
| System proxy | `EnableSystemProxy` | Follows the OS proxy settings | Lowest priority; environment variables take precedence over platform settings |

When several fields are set, only the highest-priority one takes effect.

```go
// Method 1: single proxy (supports http/https/socks5 protocols)
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://user:pass@proxy:1080"
client, _ := httpc.New(cfg)

// Method 2: system proxy (environment variables first, then platform settings)
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

**1. Strategy rotation** (on each selection): `ProxyStrategyRoundRobin` selects proxies in sequential order, advancing to the next each time, so retries **land on different IPs** with no extra configuration. `ProxyStrategyRandom` picks at random from healthy proxies.

**2. Per-request rotation** (on request start): set `ProxyRotatePerRequest = true`; at the start of each independent request, all idle connections are closed, forcing the Transport to re-evaluate the proxy pool. When disabled, HTTP connection reuse makes consecutive requests to the same host reuse the previous request's proxy tunnel, bypassing strategy rotation.

The trade-off is no connection reuse (each request establishes a new connection), in exchange for per-request rotation. Useful for scraping/data collection against the same host: each request has a different source IP.

**3. Status-code-triggered rotation** (on response): set `ProxyRotateOnStatus` (e.g. `[]int{403}`); when the response returns one of these status codes and `Retry.MaxRetries > 0`, a retry is triggered, and strategy rotation switches the IP. Useful for bypassing CF/WAF-style IP-level blocking.

The proxy pool also provides **passive circuit-breaking and automatic recovery**: after consecutive **TCP dial failures** reach `ProxyFailureThreshold` (default 3), the proxy is temporarily removed from the rotation pool and restored via half-open probing after `ProxyCooldown` (default 30s). Failures that occur after the dial returns (TLS handshake to an `https://` proxy, a rejected CONNECT, the SOCKS5 handshake) do not count toward circuit breaking.

HTTP status codes do **not** trigger circuit-breaking: blocking is specific to a target site, so a proxy blocked on one site remains usable for others.

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
cfg.Connection.ProxyFailureThreshold = 3   // Circuit-break after 3 consecutive TCP dial failures
cfg.Connection.ProxyCooldown = 30 * time.Second // Half-open probe recovery after 30s
cfg.Connection.ProxyRotateOnStatus = []int{403} // Switch IP and retry on 403
cfg.Retry.MaxRetries = 3 // ProxyRotateOnStatus must be paired with retries
```

See [Proxy Configuration](../guides/proxy) for how the proxy pool interacts with the retry budget.

## How do I configure DoH?

**Answer:** DNS-over-HTTPS (DoH) reduces DNS resolution latency and prevents DNS hijacking and cache poisoning. To enable it:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // DNS response cache duration (default 5 minutes)
```

By default it uses three providers — Cloudflare, Google, and AliDNS — with priority-based fallback. If all DoH providers are unavailable, it falls back to system DNS.

:::tip When to use DoH
DoH suits scenarios with DNS-security requirements, such as preventing ISP DNS hijacking. Regular API calls do not need it: system DNS is sufficient, and DoH adds resolution latency (the first query requires an HTTPS round trip).
:::

See [Connection Pool & DNS](../guides/connection-pool#dns-over-https).

## How do I manage cookie sessions?

**Answer:** Cookie management has two layers:

**1. Automatic management (DomainClient)**: the DomainClient created by `NewDomain` embeds a SessionManager. Session headers and cookies are injected automatically before each request, and `Set-Cookie` is captured from the response and written back into the session. This session store is independent of `Connection.EnableCookies`. Suited to scenarios such as maintaining a login session.

**2. Manual management (SessionManager)**: for finer control, operate the `*SessionManager` returned by `dc.Session()` directly: set/delete/query cookies, switch security policies at runtime, or bulk-extract from responses.

```go
// Automatic management: the session is maintained automatically after login
dc, _ := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
defer func() { _ = dc.Close() }()

// Login (the response's Set-Cookie is captured automatically)
_, _ = dc.Request(ctx, "POST", "/login", httpc.WithJSON(loginData))

// Subsequent requests automatically carry the session cookies
result, _ := dc.Request(ctx, "GET", "/profile")
```

For a plain Client, setting `cfg.Connection.EnableCookies = true` lets the cookie jar manage cookies, but they are not extracted into a SessionManager.

See [Session Management](../api-reference/client-config/session).

## How do I configure retries?

**Answer:** HTTPC retries 3 times by default, and only for **retryable transient errors**.

**Default retry conditions** (no configuration required):
- Network-layer errors: connection refused, connection reset, network unreachable, etc.
- Transport-layer timeouts: `net.OpError` timeout (**not** a context deadline)
- Specific HTTP status codes: 408 (request timeout), 429 (rate limit), 500, 502, 503, 504

**Retry-After header parsing**: when a retryable response such as 429/503 carries a `Retry-After` header, HTTPC waits the delay the server indicates instead of computing its own backoff, so it does not add pressure on the server. The wait is **capped at 60s**, so a server cannot hold the client for long with an oversized Retry-After value.

**Custom retry**: implement the `RetryPolicy` interface (the three methods `ShouldRetry` / `GetDelay` / `MaxRetries`) to replace the built-in logic, then assign it to `cfg.Retry.CustomPolicy`. See the [Retry and Fault Tolerance guide](../guides/retry-fault-tolerance).

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5              // Max 5 retries (cap 10)
cfg.Retry.Delay = 2 * time.Second     // Initial delay
cfg.Retry.BackoffFactor = 2.0         // Exponential backoff factor
cfg.Retry.MaxRetryDelay = 60 * time.Second // Max single delay
cfg.Retry.EnableJitter = true         // Jitter (prevents thundering herd)
```

:::warning context cancellation is not retried
Failures triggered by `context.Canceled` and `context.DeadlineExceeded` are **never retried**: they express the caller's explicit cancellation or timeout intent, and retrying would violate it.
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

**ResponseHeader behavior**: defaults to 0 (disabled), in which case the context timeout from `TimeoutConfig.Request` or `WithTimeout()` governs. A positive value becomes a transport-level hard cap (defense against slowloris): it fires first when shorter than the `WithTimeout` budget, and applies to **all requests sharing the same client**. For the rationale, see the [Configuration reference](../api-reference/client-config/config).

```go
// Recommended: context timeout (fine-grained control, per-request)
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, _ := client.Request(ctx, "GET", url)

// Request-option override (internally converted to a context timeout)
result, _ := client.Get(url, httpc.WithTimeout(30*time.Second))
```

:::warning TimeoutMiddleware is not suitable for Download
`TimeoutMiddleware` cancels its context as soon as the handler returns (the response headers arrive), while the response body has not been read yet. The middleware therefore rejects streaming requests on entry: a `Download` or `WithStreamBody` request returns `TimeoutMiddleware is incompatible with streaming responses`.

Use `WithTimeout` for such cases instead; its deadline applies to the engine's overall context and covers body reads.
:::

## Why aren't 4xx/5xx returned as errors?

**Answer:** HTTP status codes are **application-layer semantics**, not transport-layer errors. A 404 response is entirely successful at the network layer: the TCP connection was established, the TLS handshake completed, the HTTP request was delivered, and the response came back. Treating status codes as errors would conflate them with network-layer failures and complicate error handling.

HTTPC therefore returns an error only on **network-layer failure** (connection refused, timeout, DNS failure, etc.); HTTP status codes are checked via `Result`:

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

**Answer:** Use the `Download` method for streaming downloads. It supports progress callbacks, resumable transfers, SHA-256 checksums, and path-safety checks:

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
Download validates FilePath: it rejects directory paths (returns a file-open error) and unsupported checksum algorithms (rejected before the target file is touched).

Resumable download requires server support for Range requests. If the server returns 200 instead of 206, HTTPC returns an error and leaves the existing partial file intact (no truncation, no restart from scratch).
:::

## How do I do certificate pinning?

**Answer:** Certificate pinning verifies during the TLS handshake that the server's public key matches a pre-set fingerprint, defending against MITM attacks even if a trusted CA is compromised.

**SPKI hash generation steps** (using OpenSSL):

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

**Multiple-hash rotation**: passing multiple hashes supports key rotation — the server's key passes if it matches **any one** of the pre-set hashes. Always configure a backup hash so the client does not disconnect when the server rotates its key.

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

A Pinner instance can be shared safely by multiple Clients: it is concurrency-safe internally and is not deep-copied.

## Will a request be retried after context cancellation?

**Answer:** **No.** `context.Canceled` and `context.DeadlineExceeded` are not retryable: they express the caller's explicit cancellation or timeout intent, and retrying would violate it.

HTTPC's `IsRetryable()` method **checks context errors first**, before any other check: if the Cause chain contains `context.Canceled` or `context.DeadlineExceeded`, it returns false immediately.

Even an error classified as `ErrorTypeNetwork` is still reported as non-retryable because of that check.

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

**Answer:** `MaxRedirects = 0` is the "unset" sentinel value, not "disable redirects". In `DefaultConfig()`, `MaxRedirects` defaults to 10. To disable redirects, use `WithFollowRedirects(false)` or set `Config.Security.FollowRedirects = false`:

```go
// Method 1: disable at config level
cfg := httpc.DefaultConfig()
cfg.Security.FollowRedirects = false
client, _ := httpc.New(cfg)

// Method 2: disable per request
result, _ := client.Get(url, httpc.WithFollowRedirects(false))
```

The `SecureConfig()` preset disables redirects by default (`FollowRedirects = false`) to prevent redirect-based SSRF attacks.

Full redirect behavior (following control, chain tracking, domain whitelist) is covered in the [Redirects guide](../guides/redirects).

## Why isn't an io.Reader request body size-validated?

**Answer:** `io.Reader` cannot report its length, there is no `Len()` method, and reading consumes the data. With the default `Security.MaxRequestBodySize = 0` no limit is applied, so the caller controls the data volume.

To cap the stream, wrap it with the standard library's `io.LimitReader` at the call site:

```go
// Limit the upload to at most 1MB
limitedReader := io.LimitReader(unlimitedReader, 1024*1024)
result, err := client.Post(url, httpc.WithBody(limitedReader))
```

Alternatively, configure `SecurityConfig.MaxRequestBodySize` for an engine-level upload cap (default 0 = unlimited). Once set, the engine wraps the `io.Reader` in a counting reader at send time; reading past the cap aborts the transfer and returns `request body exceeds limit of N bytes`:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxRequestBodySize = 10 * 1024 * 1024 // Global 10MB cap
```

## How do I suppress security warnings?

**Answer:** Insecure configurations such as `TestingConfig()` print warnings to `os.Stderr` (the default) when used outside a test environment. To suppress them (e.g. for specific CI scenarios), redirect the warning output with `SetSecurityWarnOutput(io.Writer)` to `io.Discard`:

```go
// Suppress all security-warning output
httpc.SetSecurityWarnOutput(io.Discard)

cfg := httpc.TestingConfig() // No longer prints a warning
```

:::warning Controlled environments only
Suppressing security warnings only silences the output; it **does not** restore the disabled security features. Use it only in controlled environments (CI, containerized tests). In production, use `SecureConfig()` or `DefaultConfig()`.
:::

## How do I access internal services?

**Answer:** SSRF protection blocks private-IP connections by default (127.0.0.1, 10.x, 192.168.x, 169.254.x, etc.). Two approaches reach internal services:

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
`AllowPrivateIPs = true` not only allows private IPs but **completely bypasses connection-level SSRF dial validation** (including localhost/loopback/link-local checks). Use it only for trusted internal services; **do not enable it** when handling untrusted URLs — use `SSRFExemptCIDRs` for precise exemptions instead.
:::

## How do I log requests?

**Answer:** Use `LoggingMiddleware` for request logging; URLs are sanitized automatically to prevent credential leakage:

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

For compliance-grade auditing (request/response headers, redirect chains, source IP, user ID), use the fuller `AuditMiddleware`. See the [Built-in Middleware reference](../api-reference/client-config/middleware).

## How does HTTPC relate to net/http?

**Answer:** HTTPC is built on top of `net/http`, not as a replacement. The underlying engine is still `http.Client` and `http.Transport`: HTTPC's connection-pool manager creates and configures the `*http.Transport`, while connection reuse, TLS, HTTP/2, and proxy selection are executed by the standard library.

The redirect policy is injected via the `CheckRedirect` callback, and SSRF validation is wrapped into the dial function `DialContext`.

On top of that, HTTPC adds what the standard library lacks: a request-level option chain, pooled result objects (low allocation), a retry engine, a middleware chain, multi-layer security validation, and audit/logging middleware.

:::tip Ecosystem compatibility
Compatible with the standard-library ecosystem: `http.Cookie`, `tls.Config`, `context.Context`, `io.Reader`, and other types are used directly, with no adapter layer.

Existing `tls.Config` knowledge (mTLS, custom CAs, cipher suites) carries over to `Security.TLSConfig`.
:::

## Does the WithTimeout budget include retry time?

**Answer:** Yes. `WithTimeout` (and `Timeouts.Request`) is the **total budget covering all retry attempts and backoff waits**: the retry engine establishes a single deadline for the whole request rather than restarting the clock per attempt.

```go
// Total budget of 30s: first attempt + up to 3 retries + backoff waits, 30s in total
result, err := client.Get(url, httpc.WithTimeout(30*time.Second))
```

Two caveats: backoff waits also consume the budget, so retries cannot finish when the budget is too small; and `WithTimeout` is capped at 30 minutes, beyond which it returns `ErrInvalidTimeout`. For how the shared budget works, see [Retry and Fault Tolerance](../guides/retry-fault-tolerance).

## Can retries cause duplicate POST submissions?

**Answer:** By default, no. HTTPC automatically retries 408/429/500/502/503/504 and network-layer transient errors, but **only for idempotent requests** (GET/HEAD/PUT/DELETE/OPTIONS/TRACE).

POST, PATCH, and custom methods **execute exactly once and are never retried**: a timeout or retryable 5xx may arrive after the server has already committed the operation, and replaying the body would duplicate it.

The risk appears only once non-idempotent retries are explicitly enabled:

```go
// Explicitly opt in: the request body may be sent more than once (beware duplicates)
client.Post(url, httpc.WithJSON(order), httpc.WithRetryNonIdempotent(true))

// Recommended: a server-side idempotency key makes even opted-in retries safe
client.Post(url,
    httpc.WithJSON(order),
    httpc.WithHeader("Idempotency-Key", orderID),
)
```

Two additional notes: `io.Reader` request bodies are fully buffered to support retry replay (capped at 100MB, beyond which it errors), so the body sent on retry matches the first.

`context.Canceled`/`DeadlineExceeded` are never retried, so an active cancellation cannot trigger a duplicate submission. See [Retry and Fault Tolerance](../guides/retry-fault-tolerance).

## Do I need to close the response body manually?

**Answer:** No, and there is no close entry point. The `Result` returned by regular requests (`Get`/`Post`/`Request`, etc.) holds **already-read and copied bytes**: HTTPC performs the read, the drain (capped at `min(10MB, MaxResponseBodySize)`, to facilitate connection reuse), and the close internally, and the connection pool manages the underlying connection.

```go
result, err := client.Get(url)
if err != nil {
    log.Fatal(err)
}
fmt.Println(len(result.RawBody())) // Bytes already in memory, no unclosed handles
```

Do not read large files into memory with regular requests; use `Download` instead (streams to disk, progress callbacks, resumable).

`WithStreamBody` only takes effect on the `Download` path: combined with a regular request method (`Get`/`Post`/`Request`, ...), the request fails with `ErrStreamBodyRequiresDownload` instead of returning an empty body. See the [File Transfer guide](../guides/file-transfer).

## Why isn't my proxy working?

**Answer:** Troubleshoot in this order (every item is source-verifiable behavior):

**1. Priority conflicts.** `ProxyURL` > `ProxyPool` > `EnableSystemProxy` — when several are set, only the highest priority takes effect: once `ProxyURL` is configured, the proxy pool is never consulted.

**2. Connection reuse bypasses proxy selection.** Consecutive requests to the same host reuse established connections (including an HTTP proxy's CONNECT tunnel), so the proxy-selection function is not triggered again. To get a **different egress IP per request**, set:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{"http://proxy1:8080", "http://proxy2:8080"}
cfg.Connection.ProxyRotatePerRequest = true // Close idle connections per request, forcing proxy re-selection
```

**3. When the system proxy is probed.** `EnableSystemProxy` probes the proxy address once, at client **construction time** (for the SSRF exemption). If the environment variables only point to a localhost proxy later (e.g. `127.0.0.1:7890`), SSRF protection blocks that proxy. For dynamic local proxies, use an explicit `ProxyURL` instead (http/https/socks5/socks5h supported).

**4. Proxy-pool circuit breaking.** A proxy whose consecutive TCP dial failures reach `ProxyFailureThreshold` (default 3) is removed from rotation and restored by half-open probing after `ProxyCooldown` (default 30s). When all proxies are broken, the pool degrades to picking the earliest one to recover rather than failing outright.

If proxies stay unavailable, check the circuit-breaking threshold and cooldown.

See [Proxy & Proxy Pool](../guides/proxy).

## Why can't I access localhost even after exempting 127.0.0.0/8?

**Answer:** The pre-validation layer's localhost-hostname check runs **before** the CIDR exemption: when the URL host is `localhost`, `127.x.x.x`, `::1`, or similar, the request is rejected without reaching exemption matching. `SSRFExemptCIDRs` can only open up non-loopback private ranges (e.g. `10.0.0.0/8`).

For loopback access (e.g. a local health check):

```go
// Per-request exemption (recommended): only this request skips SSRF
// validation; the client's overall policy is unchanged
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

See the [known boundaries of SSRF protection](../security/ssrf).

## Why is the URL in error messages masked?

**Answer:** HTTPC sanitizes URLs that reach error messages, logs, and audit events: credentials are replaced with `***:***`, sensitive query parameters such as `token`/`password`/`api_key` are replaced with `[REDACTED]`, and the fragment is removed entirely.

```go
// When the request https://user:pass@example.com/api?token=secret fails,
// what appears in the error message is https://***:***@example.com/api?token=[REDACTED]
```

This prevents second-hand leakage: the failed request itself is harmless, but once the raw URL reaches a log-aggregation system (ELK, Sentry), the credentials become a new leak surface. The behavior is built in and cannot be disabled.

## More Resources

- [Quick Start](../getting-started/) - Get started in 5 minutes
- [Tutorial](../guides/tutorial) - A complete example
- [Configuration API](../api-reference/client-config/config) - Complete configuration reference
- [Error Types](../api-reference/types/errors) - ClientError and error classification in depth
- [Error Handling](../guides/error-handling) - Error handling guide
