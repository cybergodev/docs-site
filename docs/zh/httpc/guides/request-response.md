---
title: "请求与响应 - CyberGo HTTPC | 请求选项与响应"
description: "HTTPC 请求与响应处理指南：包级函数与客户端请求、WithHeader/WithJSON/WithForm 等请求选项、WithBearerToken 认证、WithQuery 查询参数、Cookie 管理、上下文控制与流式响应解压大小限制配置。"
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

### 客户端实例

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

### 通用请求方法

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

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
// 可选显式指定: httpc.WithBody(data, httpc.BodyJSON)
```

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

### 认证

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

### Cookie

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
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
    httpc.WithMaxRedirects(3),           // 最多 3 次重定向
)
```

### 回调

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("发送请求: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("收到响应: %d", resp.StatusCode())
        return nil
    }),
)
```

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

HTTPC 自动处理 gzip、deflate 等内容编码的解压。可通过安全配置限制解压后大小，防止解压炸弹攻击：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // 压缩体最大 10MB
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // 解压后最大 100MB
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MaxResponseBodySize` | 10MB | 原始响应体大小上限 |
| `MaxDecompressedBodySize` | 100MB | 解压后响应体大小上限 |

超过限制时返回包含 `"exceeds limit"` 信息的错误，可通过 `ClientError` 类型检查处理。`ErrResponseBodyTooLarge` 在 `Result.Unmarshal()` 解析超过 50MB JSON 大小限制的响应体时返回（独立于 `MaxResponseBodySize`）。

## 下一步

- [文件上传与下载](./file-transfer) - 文件传输指南
- [域名客户端与会话](./domain-session) - 会话管理
- [请求选项 API](../api-reference/options) - 完整选项参考
- [Result API](../api-reference/result) - 响应处理参考
