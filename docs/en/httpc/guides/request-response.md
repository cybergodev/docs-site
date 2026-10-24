---
sidebar_label: "Request & Response"
title: "Request and Response - CyberGo HTTPC | Options & Responses"
description: "HTTPC request/response guide: package functions, WithJSON/WithForm/WithBody, WithQuery, cookies/auth, Result parsing, streaming uploads, size limits."
sidebar_position: 20
---

# Request and Response

HTTPC has two ends: the request side is configured with `With*` options (method, headers, body, and control parameters). The response side is a `Result` object holding the status code, content, and execution metadata.

## Sending Requests

### Package-Level Functions

Send requests directly, without creating a client:

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

Supported HTTP methods: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

Package-level functions share a lazily initialized default client, which can be replaced with `SetDefaultClient` and released with `CloseDefaultClient`; see the [Tutorial](./tutorial) for the creation and rebuild rules.

### Client Instance

```go
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

Client instances are safe for concurrent use and should be kept long-lived and reused; after `Close()`, further requests return `ErrClientClosed`.

### Generic Request Method

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

`Request` accepts any method string, which makes it a good fit for generic proxy/gateway logic; the client method `client.Request` works the same way.

## Request Options

### Headers

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

All header keys and values go through CRLF-injection validation; keys or values containing control characters or exceeding the length limit return `ErrInvalidHeader`.

Request headers take effect in this order: request-body `Content-Type` → client default headers (`Defaults.Headers`) → headers set by options and middleware. Each later layer overrides same-name entries from the earlier ones.

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
// Specify a type
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// Auto-detect the type
result, err := client.Post(url, httpc.WithBody(data))
// string -> text/plain; charset=utf-8, []byte -> application/octet-stream,
// map[string]string -> application/x-www-form-urlencoded,
// *FormData -> multipart/form-data, io.Reader -> passed through,
// other -> application/json
// Optional explicit specification: httpc.WithBody(data, httpc.BodyJSON)
```

#### Explicit BodyKind Selection

`WithBody(data, kind)` skips auto-detection and forces encoding as the specified kind:

| BodyKind | Content-Type | Input requirements |
|----------|--------------|--------------------|
| `BodyAuto` (default) | Auto-detected from the input type | See the table below |
| `BodyJSON` | `application/json` | Any JSON-serializable value |
| `BodyXML` | `application/xml` | Any XML-serializable value |
| `BodyForm` | `application/x-www-form-urlencoded` | `map[string]string` or `url.Values` |
| `BodyBinary` | `application/octet-stream` | `[]byte` or `string` (non-empty) |
| `BodyMultipart` | `multipart/form-data` | `*FormData` |

Detection rules for `BodyAuto`:

| Input type | Content-Type |
|------------|--------------|
| `string` | `text/plain; charset=utf-8` |
| `[]byte` | `application/octet-stream` |
| `map[string]string` | `application/x-www-form-urlencoded` |
| `*FormData` | `multipart/form-data` (with boundary) |
| `io.Reader` | Not set (passed through as-is) |
| Other (struct/map, etc.) | `application/json` |

#### Forms and Multipart Uploads

```go
// url.Values form (can carry repeated fields, e.g. tag=go&tag=http)
values := url.Values{"tag": {"go", "http"}, "page": {"2"}}
result, err := client.Post(url, httpc.WithBody(values, httpc.BodyForm))

// multipart/form-data: fields + files
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "avatar upload",
    },
    Files: map[string]*httpc.FileData{
        "avatar": {Filename: "avatar.png", Content: pngBytes},
    },
}
result, err = client.Post(url, httpc.WithFormData(form))

// Single-file shortcut (field name, file name, content; the file name goes
// through path-sanitization validation)
result, err = client.Post(url, httpc.WithFile("avatar", "avatar.png", pngBytes))
```

Form fields are validated one by one for control characters and length (tabs are allowed inside values); `WithForm` is equivalent to `WithBody(data, BodyForm)` — both share the same "validate first, then encode" path.

#### Streaming Request Bodies (io.Reader)

```go
// The io.Reader is passed through as-is and no Content-Type is set
// (add one with WithHeader when needed)
result, err := client.Post(url,
    httpc.WithBody(io.LimitReader(file, 10<<20)), // limit to at most 10MB
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```

:::warning io.Reader request bodies and the size limit
With the default `Security.MaxRequestBodySize = 0`, an `io.Reader` request body has no size limit; once a limit is set, the engine enforces it at send time and aborts an over-limit transfer. Wrapping untrusted sources in `io.LimitReader` is still recommended. See [Streaming Requests](#streaming-requests) for the full semantics.
:::

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

Key points:
- Values support `string`, `bool`, `int`/`int64`, the `uint` family, `float32`/`float64`, and any type implementing `fmt.Stringer`
- When a value is `nil`, the parameter does **not** appear in the URL (rather than rendering as the literal `<nil>`)
- Empty, over-long, or otherwise invalid keys return an error; a query string already present in the URL is merged with the option parameters

### Authentication

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

Both options validate their input: `WithBearerToken` fails on an empty token or invalid characters; `WithBasicAuth` requires a non-empty username and fails on over-long usernames/passwords or invalid characters.

### Cookies

```go
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "en"}),
    httpc.WithCookieString("session=abc; lang=en"),
)
```

For bulk setting, `WithCookies` takes the whole slice in a single call (one pre-allocation, one validation pass):

```go
result, err := client.Get(url, httpc.WithCookies([]http.Cookie{
    {Name: "session", Value: "abc"},
    {Name: "lang", Value: "en"},
}))
```

To validate cookie security attributes, `WithSecureCookie` **must come after all cookie options** — it only validates the cookies present at the moment it is applied:

```go
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()), // requires Secure/HttpOnly/SameSite=Strict
)
```

### Request Control

```go
// Timeout
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// Retry
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Redirects
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // Disable redirect following
)

// Context (equivalent to swapping in a different ctx for this request)
result, err := client.Get(url, httpc.WithContext(ctx))
```

:::tip WithMaxRedirects(0) does not disable
`WithMaxRedirects(0)` does **not** disable redirects -- the engine treats `0` as "unset" and falls back to the default of 10. To disable redirect following entirely, use `WithFollowRedirects(false)`. For full redirect control, chain tracking, and domain whitelisting, see [Redirects](./redirects).
:::

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

A callback returning an error aborts the request (an error from `OnResponse` fails the whole request). Multiple callbacks run chained in the order they were added.

:::tip Callbacks run per attempt, middleware per request
`WithOnRequest`/`WithOnResponse` fire inside the engine and run on **every attempt (including retries)**; the middleware chain wraps the entire retry cycle and runs once per logical request. Use callbacks when you need per-attempt granularity, and [middleware](./middleware-chain) when you need per-request granularity.
:::

## Response Handling

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

// Status check
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// Read the response
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

### Result Capabilities at a Glance

A `Result` is made up of three parts: `Request` (the request actually sent), `Response` (the response data), and `Meta` (execution metadata). Prefer the nil-safe accessor methods:

| Category | Method / Field | Description |
|----------|----------------|-------------|
| Status | `StatusCode()` / `Proto()` / `Response.Status` | Status code, protocol version (e.g. `HTTP/1.1`), status text |
| Checks | `IsSuccess()` / `IsRedirect()` / `IsClientError()` / `IsServerError()` | 2xx / 3xx / 4xx / 5xx |
| Content | `Body()` / `RawBody()` / `Response.ContentLength` | Body as string / raw bytes / Content-Length |
| JSON | `Unmarshal(&v)` | Empty body returns `ErrResponseBodyEmpty`; above 50MB returns `ErrResponseBodyTooLarge` |
| Response cookies | `GetCookie(name)` / `HasCookie(name)` / `ResponseCookies()` | Get by name / existence check / all response cookies |
| Request cookies | `GetRequestCookie(name)` / `HasRequestCookie(name)` / `RequestCookies()` | Cookies actually sent with the request (final values after redirects) |
| Metadata | `Meta.Duration` / `Attempts` / `RedirectChain` / `RedirectCount` / `ProxyURL` | Duration, attempts (including the first), redirect chain, the proxy used for this request |
| Files | `SaveToFile(path)` | Writes the response body to a file (with path-traversal / symlink safety checks) |
| Debugging | `String()` | Redacted summary: sensitive headers masked, body truncated to 200 characters |

All accessors are nil-safe: when `Result` or an inner pointer is nil, `StatusCode()` returns 0, `Body()` returns an empty string, and the check methods return false — no panic.

### Response Headers and Metadata

```go
// Response headers are a standard http.Header, case-insensitive
contentType := result.Response.Headers.Get("Content-Type")
date := result.Response.Headers.Get("Date")

// Request side: the headers and cookies actually sent
// (the final request after redirects)
ua := result.Request.Headers.Get("User-Agent")
finalURL := result.Request.URL

// Proxy-pool scenario: the proxy actually used for this request
if result.Meta.ProxyURL != "" {
    log.Printf("Via proxy: %s", result.Meta.ProxyURL)
}

// Redirect chain: the URLs visited in order
for i, u := range result.Meta.RedirectChain {
    log.Printf("Redirect %d: %s", i+1, u)
}
```

### Saving to a File

Small response bodies can be saved directly (for large files use the [file download API](./file-transfer) to avoid loading the whole payload into memory):

```go
if err := result.SaveToFile("user.json"); err != nil {
    log.Fatal(err) // empty response body, or a path that failed the safety
                   // validation (path traversal, symlink, etc.)
}
```

### Debug Output

`String()` produces a one-line summary suitable for logging: sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, etc.) show up as `***`, and the response body is truncated to 200 characters:

```go
fmt.Println(result.String())
// Example output: Result{Status: 200 200 OK, ContentLength: 5102, Duration: 150ms,
// Attempts: 1, Headers: 14 [Content-Length, Content-Type, ...], Body: {"id":...}
```

## Context Control

```go
// Timeout control
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// Cancellation control
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // cancel after 5 seconds
}()
result, err := httpc.Request(ctx, "GET", url)
```

How `WithTimeout` relates to a context timeout: `WithTimeout` is the total budget across all retry attempts, and the engine wraps it around the entire retry loop; context cancellation takes effect immediately at the transport layer. See [Retry and Fault Tolerance](./retry-fault-tolerance) for the full budget semantics.

## Streaming Requests

Mirroring [streaming responses](#streaming-responses), the upload side streams too. `WithBody` accepts any `io.Reader` directly and sends data as it is generated, without reading the entire request body into memory first. For the complete large-file upload story (chunking, checksums), see [File Upload and Download](./file-transfer#streaming-upload-large-files).

### io.Reader Request Bodies

`WithBody(reader)` takes the auto-detection `io.Reader` branch: the Reader is passed through to the transport as-is and no `Content-Type` is set (add one with `WithHeader` when needed). The engine does not pre-read the data; the pace of reading is driven by the HTTP transport. When `Security.MaxRequestBodySize` is set, the engine wraps the reader in a counting reader only at send time, for limiting.

:::warning Reader bodies and the size limit
An `io.Reader` is consumed by reading and its length is not known in advance. With the default `Security.MaxRequestBodySize = 0` there is no limit; when a limit is set explicitly, the engine enforces it at send time and aborts the transfer with `request body exceeds limit of N bytes` once the limit is crossed.

For untrusted sources, wrapping with `io.LimitReader` at the source is still recommended. For the rationale, see the FAQ: [Why isn't an io.Reader request body size-validated?](../faq/#why-isn-t-an-io-reader-request-body-size-validated)
:::

### Retry vs. Streaming Trade-offs

Retries need to replay the request body, but an `io.Reader` is drained after a single read. What the engine actually does:

| Retry configuration | Request-body behavior |
|---------------------|------------------------|
| Enabled (default `Retry.MaxRetries = 3`) | Before the first attempt, the Reader is fully read into memory and converted to `[]byte`; every retry rebuilds a Reader to replay it. Cap of 100MB; beyond that an error is returned (`retry not supported for streaming bodies exceeding 104857600 bytes`) |
| `WithMaxRetries(0)` | The Reader goes straight to the transport: zero-buffer true streaming. The trade-off is that the request is not retried |

Two knock-on differences:

- **Content-Length**: on the buffered path the length becomes known once converted to `[]byte`, so the request carries Content-Length; on the pass-through path the length is unknown and HTTP/1.1 automatically uses chunked transfer encoding.
- **Memory footprint**: with the default retry configuration the request body is fully in memory even when the first attempt succeeds. "Streaming" here only saves assembling a `[]byte` by hand; it is not zero-copy. For generate-and-send streaming, set `WithMaxRetries(0)`.

### WithStreamBody Is Response-Side

`WithStreamBody(true)` is a response-side mechanism, not a request-body streaming switch: it skips in-memory buffering of the response body and is used internally by the file download API. It does not affect how the request body is processed, nor does it change the retry buffering described above; whether the request body streams depends only on whether an `io.Reader` is passed and whether retries are enabled. See [Streaming Responses](#streaming-responses) below.

### Zero-Copy Uploads with io.Pipe

`io.Pipe` wires "generating data" and "sending data" onto the same pipe: a producer goroutine writes as it generates while the HTTP transport consumes concurrently, with no intermediate buffer along the way. A typical scenario — uploading a compression stream directly, without staging a `.gz` file on disk:

```go
package main

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	file, err := os.Open("data.json")
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	pr, pw := io.Pipe()
	gw := gzip.NewWriter(pw)

	// Producer: read the file and compress it into the pipe as we go
	go func() {
		_, copyErr := io.Copy(gw, file)
		if closeErr := gw.Close(); closeErr != nil && copyErr == nil {
			copyErr = closeErr
		}
		pw.CloseWithError(copyErr) // equivalent to Close when copyErr is nil
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// Consumer: the HTTP transport reads directly from the pipe
	result, err := httpc.Request(ctx, "POST", "https://api.example.com/upload",
		httpc.WithBody(pr),
		httpc.WithMaxRetries(0), // true streaming: disable retries so the engine does not buffer the whole body
		httpc.WithHeader("Content-Type", "application/gzip"),
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode(), result.Meta.Attempts)
	// Output: 200 1
}
```

Key points:

- Any producer error must reach the consumer via `pw.CloseWithError`; otherwise the peer only sees EOF and partial data is treated as a complete upload
- An `io.Pipe` cannot be replayed, which suits `WithMaxRetries(0)`; when retries are required, use a buffered approach (e.g. stage to disk first, then upload)
- The server receives the compressed data chunk by chunk per `Content-Type: application/gzip`; the receiver can decompress on the fly, and neither side needs to buffer the whole payload

## Streaming Responses

`WithStreamBody(true)` is a response-side mechanism used internally by file downloads to avoid caching the entire response body in memory. Applying it to standard request methods such as `Get`/`Post`/`Request` makes the request fail with `ErrStreamBodyRequiresDownload`.

:::warning
`WithStreamBody(true)` is used internally by the file download API. For streaming response content, use the [file download API](./file-transfer).
:::

For downloading large files, use the download API:

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.Download(context.Background(), url, cfg)
```

## Response Decompression

HTTPC automatically decompresses `gzip` and `deflate` content encodings. The transport disables the Go standard library's transparent decompression, and the engine handles it manually.

Requests carry `Accept-Encoding: gzip, deflate` by default; override it with `WithHeader("Accept-Encoding", ...)`.

Supported encodings:

| Content-Encoding | Handling |
|------------------|----------|
| `gzip` / `deflate` | Decompressed automatically (decompressors are reused from a pool) |
| `br` (brotli) / `zstd` / `compress` (LZW) / any other unknown encoding | Not supported — an error is returned; `br` and `zstd` work only on the `Security.TLSFingerprint` path |
| `identity` | Passed through as-is |

The security configuration caps the decompressed size to defend against decompression bombs:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // Response body cap: enforced on streaming downloads; fallback for the decompressed cap on non-streaming reads
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // Max 100MB after decompression
```

| Setting | Default | Description |
|---------|---------|-------------|
| `MaxResponseBodySize` | 10MB | Response body cap for streaming downloads; in non-streaming reads it acts as the fallback for the decompressed cap |
| `MaxDecompressedBodySize` | 100MB | Decompressed response body size cap (falls back to `MaxResponseBodySize` when unset) |

The compressed body has a separate 100MB hard cap (`maxCompressedSize`, not configurable) that defends against decompression bombs, independent of `MaxResponseBodySize`.

When a limit is exceeded, the error message contains `"exceeds limit"` and can be handled through `ClientError`. `Result.Unmarshal()` returns `ErrResponseBodyTooLarge` when it parses a response body exceeding the 50MB JSON size limit; that limit is independent of `MaxResponseBodySize`.

## Formatting Helpers

Package-level formatting helpers (base-1024) are useful for displaying download progress or log sizes:

```go
fmt.Println(httpc.FormatBytes(1536))        // Output: 1.50 KB
fmt.Println(httpc.FormatBytes(1048576))     // Output: 1.00 MB
fmt.Println(httpc.FormatSpeed(1048576))     // Output: 1.00 MB/s
```

## Next Steps

- [Redirects](./redirects) - Following control, chain tracking, and domain whitelisting
- [File Upload and Download](./file-transfer) - Streaming upload, download, and checksums for large files
- [Domain Client and Sessions](./domain-session) - Session management
- [Request Options API](../api-reference/core/options) - The complete options reference
- [Result API](../api-reference/core/result) - Response handling reference
