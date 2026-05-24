---
title: "Request and Response - HTTPC"
description: "Guide to HTTPC request and response handling covering headers, multiple body formats, query parameters, authentication, cookies, and streaming responses."
---

# Request and Response

## Sending Requests

### Package-Level Functions

Send requests directly without creating a client:

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

Supported HTTP methods: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

### Client Instance

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

### Generic Request Method

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## Request Options

### Request Headers

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer token"),
    httpc.WithHeader("X-Custom", "value"),
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "123",
    }),
    httpc.WithUserAgent("my-app/1.0"),
)
```

### Request Body

```go
// JSON
result, err := client.Post(url, httpc.WithJSON(map[string]any{
    "name": "test",
}))

// XML
result, err := client.Post(url, httpc.WithXML(data))

// Form
result, err := client.Post(url, httpc.WithForm(map[string]string{
    "username": "admin",
    "password": "secret",
}))

// Binary (default application/octet-stream)
result, err := client.Post(url, httpc.WithBinary(data))
// Specify type
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// Auto-detect type
result, err := client.Post(url, httpc.WithBody(data))
// string → text/plain; charset=utf-8, []byte → application/octet-stream,
// map[string]string → application/x-www-form-urlencoded,
// *FormData → multipart/form-data, io.Reader → passed through,
// other → application/json
// Optionally specify explicitly: httpc.WithBody(data, httpc.BodyJSON)
```

### Query Parameters

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)

// Or use a Map
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
    }),
)
```

### Authentication

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

### Cookies

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
)
```

### Request Control

```go
// Timeout
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// Retry
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Redirect
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // Disable redirects
    httpc.WithMaxRedirects(3),           // Max 3 redirects
)
```

### Callbacks

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("Sending request: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Received response: %d", resp.StatusCode())
        return nil
    }),
)
```

## Response Handling

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// Status checks
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// Read response
result.Body()           // string
result.RawBody()        // []byte
result.Proto()          // "HTTP/1.1"

// JSON parsing
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}

// Cookies
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}

// Request metadata
fmt.Println(result.Meta.Duration)       // Request duration
fmt.Println(result.Meta.Attempts)       // Retry count
fmt.Println(result.Meta.RedirectCount)  // Redirect count
```

## Context Control

```go
// Timeout control
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// Cancel control
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // Cancel after 5 seconds
}()
result, err := httpc.Request(ctx, "GET", url)
```

## Streaming Responses

`WithStreamBody(true)` is an internal mechanism used during file downloads to avoid buffering the complete response body in memory. When enabled, the response body is not read into the `Result` (both `Body()` and `RawBody()` return empty values).

:::warning
`WithStreamBody(true)` is used internally by the file download API (`DownloadFile`, `DownloadWithOptions`). To stream response content, use the [File Download API](./file-transfer).
:::

To download large files, use the download API:

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.DownloadWithOptions(url, cfg)
```

## Response Decompression

HTTPC automatically handles decompression of content encodings such as gzip and deflate. You can use security configuration to limit decompressed size and prevent decompression bomb attacks:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // Max compressed body 10MB
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // Max decompressed body 100MB
```

| Configuration | Default | Description |
|---------------|---------|-------------|
| `MaxResponseBodySize` | 10MB | Maximum raw response body size |
| `MaxDecompressedBodySize` | 100MB | Maximum decompressed response body size |

When the limit is exceeded, an error containing `"exceeds limit"` is returned, which can be handled via the `ClientError` type check. `ErrResponseBodyTooLarge` is returned when `Result.Unmarshal()` parses JSON exceeding the 50MB size limit (independent of `MaxResponseBodySize`).

## Next Steps

- [File Upload and Download](./file-transfer) - File transfer guide
- [Domain Client and Sessions](./domain-session) - Session management
- [Request Options API](../api-reference/options) - Complete options reference
- [Result API](../api-reference/result) - Response handling reference
