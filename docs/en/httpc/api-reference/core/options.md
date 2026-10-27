---
sidebar_label: "Request Options"
title: "Request Options - CyberGo HTTPC | WithXxx Options"
description: "HTTPC request options: signatures, defaults, and validation of all 32 WithXxx functions in eight groups, plus the Config defaults each one overrides."
sidebar_position: 20
---

# Request Options

Request options are functional configuration items passed to request methods through the `RequestOption` type; they control the behavior of a single request.

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
`nil` options are skipped silently instead of raising an error, which makes conditional option slices straightforward. Any option that returns an error aborts the request (wrapped uniformly as `failed to apply request option`).
:::

## Headers

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

Sets a single request header. Keys and values are security-validated (CRLF injection protection): keys ≤256 characters, values ≤8192 characters, control characters rejected (an error wrapping `ErrInvalidHeader` is returned). A same-named default header in `Config.Defaults.Headers` is overridden.

On a `DomainClient` the header is captured into the session and persists on later requests; for a one-shot header use a custom `RequestOptionFunc` (never captured).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

Sets multiple request headers at once. Each entry runs the same validation as `WithHeader`; the first invalid key or value aborts with an error naming the offending key.

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

Sets the User-Agent header. A convenience wrapper for `WithHeader("User-Agent", ...)`, overriding `Config.Defaults.UserAgent` (`"httpc/1.0"`). Because it is a `WithHeader` passthrough, it is also captured into the session on a `DomainClient`, pinning the UA for every later request.

## Authentication

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

Sets HTTP Basic authentication and generates an `Authorization: Basic <base64>` header. Username and password cannot be empty, are limited to 255 characters, and must not contain control characters; the username must not contain a colon (`:`).

On a `DomainClient` this option is **not** captured into the session (credentials never persist); use `WithHeader("Authorization", ...)` when the credential must be reused across requests.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Sets the `Authorization: Bearer <token>` header. The token cannot be empty, is limited to 2048 characters, and must not contain spaces or control characters (RFC 6750 constraints).

On a `DomainClient` this option is **not** captured into the session (credentials never persist); use `WithHeader("Authorization", ...)` when the credential must be reused across requests.

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

Sets a JSON request body and adds `Content-Type: application/json` automatically. A nil `data` returns an error; equivalent to `WithBody(data, BodyJSON)`.

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

Sets an XML request body and adds `Content-Type: application/xml` automatically. A nil `data` returns an error; equivalent to `WithBody(data, BodyXML)`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Sets a URL-encoded form body and adds `Content-Type: application/x-www-form-urlencoded` automatically.

Each field key (≤256 characters) and value (≤8192 characters) is validated for control characters and length. Keys are encoded in alphabetical order, so the same input always produces the same body, which helps with testing and request signing.

Only `map[string]string` is accepted. To submit `url.Values`, use `WithBody(data, BodyForm)`; both share the same validation and encoding path.

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

Sets a `multipart/form-data` body for mixed file and field uploads. A nil `data` returns an error; equivalent to `WithBody(data, BodyMultipart)`.

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

Uploads a single file as multipart. `fieldName` and `filename` cannot be empty, are limited to 256 characters, and must be a **single path segment**: any `/`, `\`, or `..` is rejected (see `validation.ValidateFieldName`), along with quotes, angle brackets, `&`, and similar dangerous characters.

There is no path-stripping step — `filename` is written into the multipart header as given, and `"."` is also rejected.

:::warning Repeated WithFile calls merge; mixing with other body options replaces
Repeated `WithFile` calls are **merged** into one multipart body (source behavior, pinned by a test), so several files can be uploaded in a single request; when the same `fieldName` appears again, the later entry overwrites the earlier one.

Mixing with other body options such as `WithJSON`/`WithBinary` makes the later option replace the entire body; calling `WithFile` after `WithFormData` merges the files into that FormData. For file-plus-field uploads, build a single `*FormData` and use `WithFormData`.
:::

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Sets a binary request body. A nil **or zero-length** `data` returns an error (`binary data cannot be empty`). The default Content-Type is `application/octet-stream` and can be overridden by the second argument (an empty string falls back to the default).

Versus `WithBody(data, BodyBinary)`: the latter also rejects empty data but additionally accepts `string` input.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Generic request-body setter with auto-detection and explicit type specification. When `kind` is omitted, `BodyAuto` is used.

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

:::warning io.Reader and the request-body size cap
`io.Reader` cannot report its length, so with the default `Security.MaxRequestBodySize = 0` no limit is applied.

Once `MaxRequestBodySize` is set, the engine wraps the `io.Reader` in a counting reader at send time; reading past the cap aborts the transfer and returns `request body exceeds limit of N bytes`. For untrusted sources, capping the stream at the call site with `io.LimitReader` is still recommended:

```go
limited := io.LimitReader(untrustedReader, 10<<20) // cap at 10 MB
```
:::

## Query Parameters

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

Sets a single query parameter. The key cannot be empty, is limited to 256 characters, and must not contain control characters or reserved characters (`&`, `=`, `#`, `?`); the formatted value is limited to 8192 characters.

A nil `value` skips the parameter entirely (it is not rendered as `<nil>`). Common types such as `string`, `bool`, integers, and floats are supported; other types use the generic formatting path (e.g. `fmt.Stringer` implementers).

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

Sets multiple query parameters at once. Validation rules match `WithQuery`. Entries with nil values are skipped; a nil map adds no parameters.

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

Adds simple cookies in bulk. Suitable when cookies carry only name-value pairs.

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

Adds cookies from a raw Cookie header string. An empty string is a no-op; a missing `=` separator or an empty name before `=` returns an error. Each parsed cookie is validated the same way as with `WithCookies`.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=en"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

Validates, when applied, the security attributes (Secure, HttpOnly, SameSite) of cookies present at that moment.

:::warning Option order
`WithSecureCookie` **validates only cookies that exist when it is applied**. Place it **after** all `WithCookies`/`WithCookieMap`/`WithCookieString` calls; otherwise later cookies are not validated. For session-level cookie validation that does not depend on order, use `SessionManager.SetCookieSecurity`.
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

Sets the request context with timeout and cancellation support. The context cannot be nil. A context deadline only **narrows** the client default timeout (`Timeouts.Request`) — the shorter of the two wins; a context without a deadline does not lift that default (use `WithNoTimeout` for that), and an explicit `WithTimeout` replaces the client default budget while a nearer context deadline still takes precedence.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Sets a per-request timeout, overriding `Config.Timeouts.Request` (default 180s, covering the whole request including retries). The value must be greater than 0 and at most 30 minutes: `0`, negative values, and values above 30 minutes return `ErrInvalidTimeout`. For no timeout, use [`WithNoTimeout`](#withnotimeout).

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithNoTimeout

```go
func WithNoTimeout() RequestOption
```

Lifts the client-level default request timeout (`Config.Timeouts.Request`, default 180s) for this single request, so a slow call can run until the server finishes. Only the client default is lifted; two limits still apply:

- An explicit [`WithTimeout`](#withtimeout) on the same request takes precedence.
- A deadline set by the caller's context (`WithContext` or the ctx parameter) is always honored.

Dial, TLS, and response-header timeouts are unaffected.

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

Sets the per-request maximum retry count, overriding `Config.Retry.MaxRetries` (default 3). Range: 0-10; values outside the range return `ErrInvalidRetry`. `0` **disables** retries for this request (unlike `WithMaxRedirects(0)`, which is a no-op).

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithRetryNonIdempotent

```go
func WithRetryNonIdempotent(allow bool) RequestOption
```

Overrides, for this single request, whether non-idempotent methods (POST, PATCH, and custom methods) may be retried. The override is **bidirectional** over the client-level `Config.Retry.RetryNonIdempotent` (default false):

- `true`: retries a POST on a client that otherwise forbids it.
- `false`: pins a single attempt on a client that allows retries.

Idempotent methods (GET/HEAD, etc.) are unaffected, and the [`WithMaxRetries`](#withmaxretries) cap still applies.

:::warning Side-effect risk
Enabling retries for a non-idempotent request means a timeout or retryable 5xx may send the request body more than once (duplicate orders, duplicate payments). Enable it only for endpoints that tolerate replay, or protect them with an idempotency key.
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

Controls whether redirects are followed, overriding `Config.Security.FollowRedirects` (default true).

```go
// Disable following redirects
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Sets the per-request maximum redirect count, overriding `Config.Security.MaxRedirects` (default 10). Range: 0-50; negative values or values above 50 return `ErrInvalidMaxRedirects`.

:::warning Zero-value semantics
`0` does **not** disable redirects. The engine treats `0` as an "unset" sentinel and falls back to the default cap (10), so `WithMaxRedirects(0)` is equivalent to omitting the option. To fully disable redirect following, use `WithFollowRedirects(false)` instead.
:::

Counting follows `net/http` semantics: the cap includes the initial request itself, so `WithMaxRedirects(n)` follows at most `n-1` redirects (the default 10 follows at most 9).

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

Overrides the SSRF policy of the client for a single request (corresponds to `Config.Security.AllowPrivateIPs`, default false).

- `true`: the request may access localhost and private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 169.254.0.0/16, etc.) and follow redirects to such addresses.
- `false`: SSRF protection is enforced for this request even when the client sets `Security.AllowPrivateIPs=true`.

:::warning Security note
This option is a **single-request exemption** from SSRF protection. It suits a default-secure client (`AllowPrivateIPs=false`) that occasionally needs to reach internal services, loopback addresses, or a local dev server.

Enable it only when the request URL is trusted and **not** derived from untrusted external input. To allow internal access for an entire client, set `Security.AllowPrivateIPs=true` on `Config`.
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

Enables streaming mode so the response body is not buffered in memory.

:::warning Important limitation
Streaming mode **takes effect only on the [`Download`](./functions#download) path**. When `WithStreamBody(true)` is used with the standard request methods (`Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options`/`Request`), the request fails with `ErrStreamBodyRequiresDownload`. Those methods buffer the body into a `Result` and cannot hand the stream to the caller.

To stream-download large files without buffering them in memory, use `Download`.
:::

## Package-level Routing

`WithProxy`, `WithSystemProxy`, and `WithTLSFingerprint` are three **package-level-only** routing options. Each routes a single package-level call to a dedicated client.

The dedicated client has its own connection pool and inherits the default client's secure defaults (SSRF protection, TLS 1.2+, timeouts, retries). The shared default client and any other in-flight calls are unaffected. Each distinct `(proxy, system proxy, fingerprint)` combination is cached as its own client; close them all with `CloseRoutedClients` (see [Package Functions & Client Methods](./functions#closeroutedclients)).

:::warning Package-level only
These options apply only to package-level functions (`Get`/`Post`/`Request`/`Download`, etc.). On an explicit `Client` instance they return an error; use `Config.Connection.ProxyURL` / `Config.Connection.EnableSystemProxy` / `Config.Security.TLSFingerprint` there instead.
:::

### WithProxy

```go
func WithProxy(proxyURL string) RequestOption
```

Routes this call through an explicit proxy (`http`/`https`/`socks5`/`socks5h`), taking precedence over the default client's own proxy configuration. The proxy URL may carry credentials; httpc does not log them.

```go
result, err := httpc.Get("https://example.com",
    httpc.WithProxy("http://127.0.0.1:7890"),
)
```

### WithSystemProxy

```go
func WithSystemProxy() RequestOption
```

Routes this call through a client with system-proxy detection (`Connection.EnableSystemProxy`). That client reads environment variables (`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`) and platform settings (Windows registry, macOS system configuration). Requests to `localhost`/loopback and NO_PROXY-exempt hosts bypass the proxy, following `net/http` semantics; with no system proxy configured, the request connects directly. When combined with `WithProxy`, `WithProxy` takes precedence.

```go
result, err := httpc.Get("https://example.com", httpc.WithSystemProxy())
```

### WithTLSFingerprint

```go
func WithTLSFingerprint(preset string) RequestOption
```

Routes this call to a browser TLS-fingerprint client (equivalent to `Config.Security.TLSFingerprint`). The value must be a known preset (case-insensitive, whitespace-trimmed): `chrome` / `firefox` and their OS/version aliases. An unknown preset fails the request with `ErrInvalidSecurity`. See the [TLS Fingerprinting guide](../../guides/tls-fingerprint) for the full preset list and behavior.

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

Registers a pre-send callback. Multiple callbacks can be chained and run in the order they are added. A returned error aborts the request; a nil `callback` returns an error.

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

Registers a post-receive callback. Multiple callbacks can be chained and run in the order they are added. Any callback that returns an error fails the request with that error; a nil `callback` returns an error.

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

A public adapter type that turns a function literal into the `RequestOption` interface, mirroring net/http's Handler/HandlerFunc split. The `apply` method of `RequestOption` is unexported, so the interface cannot be implemented outside the package; express custom per-request options through `RequestOptionFunc` instead, without naming the internal request type.

```go
result, err := client.Get(url,
    httpc.RequestOptionFunc(func(req httpc.RequestMutator) error {
        req.SetHeader("X-Custom", "value")
        return nil
    }),
)
```

A nil `RequestOptionFunc` is a no-op and is skipped silently when applied.

## See Also

- [Constants and Types](../types/constants) - BodyKind constants and type aliases
- [Interface Definitions](../types/interfaces) - RequestMutator, ResponseMutator interfaces
- [Request and Response Mutators](../handler/mutators) - The full read/write contract of RequestMutator/ResponseMutator
- [Request and Response](../../guides/request-response) - Request options usage guide
