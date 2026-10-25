---
title: "Core Concepts - CyberGo HTTPC | Two-Layer API & Config"
description: "HTTPC core concepts: two-layer API architecture, building blocks, Config vs With* options, request lifecycle, domain client sessions, and the ClientError model."
sidebar_label: "Core Concepts"
sidebar_position: 20
---

# Core Concepts

HTTPC is an HTTP client library built on the standard-library `net/http` transport. It consists of client instances, request options, a middleware chain, and the `Result` response wrapper. This page describes each component's role, the configuration layers, and how a request is processed.

## Core Building Blocks at a Glance

| Component | Responsibility | Key Points |
|------|------|--------|
| `Client` (interface) | Executes requests; manages the connection pool and lifecycle | Created via `New(cfg)` / `NewDefault()`; 7 verb methods + `Request` + `Download` + `Close` |
| `Doer` (interface) | Minimal request interface | A single `Request(ctx, method, url, opts...)` method; used for mocks and custom implementations |
| `RequestOption` (`With*` functions) | Builds a single request | Functional options; applied in the order passed; the first failure aborts the request immediately |
| `MiddlewareFunc` / `Handler` | Middleware and terminal handler | Onion model; composed with `Chain(mw...)` |
| `RequestMutator` / `ResponseMutator` | Read/write views of the request/response inside middleware | Read/write the request in the request phase, the response in the response phase |
| `SessionManager` | Session-state store | Thread safe; manages cookies and common request headers uniformly |
| `DomainClienter` (interface) | Domain client | Binds a base URL + embedded session; relative paths are joined automatically |
| `Result` | Response wrapper | Three-part structure (request/response/metadata); nil-safe accessors; reclaimed by GC automatically |
| `ClientError` | Network-layer error classification | Extract with `errors.As`; `Code()` / `IsRetryable()` / `Attempts` |

How the components relate to each other:

```text
Package-level functions ──share──▶ default Client ◀──creates── New(cfg)
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 ▼                     ▼                     ▼
          Middleware chain        Engine execution       Download
          (optional)              security/retry         streaming file
          Chain(mw...)                                   download
                 │                     │
                 ▼                     ▼
          RequestMutator        Result (Request / Response / Meta)

DomainClienter = Client + base URL + SessionManager
(injects session headers/cookies before each request, writes Set-Cookie back after each response)
```

## Two-Layer API Architecture

HTTPC provides two request styles that mirror the relationship between `http.Get` and `http.Client` in the standard library `net/http`:

**Package-level functions** — need no extra configuration; they use a lazily-initialized default client internally. Suitable for scripts and one-off requests:

```go
result, err := httpc.Get("https://api.example.com/data")
```

**Client instances** — full control over configuration, connection pools, and lifecycle. Suitable for long-running services:

```go
client, err := httpc.NewDefault()
defer func() { _ = client.Close() }()
result, err := client.Get("https://api.example.com/data")
```

Both styles accept the same request options (`WithHeader`, `WithJSON`, ...) and return the same `*Result` type. Package-level functions are a lightweight wrapper around Client instances.

The default client is replaceable: `SetDefaultClient(client)` installs a custom instance as the default (the old instance is closed automatically), and `CloseDefaultClient()` closes and resets it. After a close, the next package-level call rebuilds it automatically.

Replacing the default client **closes the old instance and aborts its in-flight requests**, so concurrent callers observe connection errors. Call it only at startup or during a quiescent window, never under live traffic.

:::tip Which to use
One-off requests or quick prototypes -> package-level functions. Production services, custom configuration, or connection-pool management -> Client instances.
:::

## Configuration System: Config vs With\* Options

HTTPC splits configuration into two independent layers to avoid confusion:

| Layer | Carrier | Scope | Typical fields |
|------|------|--------|----------|
| **Instance configuration** | `Config` struct | Entire client lifetime | Timeouts, retry strategy, connection pool, TLS |
| **Request options** | `WithXxx()` functions | Single request | `WithHeader`, `WithJSON`, `WithTimeout` |

Instance configuration is passed to `New()` via the `Config` struct, starting from `DefaultConfig()` and modified as needed:

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

Request options are passed on each call to supplement or override instance-level defaults:

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer "+token),
    httpc.WithTimeout(30*time.Second),
)
```

Starting from preset configurations (`SecureConfig()`, `PerformanceConfig()`, etc.) is also supported. See the [Config API](../api-reference/client-config/config).

Configuration across the library follows one convention:

- the main `Config` and `SessionConfig` are **passed by value** (required);
- middleware configs are **passed by pointer**, where passing `nil` means using the defaults;
- `DownloadConfig` is passed by pointer and requires `FilePath` to be set.

Every `XxxConfig` has a matching `DefaultXxxConfig()` constructor: start from the defaults and adjust fields as needed.

## Request Lifecycle

Every request goes through the following flow:

```text
Options applied -> Middleware chain (if any) -> Engine execution -> Retry (if needed) -> Result returned
    ^                                       ^
  With* functions                  Connection pool / TLS / proxy / SSRF checks
```

Stage-by-stage details:

- **Options applied** — `With*` functions set request headers, body, timeouts, and so on; they run in the order passed, and any option returning an error (e.g. a header failing CRLF validation) fails the request immediately.
- **Middleware chain** — active when `Config.Middleware.Middlewares` is configured. The request passes through middleware in registration order, and the terminal Handler hands the middleware-processed request to the engine. With no middleware configured, the request goes straight to the engine with no extra overhead.
- **Engine execution** — runs these steps in order: URL and header validation (on by default), SSRF dial check (private IPs blocked by default), and DNS resolution (optional DoH). It then takes a connection from the pool (creating one if short, bounded by `MaxConnsPerHost`), performs the TLS handshake (version policy, optional certificate pinning), and sends the request. Reading the response checks the body size and decompression caps.
- **Retry** — Retryable conditions: timeouts, transport errors, transient network errors, plus status codes 408/429/500/502/503/504. Backoff is `Delay × BackoffFactor^n` plus jitter, with each wait capped at `MaxRetryDelay`. A `Retry-After` response header takes precedence, capped at 60s. The total duration is bounded by `Timeouts.Request` or `WithTimeout`: **the timeout budget is shared across retries** and does not reset each round.
- **Result** — carries the response data, request metadata, and retry statistics; internal engine objects are pooled but transparent to callers, and `Result` is reclaimed by GC automatically — no manual release required.

Exhausted retries end one of two ways:

- **Network errors exhausted** -> an `error` is returned (`ClientError.Attempts` records the attempt count);
- **Retryable status codes (e.g. 503) exhausted** -> the **last response** is returned (`result.StatusCode() == 503`, with `Meta.Attempts` recording the total), and the caller handles the status code.

## Middleware Model

A middleware is a function of the form `func(Handler) Handler` (`MiddlewareFunc`); `Handler` is the signature of the function that actually processes the request:

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
type MiddlewareFunc func(Handler) Handler
```

Middleware is registered on `Config.Middleware.Middlewares` and composed into an onion model by `Chain(middlewares...)`. The first middleware is the outermost layer: the request phase runs in registration order, the response phase in reverse.

Skeleton of a custom middleware:

```go
func TimingMiddleware(report func(d time.Duration)) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            start := time.Now()
            resp, err := next(ctx, req)        // Call the inner layer (next middleware or the engine)
            report(time.Since(start))          // Response-phase logic (runs in reverse order)
            return resp, err
        }
    }
}
```

Built-in middleware at a glance:

| Middleware | Responsibility | Behavior with nil config |
|--------|------|------------------|
| `LoggingMiddleware` | Emits request/response summaries (URLs redacted automatically) | Logging disabled (no-op) |
| `RecoveryMiddleware` | Catches panics inside the chain and converts them to errors | — |
| `RequestIDMiddleware` | Injects `X-Request-ID` (generated with crypto/rand) | Default header name and secure generator |
| `TimeoutMiddleware` | Middleware-layer timeout (takes effect ahead of the client's built-in timeout) | Timeout disabled (passthrough) |
| `MetricsMiddleware` | Per-request callback (method/URL/status/duration/error) | Metrics disabled (no-op) |
| `AuditMiddleware` | Compliance audit events (text/json formats, sensitive headers redacted) | Default text config |
| `HeaderMiddleware` | Attaches static headers to every request (CRLF validated at creation) | No headers (passthrough) |

:::warning Do not use for Download or streaming requests
`TimeoutMiddleware` is not suitable for `Download` or `WithStreamBody(true)` requests: the middleware rejects streaming requests on entry, returning `TimeoutMiddleware is incompatible with streaming responses`. Use `WithTimeout` for such cases instead.
:::

## Sessions and the Domain Client

For consecutive requests to the same domain (login state, common headers, cookie pass-through), use a `DomainClient` instead of hand-building URLs and passing cookies on every call:

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token) // Session header: sent automatically on subsequent requests

_, _ = dc.Post("/login", httpc.WithJSON(creds)) // Set-Cookie from the response enters the session automatically
_, _ = dc.Get("/me")                            // Session cookies attached automatically
```

Division of labor between the two components:

- **`DomainClient`** — binds a base URL. Relative paths are joined automatically (`/users` -> `https://api.example.com/users`), while full `http(s)://` URLs are used as-is. It has built-in path-traversal protection: an error is returned if the joined result escapes the base path. Session cookies are stored in the embedded `SessionManager`, independent of `Connection.EnableCookies`.
- **`SessionManager`** — a thread-safe session-state store (cookies + headers). `DomainClient` embeds it: before each request it injects session state, and after the response it writes `Set-Cookie` back. `SessionManager` can also be used standalone (`NewSessionManagerDefault()`).

:::warning Options run once; session capture is static
Request options passed to a `DomainClient` run once. Session capture is static: `SessionManager` recognizes only `WithHeader`/`WithHeaderMap`/`WithCookies`/`WithCookieMap`/`WithCookieString`, and the headers and cookies they carry persist into the session. A `SetHeader`/`SetCookies` call inside a custom `RequestOptionFunc` is not captured.
:::

See the [Domain Client & Sessions guide](../guides/domain-session).

## Secure Defaults

The default configuration enables the following without extra setup:

- **TLS 1.2+** enforced encryption
- **SSRF protection** — blocks connections to private IP addresses, for example `127.0.0.1`, `10.x`, and `192.168.x`
- **CRLF injection protection** — automatic validation of request headers and URLs
- **Response body size limit** — 10MB by default, preventing memory exhaustion
- **Decompression-bomb guardrail** — decompressed response bodies capped at 100MB by default
- **Strict Content-Length validation** — on by default; errors when the body length does not match the declared value

To connect to internal services (VPN, intranet), set `Security.AllowPrivateIPs = true` or use `SSRFExemptCIDRs` for precise exemptions. See the [Security Overview](../security/).

## Error Model

HTTPC distinguishes **network-layer errors** from **HTTP status codes**:

- **Network-layer errors** (connection failures, timeouts, TLS errors, etc.) -> returned as `error`; use `errors.As` to extract a `ClientError` for classification and retryability
- **HTTP status codes** (4xx, 5xx) -> **not** returned as `error`; check them via methods like `result.IsSuccess()`

```go
result, err := client.Get(url)
if err != nil {
    // Network-layer error — the request did not complete successfully
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("Error type: %s, retryable: %v", clientErr.Code(), clientErr.IsRetryable())
    }
    return err
}
// Request completed successfully — check the HTTP status code
if !result.IsSuccess() {
    log.Printf("HTTP error: %d", result.StatusCode())
}
```

The context carried by `ClientError`:

| Member | Description |
|------|------|
| `Type` | Error classification (`ErrorTypeTimeout`, `ErrorTypeNetwork`, etc. — a 12-value enum) |
| `Code()` | Short code string: `TIMEOUT`, `NETWORK_ERROR`, `TLS_ERROR`, `DNS_ERROR`, `CONTEXT_CANCELED`, `VALIDATION_ERROR`, `HTTP_ERROR`, etc. |
| `IsRetryable()` | Whether a retry can succeed (context cancellation/validation/TLS/certificate always false; timeout/transport always true; network/DNS/5xx depend on the cause) |
| `Attempts` | Attempts made so far (including the first) |
| `StatusCode` | Associated HTTP status code (if applicable) |
| `Cause` | Underlying error; transparent to `errors.Is` / `errors.As` |
| `URL` / `Method` | Redacted request URL and request method |

Common sentinel errors can be matched with `errors.Is`:

- `ErrClientClosed`: the client is already closed
- `ErrResponseBodyEmpty`: `Unmarshal` on an empty body
- `ErrResponseBodyTooLarge`: the body to parse exceeds 50MB

See [Error Types](../api-reference/types/errors) for the full list.

See [Error Handling](../guides/error-handling).

## Concurrency and Resource Management

- **Client concurrency safety** — one client can be shared by any number of goroutines; the connection pool is managed per host internally, so no separate clients are needed for concurrency.
- **Result is independent and release-free** — every request returns a brand-new `*Result`, allocated once together with its three metadata structs. Holding it carries no lifecycle burden, so the GC reclaims it.
- **Explicit Close** — `client.Close()` releases the connection pool and transport resources; requests after a close return `ErrClientClosed`.
- **Default client rebuild** — the default client behind package-level functions can be replaced with `SetDefaultClient()` and closed with `CloseDefaultClient()`; after a close, the next package-level call rebuilds it automatically.
- **Panic safety net** — `Request` has an internal recover fallback: unexpected panics on the execution path are converted into an `error` with a stack trace instead of propagating to the caller.

## Next Steps

- [Hands-On Tutorial](../guides/tutorial) - Put the concepts on this page into practice, step by step, in about 30 minutes
