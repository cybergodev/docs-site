---
sidebar_label: "请求选项"
title: "请求选项 - CyberGo HTTPC | WithXxx 选项"
description: "HTTPC 请求选项 API 参考：系统梳理全部 32 个 WithXxx 函数，覆盖请求头设置、认证凭据、请求体编码、Cookie 校验、回调触发以及包级路由等场景，并逐一说明各选项覆盖的 Config 默认值与校验规则。"
sidebar_position: 20
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

## 选项总览

| 分组 | 选项 |
|------|------|
| [请求头](#请求头) | `WithHeader`、`WithHeaderMap`、`WithUserAgent` |
| [认证](#认证) | `WithBasicAuth`、`WithBearerToken` |
| [请求体](#请求体) | `WithJSON`、`WithXML`、`WithForm`、`WithFormData`、`WithFile`、`WithBinary`、`WithBody` |
| [查询参数](#查询参数) | `WithQuery`、`WithQueryMap` |
| [Cookie](#cookie) | `WithCookies`、`WithCookieMap`、`WithCookieString`、`WithSecureCookie` |
| [请求控制](#请求控制) | `WithContext`、`WithTimeout`、`WithNoTimeout`、`WithMaxRetries`、`WithRetryNonIdempotent`、`WithFollowRedirects`、`WithMaxRedirects`、`WithAllowPrivateIPs`、`WithStreamBody` |
| [包级路由](#包级路由) | `WithProxy`、`WithSystemProxy`、`WithTLSFingerprint` |
| [回调](#回调) | `WithOnRequest`、`WithOnResponse` |

部分选项可覆盖客户端配置（`Config`）中的同名默认值：

| 选项 | 覆盖的 Config 字段（默认值） |
|------|------------------------------|
| `WithUserAgent` | `Defaults.UserAgent`（`"httpc/1.0"`） |
| `WithHeader` / `WithHeaderMap` | `Defaults.Headers` 中的同名默认头 |
| `WithTimeout` | `Timeouts.Request`（180s） |
| `WithNoTimeout` | `Timeouts.Request`（解除该默认上限） |
| `WithMaxRetries` | `Retry.MaxRetries`（3） |
| `WithRetryNonIdempotent` | `Retry.RetryNonIdempotent`（false） |
| `WithFollowRedirects` | `Security.FollowRedirects`（true） |
| `WithMaxRedirects` | `Security.MaxRedirects`（10） |
| `WithAllowPrivateIPs` | `Security.AllowPrivateIPs`（false） |

:::tip
`nil` 选项被静默跳过，不会报错——便于条件拼装选项切片。任一选项返回错误都会中止请求（统一包装为 `failed to apply request option`）。
:::

## 请求头

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

设置单个请求头。键和值经过安全验证（CRLF 注入防护）：键 ≤256 字符、值 ≤8192 字符，控制字符被拒绝（返回 `ErrInvalidHeader` 包装错误）。同名默认头（`Config.Defaults.Headers`）会被覆盖。

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

批量设置请求头。逐项执行与 `WithHeader` 相同的校验，任一键值非法即报错（错误信息含出错的键名）。

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

设置 User-Agent 头。是 `WithHeader("User-Agent", ...)` 的便捷包装，覆盖 `Config.Defaults.UserAgent` 默认值（`"httpc/1.0"`）。

## 认证

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

设置 HTTP Basic 认证，生成 `Authorization: Basic <base64>` 头。用户名与密码均不能为空、≤255 字符且不含控制字符；用户名还不得包含冒号 `:`。

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

设置 `Authorization: Bearer <token>` 头。Token 不能为空、≤2048 字符、不含空格与控制字符（遵循 RFC 6750 格式约束）。

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

设置 JSON 请求体，自动添加 `Content-Type: application/json`。`data` 为 nil 时报错；等价于 `WithBody(data, BodyJSON)`。

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

设置 XML 请求体，自动添加 `Content-Type: application/xml`。`data` 为 nil 时报错；等价于 `WithBody(data, BodyXML)`。

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

设置 URL 编码表单请求体，自动添加 `Content-Type: application/x-www-form-urlencoded`。每个字段的键（≤256 字符）与值（≤8192 字符）都经过控制字符与长度校验；编码时键按字母序输出，同一输入产生确定性的请求体（利于测试与请求签名）。

仅接受 `map[string]string`；需要提交 `url.Values` 时改用 `WithBody(data, BodyForm)`（两者的校验与编码路径完全一致）。

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

设置 `multipart/form-data` 请求体，支持文件和字段混合上传。`data` 为 nil 时报错；等价于 `WithBody(data, BodyMultipart)`。

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

便捷的单文件 multipart 上传。`fieldName` 与 `filename` 不能为空、≤256 字符，且不得包含路径分隔符（`/`、`\`）、`..`、引号、尖括号等危险字符；实际使用的文件名取 `filepath.Base(filename)`（剥离路径部分，防路径遍历），结果为 `"."`/`".."`/空时报错。

:::warning 与其他请求体选项互斥
`WithFile` 会替换整个请求体：多次调用 `WithFile`、或再搭配 `WithFormData`/`WithJSON` 等请求体选项时，后应用的选项覆盖前者。需要多文件或「文件 + 字段」混合上传时，请构建单个 `*FormData` 并使用 `WithFormData`。
:::

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

设置二进制请求体。`data` 为 nil 时报错（非 nil 的空切片允许通过，但会发送空请求体）。默认 Content-Type 为 `application/octet-stream`，可通过第二个参数自定义（传空字符串回退默认值）。与 `WithBody(data, BodyBinary)` 的区别：后者还接受 `string` 输入，且会拒绝空数据。

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

**显式类型的输入约束**：

| 类型 | 输入要求 |
|------|----------|
| `BodyJSON` / `BodyXML` | 任意非 nil 数据 |
| `BodyForm` | `map[string]string` 或 `url.Values`（逐字段校验） |
| `BodyBinary` | `[]byte` 或 `string`，且非空 |
| `BodyMultipart` | `*FormData` |

类型不匹配（如 `BodyMultipart` 传入非 `*FormData`）或 `data` 为 nil 时报错。

:::warning io.Reader 不参与大小校验
`io.Reader` 请求体绕过请求体大小校验。读取不可信来源时，请用 `io.LimitReader` 包裹以防资源耗尽：

```go
limited := io.LimitReader(untrustedReader, 10<<20) // 上限 10 MB
```
:::

## 查询参数

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

设置单个查询参数。key 不能为空、≤256 字符，且不含控制字符与保留字符（`&`、`=`、`#`、`?`）；格式化后的值 ≤8192 字符。**value 为 nil 时该参数被整体跳过**（不会渲染成字面量 `<nil>`）。支持 `string`/`bool`/整数/浮点等常用类型，其余类型走通用格式化路径（如实现了 `fmt.Stringer`）。

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

批量设置查询参数。校验规则与 `WithQuery` 一致；nil 值条目被跳过；nil map 不产生任何参数。

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

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

添加一个或多个 Cookie，每个 Cookie 都经过安全验证：名称 ≤256 字符、值 ≤4096 字符，控制字符与 Cookie 非法字符被拒绝；设置 Domain（≤255）或 Path（≤1024）时也会校验。整批在单次遍历中预分配容量并完成验证。

```go
// 单个 Cookie：传单元素切片
result, err := client.Get(url,
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc123"}}),
)

// 多个 Cookie
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err = client.Get("https://api.example.com",
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

从原始 Cookie 头字符串添加 Cookie。空字符串为空操作；缺少 `=` 分隔符或 `=` 前名称为空时报错；解析出的每个 Cookie 再经过与 `WithCookies` 相同的校验。

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

:::warning 选项顺序
此选项**仅校验应用时已存在的 Cookie**。必须将 `WithSecureCookie` 放在所有 `WithCookies`/`WithCookieMap`/`WithCookieString` **之后**，否则后添加的 Cookie 不会被校验。如需不受顺序限制的会话级 Cookie 安全校验，请使用 `SessionManager.SetCookieSecurity`。
:::

```go
// 正确顺序：先添加 Cookie，再校验
result, err := client.Get(url,
    httpc.WithCookies(sessionCookies),
    httpc.WithCookieMap(otherCookies),
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## 请求控制

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

设置请求上下文，支持超时和取消。上下文不能为 nil；上下文的截止时间会覆盖该请求的客户端默认超时（`Timeouts.Request`）。

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

设置单次请求超时，覆盖 `Config.Timeouts.Request`（默认 180s，覆盖含重试在内的整段请求时长）。范围：0 到 30 分钟，越界返回 `ErrInvalidTimeout`。

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithNoTimeout

```go
func WithNoTimeout() RequestOption
```

为单次请求解除客户端级默认整体超时（`Config.Timeouts.Request`，默认 180s），让慢调用可以运行到服务端处理完毕为止。仅解除客户端默认，两项限制始终生效：同一请求上显式设置的 [`WithTimeout`](#withtimeout) 优先级更高，调用方上下文（`WithContext` 或 ctx 参数）预设的截止时间也始终被尊重。拨号/TLS/响应头等分段超时不受影响。

```go
// 解除默认 180s 上限，用于大文件上传、慢报表等长调用
result, err := client.Post(uploadURL,
    httpc.WithFile("file", "backup.tar.gz", data),
    httpc.WithNoTimeout(),
)
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

设置单次请求最大重试次数，覆盖 `Config.Retry.MaxRetries`（默认 3）。范围：0-10，越界返回 `ErrInvalidRetry`。

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithRetryNonIdempotent

```go
func WithRetryNonIdempotent(allow bool) RequestOption
```

为单次请求覆盖非幂等方法（POST、PATCH 及自定义方法）是否允许重试，**双向**覆盖客户端级 `Config.Retry.RetryNonIdempotent`（默认 false）：`true` 可在默认禁用重试的客户端上重试 POST；`false` 可在默认允许的客户端上将本次请求固定为单次执行。幂等方法（GET/HEAD 等）不受影响，[`WithMaxRetries`](#withmaxretries) 的次数上限照常适用。

:::warning 副作用风险
对非幂等请求启用重试，意味着超时或可重试 5xx 时请求体可能被发送不止一次（如重复下单、重复支付）。仅对可容忍重放的端点启用，或以幂等键（Idempotency-Key）保护。
:::

```go
// 客户端默认不重试 POST；本次调用显式允许（端点已用幂等键防重放）
result, err := client.Post(orderURL,
    httpc.WithJSON(order),
    httpc.WithMaxRetries(3),
    httpc.WithRetryNonIdempotent(true),
)
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

控制是否跟随重定向，覆盖 `Config.Security.FollowRedirects`（默认 true）。

```go
// 禁止跟随重定向
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

设置单次请求最大重定向次数，覆盖 `Config.Security.MaxRedirects`（默认 10）。范围：0-50，负数或超过 50 报错。

:::warning 0 值语义
`0` **不会**禁用重定向。引擎将 `0` 视为「未显式设置」的哨兵值，回退到默认上限（10），因此 `WithMaxRedirects(0)` 等价于省略该选项。要完全禁用重定向跟随，请改用 `WithFollowRedirects(false)`。
:::

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

为单次请求覆盖客户端的 SSRF 策略（对应 `Config.Security.AllowPrivateIPs`，默认 false）。当 `allow` 为 `true` 时，该请求可访问 localhost 和私有/保留 IP 段（127.0.0.0/8、10.0.0.0/8、192.168.0.0/16、169.254.0.0/16 等），并可跟随到此类地址的重定向；为 `false` 时，即使客户端配置了 `Security.AllowPrivateIPs=true`，本次请求仍强制启用 SSRF 防护。

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

启用流式模式，响应体不缓存到内存。

:::warning 重要限制
流式模式**仅通过 [`Download`](./functions#download) 生效**。与标准请求方法（`Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options`/`Request`）配合使用时，响应体会被完整读入并转换为 `Result`，随后底层流被关闭——返回的 `Result` 响应体为空，调用方无法消费该流。

要真正流式下载大文件而不缓存到内存，请使用 `Download`。
:::

## 包级路由

三个**包级函数专属**的路由选项：`WithProxy`、`WithSystemProxy`、`WithTLSFingerprint`。它们把一个包级调用路由到**专用客户端**（独立的连接池，继承默认客户端的安全默认值——SSRF 防护、TLS 1.2+、超时、重试），而共享默认客户端与其它在途调用不受影响。每个不同的 `(proxy, fingerprint)` 组合被缓存为各自的客户端，可用 `CloseRoutedClients` 一并关闭（详见[包级函数与客户端方法](./functions#closeroutedclients)）。

:::warning 仅包级函数
这三个选项只对包级函数（`Get`/`Post`/`Request`/`Download` 等）有意义；在显式 `Client` 实例上使用会返回错误——实例场景请改用 `Config.Connection.ProxyURL` / `Config.Connection.EnableSystemProxy` / `Config.Security.TLSFingerprint`。
:::

### WithProxy

```go
func WithProxy(proxyURL string) RequestOption
```

把本次调用路由到显式代理（支持 `http`/`https`/`socks5`/`socks5h`），优先级高于默认客户端自身的代理配置。代理 URL 可携带凭据，httpc 不会记录它们。

```go
result, err := httpc.Get("https://example.com",
    httpc.WithProxy("http://127.0.0.1:7890"),
)
```

### WithSystemProxy

```go
func WithSystemProxy() RequestOption
```

把本次调用路由到启用系统代理检测的客户端（`Connection.EnableSystemProxy`）：读取环境变量（`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`）与平台设置（Windows 注册表、macOS 系统配置），`localhost`/回环与 NO_PROXY 豁免主机按 `net/http` 语义绕过代理。未配置系统代理时直连。与 `WithProxy` 同时出现时 `WithProxy` 胜出。

```go
result, err := httpc.Get("https://example.com", httpc.WithSystemProxy())
```

### WithTLSFingerprint

```go
func WithTLSFingerprint(preset string) RequestOption
```

把本次调用路由到浏览器 TLS 指纹客户端（等价 `Config.Security.TLSFingerprint`）。值须为已知预设（大小写不敏感、自动去空白）：`chrome` / `firefox` 及其 OS/版本别名，未知预设使请求以 `ErrInvalidSecurity` 失败。完整预设清单与行为语义见 [TLS 指纹指南](../../guides/tls-fingerprint)。

```go
result, err := httpc.Get("https://example.com",
    httpc.WithTLSFingerprint("chrome-windows"),
)
```

## 回调

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

注册请求发送前的回调。可链式注册多个，按添加顺序执行。回调返回错误会中止请求；`callback` 为 nil 时报错。

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

注册响应接收后的回调。可链式注册多个，按添加顺序执行；任一回调返回错误会使请求以该错误失败；`callback` 为 nil 时报错。

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("收到响应: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## 自定义选项

### RequestOptionFunc

```go
type RequestOptionFunc func(RequestMutator) error
```

把函数字面量适配为 `RequestOption` 接口的公开适配器类型，镜像 net/http 的 Handler/HandlerFunc 拆分——`RequestOption` 的 `apply` 方法未导出，包外无法直接实现该接口，自定义逐请求选项统一经 `RequestOptionFunc` 表达，无需命名内部请求类型：

```go
result, err := client.Get(url,
    httpc.RequestOptionFunc(func(req httpc.RequestMutator) error {
        req.SetHeader("X-Custom", "value")
        return nil
    }),
)
```

nil 的 `RequestOptionFunc` 是 no-op，应用时直接跳过、不报错。

## 另见

- [常量与类型](../types/constants) - BodyKind 常量和类型别名
- [接口定义](../types/interfaces) - RequestMutator、ResponseMutator 接口
- [请求与响应变更器](../handler/mutators) - 回调中 RequestMutator/ResponseMutator 的完整读写契约
- [请求与响应](../../guides/request-response) - 请求选项使用指南
