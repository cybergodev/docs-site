---
sidebar_label: "Result"
title: "Result - CyberGo HTTPC | Result Response Type"
description: "HTTPC Result reference: 17 nil-safe methods, status checks, cookie access, JSON parsing, file saving, and the RequestInfo/ResponseInfo/RequestMeta sub-types."
sidebar_position: 30
---

# Result

Result wraps the HTTP response and request metadata and provides nil-safe access methods. It is returned by `Client.Request()` or the package-level functions.

```go
type Result struct {
    Request  *RequestInfo
    Response *ResponseInfo
    Meta     *RequestMeta
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `Result.Request` | `*RequestInfo` | Details of the request as finally sent (after redirects); nil-safe methods check it automatically |
| `Result.Response` | `*ResponseInfo` | Final response data; nil when the request errored |
| `Result.Meta` | `*RequestMeta` | Request-execution metadata (duration, attempts, proxy, redirect chain); nil only in zero-value Results constructed by callers |

### Method Overview

All methods are defined on the `*Result` pointer receiver and are nil-receiver-safe: they return zero values instead of panicking.

| Method | Signature | Description |
|--------|-----------|-------------|
| `Result.StatusCode` | `func (r *Result) StatusCode() int` | Returns the HTTP status code; nil-safe, returns 0 |
| `Result.Body` | `func (r *Result) Body() string` | Returns the response body as a string; nil-safe, returns an empty string |
| `Result.RawBody` | `func (r *Result) RawBody() []byte` | Returns the raw response-body bytes; nil-safe, returns nil |
| `Result.Proto` | `func (r *Result) Proto() string` | Returns the HTTP protocol version (e.g. `"HTTP/1.1"`) |
| `Result.IsSuccess` | `func (r *Result) IsSuccess() bool` | Returns true when the status code is 2xx |
| `Result.IsRedirect` | `func (r *Result) IsRedirect() bool` | Returns true when the status code is 3xx |
| `Result.IsClientError` | `func (r *Result) IsClientError() bool` | Returns true when the status code is 4xx |
| `Result.IsServerError` | `func (r *Result) IsServerError() bool` | Returns true when the status code is 5xx |
| `Result.Unmarshal` | `func (r *Result) Unmarshal(v any) error` | Parses the JSON response body into `v` |
| `Result.SaveToFile` | `func (r *Result) SaveToFile(filePath string) error` | Writes the response body to a file |
| `Result.String` | `func (r *Result) String() string` | Returns a human-readable string representation (sensitive headers masked) |
| `Result.ResponseCookies` | `func (r *Result) ResponseCookies() []*http.Cookie` | Returns all cookies from the response |
| `Result.GetCookie` | `func (r *Result) GetCookie(name string) *http.Cookie` | Returns the named response cookie, or nil if absent |
| `Result.HasCookie` | `func (r *Result) HasCookie(name string) bool` | Returns whether the response contains the named cookie |
| `Result.RequestCookies` | `func (r *Result) RequestCookies() []*http.Cookie` | Returns all cookies sent with the request |
| `Result.GetRequestCookie` | `func (r *Result) GetRequestCookie(name string) *http.Cookie` | Returns the named request cookie, or nil if absent |
| `Result.HasRequestCookie` | `func (r *Result) HasRequestCookie(name string) bool` | Returns whether the request contains the named cookie |

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::tip
Result is created fresh for each request and reclaimed by GC; no manual release is needed.
:::

:::tip Access style
Prefer the nil-safe accessor methods (`StatusCode`, `Body`, `GetCookie`, etc.). The `Request`/`Response`/`Meta` fields are exported mainly so tests and mocks can construct a Result directly. Before reading them off a client-returned Result, nil-check the nested pointers: `Response` is nil when the request failed.
:::

## Basic Methods

### StatusCode

```go
func (r *Result) StatusCode() int
```

Returns the HTTP status code. Nil-safe: returns 0.

### Body

```go
func (r *Result) Body() string
```

Returns the response body as a string. Nil-safe: returns an empty string.

### RawBody

```go
func (r *Result) RawBody() []byte
```

Returns the response body as raw bytes. Nil-safe: returns nil.

### Proto

```go
func (r *Result) Proto() string
```

Returns the HTTP protocol version, e.g. `"HTTP/1.1"`, `"HTTP/2.0"`.

## Status Checks

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

Returns true when the status code is 2xx.

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

Returns true when the status code is 3xx.

### IsClientError

```go
func (r *Result) IsClientError() bool
```

Returns true when the status code is 4xx.

### IsServerError

```go
func (r *Result) IsServerError() bool
```

Returns true when the status code is 5xx.

```go
result, _ := client.Get(url)
switch {
case result.IsSuccess():
    handleSuccess(result)
case result.IsClientError():
    handleClientError(result)
case result.IsServerError():
    handleServerError(result)
}
```

## Cookie Methods

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

Returns all cookies from the response.

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

Returns the named response cookie, or nil if absent.

```go
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}
```

### HasCookie

```go
func (r *Result) HasCookie(name string) bool
```

Returns whether the response contains the named cookie.

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

Returns all cookies sent with the request.

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

Returns the named request cookie, or nil if absent.

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

Returns whether the request contains the named cookie.

## JSON Parsing

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

Parses the JSON response body into `v`, following `json.Unmarshal` conventions.

| Error | Trigger Condition |
|-------|-------------------|
| `ErrResponseBodyEmpty` | The response body is empty (including when Result or Response is nil) |
| `ErrResponseBodyTooLarge` | The response body exceeds the 50MB JSON-parsing limit (the error reports the actual byte count) |

```go
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}
fmt.Println(user.Name)
```

## File Saving

### SaveToFile

```go
func (r *Result) SaveToFile(filePath string) error
```

Writes the response body to a file, unconditionally overwriting an existing target (unlike `Download`, which returns `ErrFileExists` by default). The file path is security-validated (path-traversal protection, symlink checks, system-path protection). Content is first written to a `<path>.httpc-tmp` temporary file and atomically renamed into place once validation passes; the file is written with `0644` permissions.

| Error | Trigger Condition |
|-------|-------------------|
| `ErrResponseBodyEmpty` | The response body is nil or empty (including when Result or Response is nil) |
| `ErrDownloadInProgress` | A `Download` or another `SaveToFile` in the same process is already writing the same target path |
| Wrapped error | Path validation failed or the write failed |

```go
result, _ := client.Get("https://example.com/data.csv")

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## String Representation

### String

```go
func (r *Result) String() string
```

`String` returns a human-readable string representation (it implements `fmt.Stringer`). Sensitive headers are masked automatically. The response body content is **never included**: only its size in bytes is reported (`Body: [N bytes omitted]`), which keeps credentials and session data out of logs. A nil Result, or one without a response, yields `Result{}`.

Masked headers: `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-Auth-Token`, and `Proxy-Authorization`, shown in the header list as `Name: ***`.

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
```

## Sub-types

### RequestInfo

```go
type RequestInfo struct {
    URL     string
    Method  string
    Headers http.Header
    Cookies []*http.Cookie
}
```

Request details. Accessed via `result.Request`.

| Field | Type | Description |
|-------|------|-------------|
| `RequestInfo.URL` | `string` | Request URL |
| `RequestInfo.Method` | `string` | HTTP method |
| `RequestInfo.Headers` | `http.Header` | Request headers |
| `RequestInfo.Cookies` | `[]*http.Cookie` | Request cookies |

### ResponseInfo

```go
type ResponseInfo struct {
    StatusCode    int
    Status        string
    Proto         string
    Headers       http.Header
    Body          string
    RawBody       []byte
    ContentLength int64
    Cookies       []*http.Cookie
}
```

Response data. Accessed via `result.Response`.

| Field | Type | Description |
|-------|------|-------------|
| `ResponseInfo.StatusCode` | `int` | HTTP status code |
| `ResponseInfo.Status` | `string` | Status text (e.g. `"200 OK"`) |
| `ResponseInfo.Proto` | `string` | HTTP protocol version |
| `ResponseInfo.Headers` | `http.Header` | Response headers |
| `ResponseInfo.Body` | `string` | Response body (string) |
| `ResponseInfo.RawBody` | `[]byte` | Response body (raw bytes) |
| `ResponseInfo.ContentLength` | `int64` | Response Content-Length |
| `ResponseInfo.Cookies` | `[]*http.Cookie` | Response cookies |

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    ProxyURL      string
    RedirectChain []string
    RedirectCount int
}
```

Request-execution metadata. Accessed via `result.Meta`.

| Field | Description |
|-------|-------------|
| `RequestMeta.Duration` | Total time from request start to response completion |
| `RequestMeta.Attempts` | Total attempts including retries |
| `RequestMeta.ProxyURL` | Proxy URL used by the attempt that produced the current response (`Connection.ProxyURL` or the selected proxy-pool entry). Empty for direct connections and for system proxies (`EnableSystemProxy`); configure `Connection.ProxyURL` or `ProxyPool` explicitly when you need to observe egress per request |
| `RequestMeta.RedirectChain` | Chain of redirect URLs followed |
| `RequestMeta.RedirectCount` | Number of redirects followed |

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2 (retried once)
fmt.Println(result.Meta.RedirectCount)  // 1 (followed one redirect)
fmt.Println(result.Meta.ProxyURL)        // "" (direct) or "http://proxy:8080"
```

## Complete Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://api.example.com/users/1")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode()) // 200
	fmt.Println(result.IsSuccess())  // true

	var user struct {
		Name string `json:"name"`
	}
	if err := result.Unmarshal(&user); err != nil {
		log.Fatal(err)
	}
	fmt.Println(user.Name) // test

	fmt.Println(result.Meta.Attempts) // 1
}
```

## See Also

- [Package Functions](./functions) - Request methods that return Result
- [Request Options](./options) - Configure request behavior
- [File Download](../client-config/download) - The DownloadResult download-result type
