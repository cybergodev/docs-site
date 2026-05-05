---
title: Request Options - HTTPC
description: HTTPC twenty-six request option functions complete API reference documentation, organized by category covering header settings, Bearer and Basic authentication, JSON and form request body formats, URL query parameter construction, cookie management, and OnRequest and OnResponse callback functions.
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

Set a single request header. Keys and values are validated for security (CRLF injection protection).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

Set multiple request headers at once.

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

Set the User-Agent header. This is a convenience wrapper for `WithHeader("User-Agent", ...)`.

## Authentication

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

Set HTTP Basic authentication. Username cannot be empty, and credential length is limited.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Set the `Authorization: Bearer <token>` header. Token cannot be empty.

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

Set a JSON request body, automatically adding `Content-Type: application/json`.

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

Set an XML request body, automatically adding `Content-Type: application/xml`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Set a URL-encoded form request body, automatically adding `Content-Type: application/x-www-form-urlencoded`.

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

Set a `multipart/form-data` request body, supporting mixed file and field uploads.

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

Convenient file upload. Automatically constructs a multipart request body. Filename is processed for path traversal protection.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Set a binary request body. Default Content-Type is `application/octet-stream`, customizable.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Generic request body setting, supporting automatic detection and explicit type specification.

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

Set a single query parameter.

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

Set multiple query parameters at once.

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

Add a single cookie, validated for security.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

Add multiple simple cookies. Suitable for name-value-only scenarios.

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

Add cookies from a raw Cookie header string.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=en"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

Enforce validation of request cookie security attributes (Secure, HttpOnly, SameSite).

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

Set the request context, supporting timeout and cancellation. Context cannot be nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Set a per-request timeout, overriding the client default. Range: 0 to 30 minutes.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Set the maximum retry count for a single request, overriding the client configuration. Range: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

Control whether to follow redirects.

```go
// Disable redirect following
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Set the maximum number of redirects for a single request. Range: 0-50.

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Enable streaming mode where the response body is not cached in memory. Used internally for file downloads to avoid memory consumption with large files.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Callbacks

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Register a pre-send callback. Multiple callbacks can be chained and execute in the order added. Returning an error from the callback aborts the request.

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

Register a post-response callback. Multiple callbacks can be chained and execute in the order added.

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
- [Interfaces](./interfaces) - RequestMutator, ResponseMutator interfaces
- [Request and Response](../guides/request-response) - Request options usage guide
