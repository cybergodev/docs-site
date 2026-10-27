---
sidebar_label: "Overview"
title: "HTTP Client - CyberGo HTTPC | TLS and SSRF Protection"
description: "CyberGo HTTPC: a Go HTTP client with TLS 1.2+, SSRF protection, exponential-backoff retries, middleware chains, connection pooling, and Result."
---

# HTTPC

HTTPC is a Go HTTP client library built on the standard-library `net/http` transport. It provides TLS policy, SSRF protection, retries, a middleware chain, and a `Result` response wrapper.

Connection reuse, HTTP/2 negotiation, and TLS sessions come from the standard-library Transport. HTTPC adds URL and header validation, SSRF dial checks, and response-body size and decompression caps on top.

## Features

- **TLS 1.2+** - Enforces a minimum TLS version, defaults to TLS 1.2-1.3
- **SSRF Protection** - Blocks private IP connections by default, with configurable CIDR exemptions
- **Automatic Retries** - Exponential backoff with jitter and customizable retry strategies
- **Connection Pool Management** - Connection reuse with HTTP/2 support
- **Middleware Chain** - Built-in middleware for logging, audit, metrics, recovery, request IDs, and more
- **File Downloads** - Resumable downloads, progress callbacks, and checksum verification
- **DNS-over-HTTPS** - Built-in DoH resolution that reduces DNS hijacking risk
- **Object Pool Reuse** - Internal response objects and string builders are pooled via sync.Pool to reduce GC pressure
- **Proxy & Proxy Pool** - Single proxy, system proxy, and pool rotation (round-robin/random), with failure-based circuit breaking and status-code-driven IP rotation
- **Certificate Pinning** - SPKI-hash/public-key pinning that defends against MITM attacks even if a trusted CA is compromised
- **TLS Fingerprinting** - Browser transport-layer fingerprint imitation (JA3/JA4 + HTTP/2 frames + ordered header block) with Chrome/Firefox/Safari presets
- **Domain Sessions** - DomainClient binds a base URL; SessionManager maintains cookies and common request headers
- **Redirect Control** - Follow toggle, hop limit, and a target-domain whitelist

### Capability Matrix

| Capability | Default Behavior | Main Customization Points | Further Reading |
|------|----------|------------|----------|
| Retry & fault tolerance | Idempotent requests retry up to 3 times (POST/PATCH execute exactly once by default), exponential backoff (1s base, ×2, 30s cap per wait) + jitter; honors `Retry-After` | Count/backoff parameters/custom strategies/`WithRetryNonIdempotent` to opt into non-idempotent retries | [Retry & Fault Tolerance](./guides/retry-fault-tolerance) |
| Middleware chain | Not enabled | Logging/metrics/audit/recovery/request ID/timeout/static headers, plus custom middleware | [Middleware Chain](./guides/middleware-chain) |
| SSRF protection | Blocks private/reserved IPs (127.0.0.1, 10.x, 192.168.x, etc.) | Precise `SSRFExemptCIDRs` exemptions/per-request exemption/disable entirely | [SSRF Protection](./security/ssrf) |
| TLS & certificate pinning | TLS 1.2-1.3 | Version floor/ceiling, custom `tls.Config`, SPKI/public-key pinning | [TLS & Certificate Pinning](./security/tls-certpin) |
| TLS fingerprinting (browser spoofing) | Off (standard stack) | `Security.TLSFingerprint` preset + package-level `WithTLSFingerprint` routing | [TLS Fingerprinting](./guides/tls-fingerprint) |
| Connection pool & HTTP/2 | 50 idle connections, 10 per host, HTTP/2 enabled | Pool sizes, idle duration, response-header size limit | [Connection Pool](./guides/connection-pool) |
| Proxy & proxy pool | No proxy used | Single proxy/system proxy/pool rotation/failure circuit breaking/status-code IP rotation | [Proxy & Proxy Pool](./guides/proxy) |
| DNS-over-HTTPS | Off | `EnableDoH`, cache TTL (5 minutes by default) | [Connection Pool](./guides/connection-pool) |
| Sessions & cookies | Client-level cookies off; DomainClient keeps session cookies in its SessionManager | `EnableCookies`, domain-client session management | [Domain Client & Sessions](./guides/domain-session) |
| File transfer | — | `Download` (resume/progress callbacks/checksums), `WithFile` upload | [File Upload & Download](./guides/file-transfer) |
| Timeout control | 180s overall, 10s dial/TLS, 90s idle connections | Five independently configurable timeout levels, per-request `WithTimeout` override | [Request & Response](./guides/request-response) |

## Installation

```bash
# Initialize a module (skip if you already have a project)
go mod init example.com/demo

# Install HTTPC (requires Go 1.27+)
go get github.com/cybergodev/httpc
```

```go
import "github.com/cybergodev/httpc"
```

The 7 direct dependencies all compile in unconditionally (there are no build tags for trimming features). `golang.org/x/net` and `golang.org/x/sys` serve the standard path; brotli / compress / uTLS / tls-client / fhttp serve the `Security.TLSFingerprint` path and simply do not run when fingerprinting is off, so requests go out over the standard stack. No initialization or configuration is required after import.

## 30-Second Experience

```go
package main

import (
	"fmt"
	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}

	fmt.Println(result.StatusCode()) // 200
}
```

How the request is processed:

1. `httpc.Get` uses the default client (created lazily on the first call, reused afterwards, safe for concurrent use);
2. The request is sent after CRLF-injection protection, SSRF checks, and a TLS 1.2+ handshake;
3. Retryable errors (timeouts, 408/429/5xx, etc.) are retried with exponential backoff, up to 3 times. `Get` is idempotent; POST/PATCH are not retried by default;
4. The response is wrapped in a `*Result`; the status code, body, and retry statistics are read from that object.

:::tip
4xx/5xx responses are **not** returned as `error`; check the status code with methods like `result.IsSuccess()`. `err` indicates network-layer errors only. See [Quick Start](./getting-started/) for details.
:::

## Relationship with the Standard Library net/http

HTTPC's API layering mirrors the standard library to keep migration costs low:

- **Two-layer API correspondence** — package-level `httpc.Get` corresponds to `http.Get` (both use a default client). The `Client` returned by `httpc.New(cfg)` corresponds to `http.Client` (explicit configuration and lifecycle).
- **Reuse of the transport** — the underlying connection pool, HTTP/2, and proxy tunneling come from `net/http`'s Transport. HTTPC layers security validation, a retry engine, a middleware chain, and the `Result` transformation on top.
- **Minimal `Doer` interface** — a single `Request` method. To replace the implementation (e.g. a test mock), implement only this interface instead of the full `Client` interface.
- **Consistent mental model** — `http.Cookie`, `context.Context`, and timeout semantics map one-to-one onto standard-library usage. Existing `net/http` code migrates directly.

## Where to Start

Choose a reading path based on the target:

| Goal | Recommended |
|------|-------------|
| Get started in 5 minutes | [Quick Start](./getting-started/) |
| Migrate from net/http | [Migration Guide](./guides/migration) |
| Hands-on practice in 30 minutes | [Tutorial](./guides/tutorial) |
| Look up a usage pattern | [Cheat Sheet](./getting-started/cheatsheet) |
| Understand the design | [Core Concepts](./getting-started/concepts) |
| Request options & response handling | [Request & Response](./guides/request-response) |
| Retry & fault tolerance | [Retry & Fault Tolerance](./guides/retry-fault-tolerance) |
| Middleware chain | [Middleware Chain](./guides/middleware-chain) |
| Connection pool & DNS | [Connection Pool & DNS](./guides/connection-pool) |
| Proxy & proxy pool | [Proxy & Proxy Pool](./guides/proxy) |
| File upload & download | [File Upload & Download](./guides/file-transfer) |
| Sessions & cookies | [Domain Client & Sessions](./guides/domain-session) |
| Redirect control | [Redirects](./guides/redirects) |
| Performance tuning | [Performance](./guides/performance) |
| Browser TLS fingerprint spoofing | [TLS Fingerprinting](./guides/tls-fingerprint) |
| Learn about security features | [Security Overview](./security/) |
| Look up API signatures | [API Reference](./api-reference/) |
| Frequent questions | [FAQ](./faq/) |

## Core Concepts

HTTPC offers package-level functions, `Client` instances, and the domain client, in ascending order of control granularity:

```text
Package-level functions    Client instance               Domain client
httpc.Get()  →  client, _ := httpc.NewDefault()  →  dc, _ := httpc.NewDomainDefault(url)
One-off requests       Custom config/middleware       Session management/automatic cookie handling
```

### Configuration Presets

| Preset | Use Case |
|--------|----------|
| `DefaultConfig()` | General scenarios with secure defaults |
| `SecureConfig()` | Security-sensitive scenarios with strict timeouts |
| `PerformanceConfig()` | High throughput with a large connection pool |
| `TestingConfig()` | Test environments with security checks disabled |
| `MinimalConfig()` | Lightweight scripts with no retries or redirects |

:::tip How to choose
- Unclear: `DefaultConfig()`
- Untrusted URLs: `SecureConfig()` — no redirects, strict timeouts, a 5MB response cap
- High throughput: `PerformanceConfig()` — large connection pool, cookies enabled
- Unit tests and local development: `TestingConfig()` — certificate validation and SSRF protection off, **never in production**
- One-off scripts: `MinimalConfig()`
:::

## Production Ready

- **Concurrency safe** — a `Client` can be shared by any number of goroutines; no separate clients are needed for concurrency
- **Panic safety net** — unexpected panics on the request path are caught and converted into an `error` returned to the caller
- **Memory protection** — response bodies are capped at 10MB by default (100MB after decompression), preventing memory exhaustion and decompression-bomb attacks
- **Observability** — built-in logging, metrics, audit, and request-ID middleware; URL credentials and sensitive headers are redacted automatically in logs and errors
- **Lifecycle** — call `Close()` on an instance client when done to release its connection pool; the default client behind package-level functions is managed by the library and can be replaced with `SetDefaultClient()`
