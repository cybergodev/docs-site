---
title: "Request Options - CyberGo HTTPC | WithXxx Options"
description: "HTTPC request options API reference: WithHeader, WithBearerToken authentication, WithJSON/WithForm bodies, WithQuery parameters, and callback functions."
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

Sets HTTP Basic authentication. Username cannot be empty, credentials length is limited.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Sets the `Authorization: Bearer <token>` header. Token cannot be empty.

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

Convenient file upload. Automatically builds a multipart request body. Filename is processed for path traversal protection.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Sets a binary request body. Default Content-Type is `application/octet-stream`, customizable.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Generic request body setting, supporting auto-detection and explicit type specification.

**Auto-detection rules** (default `BodyAuto`):

| Input Type | Content-Type |
|------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | Not set (handled by caller) |
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

### WithCookie

```go
func WithCookie(cookie http.Cookie) RequestOption
```

Adds a single cookie, with security validation.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Adds multiple cookies at once. More efficient than calling `WithCookie` multiple times -- pre-allocates capacity and validates all cookies in a single pass.

```go
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err := client.Get("https://api.example.com",
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

Enforces validation of request cookie security attributes (Secure, HttpOnly, SameSite).

```go
result, err := client.Get(url,
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## Request Control

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

Sets the request context, supporting timeout and cancellation. Context cannot be nil.

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

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Sets the per-request maximum retry count, overriding the client configuration. Range: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
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

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

Overrides the client's SSRF policy for a single request. When `allow` is `true`, the request may access localhost and private/reserved IP ranges (127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 169.254.0.0/16, etc.) and follow redirects to such addresses; when `false`, SSRF protection is enforced for this request even if the client is configured with `Security.AllowPrivateIPs=true`.

:::warning Security note
This is a **per-request escape hatch** from SSRF protection, suited for cases where a default-secure client (`AllowPrivateIPs=false`) occasionally needs to reach internal services, loopback addresses, or a local dev server.

Enable it only when the request URL is trusted and **not** derived from untrusted user input. To allow internal access for an entire client, set `Security.AllowPrivateIPs=true` on `Config` directly.
:::

```go
// Default client blocks private IPs; this call allows it per request
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Enables streaming mode where the response body is not cached in memory. Used internally for file downloads to avoid memory consumption with large files.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Callbacks

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Registers a pre-send callback. Multiple callbacks can be chained and execute in the order added. Returning an error aborts the request.

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

Registers a post-receive callback. Multiple callbacks can be chained and execute in the order added.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Received response: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## See Also

- [Constants and Types](./constants) - BodyKind constants and type aliases
- [Interface Definitions](./interfaces) - RequestMutator, ResponseMutator interfaces
- [Request and Response](../guides/request-response) - Request options usage guide
