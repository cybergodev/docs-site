---
sidebar_label: "Request Options"
title: "Request Options - CyberGo HTTPC | WithXxx Options"
description: "HTTPC request options reference: all 32 WithXxx functions for headers, auth, bodies, cookies, request control, callbacks, and routing, with Config overrides."
sidebar_position: 20
---

# Request Options

Request options are functional configuration items passed to request methods via the `RequestOption` type, enabling fine-grained request control.

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

All options can be freely combined and are applied in the order they are passed.

## Options Overview

| Group | Options |
|-------|---------|
| [Headers](#headers) | `WithHeader`, `WithHeaderMap`, `WithUserAgent` |
| [Authentication](#authentication) | `WithBasicAuth`, `WithBearerToken` |
| [Request Body](#request-body) | `WithJSON`, `WithXML`, `WithForm`, `WithFormData`, `WithFile`, `WithBinary`, `WithBody` |
| [Query Parameters](#query-parameters) | `WithQuery`, `WithQueryMap` |
| [Cookies](#cookies) | `WithCookies`, `WithCookieMap`, `WithCookieString`, `WithSecureCookie` |
| [Request Control](#request-control) | `WithContext`, `WithTimeout`, `WithNoTimeout`, `WithMaxRetries`, `WithRetryNonIdempotent`, `WithFollowRedirects`, `WithMaxRedirects`, `WithAllowPrivateIPs`, `WithStreamBody` |
| [Package-level Routing](#package-level-routing) | `WithProxy`, `WithSystemProxy`, `WithTLSFingerprint` |
| [Callbacks](#callbacks) | `WithOnRequest`, `WithOnResponse` |

Some options override same-named defaults in the client configuration (`Config`):

| Option | Config field overridden (default) |
|--------|-----------------------------------|
| `WithUserAgent` | `Defaults.UserAgent` (`"httpc/1.0"`) |
| `WithHeader` / `WithHeaderMap` | Same-named default headers in `Defaults.Headers` |
| `WithTimeout` | `Timeouts.Request` (180s) |
| `WithNoTimeout` | `Timeouts.Request` (lifts the default ceiling) |
| `WithMaxRetries` | `Retry.MaxRetries` (3) |
| `WithRetryNonIdempotent` | `Retry.RetryNonIdempotent` (false) |
| `WithFollowRedirects` | `Security.FollowRedirects` (true) |
| `WithMaxRedirects` | `Security.MaxRedirects` (10) |
| `WithAllowPrivateIPs` | `Security.AllowPrivateIPs` (false) |

:::tip
`nil` options are silently skipped instead of raising an error — handy for conditionally assembling option slices. Any option that returns an error aborts the request (wrapped uniformly as `failed to apply request option`).
:::

## Headers

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

Sets a single request header. Keys and values are security-validated (CRLF injection protection).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

Sets multiple request headers at once.

```go
result, err := client.Get(url,
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "abc123",
    }),
)
```

### WithUserAgent

```go
func WithUserAgent(userAgent string) RequestOption
```

Sets the User-Agent header. This is a convenience wrapper for `WithHeader("User-Agent", ...)`.

## Authentication

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

Sets HTTP Basic authentication. The username cannot be empty and credential length is limited.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Sets the `Authorization: Bearer <token>` header. The token cannot be empty.

```go
result, err := client.Get(url,
    httpc.WithBearerToken("eyJhbGciOiJIUzI1NiIs..."),
)
```

## Request Body

### WithJSON

```go
func WithJSON(data any) RequestOption
```

Sets a JSON request body, automatically adding `Content-Type: application/json`.

```go
result, err := client.Post(url,
    httpc.WithJSON(map[string]any{
        "name":  "test",
        "email": "test@example.com",
    }),
)
```

### WithXML

```go
func WithXML(data any) RequestOption
```

Sets an XML request body, automatically adding `Content-Type: application/xml`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Sets a URL-encoded form request body, automatically adding `Content-Type: application/x-www-form-urlencoded`.

```go
result, err := client.Post(url,
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### WithFormData

```go
func WithFormData(data *FormData) RequestOption
```

Sets a `multipart/form-data` request body, supporting mixed file and field uploads.

```go
result, err := client.Post(url,
    httpc.WithFormData(&httpc.FormData{
        Fields: map[string]string{"description": "upload"},
        Files: map[string]*httpc.FileData{
            "file": {Filename: "doc.pdf", Content: fileBytes},
        },
    }),
)
```

### WithFile

```go
func WithFile(fieldName, filename string, content []byte) RequestOption
```

Convenient file upload. Automatically builds a multipart request body. The filename is processed for path-traversal protection.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Sets a binary request body. The default Content-Type is `application/octet-stream`, customizable.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Generic request-body setter, supporting auto-detection and explicit type specification.

**Auto-detection rules** (default `BodyAuto`):

| Input Type | Content-Type |
|------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | Not set (handled by the caller) |
| Other types | application/json |

**Explicit type specification**:

```go
// Auto-detect (default)
result, _ := client.Post(url, httpc.WithBody(data))

// Force JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Force XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| Constant | Meaning |
|----------|---------|
| `BodyAuto` | Auto-detect (default) |
| `BodyJSON` | Force JSON |
| `BodyXML` | Force XML |
| `BodyForm` | Force form |
| `BodyBinary` | Force binary |
| `BodyMultipart` | Force multipart (requires `*FormData`) |

**Input constraints for explicit types**:

| Type | Input requirement |
|------|----------|
| `BodyJSON` / `BodyXML` | Any non-nil data |
| `BodyForm` | `map[string]string` or `url.Values` (validated per field) |
| `BodyBinary` | `[]byte` or `string`, non-empty |
| `BodyMultipart` | `*FormData` |

A type mismatch (e.g., passing a non-`*FormData` to `BodyMultipart`) or a nil `data` returns an error.

:::warning io.Reader bypasses size validation
`io.Reader` request bodies bypass request-body size validation. When reading from an untrusted source, wrap it with `io.LimitReader` to prevent resource exhaustion:

```go
limited := io.LimitReader(untrustedReader, 10<<20) // cap at 10 MB
```
:::

## Query Parameters

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

Sets a single query parameter.

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)
```

### WithQueryMap

```go
func WithQueryMap(params map[string]any) RequestOption
```

Sets multiple query parameters at once.

```go
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
        "sort":  "created_at",
    }),
)
```

## Cookies

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Adds one or more cookies, each security-validated: names ≤256 characters, values ≤4096 characters; control characters and illegal cookie characters are rejected; Domain (≤255) and Path (≤1024) are validated when set. The whole batch is pre-allocated and validated in a single pass.

```go
// A single cookie: pass a one-element slice
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc123"}}),
)

// Multiple cookies
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err = client.Get("https://api.example.com",
    httpc.WithCookies(cookies),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

Adds simple cookies in bulk. Suitable for scenarios requiring only name-value pairs.

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "en",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

Adds cookies from a raw Cookie header string.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=en"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

Enforces validation of the security attributes (Secure, HttpOnly, SameSite) of request cookies.

:::warning
This option **only validates cookies that already exist at the time it is applied**. You must place `WithSecureCookie` **after** all `WithCookies`/`WithCookieMap`/`WithCookieString` calls; otherwise cookies added later will not be validated. For session-level cookie-security validation that is not subject to ordering, use `SessionManager.SetCookieSecurity`.
:::

```go
// Correct order: add cookies first, then validate
result, err := client.Get(url,
    httpc.WithCookies(sessionCookies),
    httpc.WithCookieMap(otherCookies),
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## Request Control

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

Sets the request context, supporting timeout and cancellation. The context cannot be nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Sets a per-request timeout, overriding the client default. Range: 0 to 30 minutes.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithNoTimeout

```go
func WithNoTimeout() RequestOption
```

Lifts the client-level default request timeout (`Config.Timeouts.Request`, default 180s) for this single request, letting a slow call run for as long as the server takes. Only the client default is lifted: an explicit [`WithTimeout`](#withtimeout) on the same request takes precedence, and any deadline on the caller-provided context (`WithContext` or the ctx parameter) is always honored. Dial/TLS/response-header timeouts are unaffected.

```go
// Lift the default 180s ceiling for long calls (large uploads, slow reports)
result, err := client.Post(uploadURL,
    httpc.WithFile("file", "backup.tar.gz", data),
    httpc.WithNoTimeout(),
)
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Sets the per-request maximum retry count, overriding the client configuration. Range: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithRetryNonIdempotent

```go
func WithRetryNonIdempotent(allow bool) RequestOption
```

Overrides, for this single request, whether non-idempotent methods (POST, PATCH, and custom methods) may be retried, in **both** directions over the client-level `Config.Retry.RetryNonIdempotent` (default false): `true` retries a POST on a client that otherwise forbids it; `false` pins a single attempt on a client that allows it. Idempotent methods (GET/HEAD, etc.) are unaffected, and the [`WithMaxRetries`](#withmaxretries) cap still applies.

:::warning
Enabling retries for a non-idempotent request means a timeout or retryable 5xx may send the request body more than once (duplicate orders, duplicate payments). Use it only against endpoints that tolerate replay, or guard them with an idempotency key.
:::

```go
// The client forbids POST retries by default; opt in for this call (endpoint is replay-safe via idempotency key)
result, err := client.Post(orderURL,
    httpc.WithJSON(order),
    httpc.WithMaxRetries(3),
    httpc.WithRetryNonIdempotent(true),
)
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

Controls whether to follow redirects.

```go
// Disable following redirects
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Sets the per-request maximum redirect count. Range: 0-50.

:::warning
`0` does **not** disable redirects. The engine treats `0` as an "unset" sentinel and falls back to the default cap (10), so `WithMaxRedirects(0)` is equivalent to omitting the option. To fully disable redirect following, use `WithFollowRedirects(false)` instead.
:::

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

Overrides the client's SSRF policy for a single request. When `allow` is `true`, the request may access localhost and private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 169.254.0.0/16, etc.) and follow redirects to such addresses; when `false`, SSRF protection is enforced for this request even if the client is configured with `Security.AllowPrivateIPs=true`.

:::warning
This is a **per-request escape hatch** from SSRF protection, suited for cases where a default-secure client (`AllowPrivateIPs=false`) occasionally needs to reach internal services, loopback addresses, or a local dev server.

Enable it only when the request URL is trusted and **not** derived from untrusted user input. To allow internal access for an entire client, set `Security.AllowPrivateIPs=true` on `Config` directly.
:::

```go
// The default client blocks private IPs; this call allows it per request
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Enables streaming mode; the response body is not cached in memory.

:::warning
Streaming mode **only takes effect via [`Download`](./functions#download)**. When used with the standard request methods (`Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options`/`Request`), the response body is read in full and converted into a `Result`, after which the underlying stream is closed — the returned `Result` body is empty and the caller cannot consume the stream.

To actually stream-download large files without caching them in memory, use `Download`.
:::

## Package-level Routing

Three **package-level-only** routing options: `WithProxy`, `WithSystemProxy`, and `WithTLSFingerprint`. Each routes a single package-level call to a dedicated client (isolated pools, inheriting the default client's secure defaults — SSRF protection, TLS 1.2+, timeouts, retries), leaving the shared default client and any other in-flight calls untouched. Each distinct `(proxy, fingerprint)` combination is cached as its own client; close them all with `CloseRoutedClients` (see [Package Functions & Client Methods](./functions#closeroutedclients)).

:::warning Package-level only
These options only make sense on package-level functions (`Get`/`Post`/`Request`/`Download`, etc.). On an explicit `Client` instance they return an error — use `Config.Connection.ProxyURL` / `Config.Connection.EnableSystemProxy` / `Config.Security.TLSFingerprint` there instead.
:::

### WithProxy

```go
func WithProxy(proxyURL string) RequestOption
```

Routes this call through an explicit proxy (`http`/`https`/`socks5`/`socks5h`), taking precedence over the default client's own proxy configuration. The proxy URL may carry credentials; httpc never logs them.

```go
result, err := httpc.Get("https://example.com",
    httpc.WithProxy("http://127.0.0.1:7890"),
)
```

### WithSystemProxy

```go
func WithSystemProxy() RequestOption
```

Routes this call through a client with automatic system-proxy detection (`Connection.EnableSystemProxy`): it reads environment variables (`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`) and platform settings (Windows registry, macOS system configuration). Requests to `localhost`/loopback and NO_PROXY-exempt hosts bypass the proxy, matching `net/http` behavior; with no system proxy configured, the request connects directly. When combined with `WithProxy`, `WithProxy` wins.

```go
result, err := httpc.Get("https://example.com", httpc.WithSystemProxy())
```

### WithTLSFingerprint

```go
func WithTLSFingerprint(preset string) RequestOption
```

Routes this call to a browser TLS-fingerprint client (equivalent to `Config.Security.TLSFingerprint`). The value must be a known preset (case-insensitive, whitespace-trimmed): `chrome` / `firefox` and their OS/version aliases; an unknown preset fails the request with `ErrInvalidSecurity`. See the [TLS Fingerprinting guide](../../guides/tls-fingerprint) for the full preset list and behavior semantics.

```go
result, err := httpc.Get("https://example.com",
    httpc.WithTLSFingerprint("chrome-windows"),
)
```

## Callbacks

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Registers a pre-send callback. Multiple callbacks can be chained and execute in the order they are added. Returning an error aborts the request.

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("Sending %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

Registers a post-receive callback. Multiple callbacks can be chained and execute in the order they are added.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Received response: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## Custom Options

### RequestOptionFunc

```go
type RequestOptionFunc func(RequestMutator) error
```

A public adapter type that turns a function literal into the `RequestOption` interface, mirroring net/http's Handler/HandlerFunc split — `RequestOption`'s `apply` method is unexported, so the interface cannot be implemented outside the package; custom per-request options are expressed through `RequestOptionFunc`, without naming the internal request type:

```go
result, err := client.Get(url,
    httpc.RequestOptionFunc(func(req httpc.RequestMutator) error {
        req.SetHeader("X-Custom", "value")
        return nil
    }),
)
```

A nil `RequestOptionFunc` is a no-op — it is skipped silently when applied.

## See Also

- [Constants and Types](../types/constants) - BodyKind constants and type aliases
- [Interface Definitions](../types/interfaces) - RequestMutator, ResponseMutator interfaces
- [Request and Response Mutators](../handler/mutators) - The full read/write contract of RequestMutator/ResponseMutator
- [Request and Response](../../guides/request-response) - Request options usage guide
