---
sidebar_label: "Interfaces"
title: "Interface Definitions - CyberGo HTTPC | Core Interfaces"
description: "HTTPC core interfaces: Client, Doer, DomainClienter, RetryPolicy, RequestMutator/ResponseMutator, and CertificatePinner, with their extension points."
sidebar_position: 10
---

# Interface Definitions

The interface definitions describe HTTPC's extension points and implementation contracts: `Client`, `Doer`, `DomainClienter`, and `RetryPolicy` govern how callers integrate, while `RequestMutator`/`ResponseMutator` govern how middleware reads and writes requests and responses.

## Interface Overview

| Interface / type | Category | Implemented by | Extension-point purpose |
|-----------|------|--------|-----------|
| `Client` | Main client interface | `clientImpl` (returned by `New`/`NewDefault`) | Parameter type constraint for consumers |
| `Doer` | Minimal execution interface | `clientImpl`; also implementable by callers | Mock testing, decorator wrapping |
| `DomainClienter` | Domain client interface | `DomainClient` (returned by `NewDomain`/`NewDomainDefault`) | Domain-level session management |
| `RequestMutator` | Request mutator interface | `*engine.Request` (internal) | Middleware read/write access to requests |
| `ResponseMutator` | Response mutator interface | `*engine.Response` (internal) | Middleware read/write access to responses |
| `Handler` | Request handler function type | `finalHandler`, middleware-wrapped products | Core signature for custom middleware |
| `MiddlewareFunc` | Middleware function type | 7 built-in middleware factories, caller-defined ones | Intercepting or rewriting requests and responses |
| `RetryPolicy` | Retry policy interface | Caller implementations (any external package, see note below) | Custom retry decisions |
| `CertificatePinner` | Certificate pinning interface | `NewSPKIHashPinner` and other constructors, caller-defined | Custom pinning strategies |
| `RequestOption` | Request option interface | `WithXxx` factory functions, `RequestOptionFunc` | Per-request configuration |

## Client

```go
type Client interface {
    Doer

    // HTTP methods
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // File downloads
    Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // Lifecycle
    Close() error
}
```

Main client interface, created via `New()`. See [Package Functions & Client Methods](../core/functions) for details.

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

Minimal interface containing only `Doer.Request`. Any type that satisfies this single method can be injected wherever a `Doer` is accepted.

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // Custom implementation
    return nil, nil
}
```

## DomainClienter

```go
type DomainClienter interface {
    Client

    // URL access
    URL() string
    Domain() string

    // Session header management
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // Session cookie management
    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    // Session access
    Session() *SessionManager
}
```

Domain client interface with automatic cookie and header management. See [Domain Client](../client-config/domain-client) and [Session Management](../client-config/session) for details.

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

Custom retry strategy interface.

| Method | Description |
|--------|-------------|
| `ShouldRetry(resp, err, attempt)` | Returns whether to retry; `attempt` starts from 0 |
| `GetDelay(attempt)` | Returns the wait time before the next retry |
| `MaxRetries()` | Returns the maximum retry count |

:::tip Type Publicly Exported
The `resp` parameter type `ResponseReader` in `ShouldRetry` is exported by the `httpc` package as a public type alias (`httpc.ResponseReader`, declared in `types.go`), so external packages can reference it directly. A custom `RetryPolicy` can therefore live in any business package. Most cases are covered by `RetryConfig` and the `WithMaxRetries` option.
:::

The following example implements `RetryPolicy` and compiles as-is in any package that imports `httpc`:

```go
// ResponseReader is publicly exported by the httpc package (httpc.ResponseReader).
// This example compiles in any package that imports github.com/cybergodev/httpc.

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp httpc.ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxRetries {
        return false
    }
    if err != nil {
        return true
    }
    return resp.StatusCode() >= 500
}

func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(1<<attempt)
}

func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxRetries
}
```

## Core Types

### RequestMutator

```go
type RequestMutator interface {
    // Read methods
    Method() string
    URL() string
    Headers() map[string]string
    QueryParams() map[string]any
    Body() any
    Timeout() time.Duration
    MaxRetries() int
    Context() context.Context
    Cookies() []http.Cookie
    FollowRedirects() *bool
    MaxRedirects() *int
    StreamBody() bool

    // Write methods
    SetMethod(string)
    SetURL(string)
    SetHeaders(map[string]string)
    SetHeader(key, value string)
    SetQueryParams(map[string]any)
    SetBody(any)
    SetTimeout(time.Duration)
    SetMaxRetries(int)
    SetContext(context.Context)
    SetCookies([]http.Cookie)
    SetFollowRedirects(*bool)
    SetMaxRedirects(*int)
    SetStreamBody(bool)
}
```

Used in middleware to provide read-write access to requests. It is composed from the split interfaces `RequestReader` and `RequestWriter`, both exported by the `httpc` package as public type aliases (`httpc.RequestReader` / `httpc.RequestWriter`). For the full method contract and a read/write example, see [Request & Response Mutators](../handler/mutators).

### ResponseMutator

```go
type ResponseMutator interface {
    // Read methods
    StatusCode() int
    Status() string
    Proto() string
    Headers() http.Header
    Body() string
    RawBody() []byte
    ContentLength() int64
    Duration() time.Duration
    Attempts() int
    Cookies() []*http.Cookie
    RedirectChain() []string
    RedirectCount() int
    RequestHeaders() http.Header
    RequestURL() string
    RequestMethod() string

    // Write methods
    SetStatusCode(int)
    SetStatus(string)
    SetProto(string)
    SetHeaders(http.Header)
    SetBody(string)
    SetRawBody([]byte)
    SetContentLength(int64)
    SetDuration(time.Duration)
    SetAttempts(int)
    SetCookies([]*http.Cookie)
    SetRedirectChain([]string)
    SetRedirectCount(int)
    SetRequestHeaders(http.Header)
    SetRequestURL(string)
    SetRequestMethod(string)
    SetHeader(key string, values ...string)
}
```

Used in middleware to provide read-write access to responses. It is composed from the split interfaces `ResponseReader` and `ResponseWriter`, both exported by the `httpc` package as public type aliases (`httpc.ResponseReader` / `httpc.ResponseWriter`). For the full method contract, see [Request & Response Mutators](../handler/mutators).

### Reader/Writer Split Interfaces: RequestReader / RequestWriter / ResponseReader / ResponseWriter

`RequestMutator = RequestReader + RequestWriter` and `ResponseMutator = ResponseReader + ResponseWriter`. The four method sets are defined in `internal/types/interfaces.go`, and the `httpc` package exports all four as public type aliases in `types.go`, so external packages can reference them directly (e.g. `httpc.ResponseReader`).

These four interfaces are the low-level read/write surfaces for middleware and retry policies:

- Declare a `*Reader` to inspect without modifying.
- Declare a `*Writer` to modify without inspecting.
- Everyday code uses the aggregate `RequestMutator` / `ResponseMutator`.

The `resp` parameter of `RetryPolicy.ShouldRetry` takes the read-only `ResponseReader`. For grouped method contracts and read/write examples, see [Request & Response Mutators](../handler/mutators).

#### RequestReader

Read-only access to request data:

| Method | Signature | Description |
|------|------|------|
| `Method` | `Method() string` | HTTP method |
| `URL` | `URL() string` | Request URL |
| `Headers` | `Headers() map[string]string` | All request headers (key → single value) |
| `QueryParams` | `QueryParams() map[string]any` | Query parameters |
| `Body` | `Body() any` | Request body |
| `Timeout` | `Timeout() time.Duration` | Request timeout |
| `MaxRetries` | `MaxRetries() int` | Maximum retry count |
| `Context` | `Context() context.Context` | Request context |
| `Cookies` | `Cookies() []http.Cookie` | Request cookies |
| `FollowRedirects` | `FollowRedirects() *bool` | Whether to follow redirects (nil means use the default) |
| `MaxRedirects` | `MaxRedirects() *int` | Maximum redirect count (nil means use the default) |
| `StreamBody` | `StreamBody() bool` | Whether to stream the request body |

#### RequestWriter

Write-only access to request data, mirroring the read methods of `RequestReader`:

| Method | Signature | Description |
|------|------|------|
| `SetMethod` | `SetMethod(string)` | Set the HTTP method |
| `SetURL` | `SetURL(string)` | Set the URL |
| `SetHeaders` | `SetHeaders(map[string]string)` | Set all request headers (full replacement) |
| `SetHeader` | `SetHeader(key, value string)` | Set a single request header (add/modify; key canonicalized) |
| `SetQueryParams` | `SetQueryParams(map[string]any)` | Set query parameters |
| `SetBody` | `SetBody(any)` | Set the request body |
| `SetTimeout` | `SetTimeout(time.Duration)` | Set the timeout |
| `SetMaxRetries` | `SetMaxRetries(int)` | Set the maximum retry count |
| `SetContext` | `SetContext(context.Context)` | Set the context |
| `SetCookies` | `SetCookies([]http.Cookie)` | Set cookies |
| `SetFollowRedirects` | `SetFollowRedirects(*bool)` | Set whether to follow redirects |
| `SetMaxRedirects` | `SetMaxRedirects(*int)` | Set the maximum redirect count |
| `SetStreamBody` | `SetStreamBody(bool)` | Set whether to stream the body |

#### ResponseReader

Read-only access to response data; also the parameter type of `RetryPolicy.ShouldRetry`:

| Method | Signature | Description |
|------|------|------|
| `StatusCode` | `StatusCode() int` | Status code |
| `Status` | `Status() string` | Status text (e.g. `"200 OK"`) |
| `Proto` | `Proto() string` | Protocol version (e.g. `"HTTP/1.1"`) |
| `Headers` | `Headers() http.Header` | Response headers |
| `Body` | `Body() string` | Response body (string) |
| `RawBody` | `RawBody() []byte` | Response body (bytes) |
| `ContentLength` | `ContentLength() int64` | Content length |
| `Duration` | `Duration() time.Duration` | Request duration |
| `Attempts` | `Attempts() int` | Attempt count (including retries) |
| `Cookies` | `Cookies() []*http.Cookie` | Response cookies |
| `RedirectChain` | `RedirectChain() []string` | Redirect chain (URL of each hop) |
| `RedirectCount` | `RedirectCount() int` | Redirect count |
| `RequestHeaders` | `RequestHeaders() http.Header` | Request headers actually sent |
| `RequestURL` | `RequestURL() string` | Actual request URL (including the final URL after redirects) |
| `RequestMethod` | `RequestMethod() string` | Request method |

#### ResponseWriter

Write-only access to response data:

| Method | Signature | Description |
|------|------|------|
| `SetStatusCode` | `SetStatusCode(int)` | Set the status code |
| `SetStatus` | `SetStatus(string)` | Set the status text |
| `SetProto` | `SetProto(string)` | Set the protocol version |
| `SetHeaders` | `SetHeaders(http.Header)` | Set response headers (full replacement) |
| `SetBody` | `SetBody(string)` | Set the response body |
| `SetRawBody` | `SetRawBody([]byte)` | Set the response body (bytes) |
| `SetContentLength` | `SetContentLength(int64)` | Set the content length |
| `SetDuration` | `SetDuration(time.Duration)` | Set the duration |
| `SetAttempts` | `SetAttempts(int)` | Set the attempt count |
| `SetCookies` | `SetCookies([]*http.Cookie)` | Set cookies |
| `SetRedirectChain` | `SetRedirectChain([]string)` | Set the redirect chain |
| `SetRedirectCount` | `SetRedirectCount(int)` | Set the redirect count |
| `SetRequestHeaders` | `SetRequestHeaders(http.Header)` | Set the request headers |
| `SetRequestURL` | `SetRequestURL(string)` | Set the request URL |
| `SetRequestMethod` | `SetRequestMethod(string)` | Set the request method |
| `SetHeader` | `SetHeader(key string, values ...string)` | Set a single response header (add/modify) |

:::tip ResponseWriter.SetHeader does not canonicalize keys
`ResponseWriter.SetHeader` stores the key **exactly as given, with no canonicalization**, unlike the request-side `RequestWriter.SetHeader`. Writing `content-type` alongside a server-sent canonical `Content-Type` yields two distinct entries. To replace an existing response header, pass the `http.CanonicalMIMEHeaderKey` spelling.
:::

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Request handler function signature.

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

Middleware function signature that receives the next Handler and returns a wrapped Handler. `Handler` and `MiddlewareFunc` are aliases of the same-named types in the internal `types` package (`types.go`). See [Handler Pipeline](../handler/handler-chain) for chain assembly and customization rules.

### RequestOption

```go
type RequestOption interface {
    apply(RequestMutator) error
}
```

A public interface whose `apply` method is unexported, so it cannot be implemented outside the package; express custom per-request options with `RequestOptionFunc` (an adapter for `func(RequestMutator) error` literals, where nil is a no-op). Options themselves come from `WithXxx` factories such as `WithHeader`, `WithJSON`, and `WithOnRequest`. See [Request Options](../core/options) for the per-option reference.

## Certificate Pinning

Certificate Pinning validates during the TLS handshake whether the server certificate matches a pre-pinned public key or certificate. Even if a trusted CA is compromised, the handshake is rejected, which defends against man-in-the-middle attacks.

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

The certificate pinner interface, a type alias of the internal `security.CertificatePinner`. Method set:

<!-- check-code: skip -->
```go
type CertificatePinner interface {
    // Pin returns a string representation of the pin, for logging and debugging
    Pin() string

    // VerifyPeerCertificate checks whether the peer certificate chain matches
    // the pin. rawCerts are ASN.1 DER-encoded certificates; verifiedChains are
    // the verified chains (may be nil when regular verification was skipped)
    VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `Pin` | `Pin() string` | Returns a string representation of the pin, for logging and debugging (`CertificatePinner.Pin`) |
| `VerifyPeerCertificate` | `VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error` | Checks whether the peer certificate chain matches the pin (`CertificatePinner.VerifyPeerCertificate`) |

`VerifyPeerCertificate`'s signature matches the `crypto/tls.Config.VerifyPeerCertificate` callback, so a custom implementation plugs directly into the TLS handshake flow.

Create one via the constructors below and assign it to the `SecurityConfig.CertificatePinner` field (accessed via `Config.Security`):

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // current key
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // backup key (rotation)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
Pinner implementations are concurrency-safe and can be shared across multiple clients created from the same `Config` (passed by reference on deep copy, not duplicated). To apply a custom pinning strategy (e.g. pinning the full certificate rather than the public key), implement this interface directly.
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

Creates a certificate pinner from one or more base64-encoded SHA-256 hashes (over the DER-encoded SubjectPublicKeyInfo/SPKI). This is the most common pinning format (used by HPKP).

Multiple hashes support key rotation: the handshake succeeds when the peer's public key matches **any one** of the pinned hashes.

Generate a hash from a certificate with the following command:

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

Returns an error when no valid hash is provided, or when a hash is not valid base64.

### NewPublicKeyPinner

```go
func NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)
```

Creates a certificate pinner from one or more DER-encoded PKIX public keys (as returned by `x509.MarshalPKIXPublicKey`). It computes a SHA-256 hash of each public key internally. When the raw public key bytes are already available, this is more direct than `NewSPKIHashPinner`.

Returns an error when no valid public key is provided.

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

Combines multiple pinners into one. The certificate passes when **any one** of the wrapped pinners accepts it. Use this to support several pinning strategies at once, or to combine rotation keys built with different constructors.

:::warning Zero-argument behavior: rejects all connections
With no arguments it returns an empty-chain pinner whose `VerifyPeerCertificate` returns an error, so **it rejects every connection** (fail-closed). It neither accepts nor panics.

The error is `certificate pinning failed: no pinners configured` (source `internal/security/certpin.go`). Always pass at least one valid pinner; do not rely on the zero-argument behavior.
:::

:::tip Further reading
For the complete guide to certificate pinning (hash generation, key rotation strategies, production deployment), see [TLS Certificate Pinning](../../security/tls-certpin).
:::

## Related Pages

| Type | Detailed Reference |
|------|-------------------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](../core/result) |
| `SessionManager` methods | [Session Management](../client-config/session) |
| `DomainClient` implementation | [Domain Client](../client-config/domain-client) |
| `DownloadConfig` / `DownloadResult` | [File Download](../client-config/download) |
| `ClientError` / `ErrorType` / error variables | [Error Types](./errors) |
| `FormData` / `FileData` / `BodyKind` | [Constants and Types](./constants) |
