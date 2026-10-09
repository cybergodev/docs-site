---
sidebar_label: "Overview"
title: "HTTP Client - CyberGo HTTPC | Secure High-Performance"
description: "CyberGo HTTPC: secure, high-performance Go HTTP client with TLS 1.2+, SSRF protection, smart retries, middleware chains, and pooling for microservices and APIs."
---

# HTTPC

A secure HTTP client library that is secure by default, with built-in smart retries, a middleware chain, and object-pool reuse.

HTTPC is built on top of the standard-library `net/http` transport: connection reuse, HTTP/2 negotiation, and TLS sessions behave exactly as they do with the standard library. On top of that, it adds what a production-grade HTTP client needs but the standard library does not provide — enforced TLS policy, SSRF protection, exponential-backoff retries, a middleware chain, a response-body size guardrail, and an all-in-one `Result` wrapper.

## Features

- **TLS 1.2+** - Enforces a minimum TLS version, defaults to TLS 1.2-1.3
- **SSRF Protection** - Blocks private IP connections by default, with configurable CIDR exemptions
- **Smart Retries** - Exponential backoff with jitter and customizable retry strategies
- **Connection Pool Management** - High-performance connection reuse with HTTP/2 support
- **Middleware Chain** - Built-in middleware for logging, audit, metrics, recovery, request IDs, and more
- **File Downloads** - Resumable downloads, progress callbacks, and checksum verification
- **DNS-over-HTTPS** - Built-in DoH resolution to reduce DNS hijacking risk
- **Object Pool Reuse** - Internal response objects and string builders are pooled via sync.Pool to reduce GC pressure
- **Proxy & Proxy Pool** - Single proxy, system proxy, and pool rotation (round-robin/random), with failure-based circuit breaking and status-code-driven IP rotation
- **Certificate Pinning** - SPKI-hash/public-key pinning that defends against MITM attacks even if a trusted CA is compromised
- **Domain Sessions** - DomainClient binds a base URL; SessionManager automatically maintains cookies and common request headers
- **Redirect Control** - Follow toggle, hop limit, and a target-domain whitelist

### Capability Matrix

| Capability | Default Behavior | Main Customization Points | Further Reading |
|------|----------|------------|----------|
| Retry & fault tolerance | Up to 3 retries with exponential backoff (1s base, ×2, 30s cap per wait) + jitter; honors `Retry-After` | Count/backoff parameters/custom strategies/per-request overrides | [Retry & Fault Tolerance](./guides/retry-fault-tolerance) |
| Middleware chain | Not enabled | Logging/metrics/audit/recovery/request ID/timeout/static headers, plus custom middleware | [Middleware Chain](./guides/middleware-chain) |
| SSRF protection | Blocks private/reserved IPs (127.0.0.1, 10.x, 192.168.x, etc.) | Precise `SSRFExemptCIDRs` exemptions/per-request exemption/disable entirely | [SSRF Protection](./security/ssrf) |
| TLS & certificate pinning | TLS 1.2-1.3 | Version floor/ceiling, custom `tls.Config`, SPKI/public-key pinning | [TLS & Certificate Pinning](./security/tls-certpin) |
| Connection pool & HTTP/2 | 50 idle connections, 10 per host, HTTP/2 enabled | Pool sizes, idle duration, response-header size limit | [Connection Pool](./guides/connection-pool) |
| Proxy & proxy pool | No proxy used | Single proxy/system proxy/pool rotation/failure circuit breaking/status-code IP rotation | [Proxy & Proxy Pool](./guides/proxy) |
| DNS-over-HTTPS | Off | `EnableDoH`, cache TTL (5 minutes by default) | [Connection Pool](./guides/connection-pool) |
| Sessions & cookies | Client-level cookies off; DomainClient enables them automatically | `EnableCookies`, domain-client session management | [Domain Client & Sessions](./guides/domain-session) |
| File transfer | — | `Download` (resume/progress callbacks/checksums), `WithFile` upload | [File Upload & Download](./guides/file-transfer) |
| Timeout control | 180s overall, 10s dial/TLS, 90s idle connections | Five independently configurable timeout levels, per-request `WithTimeout` override | [Request & Response](./guides/request-response) |

## Installation

```bash
# Initialize a module (skip if you already have a project)
go mod init example.com/demo

# Install HTTPC (requires Go 1.25+)
go get github.com/cybergodev/httpc
```

```go
import "github.com/cybergodev/httpc"
```

Apart from `golang.org/x/sys` there are no other third-party dependencies — import it and you are ready to go, with no initialization or configuration required.

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

What happens behind that one line:

1. `httpc.Get` internally resolves to a shared default client (created lazily on the first call, reused afterwards, safe for concurrent use);
2. The request goes out after CRLF-injection protection, SSRF checks, and a TLS 1.2+ handshake;
3. Retryable errors (timeouts, 408/429/5xx, etc.) are retried automatically with exponential backoff, up to 3 times;
4. The response comes back wrapped in a `*Result` — status code, body, and retry statistics in one place.

:::tip
4xx/5xx responses are **not** returned as `error`; check the status code with methods like `result.IsSuccess()`. `err` indicates network-layer errors only. See [Quick Start](./getting-started/) for details.
:::

## Relationship with the Standard Library net/http

HTTPC's API layering deliberately mirrors the standard library to keep migration and cognitive costs low:

- **Two-layer API correspondence** — package-level `httpc.Get` corresponds to `http.Get` (sharing a default instance); the `Client` returned by `httpc.New(cfg)` corresponds to `http.Client` (explicit configuration and lifecycle).
- **Reuse, not reinvention, of the transport** — the underlying connection pool, HTTP/2, and proxy tunneling come from `net/http`'s Transport; HTTPC layers security validation, a retry engine, a middleware chain, and the `Result` transformation on top.
- **Minimal `Doer` interface** — a single `Request` method; to swap in your own implementation (e.g. a test mock), implement just this instead of the full `Client` interface.
- **Consistent mental model** — `http.Cookie`, `context.Context`, and timeout semantics map one-to-one onto standard-library usage, so existing `net/http` experience transfers directly.

## Where to Start

Choose a reading path based on your goal:

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
| Learn about security features | [Security Overview](./security/) |
| Look up API signatures | [API Reference](./api-reference/) |

## Core Concepts

HTTPC offers three usage modes, from simplest to most flexible:

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
When unsure, start from `DefaultConfig()`. Use `SecureConfig()` when handling user-supplied URLs (no redirects, strict timeouts, a 5MB response cap), `PerformanceConfig()` for high throughput (large connection pool, cookies enabled), `TestingConfig()` for unit tests and local development (certificate validation and SSRF protection off — **never use it in production**), and `MinimalConfig()` for one-off scripts.
:::

## Production Ready

- **Concurrency safe** — a `Client` can be shared by any number of goroutines; no need to create separate clients for concurrency
- **Panic safety net** — unexpected panics on the request path are caught and converted into an `error` returned to the caller
- **Memory guardrails** — response bodies are capped at 10MB by default (100MB after decompression), preventing memory exhaustion and decompression-bomb attacks
- **Observability** — built-in logging, metrics, audit, and request-ID middleware; URL credentials and sensitive headers are redacted automatically in logs and errors
- **Explicit lifecycle** — call `Close()` on an instance client when done to release its connection pool; the default client behind package-level functions is managed by the library and can be replaced with `SetDefaultClient()`
