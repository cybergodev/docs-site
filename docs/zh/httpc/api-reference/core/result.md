---
sidebar_label: "Result"
title: "Result - CyberGo HTTPC | Result 响应类型"
description: "HTTPC Result 响应类型 API 参考：StatusCode/Body 基础方法、状态判断、Cookie 操作、Unmarshal JSON 解析、SaveToFile 文件保存与 RequestInfo/ResponseInfo 子类型。"
sidebar_position: 3
---

# Result

Result 封装 HTTP 响应和请求元数据，提供便捷的访问方法。通过 `Client.Request()` 或包级函数获取。

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
Result 每次请求新建，GC 自动回收，无需手动释放。
:::

## 基础方法

### StatusCode

```go
func (r *Result) StatusCode() int
```

返回 HTTP 状态码。nil 安全，返回 0。

### Body

```go
func (r *Result) Body() string
```

返回响应体字符串。nil 安全，返回空字符串。

### RawBody

```go
func (r *Result) RawBody() []byte
```

返回响应体原始字节。nil 安全，返回 nil。

### Proto

```go
func (r *Result) Proto() string
```

返回 HTTP 协议版本，如 `"HTTP/1.1"`、`"HTTP/2.0"`。

## 状态判断

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

状态码 2xx 返回 true。

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

状态码 3xx 返回 true。

### IsClientError

```go
func (r *Result) IsClientError() bool
```

状态码 4xx 返回 true。

### IsServerError

```go
func (r *Result) IsServerError() bool
```

状态码 5xx 返回 true。

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

## Cookie 方法

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

返回响应中的所有 Cookie。

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

按名称获取响应 Cookie，未找到返回 nil。

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

检查响应中是否存在指定名称的 Cookie。

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

返回请求中发送的所有 Cookie。

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

按名称获取请求 Cookie。

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

检查请求中是否存在指定名称的 Cookie。

## JSON 解析

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

将 JSON 响应体解析到目标变量。遵循 `json.Unmarshal` 约定。

| 错误 | 触发条件 |
|------|----------|
| `ErrResponseBodyEmpty` | 响应体为空 |
| `ErrResponseBodyTooLarge` | 响应体超过 50MB JSON 解析大小限制 |

```go
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}
fmt.Println(user.Name)
```

## 文件保存

### SaveToFile

```go
func (r *Result) SaveToFile(filePath string) error
```

将响应体保存到文件。文件路径经过安全验证（路径遍历防护、符号链接检查、系统路径保护）。

| 错误 | 触发条件 |
|------|----------|
| `ErrResponseBodyEmpty` | 响应体为空 |

```go
result, _ := client.Get("https://example.com/data.csv")

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## 字符串表示

### String

```go
func (r *Result) String() string
```

返回人类可读的字符串表示。敏感头部自动脱敏，响应体截断至 200 字符。

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
```

## 子类型

### RequestInfo

```go
type RequestInfo struct {
    URL     string
    Method  string
    Headers http.Header
    Cookies []*http.Cookie
}
```

请求详情。通过 `result.Request` 访问。

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

响应数据。通过 `result.Response` 访问。

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

请求执行元数据。通过 `result.Meta` 访问。

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2（重试了 1 次）
fmt.Println(result.Meta.RedirectCount)  // 1（跟随了 1 次重定向）
```

## 另见

- [包函数](./functions) - 获取 Result 的请求方法
- [请求选项](./options) - 配置请求行为
- [文件下载](../client-config/download) - 下载结果类型 DownloadResult
