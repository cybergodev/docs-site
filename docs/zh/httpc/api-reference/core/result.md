---
sidebar_label: "Result"
title: "Result - CyberGo HTTPC | Result 响应类型"
description: "HTTPC Result 响应类型 API 参考：StatusCode/Body 等全部 17 个 nil 安全方法、状态判断、Cookie 操作、Unmarshal 解析与 SaveToFile 保存，及 RequestInfo/ResponseInfo/RequestMeta 子类型详解。"
sidebar_position: 30
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

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `Result.Request` | `*RequestInfo` | 最终发出的请求详情（含重定向后的最终形态）；nil 安全方法自动判空 |
| `Result.Response` | `*ResponseInfo` | 最终响应数据；请求出错时为 nil |
| `Result.Meta` | `*RequestMeta` | 请求执行元数据（耗时、尝试次数、代理、重定向链）；可能为 nil |

### 方法一览

全部方法均以 `*Result` 指针接收者定义，且对 nil 接收者安全（返回零值而非 panic）：

| 方法 | 签名 | 说明 |
|------|------|------|
| `Result.StatusCode` | `func (r *Result) StatusCode() int` | 返回 HTTP 状态码，nil 安全（返回 0） |
| `Result.Body` | `func (r *Result) Body() string` | 返回响应体字符串，nil 安全（返回空字符串） |
| `Result.RawBody` | `func (r *Result) RawBody() []byte` | 返回响应体原始字节，nil 安全（返回 nil） |
| `Result.Proto` | `func (r *Result) Proto() string` | 返回 HTTP 协议版本（如 `"HTTP/1.1"`） |
| `Result.IsSuccess` | `func (r *Result) IsSuccess() bool` | 状态码 2xx 时返回 true |
| `Result.IsRedirect` | `func (r *Result) IsRedirect() bool` | 状态码 3xx 时返回 true |
| `Result.IsClientError` | `func (r *Result) IsClientError() bool` | 状态码 4xx 时返回 true |
| `Result.IsServerError` | `func (r *Result) IsServerError() bool` | 状态码 5xx 时返回 true |
| `Result.Unmarshal` | `func (r *Result) Unmarshal(v any) error` | 将 JSON 响应体解析到目标变量 |
| `Result.SaveToFile` | `func (r *Result) SaveToFile(filePath string) error` | 将响应体保存到文件 |
| `Result.String` | `func (r *Result) String() string` | 返回人类可读的字符串表示（敏感头脱敏） |
| `Result.ResponseCookies` | `func (r *Result) ResponseCookies() []*http.Cookie` | 返回响应中的所有 Cookie |
| `Result.GetCookie` | `func (r *Result) GetCookie(name string) *http.Cookie` | 按名称获取响应 Cookie，未找到返回 nil |
| `Result.HasCookie` | `func (r *Result) HasCookie(name string) bool` | 检查响应中是否存在指定名称的 Cookie |
| `Result.RequestCookies` | `func (r *Result) RequestCookies() []*http.Cookie` | 返回请求中发送的所有 Cookie |
| `Result.GetRequestCookie` | `func (r *Result) GetRequestCookie(name string) *http.Cookie` | 按名称获取请求 Cookie，未找到返回 nil |
| `Result.HasRequestCookie` | `func (r *Result) HasRequestCookie(name string) bool` | 检查请求中是否存在指定名称的 Cookie |

各方法按功能分组详述如下。

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

:::tip 访问风格
优先使用 nil 安全的访问方法（`StatusCode`、`Body`、`GetCookie` 等）。`Request`/`Response`/`Meta` 三个字段导出主要是为了在测试与 mock 中直接构造 Result；对客户端返回的 Result 直接读字段前需对嵌套指针判空（请求失败时 `Response` 可能为 nil）。
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
| `ErrResponseBodyEmpty` | 响应体为空（含 Result 或 Response 为 nil 的情形） |
| `ErrResponseBodyTooLarge` | 响应体超过 50MB JSON 解析大小限制（错误信息附实际字节数） |

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

将响应体保存到文件。文件路径经过安全验证（路径遍历防护、符号链接检查、系统路径保护），文件以 `0644` 权限写入。

| 错误 | 触发条件 |
|------|----------|
| `ErrResponseBodyEmpty` | 响应体为 nil（含 Result 或 Response 为 nil 的情形） |
| 包装错误 | 路径校验失败或写入失败 |

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

`String` 返回人类可读的字符串表示（实现了 `fmt.Stringer`）。敏感头部自动脱敏；响应体**从不包含内容**，仅输出字节大小（`Body: [N bytes omitted]`），防止凭据与会话数据泄漏到日志。Result 为 nil 或无响应时返回 `Result{}`。

脱敏的头部：`Authorization`、`Cookie`、`Set-Cookie`、`X-Api-Key`、`X-Auth-Token`、`Proxy-Authorization`，在头部列表中显示为 `名称: ***`。

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `RequestInfo.URL` | `string` | 请求 URL |
| `RequestInfo.Method` | `string` | HTTP 方法 |
| `RequestInfo.Headers` | `http.Header` | 请求头 |
| `RequestInfo.Cookies` | `[]*http.Cookie` | 请求 Cookie |

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `ResponseInfo.StatusCode` | `int` | HTTP 状态码 |
| `ResponseInfo.Status` | `string` | 状态文本（如 `"200 OK"`） |
| `ResponseInfo.Proto` | `string` | HTTP 协议版本 |
| `ResponseInfo.Headers` | `http.Header` | 响应头 |
| `ResponseInfo.Body` | `string` | 响应体（字符串） |
| `ResponseInfo.RawBody` | `[]byte` | 响应体（原始字节） |
| `ResponseInfo.ContentLength` | `int64` | 响应 Content-Length |
| `ResponseInfo.Cookies` | `[]*http.Cookie` | 响应 Cookie |

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

请求执行元数据。通过 `result.Meta` 访问。

| 字段 | 说明 |
|------|------|
| `RequestMeta.Duration` | 从请求发起到响应完成的总耗时 |
| `RequestMeta.Attempts` | 含重试在内的总尝试次数 |
| `RequestMeta.ProxyURL` | 最终一次尝试实际使用的代理 URL（`Connection.ProxyURL` 或代理池选中的条目）；直连时为空字符串，系统代理（`EnableSystemProxy`）同样不记录（仍为空）——需要逐请求观测出口时请显式配置 `Connection.ProxyURL` 或 `ProxyPool`。代理轮换场景下每次重试可能换用不同代理，此字段报告产生当前响应的那一次 |
| `RequestMeta.RedirectChain` | 重定向跟随过的 URL 链 |
| `RequestMeta.RedirectCount` | 跟随的重定向次数 |

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2（重试了 1 次）
fmt.Println(result.Meta.RedirectCount)  // 1（跟随了 1 次重定向）
fmt.Println(result.Meta.ProxyURL)       // ""（直连）或 "http://proxy:8080"
```

## 完整示例

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

## 另见

- [包函数](./functions) - 获取 Result 的请求方法
- [请求选项](./options) - 配置请求行为
- [文件下载](../client-config/download) - 下载结果类型 DownloadResult
