---
sidebar_label: "请求与响应"
title: "请求与响应 - CyberGo HTTPC | 请求选项与响应"
description: "HTTPC 请求与响应完整指南：包级函数与客户端方法、WithJSON/WithForm/WithBody 请求体、WithQuery 查询参数、Cookie 与认证选项、Result 解析（Unmarshal、SaveToFile、String）、上下文控制、流式上传与响应自动解压及大小限制配置。"
sidebar_position: 3
---

# 请求与响应

## 发送请求

### 包级函数

无需创建客户端，直接发送请求：

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

支持的 HTTP 方法：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

包级函数共享一个惰性初始化的默认客户端，可用 `SetDefaultClient` 接管、`CloseDefaultClient` 释放（详见[实战教程](./tutorial)）。

### 客户端实例

```go
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

客户端实例可安全并发使用，应长驻复用；`Close()` 后再请求返回 `ErrClientClosed`。

### 通用请求方法

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

`Request` 接受任意方法字符串，适合实现通用代理/网关类逻辑；客户端方法 `client.Request` 用法相同。

## 请求选项

### 请求头

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

所有头键值都会做 CRLF 注入校验，含控制字符或超长的键值返回 `ErrInvalidHeader`。请求头的最终生效顺序：请求体 Content-Type → 客户端默认头（`Defaults.Headers`）→ 选项/中间件设置的头（后者覆盖前者同名项）。

### 请求体

```go
// JSON
result, err := client.Post(url, httpc.WithJSON(map[string]any{
    "name": "test",
}))

// XML
result, err := client.Post(url, httpc.WithXML(data))

// 表单
result, err := client.Post(url, httpc.WithForm(map[string]string{
    "username": "admin",
    "password": "secret",
}))

// 二进制（默认 application/octet-stream）
result, err := client.Post(url, httpc.WithBinary(data))
// 指定类型
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// 自动检测类型
result, err := client.Post(url, httpc.WithBody(data))
// string → text/plain; charset=utf-8, []byte → application/octet-stream,
// map[string]string → application/x-www-form-urlencoded,
// *FormData → multipart/form-data, io.Reader → passed through,
// 其他 → application/json
// 可选显式指定：httpc.WithBody(data, httpc.BodyJSON)
```

#### BodyKind 显式指定

`WithBody(data, kind)` 可跳过自动检测，强制按指定类型编码：

| BodyKind | Content-Type | 输入要求 |
|----------|--------------|----------|
| `BodyAuto`（默认） | 按输入类型自动检测 | 见下表 |
| `BodyJSON` | `application/json` | 任意可 JSON 序列化的值 |
| `BodyXML` | `application/xml` | 任意可 XML 序列化的值 |
| `BodyForm` | `application/x-www-form-urlencoded` | `map[string]string` 或 `url.Values` |
| `BodyBinary` | `application/octet-stream` | `[]byte` 或 `string`（非空） |
| `BodyMultipart` | `multipart/form-data` | `*FormData` |

`BodyAuto` 的检测规则：

| 输入类型 | Content-Type |
|----------|--------------|
| `string` | `text/plain; charset=utf-8` |
| `[]byte` | `application/octet-stream` |
| `map[string]string` | `application/x-www-form-urlencoded` |
| `*FormData` | `multipart/form-data`（含 boundary） |
| `io.Reader` | 不设置（原样透传） |
| 其他（struct/map 等） | `application/json` |

#### 表单与 multipart 上传

```go
// url.Values 表单（可携带同名字段，如 tag=go&tag=http）
values := url.Values{"tag": {"go", "http"}, "page": {"2"}}
result, err := client.Post(url, httpc.WithBody(values, httpc.BodyForm))

// multipart/form-data：字段 + 文件
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "avatar upload",
    },
    Files: map[string]*httpc.FileData{
        "avatar": {Filename: "avatar.png", Content: pngBytes},
    },
}
result, err = client.Post(url, httpc.WithFormData(form))

// 单文件快捷方式（字段名、文件名、内容；文件名会做路径清洗校验）
result, err = client.Post(url, httpc.WithFile("avatar", "avatar.png", pngBytes))
```

表单字段会逐个校验控制字符与长度（值中允许制表符）；`WithForm` 等价于 `WithBody(data, BodyForm)`，二者共用同一条「先校验后编码」路径。

#### 流式请求体（io.Reader）

```go
// io.Reader 直接透传，不设置 Content-Type（需要时自行 WithHeader）
result, err := client.Post(url,
    httpc.WithBody(io.LimitReader(file, 10<<20)), // 限制最多 10MB
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```

:::warning io.Reader 绕过体积校验
`io.Reader` 类型的请求体**不经过请求体大小校验**。读取不可信来源时务必用 `io.LimitReader` 包一层，防止内存被撑爆。
:::

### 查询参数

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)

// 或使用 Map
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
    }),
)
```

要点：
- 值支持 `string`、`bool`、`int`/`int64`、`uint` 系列、`float32`/`float64` 及实现 `fmt.Stringer` 的类型
- 值为 `nil` 时该参数**不会**出现在 URL 中（而不是渲染成字面量 `<nil>`）
- 键为空、过长或含非法字符会返回错误；URL 中已有的查询串与选项参数会合并

### 认证

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

两个选项都做格式校验：`WithBearerToken` 的 token 为空或含非法字符会报错；`WithBasicAuth` 要求用户名非空，用户名/密码超长或含非法字符会报错。

### Cookie

```go
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
)
```

批量设置用 `WithCookies` 一次传入整个切片（单次预分配、单趟校验）：

```go
result, err := client.Get(url, httpc.WithCookies([]http.Cookie{
    {Name: "session", Value: "abc"},
    {Name: "lang", Value: "zh"},
}))
```

需要对 Cookie 做安全属性校验时，`WithSecureCookie` **必须放在所有 Cookie 选项之后**——它只校验应用时已存在的 Cookie：

```go
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()), // 要求 Secure/HttpOnly/SameSite=Strict
)
```

### 请求控制

```go
// 超时
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// 重试
result, err := client.Get(url, httpc.WithMaxRetries(5))

// 重定向
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // 禁止重定向
)

// 上下文（等价于给这次请求换一个 ctx）
result, err := client.Get(url, httpc.WithContext(ctx))
```

:::tip WithMaxRedirects(0) 不是禁用
`WithMaxRedirects(0)` **不会**禁用重定向——引擎把 `0` 视为「未设置」并回退默认值 10。要完全禁用重定向跟随，请用 `WithFollowRedirects(false)`。重定向的完整控制、链追踪与域名白名单见 [重定向](./redirects)。
:::

### 回调

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("发送请求: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("收到响应：%d", resp.StatusCode())
        return nil
    }),
)
```

回调返回错误会中止请求（`OnResponse` 返回错误则整个请求失败）。多个回调按添加顺序链式执行。

:::tip 回调按「尝试」执行，中间件按「请求」执行
`WithOnRequest`/`WithOnResponse` 在引擎内部触发，**每次尝试（含重试）都会执行**；中间件链则包裹整个重试周期，一个逻辑请求只执行一次。需要每次尝试的粒度用回调，需要整请求的粒度用[中间件](./middleware-chain)。
:::

## 响应处理

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

// 状态检查
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// 读取响应
result.Body()           // 字符串
result.RawBody()        // []byte
result.Proto()          // "HTTP/1.1"

// JSON 解析
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}

// Cookie
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}

// 请求元数据
fmt.Println(result.Meta.Duration)       // 请求耗时
fmt.Println(result.Meta.Attempts)       // 重试次数
fmt.Println(result.Meta.RedirectCount)  // 重定向次数
```

### Result 能力一览

`Result` 由三部分组成：`Request`（实际发出的请求信息）、`Response`（响应数据）、`Meta`（执行元数据）。优先使用 nil 安全的访问器方法：

| 分类 | 方法 / 字段 | 说明 |
|------|-------------|------|
| 状态 | `StatusCode()` / `Proto()` / `Response.Status` | 状态码、协议版本（如 `HTTP/1.1`）、状态文本 |
| 判断 | `IsSuccess()` / `IsRedirect()` / `IsClientError()` / `IsServerError()` | 2xx / 3xx / 4xx / 5xx |
| 内容 | `Body()` / `RawBody()` / `Response.ContentLength` | 字符串体 / 原始字节 / Content-Length |
| JSON | `Unmarshal(&v)` | 空体返回 `ErrResponseBodyEmpty`；超过 50MB 返回 `ErrResponseBodyTooLarge` |
| 响应 Cookie | `GetCookie(name)` / `HasCookie(name)` / `ResponseCookies()` | 按名取 / 是否存在 / 全部响应 Cookie |
| 请求 Cookie | `GetRequestCookie(name)` / `HasRequestCookie(name)` / `RequestCookies()` | 实际随请求发出的 Cookie（含重定向后的最终值） |
| 元数据 | `Meta.Duration` / `Attempts` / `RedirectChain` / `RedirectCount` / `ProxyURL` | 耗时、尝试次数（含首次）、重定向链、本次使用的代理 |
| 文件 | `SaveToFile(path)` | 响应体写入文件（含路径穿越 / symlink 安全校验） |
| 调试 | `String()` | 脱敏摘要，敏感头打码、正文截断 200 字符 |

所有访问器都是 nil 安全的：`Result` 或内层指针为 nil 时，`StatusCode()` 返回 0、`Body()` 返回空串、判断方法返回 false，不会 panic。

### 响应头与元数据

```go
// 响应头是标准 http.Header，大小写不敏感
contentType := result.Response.Headers.Get("Content-Type")
date := result.Response.Headers.Get("Date")

// 请求侧：实际发出的头与 Cookie（重定向后为最终请求）
ua := result.Request.Headers.Get("User-Agent")
finalURL := result.Request.URL

// 代理池场景：本次请求实际使用的代理
if result.Meta.ProxyURL != "" {
    log.Printf("经由代理：%s", result.Meta.ProxyURL)
}

// 重定向链：依次经过的 URL
for i, u := range result.Meta.RedirectChain {
    log.Printf("重定向 %d: %s", i+1, u)
}
```

### 保存到文件

小响应体可直接保存（大文件请用[文件下载 API](./file-transfer)，避免整包进内存）：

```go
if err := result.SaveToFile("user.json"); err != nil {
    log.Fatal(err) // 空响应体，或路径未通过安全校验（路径穿越、symlink 等）
}
```

### 调试输出

`String()` 生成单行摘要，适合打进日志：敏感头（`Authorization`、`Cookie`、`Set-Cookie`、`X-Api-Key` 等）显示为 `***`，响应正文截断到 200 字符：

```go
fmt.Println(result.String())
// 输出示例：Result{Status: 200 200 OK, ContentLength: 5102, Duration: 150ms,
// Attempts: 1, Headers: 14 [Content-Length, Content-Type, ...], Body: {"id":...}
```

## 上下文控制

```go
// 超时控制
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// 取消控制
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // 5 秒后取消
}()
result, err := httpc.Request(ctx, "GET", url)
```

`WithTimeout` 与 context 超时的关系：`WithTimeout` 是**全部重试的总预算**，引擎会把它套在整个重试循环外层；context 取消则在传输层立即生效。

## 流式请求

与[流式响应](#流式响应)对称，上传侧同样可以流式：`WithBody` 直接接受任意 `io.Reader`，数据边生成边发送，无需先把整个请求体读入内存。本节深入其语义与陷阱；大文件上传的完整场景（分块、校验和）见[文件上传与下载](./file-transfer#流式上传-大文件)。

### io.Reader 请求体

`WithBody(reader)` 走自动检测的 `io.Reader` 分支：Reader 原样透传给传输层，**不设置 Content-Type**（需要时自行 `WithHeader`）。引擎不预读、不包装，读取节奏完全由 HTTP 传输驱动。

::: warning 注意 Reader 请求体不做大小校验
`io.Reader` 读取即消费，无法预知数据长度，因此 HTTPC 对其**不做任何大小验证**——`Security.MaxRequestBodySize` 只作用于内存型请求体（`string`、`[]byte`、`url.Values`、`*FormData`），对 `io.Reader` 一律放行。读取不可信来源时务必用 `io.LimitReader` 包一层，这是唯一的护栏。原理详见 [FAQ：io.Reader 请求体为什么不验证大小](../faq/#io-reader-请求体为什么不验证大小)。
:::

### 重试与流式的权衡

重试需要重放请求体，而 `io.Reader` 读一次就空了。引擎的实际处理方式：

| 重试配置 | 请求体行为 |
|----------|------------|
| 开启（默认 `Retry.MaxRetries = 3`） | **首次尝试之前**把 Reader 完整读入内存转为 `[]byte`，每次重试重建 Reader 重放；上限 100MB，超出返回错误（`retry not supported for streaming bodies exceeding 104857600 bytes`） |
| `WithMaxRetries(0)` | Reader 直通传输层，**零缓冲真流式**；代价是该请求不会重试 |

两个连带差异：

- **Content-Length**：缓冲路径转为 `[]byte` 后长度可知，请求携带 Content-Length；直传路径长度未知，HTTP/1.1 下自动使用 chunked 传输编码。
- **内存占用**：默认重试配置下，即使首次尝试就成功，请求体也已完整进了内存——此时的「流式」只是省掉手动拼接 `[]byte`，并非零拷贝。要真正的边生成边发送，必须 `WithMaxRetries(0)`。

### WithStreamBody 与请求体无关

`WithStreamBody(true)` 的名字容易误以为是请求体流式开关，实际它是**响应侧**机制：跳过响应体的内存缓冲，由文件下载 API 内部使用。它不影响请求体的处理方式，也不改变上面的重试缓冲行为——请求体是否流式只取决于「是否传 `io.Reader`」与「是否开启重试」。详见下文[流式响应](#流式响应)。

### io.Pipe 零拷贝上传

`io.Pipe` 把「生成数据」与「发送数据」接到同一条管道上：生产者 goroutine 边生成边写入，HTTP 传输层并发消费，全链路没有中间缓冲。典型场景——压缩流直接上传，不落盘 `.gz` 中间文件：

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

	// 生产者：边读文件边压缩写入管道
	go func() {
		_, copyErr := io.Copy(gw, file)
		if closeErr := gw.Close(); closeErr != nil && copyErr == nil {
			copyErr = closeErr
		}
		pw.CloseWithError(copyErr) // copyErr 为 nil 时等价于 Close
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// 消费者：HTTP 传输层直接从管道读取
	result, err := httpc.Request(ctx, "POST", "https://api.example.com/upload",
		httpc.WithBody(pr),
		httpc.WithMaxRetries(0), // 真流式：禁用重试，避免引擎缓冲整个请求体
		httpc.WithHeader("Content-Type", "application/gzip"),
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode(), result.Meta.Attempts)
	// 输出：200 1
}
```

要点：

- 生产者的任何错误都要经 `pw.CloseWithError` 传给消费者，否则对端只会看到 EOF，坏数据会被当成完整上传
- `io.Pipe` 无法重放，天然适合搭配 `WithMaxRetries(0)`；若必须重试，就得换缓冲方案（如先落盘再上传）
- 服务端按 `Content-Type: application/gzip` 逐块收到压缩数据，接收方流式解压即可，两端都不需要完整缓冲

## 流式响应

`WithStreamBody(true)` 是内部机制，用于文件下载时避免将完整响应体缓存到内存。启用后响应体不会被读取到 `Result` 中（`Body()` 和 `RawBody()` 返回空值）。

:::warning
`WithStreamBody(true)` 由文件下载 API 内部使用。如需流式获取响应内容，请使用[文件下载 API](./file-transfer)。
:::

如需下载大文件，请使用下载 API：

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.Download(context.Background(), url, cfg)
```

## 响应解压

HTTPC 自动处理 gzip、deflate 内容编码的解压。传输层关闭了 Go 标准库的透明解压、由引擎手动处理：请求会自动携带 `Accept-Encoding: gzip, deflate`（可用 `WithHeader("Accept-Encoding", ...)` 覆盖）。

支持的编码：

| Content-Encoding | 处理方式 |
|------------------|----------|
| `gzip` / `deflate` | 自动解压（使用对象池复用解压器） |
| `br`（brotli）/ `compress`（LZW） | 不支持，返回错误 |
| `identity` / 未知编码 | 原样透传 |

可通过安全配置限制解压后大小，防止解压炸弹攻击：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // 响应体上限：流式下载时强制；非流式作为解压后上限的回退
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // 解压后最大 100MB
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MaxResponseBodySize` | 10MB | 流式下载响应体上限；非流式时作为解压后上限的回退 |
| `MaxDecompressedBodySize` | 100MB | 解压后响应体大小上限（未设置时回退 `MaxResponseBodySize`） |

压缩响应体的字节数另有 100MB 硬性上限（`maxCompressedSize`，不可配置），用于防御解压炸弹，与 `MaxResponseBodySize` 相互独立。

超过限制时返回包含 `"exceeds limit"` 信息的错误，可通过 `ClientError` 类型检查处理。`ErrResponseBodyTooLarge` 在 `Result.Unmarshal()` 解析超过 50MB JSON 大小限制的响应体时返回（独立于 `MaxResponseBodySize`）。

## 格式化工具

展示下载进度、日志体积时可用包级格式化函数（1024 进制）：

```go
fmt.Println(httpc.FormatBytes(1536))        // 输出：1.50 KB
fmt.Println(httpc.FormatBytes(1048576))     // 输出：1.00 MB
fmt.Println(httpc.FormatSpeed(1048576))     // 输出：1.00 MB/s
```

## 下一步

- [重定向](./redirects) - 跟随控制、链追踪与域名白名单
- [文件上传与下载](./file-transfer) - 大文件流式上传、下载与校验和
- [域名客户端与会话](./domain-session) - 会话管理
- [请求选项 API](../api-reference/core/options) - 完整选项参考
- [Result API](../api-reference/core/result) - 响应处理参考
