---
title: 速查表 - HTTPC
description: HTTPC 速查表，涵盖客户端创建、七种 HTTP 方法、请求选项、响应处理、配置预设、中间件与错误类型的快速参考。
---

# 速查表

## 创建客户端

```go
// 默认配置
client, _ := httpc.New()
defer client.Close()

// 自定义配置
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

## HTTP 方法

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

### 查询参数

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
```

### 认证

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookie

```go
httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"})
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig())
```

### 控制

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithMaxRetries(3)
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(5)
httpc.WithStreamBody(true)
```

### 回调

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("发送 %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("收到响应: %d", resp.StatusCode())
    return nil
})
```

## 响应处理

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
httpc.ReleaseResult(result)            // 释放到对象池
```

## 配置

```go
cfg := httpc.DefaultConfig()

// 超时
cfg.Timeouts.Request = 30 * time.Second
cfg.Timeouts.Dial = 10 * time.Second
cfg.Timeouts.TLSHandshake = 10 * time.Second
cfg.Timeouts.ResponseHeader = 30 * time.Second
cfg.Timeouts.IdleConn = 90 * time.Second

// 连接
cfg.Connection.MaxIdleConns = 50
cfg.Connection.MaxConnsPerHost = 10
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// 安全
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}

// 重试
cfg.Retry.MaxRetries = 3
cfg.Retry.Delay = 1 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

## 中间件

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(log.Printf),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.TimeoutMiddleware(30 * time.Second),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
    }),
}
```

## 错误处理

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
        // 其他: ErrorTypeUnknown, ErrorTypeResponseRead,
        //       ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // 可重试
        }
    }
}
```

## 文件下载

```go
dlResult, err := client.DownloadFile(url, "/path/to/file")

// 带选项
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%s/s)", float64(downloaded)/float64(total)*100, httpc.FormatSpeed(speed))
}
dlResult, err := client.DownloadWithOptions(url, dlCfg)

// dlResult 类型为 *DownloadResult（非 *Result）
// 字段: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## 域名客户端

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```
