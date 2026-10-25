---
sidebar_label: "速查表"
title: "速查表 - CyberGo HTTPC | 常用代码速查"
description: "HTTPC 速查表：客户端创建与五种配置预设、七种请求方法、32 个 WithXxx 请求选项、Result 处理和中间件组合的常用代码片段。"
sidebar_position: 30
---

# 速查表

速查表按主题汇总 HTTPC 常用代码片段，每个小节链接到对应的详解页面。

## 创建客户端

详见 [核心概念](../getting-started/concepts)。

```go
// 默认配置
client, _ := httpc.NewDefault()
defer client.Close()

// 自定义配置
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

```go
// 预设一步到位
client, _ := httpc.New(httpc.SecureConfig())     // 安全优先：严格超时、禁重定向、5MB 上限
client, _ = httpc.New(httpc.PerformanceConfig()) // 高吞吐：大连接池、启用 Cookie
client, _ = httpc.New(httpc.TestingConfig())     // 仅测试：跳过证书校验与 SSRF（勿上生产）
client, _ = httpc.New(httpc.MinimalConfig())     // 轻量：无重试、无重定向

// 请求级默认值（User-Agent / 默认头 / 重定向策略）
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers["Authorization"] = "Bearer " + token
cfg.Security.FollowRedirects = false
cfg.Security.MaxRedirects = 5
client, _ = httpc.New(cfg)

// 管理包级默认客户端
_ = httpc.SetDefaultClient(client) // 替换默认客户端（旧的自动关闭）
_ = httpc.CloseDefaultClient()     // 关闭并重置（下次包级调用自动重建）
```

## HTTP 方法

详见 [实战教程](../guides/tutorial)。

```go
// 包级函数（使用默认客户端）
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// 实例方法
result, _ := client.Get(url)

// 带上下文
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## 请求选项

全部选项详见 [请求选项 API](../api-reference/core/options)。

### 请求头

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### 请求体

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // 文件上传
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // 指定类型
httpc.WithBody(data)                    // 自动检测类型
httpc.WithBody(data, httpc.BodyJSON)    // 显式指定：BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

`WithBody` 默认按 `BodyAuto` 自动检测类型：

- `string` → text/plain
- `[]byte` → octet-stream
- `map[string]string` → form
- `*FormData` → multipart
- `io.Reader` → 原样透传（不设 Content-Type）
- 其他类型 → JSON

### 查询参数

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
// 注意：value 为 nil 时该参数不会出现在 URL 中
```

### 认证

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookie

```go
httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}) // 单个 Cookie：单元素切片
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()) // 须放在所有 Cookie 添加选项之后
```

### 控制

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithNoTimeout()            // 解除客户端默认整体超时（显式 WithTimeout 与 ctx 截止仍生效）
httpc.WithMaxRetries(3)          // 0 禁用重试；上限 10
httpc.WithRetryNonIdempotent(true) // 允许重试 POST/PATCH 等非幂等请求（请求级双向覆盖客户端策略；警惕重复提交副作用，如重复支付）
httpc.WithFollowRedirects(false) // 禁止跟随重定向
httpc.WithMaxRedirects(5)        // 注意：0 等同未设置（回退默认 10），禁用跟随请用上一行
httpc.WithStreamBody(true)       // 仅对 Download 生效（普通请求用它会以 ErrStreamBodyRequiresDownload 失败）
httpc.WithAllowPrivateIPs(true)  // 按请求豁免 SSRF（访问内网/localhost）
```

### 包级路由（仅包级函数）

```go
httpc.WithProxy("http://127.0.0.1:7890")  // 本次调用走该代理
httpc.WithSystemProxy()                   // 本次调用读取系统/环境变量代理
httpc.WithTLSFingerprint("chrome-windows") // 本次调用使用浏览器 TLS 指纹
```

在显式 `Client` 实例上使用这三个选项会返回错误，实例场景改用 `Config.Connection.ProxyURL` / `EnableSystemProxy` / `Security.TLSFingerprint`（见[请求选项](../api-reference/core/options)）。

### 回调

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("发送 %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("收到响应：%d", resp.StatusCode())
    return nil
})
```

## 响应处理

详见 [Result API](../api-reference/core/result)。

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // JSON 解析
result.GetCookie("name")               // 获取响应 Cookie
result.HasCookie("name")               // 检查响应 Cookie
result.ResponseCookies()               // 所有响应 Cookie
result.RequestCookies()                // 所有请求 Cookie
result.GetRequestCookie("name")        // 获取请求 Cookie
result.HasRequestCookie("name")        // 检查请求 Cookie
result.SaveToFile("/path/to/file")     // 保存到文件
result.String()                        // 人类可读表示（敏感头部脱敏）
```

```go
// 元信息（result.Meta）
result.Meta.Duration       // 总耗时（含重试等待）
result.Meta.Attempts       // 尝试次数（含首次）
result.Meta.RedirectChain  // 经过的重定向 URL 链
result.Meta.RedirectCount  // 重定向次数
result.Meta.ProxyURL       // 最终请求使用的代理（直连或系统代理为空）

// 结构体字段（优先用上面的 nil 安全方法）
result.Request.URL            // 请求 URL
result.Request.Method         // 请求方法
result.Request.Headers        // 请求头
result.Response.Status        // "200 OK"
result.Response.Headers       // 响应头（http.Header）
result.Response.ContentLength // Content-Length
```

## 配置

全部字段详见 [配置 API](../api-reference/client-config/config)。

```go
cfg := httpc.DefaultConfig()

// 超时
cfg.Timeouts.Request = 30 * time.Second        // 整体预算（含重试），默认 180s
cfg.Timeouts.Dial = 10 * time.Second           // TCP 连接，默认 10s
cfg.Timeouts.TLSHandshake = 10 * time.Second   // TLS 握手，默认 10s
cfg.Timeouts.ResponseHeader = 30 * time.Second // 默认 0（关）；设置后为传输层硬上限，无法被 WithTimeout 覆盖
cfg.Timeouts.IdleConn = 90 * time.Second       // 空闲连接，默认 90s

// 连接
cfg.Connection.MaxIdleConns = 50        // 全局空闲连接上限（默认 50，上限 1000）
cfg.Connection.MaxConnsPerHost = 10     // 每主机连接上限（默认 10，上限 1000）
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// 代理池（轮换 + 被动熔断）
cfg.Connection.ProxyPool = []string{"http://p1:8080", "http://p2:8080"}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin // 或 ProxyStrategyRandom
cfg.Connection.ProxyFailureThreshold = 3   // 连续失败 N 次临时摘除（默认 3）
cfg.Connection.ProxyCooldown = 30 * time.Second // 摘除后的半开探活冷却（默认 30s）
cfg.Connection.ProxyRotatePerRequest = true     // 每个请求换 IP（牺牲连接复用）
cfg.Connection.ProxyRotateOnStatus = []int{403} // 命中状态码换代理重试（需 MaxRetries > 0）

// DNS-over-HTTPS
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // 默认 5 分钟

// 安全
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024   // 默认 10MB
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024 // 默认 100MB（防解压炸弹）
cfg.Security.MaxRequestBodySize = 50 * 1024 * 1024    // 默认 0（不限制上传）
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
cfg.Security.RedirectWhitelist = []string{"api.example.com"} // 重定向目标白名单

// 证书锁定（防 MITM，即使受信 CA 被攻破）
pinner, _ := httpc.NewSPKIHashPinner("base64-spki-sha256-hash", "backup-hash") // 多哈希支持轮换
cfg.Security.CertificatePinner = pinner

// 重试
cfg.Retry.MaxRetries = 3              // 默认 3；0 禁用；上限 10
cfg.Retry.Delay = 1 * time.Second     // 初始延迟，默认 1s
cfg.Retry.BackoffFactor = 2.0         // 退避倍数，默认 2.0（范围 1.0–10.0）
cfg.Retry.MaxRetryDelay = 30 * time.Second // 单次等待上限，默认 30s
cfg.Retry.EnableJitter = true         // 抖动，默认开
cfg.Retry.CustomPolicy = myPolicy     // 自定义策略（实现 ShouldRetry/GetDelay/MaxRetries）
```

## 中间件

详见 [中间件链](../guides/middleware-chain)。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}),
    httpc.MetricsMiddleware(&httpc.MetricsConfig{
        OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
            metrics.Record(method, statusCode, duration)
        },
    }),
    httpc.AuditMiddleware(&httpc.AuditConfig{
        OnAudit: func(event httpc.AuditEvent) {
            log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
        },
    }),
    httpc.HeaderMiddleware(&httpc.HeaderConfig{ // 静态头（创建期校验 CRLF）
        Headers: map[string]string{"X-Service": "api"},
    }),
}
```

```go
// 自定义中间件：请求阶段在 next 之前（按注册顺序），响应阶段在 next 之后（逆序）
func traceMiddleware(next httpc.Handler) httpc.Handler {
    return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
        req.SetHeader("X-Trace", "on") // 请求阶段
        resp, err := next(ctx, req)    // 交给内层
        if resp != nil {
            log.Printf("-> %d", resp.StatusCode()) // 响应阶段
        }
        return resp, err
    }
}
// 注册：cfg.Middleware.Middlewares = append(cfg.Middleware.Middlewares, traceMiddleware)
// 组合：httpc.Chain(mw1, mw2)(finalHandler)
```

:::warning 注意
`TimeoutMiddleware` 不适用于 `Download` 或 `WithStreamBody(true)` 请求：中间件在请求进入时即拒绝流式请求，返回 `TimeoutMiddleware is incompatible with streaming responses`。此类场景改用 `WithTimeout`。
:::

## 错误处理

详见 [错误处理](../guides/error-handling)。

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // 超时
        case httpc.ErrorTypeNetwork:
            // 网络错误
        case httpc.ErrorTypeTLS:
            // TLS 错误
        case httpc.ErrorTypeDNS:
            // DNS 解析错误
        case httpc.ErrorTypeContextCanceled:
            // 上下文取消
        case httpc.ErrorTypeRetryExhausted:
            // 重试耗尽
        case httpc.ErrorTypeValidation:
            // 请求验证错误
        case httpc.ErrorTypeHTTP:
            // HTTP 层错误
        // 其他：ErrorTypeUnknown, ErrorTypeResponseRead,
        //       ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // 可重试
        }
    }
}
```

```go
// 错误短码（ClientError.Code()）
switch clientErr.Code() {
case "TIMEOUT":           // 超时
case "NETWORK_ERROR":     // 网络错误
case "TLS_ERROR":         // TLS 握手/协议错误
case "CERTIFICATE_ERROR": // 证书校验错误
case "DNS_ERROR":         // DNS 解析错误
case "CONTEXT_CANCELED":  // 上下文取消
case "RETRY_EXHAUSTED":   // 重试耗尽
case "VALIDATION_ERROR":  // 请求校验错误（CRLF/非法头等）
case "HTTP_ERROR":        // HTTP 层错误
case "TRANSPORT_ERROR", "RESPONSE_READ_ERROR", "UNKNOWN_ERROR":
}

// 哨兵错误（errors.Is）
errors.Is(err, httpc.ErrClientClosed)         // 使用已关闭的客户端
errors.Is(err, httpc.ErrResponseBodyEmpty)    // Unmarshal 空响应体
errors.Is(err, httpc.ErrResponseBodyTooLarge) // 解析体超 50MB
errors.Is(err, httpc.ErrFileExists)           // 下载目标已存在且未开 Overwrite/Resume
errors.Is(err, httpc.ErrEmptyFilePath)        // DownloadConfig.FilePath 未设置

// 重试性速判
// 恒可重试：超时、传输错误
// 视原因：网络错误、DNS（临时/超时）、HTTP 408/429/500/502/503/504
// 恒不可重试：上下文取消、校验错误、TLS、证书错误
```

## 文件下载

详见 [文件传输](../guides/file-transfer)。

```go
// 基本下载（ctx 为 context.Context，如 context.Background()）
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlResult, err := client.Download(ctx, url, dlCfg)

// 带选项（覆盖、续传、进度）
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%.2f MB/s)", float64(downloaded)/float64(total)*100, float64(speed)/1024/1024)
}
dlResult, err := client.Download(ctx, url, dlCfg)

// 校验和验证（下载完成后校验，不匹配则失败并删除文件）
dlCfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
dlCfg.ChecksumAlgorithm = httpc.ChecksumSHA256 // 目前仅支持 sha256

// 包级下载（使用默认客户端）
dlResult, err := httpc.Download(ctx, url, dlCfg)

// dlResult 类型为 *DownloadResult（非 *Result）
// 字段：FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## 域名客户端

详见 [域名客户端与会话](../guides/domain-session)。

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```

```go
// 会话头 / Cookie 管理
dc.SetHeaders(map[string]string{"Authorization": "Bearer " + token, "Accept": "application/json"})
dc.DeleteHeader("Authorization")
dc.ClearHeaders()
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc"}) // 响应 Set-Cookie 也会自动写入会话
dc.GetCookie("session")
dc.ClearCookies()
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"
dc.Session() // *SessionManager（线程安全）

// URL 拼接：相对路径基于 base；完整 URL 直接使用；逃出 base 路径会报错
result, _ = dc.Get("/repos/golang/go")       // https://api.example.com/repos/golang/go
result, _ = dc.Get("https://other.host/api") // 直通

// 会话管理器也可单独使用
sm, _ := httpc.NewSessionManagerDefault()
sm.SetHeader("X-App", "demo")
sm.UpdateFromResult(result) // 从响应提取 Set-Cookie
```

:::warning 选项只执行一次，会话捕获是静态的
`DomainClient` 的请求选项只执行一次。会话捕获由 `SessionManager` 静态完成：只识别 `WithHeader`/`WithHeaderMap`/`WithCookies`/`WithCookieMap`/`WithCookieString`，其头与 Cookie 会持久化进会话；自定义 `RequestOptionFunc` 里的 `SetHeader`/`SetCookies` 不会被捕获，需改用 `dc.SetHeader`/`dc.SetCookie`。
:::

## 场景速配

更多组合场景见 [实战教程](../guides/tutorial)。

```go
// 请求级超时（覆盖实例配置）
result, err := client.Get(url, httpc.WithTimeout(30*time.Second))

// 长响应接口（AI/大模型 API）：整体超时默认 180s，可放宽
result, err := httpc.Post(url,
    httpc.WithJSON(payload),
    httpc.WithTimeout(900*time.Second),
)

// 禁用本次重试 / 提高重试上限
httpc.WithMaxRetries(0)
httpc.WithMaxRetries(5)

// 禁止重定向 / 限制次数
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(3)

// 访问内网服务（按请求豁免 SSRF）
result, err := httpc.Get("http://10.0.0.5:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// 取消与截止控制
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// 上传 JSON + 认证 + 超时一步到位
result, err := httpc.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithBearerToken(token),
    httpc.WithTimeout(15*time.Second),
)
```
