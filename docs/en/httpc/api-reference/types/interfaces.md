---
sidebar_label: "Interfaces"
title: "Interface Definitions - CyberGo HTTPC | Core Interfaces"
description: "HTTPC core interfaces API reference: the Client interface, Doer, DomainClienter, RetryPolicy, and middleware interface definitions."
sidebar_position: 1
---

# Interface Definitions

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

Minimal interface containing only the core `Request` method. Suitable for custom implementations.

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

Domain-scoped client with automatic cookie and header management. See [Domain Client](../client-config/domain-client) and [Session Management](../client-config/session) for details.

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
| `ShouldRetry(resp, err, attempt)` | Determines whether to retry; `attempt` starts from 0 |
| `GetDelay(attempt)` | Returns the wait time before the next retry |
| `MaxRetries()` | Returns the maximum retry count |

:::warning Internal Type Limitation
The `resp` parameter type ResponseReader in ShouldRetry is an internal interface (located in the `internal/types` package) that external code cannot reference directly. Therefore, `RetryPolicy` can only be implemented within the same module. Most scenarios can be satisfied through `RetryConfig` configuration and the `WithMaxRetries` option. If you need a custom policy, implement the `RetryPolicy` interface within your project's internal package.
:::

The following example demonstrates the `RetryPolicy` implementation pattern. Note that ResponseReader is an internal type -- this code can only compile within the `httpc` module:

```go
// Note: ResponseReader is an internal type (internal/types package).
// This code cannot compile outside the httpc module.
// Most users should configure retries via RetryConfig and WithMaxRetries.

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
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

Used in middleware to provide read-write access to requests. Composed from internal interfaces RequestReader and RequestWriter. For the full method contract and a read/write example, see [Request & Response Mutators](../handler/mutators).

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

Used in middleware to provide read-write access to responses. Composed from internal interfaces ResponseReader and ResponseWriter. For the full method contract, see [Request & Response Mutators](../handler/mutators).

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Request handler function signature.

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

Middleware function signature that receives the next Handler and returns a wrapped Handler.

## Certificate Pinning

Certificate Pinning validates at the TLS handshake stage whether the server certificate matches a pre-pinned public key/certificate. Even if a trusted CA is compromised, the handshake is rejected, defending against man-in-the-middle attacks.

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

The certificate pinner interface. Create one via the constructors below and assign it to the `SecurityConfig.CertificatePinner` field (accessed via `Config.Security`):

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
Pinner implementations are concurrency-safe and can be shared across multiple clients created from the same `Config` (passed by reference on deep copy, not duplicated). Advanced users can also implement this interface directly to support custom pinning strategies (e.g. pinning the full certificate rather than the public key).
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

Creates a certificate pinner from one or more base64-encoded SHA-256 hashes (over the DER-encoded SubjectPublicKeyInfo/SPKI). This is the most common pinning format (used by HPKP) and the recommended approach.

Passing multiple hashes supports key rotation -- as long as the peer's public key matches **any one** of the pinned hashes, the handshake succeeds.

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

Creates a certificate pinner from one or more DER-encoded PKIX public keys (as returned by `x509.MarshalPKIXPublicKey`). It computes a SHA-256 hash of each public key internally; when you already hold the raw public key bytes, this is more convenient than `NewSPKIHashPinner`.

Returns an error when no valid public key is provided.

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

Combines multiple pinners into one. The certificate is accepted as long as **any one** of the wrapped pinners accepts it. Use this to support multiple pinning strategies simultaneously, or to combine rotation keys built with different constructors.

:::warning Zero-argument behavior: accepts all certificates
With no arguments it returns an empty chain that **does not verify any certificate** (its verification logic returns `nil` directly) -- that is, **it accepts all certificates, equivalent to disabling certificate pinning** (the source `internal/security/certpin.go` comment reads "No pinners means no pinning"). This is the opposite of the intuitive "no pinner means reject" expectation, and is fail-open. Always pass at least one valid pinner; do not rely on the zero-argument behavior.
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
