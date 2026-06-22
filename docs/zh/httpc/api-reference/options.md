---
title: "请求选项 - CyberGo HTTPC | WithXxx 选项"
description: "HTTPC 请求选项 API 参考：WithHeader 请求头、WithBearerToken 认证、WithJSON/WithForm 请求体、WithQuery 查询参数、Cookie 选项与 WithOnRequest/WithOnResponse 回调函数。"
---

# 请求选项

请求选项是函数式配置项，通过 `RequestOption` 类型传递给请求方法，实现细粒度的请求控制。

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

所有选项可自由组合，按传入顺序依次应用。

## 请求头

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

设置单个请求头。键和值经过安全验证（CRLF 注入防护）。

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

批量设置请求头。

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

设置 User-Agent 头。是 `WithHeader("User-Agent", ...)` 的便捷包装。

## 认证

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

设置 HTTP Basic 认证。用户名不能为空，凭据长度有限制。

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

设置 `Authorization: Bearer <token>` 头。Token 不能为空。

```go
result, err := client.Get(url,
    httpc.WithBearerToken("eyJhbGciOiJIUzI1NiIs..."),
)
```

## 请求体

### WithJSON

```go
func WithJSON(data any) RequestOption
```

设置 JSON 请求体，自动添加 `Content-Type: application/json`。

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

设置 XML 请求体，自动添加 `Content-Type: application/xml`。

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

设置 URL 编码表单请求体，自动添加 `Content-Type: application/x-www-form-urlencoded`。

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

设置 `multipart/form-data` 请求体，支持文件和字段混合上传。

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

便捷文件上传。自动构建 multipart 请求体，文件名经过路径遍历防护处理。

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

设置二进制请求体。默认 Content-Type 为 `application/octet-stream`，可自定义。

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

通用请求体设置，支持自动检测和显式指定类型。

**自动检测规则**（默认 `BodyAuto`）：

| 输入类型 | Content-Type |
|----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | 不设置（由调用方处理） |
| 其他类型 | application/json |

**显式指定类型**：

```go
// 自动检测（默认）
result, _ := client.Post(url, httpc.WithBody(data))

// 强制 JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// 强制 XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| 常量 | 含义 |
|------|------|
| `BodyAuto` | 自动检测（默认） |
| `BodyJSON` | 强制 JSON |
| `BodyXML` | 强制 XML |
| `BodyForm` | 强制表单 |
| `BodyBinary` | 强制二进制 |
| `BodyMultipart` | 强制 multipart（需要 `*FormData`） |

## 查询参数

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

设置单个查询参数。

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

批量设置查询参数。

```go
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
        "sort":  "created_at",
    }),
)
```

## Cookie

### WithCookie

```go
func WithCookie(cookie http.Cookie) RequestOption
```

添加单个 Cookie，经过安全验证。

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

批量添加 Cookie，比多次调用 `WithCookie` 更高效——预分配容量并在单次遍历中验证所有 Cookie。

```go
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err := client.Get("https://api.example.com",
    httpc.WithCookies(cookies),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

批量添加简单 Cookie。适合仅需 name-value 的场景。

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "zh",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

从原始 Cookie 头字符串添加 Cookie。

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=zh"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

强制验证请求 Cookie 的安全属性（Secure、HttpOnly、SameSite）。

```go
result, err := client.Get(url,
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## 请求控制

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

设置请求上下文，支持超时和取消。上下文不能为 nil。

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

设置单次请求超时，覆盖客户端默认超时。范围：0 到 30 分钟。

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

设置单次请求最大重试次数，覆盖客户端配置。范围：0-10。

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

控制是否跟随重定向。

```go
// 禁止跟随重定向
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

设置单次请求最大重定向次数。范围：0-50。

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

为单次请求覆盖客户端的 SSRF 策略。当 `allow` 为 `true` 时，该请求可访问 localhost 和私有/保留 IP 段（127.0.0.0/8、10.0.0.0/8、192.168.0.0/16、169.254.0.0/16 等），并可跟随到此类地址的重定向；为 `false` 时，即使客户端配置了 `Security.AllowPrivateIPs=true`，本次请求仍强制启用 SSRF 防护。

:::warning 安全提示
这是 SSRF 防护的**单次请求逃生舱**，适用于默认安全的客户端（`AllowPrivateIPs=false`）偶尔需要访问内部服务、回环地址或本地开发服务器的场景。

仅在请求 URL 可信且**非**来自不受信任的用户输入时启用。若需整客户端访问内部服务，应直接在 `Config` 上设置 `Security.AllowPrivateIPs=true`。
:::

```go
// 默认客户端阻止私有 IP；本次调用逐请求放行
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

启用流式模式，响应体不缓存到内存。内部用于文件下载，避免大文件占用内存。

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## 回调

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

注册请求发送前的回调。可链式注册多个，按添加顺序执行。回调返回错误会中止请求。

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("发送 %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

注册响应接收后的回调。可链式注册多个，按添加顺序执行。

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("收到响应: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## 另见

- [常量与类型](./constants) - BodyKind 常量和类型别名
- [接口定义](./interfaces) - RequestMutator、ResponseMutator 接口
- [请求与响应](../guides/request-response) - 请求选项使用指南
