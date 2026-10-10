---
sidebar_label: "Result"
title: "Result - CyberGo HTTPC | Result Response Type"
description: "HTTPC Result API reference: all 17 nil-safe methods (StatusCode, Body, Unmarshal, SaveToFile), plus RequestInfo/ResponseInfo/RequestMeta sub-types explained."
sidebar_position: 30
---

# Result

Result wraps the HTTP response and request metadata, providing convenient access methods. It is obtained via `Client.Request()` or package-level functions.

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
| `Result.Meta` | `*RequestMeta` | Request-execution metadata (duration, attempts, proxy, redirect chain); may be nil |

### Method Overview

All methods are defined on the `*Result` pointer receiver and are nil-receiver-safe (returning zero values instead of panicking):

| Method | Signature | Description |
|--------|-----------|-------------|
| `Result.StatusCode` | `func (r *Result) StatusCode() int` | Returns the HTTP status code; nil-safe (returns 0) |
| `Result.Body` | `func (r *Result) Body() string` | Returns the response body as a string; nil-safe (returns an empty string) |
| `Result.RawBody` | `func (r *Result) RawBody() []byte` | Returns the raw response-body bytes; nil-safe (returns nil) |
| `Result.Proto` | `func (r *Result) Proto() string` | Returns the HTTP protocol version (e.g. `"HTTP/1.1"`) |
| `Result.IsSuccess` | `func (r *Result) IsSuccess() bool` | Returns true for 2xx status codes |
| `Result.IsRedirect` | `func (r *Result) IsRedirect() bool` | Returns true for 3xx status codes |
| `Result.IsClientError` | `func (r *Result) IsClientError() bool` | Returns true for 4xx status codes |
| `Result.IsServerError` | `func (r *Result) IsServerError() bool` | Returns true for 5xx status codes |
| `Result.Unmarshal` | `func (r *Result) Unmarshal(v any) error` | Parses the JSON response body into the target variable |
| `Result.SaveToFile` | `func (r *Result) SaveToFile(filePath string) error` | Saves the response body to a file |
| `Result.String` | `func (r *Result) String() string` | Returns a human-readable string representation (sensitive headers masked) |
| `Result.ResponseCookies` | `func (r *Result) ResponseCookies() []*http.Cookie` | Returns all cookies from the response |
| `Result.GetCookie` | `func (r *Result) GetCookie(name string) *http.Cookie` | Gets a response cookie by name; returns nil if not found |
| `Result.HasCookie` | `func (r *Result) HasCookie(name string) bool` | Checks whether a response cookie with the given name exists |
| `Result.RequestCookies` | `func (r *Result) RequestCookies() []*http.Cookie` | Returns all cookies sent with the request |
| `Result.GetRequestCookie` | `func (r *Result) GetRequestCookie(name string) *http.Cookie` | Gets a request cookie by name; returns nil if not found |
| `Result.HasRequestCookie` | `func (r *Result) HasRequestCookie(name string) bool` | Checks whether a request cookie with the given name exists |

The methods are detailed by functional group below.

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::tip
Result is created fresh for each request and reclaimed automatically by GC — no manual release needed.
:::

:::tip Access style
Prefer the nil-safe accessor methods (`StatusCode`, `Body`, `GetCookie`, etc.). The `Request`/`Response`/`Meta` fields are exported mainly so tests and mocks can construct a Result directly; before reading them off a client-returned Result, nil-check the nested pointers (`Response` may be nil when the request failed).
:::

## Basic Methods

### StatusCode

```go
func (r *Result) StatusCode() int
```

Returns the HTTP status code. Nil-safe, returns 0.

### Body

```go
func (r *Result) Body() string
```

Returns the response body as a string. Nil-safe, returns an empty string.

### RawBody

```go
func (r *Result) RawBody() []byte
```

Returns the response body as raw bytes. Nil-safe, returns nil.

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

Returns true for 2xx status codes.

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

Returns true for 3xx status codes.

### IsClientError

```go
func (r *Result) IsClientError() bool
```

Returns true for 4xx status codes.

### IsServerError

```go
func (r *Result) IsServerError() bool
```

Returns true for 5xx status codes.

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

Gets a response cookie by name; returns nil if not found.

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

Checks whether a cookie with the specified name exists in the response.

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

Returns all cookies sent with the request.

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

Gets a request cookie by name.

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

Checks whether a cookie with the specified name exists in the request.

## JSON Parsing

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

Parses the JSON response body into the target variable. Follows `json.Unmarshal` conventions.

| Error | Trigger Condition |
|-------|-------------------|
| `ErrResponseBodyEmpty` | Response body is empty |
| `ErrResponseBodyTooLarge` | Response body exceeds the 50MB JSON-parsing size limit |

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

Saves the response body to a file. The file path is security-validated (path-traversal protection, symlink checking, system-path protection).

| Error | Trigger Condition |
|-------|-------------------|
| `ErrResponseBodyEmpty` | Response body is empty |

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

`String` returns a human-readable string representation (implements `fmt.Stringer`). Sensitive headers are automatically masked; the response body content is **never included** — only its size in bytes is reported (`Body: [N bytes omitted]`), preventing credentials and session data from leaking into logs. A nil Result, or one without a response, yields `Result{}`.

The masked headers are `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-Auth-Token`, and `Proxy-Authorization`, shown in the header list as `Name: ***`.

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
| `RequestMeta.ProxyURL` | Proxy URL actually used by the final attempt (`Connection.ProxyURL` or the selected proxy-pool entry); empty for direct connections, and system proxies (`EnableSystemProxy`) are likewise not recorded (still empty) — configure `Connection.ProxyURL` or `ProxyPool` explicitly when you need to observe the egress per request. With proxy rotation each retry may use a different proxy; this field reports the one that produced the returned response |
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
