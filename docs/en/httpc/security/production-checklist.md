---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo HTTPC | Pre-Launch Audit"
description: "HTTPC production security checklist: TLS and certificate pinning, SSRF exemption audits, timeout budgets, pool limits, retries, size limits, and log redaction."
sidebar_position: 4
---

# Production Checklist

Walking through these items before launch effectively eliminates common security-configuration gaps. The checklist is grouped by category, with each item annotated with its default value, recommended production value, and a verification method. Consider automating the high-risk items in CI with the commands at the end.

## TLS / Encryption

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `InsecureSkipVerify` | `false` | `false` | Code search; see command at the end |
| `MinTLSVersion` | TLS 1.2 | TLS 1.2+ (force 1.3 for high security) | `grep MinTLSVersion` |
| `MaxTLSVersion` | TLS 1.3 | TLS 1.3 | `grep MaxTLSVersion` |
| Not using `TestingConfig()` | — | Yes | Code search; see command at the end |
| Certificate pinning (high-security scenarios) | Not enabled | Recommended | `grep CertificatePinner` |

:::warning
`InsecureSkipVerify = true` invalidates every TLS security measure. HTTPC prints a warning to `stderr` in non-test environments — confirm no such warning appears in the logs before launch.
:::

Version-semantics notes: `MinTLSVersion`/`MaxTLSVersion` fall back to 1.2/1.3 when `0`; `Min > Max` cannot pass `New()` validation. Once `TLSConfig` is set, the version fields are ignored and `Security.InsecureSkipVerify` no longer takes effect (it must be controlled inside `TLSConfig`) — when reviewing a custom `TLSConfig`, check its own fields.

## SSRF Protection

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `AllowPrivateIPs` | `false` | `false` (when handling untrusted URLs) | Code search; see command at the end |
| `SSRFExemptCIDRs` | `nil` | List only necessary subnets, as narrowly as possible | Audit whether subnets can be narrowed |
| Using `SecureConfig()` for user URLs | — | Yes | Code review |
| `RedirectWhitelist` | `nil` | Configure when handling user URLs | Code review |

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = false
// Exempt only subnets you actually need, as narrowly as possible
cfg.Security.SSRFExemptCIDRs = []string{"10.50.0.0/16"}
cfg.Security.RedirectWhitelist = []string{"api.example.com"}
```

## Timeout Configuration

Timeouts are the first line of defense against Slowloris, resource exhaustion, and cascading failures.

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `TimeoutConfig.Request` | 180s | Set per business need (e.g. 30s) | Confirm non-zero |
| `TimeoutConfig.Dial` | 10s | 5-10s | `grep Timeouts.Dial` |
| `TimeoutConfig.TLSHandshake` | 10s | 5-10s | `grep Timeouts.TLSHandshake` |
| `TimeoutConfig.ResponseHeader` | 0 | As needed (see below) | Understand its scope |
| `TimeoutConfig.IdleConn` | 90s | 60-120s | — |

:::warning
`TimeoutConfig.ResponseHeader` is a transport-level hard cap that applies to **all requests** on the client and **cannot** be overridden per request with `WithTimeout`. Setting a positive value overrides a longer `WithTimeout`. Only set a positive value when you need transport-level defense against Slowloris; for long-response scenarios like AI APIs, keep it at 0 and rely on the `Request` timeout.
:::

### How to Budget Timeouts

`Timeouts.Request` (default 180s) and `WithTimeout` form a **total budget covering all retry attempts and backoff waits**: the retry engine establishes a single deadline for the whole request instead of restarting the clock per attempt — `WithTimeout(30s)` plus 3 retries takes at most 30s, not 4 times that. Both the configured value and `WithTimeout` have a 30-minute hard cap; anything beyond that is a configuration error.

Each individual attempt is constrained by narrower timeouts: `Dial` (default 10s) bounds TCP establishment, and `TLSHandshake` (default 10s) bounds the handshake. A good starting point is to work backward from the downstream API's P99:

```go
// Budget formula: Request >= Dial + TLSHandshake + expected transfer time x (1 + MaxRetries) + total backoff
cfg.Timeouts.Request = 30 * time.Second // Total budget
cfg.Timeouts.Dial = 5 * time.Second     // Single dial
cfg.Timeouts.TLSHandshake = 5 * time.Second
```

## Connection Pool Limits

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `MaxIdleConns` (global idle connections) | 50 | Estimate from concurrency | Confirm non-zero |
| `MaxConnsPerHost` (total connections per host) | 10 | Raise as needed under high concurrency | Note 0 = unlimited |
| `MaxIdleConnsPerHost` (idle per host) | Auto-derived | — | Derived as `MaxConnsPerHost/2`, clamped to 2-10 |
| Total pool cap | 1000 | — | Built into the connection layer; exceeding it returns a pool-exhausted error |

Configuration validation hard caps: `MaxIdleConns` and `MaxConnsPerHost` are both 0-1000 (enforced by `ValidateConfig`). Two easily misunderstood semantics:

- `MaxConnsPerHost = 0` means **unlimited** (net/http semantics), not "no connections allowed"; the default configuration sets it to 10
- The total pool cap (1000) cannot be changed through the public `Config`; once reached, new dials fail immediately instead of queuing

```go
cfg := httpc.DefaultConfig()
cfg.Connection.MaxIdleConns = 50    // Global idle connections
cfg.Connection.MaxConnsPerHost = 10 // Per-host connection cap (idle + active)
```

`SecureConfig()` uses more conservative 20/5 values; `PerformanceConfig()` loosens them to 100/20.

## Size Limits

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `MaxResponseBodySize` | 10MB | Per business need (e.g. 5MB) | Confirm non-zero |
| `MaxDecompressedBodySize` | 100MB | Per business need (e.g. 50MB) | Confirm non-zero |
| `MaxRequestBodySize` | 0 (unlimited) | **Explicitly set** an upload cap | `grep MaxRequestBodySize` |
| `MaxResponseHeaderBytes` | 0 (Go default 10MB) | Tighten to 1MB for high security | `grep MaxResponseHeaderBytes` |

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 5 * 1024 * 1024     // 5MB response
cfg.Security.MaxDecompressedBodySize = 50 * 1024 * 1024 // 50MB decompressed
cfg.Security.MaxRequestBodySize = 2 * 1024 * 1024       // 2MB upload (default 0 = unlimited!)
cfg.Connection.MaxResponseHeaderBytes = 1 * 1024 * 1024  // 1MB response header
```

:::danger
`MaxRequestBodySize` defaults to 0 (unlimited) and has **no automatic fallback**. If you proxy forwarded requests or handle user uploads without setting it, an attacker can send oversized requests to drain bandwidth and memory. Always set it explicitly.
:::

## Retry Strategy

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `MaxRetries` | 3 | No more than 5 | Code review |
| Retrying non-idempotent requests | — | Be cautious with POST/PUT/PATCH | Code review for idempotency |
| `EnableJitter` | `true` | `true` (prevents thundering herd) | `grep EnableJitter` |
| `MaxRetryDelay` | 30s | 30s | — |

:::warning
Retrying non-idempotent requests (POST creating a resource, PUT partial update) may cause duplicate creation or duplicate charges. If the operation is not idempotent, set `WithMaxRetries(0)` for such requests, or implement an idempotency key on the server side.
:::

### Retry Storm Control

The built-in retryable status codes are fixed at 408/429/500/502/503/504 (`internal/engine/errors.go`); transient network errors (connection refused/reset/unreachable, non-context transport timeouts) are retried as well. Anti-storm mechanisms are in place by default — confirm item by item before launch that none have been weakened:

| Mechanism | Default | Effect |
|------|--------|------|
| Exponential backoff | `Delay=1s`, `BackoffFactor=2.0` | Spreads retry intervals, piling less pressure onto a failing service |
| Jitter | `EnableJitter=true` | Breaks the synchronized rhythm of concurrent retries, preventing thundering herds |
| Per-delay cap | `MaxRetryDelay=30s` | Backoff cannot grow unboundedly |
| Retry-After compliance | Parsed automatically | Waits as instructed by the server, but **capped at 60s** — a malicious server cannot stall the client with a huge Retry-After |
| Total budget | `WithTimeout` covers all attempts | Retries cannot exceed the request's total timeout |

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3                   // Hard cap 10 (enforced by ValidateConfig)
cfg.Retry.MaxRetryDelay = 30 * time.Second
cfg.Retry.EnableJitter = true              // On by default; written out explicitly for auditability
// Disable retries per request for non-idempotent endpoints:
// client.Post(url, httpc.WithJSON(body), httpc.WithMaxRetries(0))
```

:::tip
When `ProxyRotateOnStatus` is configured (rotating proxies and retrying by status code), `MaxRetries` is automatically raised to `len(ProxyPool)-1` (capped at 10), guaranteeing every proxy is tried at least once.
:::

Two more pitfalls to avoid: `io.Reader` request bodies are fully buffered to support retry replay, and bodies over 100MB error out outright (`retry not supported for streaming bodies`); `context.Canceled`/`context.DeadlineExceeded` are never retried, so proactive cancellation never triggers duplicate requests.

## Cookie Security

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| `CookieSecurity` | `nil` (no validation) | `StrictCookieSecurityConfig()` | `grep CookieSecurity` |
| `WithSecureCookie` ordering | — | After all cookie-adding options (`WithCookies` etc.) | Code review |

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// Requires Secure + HttpOnly + SameSite=Strict
```

## File Download Security

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| Untrusted download path | — | Use only trusted paths; never concatenate user input | Code review |
| `Checksum` verification | Not set | Set SHA-256 for critical files | `grep Checksum` |
| `Overwrite` / `ResumeDownload` | `false` | As needed | Code review |

HTTPC's `Download` already includes five layers of path defense (UNC blocking, control-character filtering, system-path protection, path-traversal detection, symlink defense), but you should still avoid using user input directly as `FilePath`.

## Resource Management

| Check item | Default | Recommended production value | Verification method |
|--------|--------|-----------|----------|
| Explicit `client.Close()` | — | `defer client.Close()` | Code review |
| Closing the default client | — | `CloseDefaultClient()` when a long-running service exits | Code review |
| `WithContext` for cancellation | — | Yes | Code review |
| Response body release | Automatic | Regular requests need no manual close (and have no way to close) | Confirm you are not holding the stream yourself |
| Download residue cleanup | Automatic | Partial files from interrupted/failed verification are deleted automatically | Confirm you are not writing to disk yourself, bypassing `Download` |

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
	cfg := httpc.DefaultConfig()
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	// Ensure the connection pool is released
	defer func() {
		if cerr := client.Close(); cerr != nil {
			log.Printf("failed to close client: %v", cerr)
		}
	}()

	// Use context to control per-request timeout and cancellation
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := client.Get("https://api.example.com", httpc.WithContext(ctx))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("status code: %d\n", result.StatusCode())
}
```

:::tip
When using package-level functions (`httpc.Get`, etc.), the default client does not close connections automatically on program exit. Long-running services should call `httpc.CloseDefaultClient()` during graceful shutdown to release the connection pool. For production services, prefer creating a client explicitly via `httpc.New(cfg)` to stay in control of configuration and lifecycle.
:::

### Response Body and Temporary Files

- **Regular requests**: what `Result` holds is bytes that have already been read and copied — HTTPC performs the read, the drain (up to `min(10MB, MaxResponseBodySize)`, for connection reuse), and the close internally; there is no Body to close manually (and no entry point for doing so)
- **Large files**: use `Download` instead of a regular request — streamed writes to disk, progress callbacks, and resume support; partial files from interrupted transfers, failed verification, or disk write errors are deleted automatically, never leaving half a file behind
- **`client.Close()`**: closes idle connections, the DoH resolver, and the connection pool; it is idempotent and safe to call repeatedly; a closed client returns `ErrClientClosed` for further requests

## Monitoring and Auditing

### Audit Middleware (High-Security Scenarios)

`AuditMiddleware` generates structured audit events — a good fit for compliance-heavy scenarios. The URL in each event is sanitized (credentials removed), and sensitive request headers are masked by default.

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
	// event.SourceIP / event.UserID are injected from context
	data, _ := json.Marshal(event)
	log.Println(string(data))
}
auditCfg.Format = "json"
auditCfg.IncludeHeaders = true
auditCfg.MaskHeaders = []string{"Authorization", "Cookie", "Set-Cookie", "X-API-Key"}
auditMiddleware := httpc.AuditMiddleware(auditCfg)
```

`SourceIP` and `UserID` are injected via the context keys `httpc.SourceIPKey` and `httpc.UserIDKey`, making it easy to correlate requests with callers. `AuditEvent` includes timestamp, method, URL, status code, duration, retry count, error, redirect chain, request/response headers, and more.

### Logging and Metrics Middleware

| Check item | Recommended production value | Verification method |
|--------|-----------|----------|
| `RecoveryMiddleware()` | Enable (prevents panic crashes) | `grep RecoveryMiddleware` |
| `LoggingMiddleware()` | Enable (request logs) | `grep LoggingMiddleware` |
| `MetricsMiddleware()` | Enable (collect metrics) | `grep MetricsMiddleware` |
| `RequestIDMiddleware()` | Enable (request tracing) | `grep RequestIDMiddleware` |

### Sensitive-Data Log Redaction

HTTPC redacts output across multiple channels by default; confirm before launch that none of them are bypassed:

| Output channel | Redaction behavior |
|----------|----------|
| Error messages | URL credentials → `***:***`; 20+ sensitive parameters such as `token`/`password`/`api_key` → `[REDACTED]`; fragment removed |
| `LoggingMiddleware` | Request-log URLs sanitized the same way (`SanitizeURL`, cannot be disabled) |
| `AuditMiddleware` | Audit-event URLs sanitized; request headers listed in `MaskHeaders` masked |
| `Config.String()` | Proxy URL credentials masked; headers not printed |

Checkpoint: a custom logging middleware that prints the raw request URL bypasses the built-in redaction — print the sanitized URL instead, or simply reuse `LoggingMiddleware`; `MaskHeaders` should cover your business's custom sensitive headers (e.g. `X-API-Key`, `X-Auth-Token`).

## Certificate Pinning

For high-security scenarios (finance, healthcare), enabling certificate pinning is recommended to defend against man-in-the-middle attacks after a CA compromise:

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // Current key
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // Backup (rotation)
)
if err != nil {
    log.Fatal(err)
}
cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
```

For pinning configuration and maintenance details, see [TLS and Certificate Pinning](./tls-certpin).

## Code Examples

### Production-Grade Client Creation

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()

	// Timeouts
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Timeouts.Dial = 10 * time.Second
	cfg.Timeouts.TLSHandshake = 10 * time.Second
	cfg.Timeouts.ResponseHeader = 0 // Rely on the Request timeout; no transport-level hard cap
	cfg.Timeouts.IdleConn = 90 * time.Second

	// Connection pool
	cfg.Connection.MaxIdleConns = 50
	cfg.Connection.MaxConnsPerHost = 10

	// Security
	cfg.Security.AllowPrivateIPs = false
	cfg.Security.MaxResponseBodySize = 5 * 1024 * 1024      // 5MB
	cfg.Security.MaxDecompressedBodySize = 50 * 1024 * 1024 // 50MB
	cfg.Security.MaxRequestBodySize = 2 * 1024 * 1024       // 2MB upload

	// Retries
	cfg.Retry.MaxRetries = 3
	cfg.Retry.Delay = 1 * time.Second
	cfg.Retry.EnableJitter = true

	// Request defaults
	cfg.Defaults.UserAgent = "my-service/1.0"
	cfg.Defaults.FollowRedirects = true
	cfg.Defaults.MaxRedirects = 5

	// Middleware
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
		httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("production client ready")
}
```

### Secure Client (Handling User URLs)

```go
func createSecureClient() (httpc.Client, error) {
	cfg := httpc.SecureConfig()
	cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
	cfg.Security.RedirectWhitelist = []string{"api.example.com"}
	// SecureConfig already sets FollowRedirects = false, AllowPrivateIPs = false, and a 5MB response cap
	return httpc.New(cfg)
}
```

## Check Commands

Run the following commands in CI or before committing to scan for high-risk configurations:

```bash
# Check for TestingConfig misuse (excluding test files)
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# Check for InsecureSkipVerify = true
grep -rn "InsecureSkipVerify.*true\|InsecureSkipVerify:\s*true" --include="*.go" | grep -v "_test.go"

# Check for AllowPrivateIPs = true (dangerous in production)
grep -rn "AllowPrivateIPs.*true\|AllowPrivateIPs:\s*true" --include="*.go" | grep -v "_test.go"

# Check whether MaxRequestBodySize is set (default 0 = unlimited)
grep -rn "MaxRequestBodySize" --include="*.go" | grep -v "_test.go"
```

:::tip
Consider wrapping these commands as a CI step that fails the build when high-risk configurations are detected (`TestingConfig`, `InsecureSkipVerify: true`, or `AllowPrivateIPs: true` appearing in non-test code).
:::

## Next Steps

- [Security Overview](./) - Security features overview
- [SSRF Protection](./ssrf) - SSRF defense in depth
- [TLS and Certificate Pinning](./tls-certpin) - Certificate pinning in production
- [Configuration API](../api-reference/client-config/config) - Complete configuration reference
