---
title: "Result - CyberGo HTTPC | Result Response Type"
description: "HTTPC Result response type API reference: StatusCode/Body basic methods, status checks, cookie operations, Unmarshal JSON parsing, and SaveToFile file saving."
---

# Result

Result wraps HTTP response and request metadata, providing convenient access methods. Obtained via `Client.Request()` or package-level functions.

```go
type Result struct {
    Request  *RequestInfo
    Response *ResponseInfo
    Meta     *RequestMeta
}
```

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::tip
Result is created fresh for each request and automatically reclaimed by GC -- no manual release needed.
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

Returns the response body as a string. Nil-safe, returns empty string.

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

Gets a response cookie by name, returns nil if not found.

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
| `ErrResponseBodyTooLarge` | Response body exceeds 50MB JSON parsing size limit |

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

Saves the response body to a file. File path is security-validated (path traversal protection, symlink checking, system path protection).

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

Returns a human-readable string representation. Sensitive headers are automatically masked, response body is truncated to 200 characters.

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
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

Request details. Access via `result.Request`.

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

Response data. Access via `result.Response`.

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

Request execution metadata. Access via `result.Meta`.

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2 (retried once)
fmt.Println(result.Meta.RedirectCount)  // 1 (followed one redirect)
```

## See Also

- [Package Functions](./functions) - Request methods that return Result
- [Request Options](./options) - Configure request behavior
- [File Download](./download) - Download result type DownloadResult
