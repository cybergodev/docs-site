---
title: 错误处理 - HTTPC
description: HTTPC 错误处理指南，详解十二种 ErrorType 错误分类、ClientError 结构体字段、哨兵错误匹配与各类网络错误的最佳实践。
---

# 错误处理

## 错误分类

HTTPC 使用 `ClientError` 对错误进行分类，支持 `errors.As` 和 `errors.Is`。

### 错误类型判断

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("请求超时: %v", err)
        case httpc.ErrorTypeNetwork:
            log.Printf("网络错误: %v", err)
        case httpc.ErrorTypeDNS:
            log.Printf("DNS 解析失败: %v", err)
        case httpc.ErrorTypeTLS:
            log.Printf("TLS 错误: %v", err)
        case httpc.ErrorTypeCertificate:
            log.Printf("证书验证失败: %v", err)
        case httpc.ErrorTypeRetryExhausted:
            log.Printf("重试耗尽: %v", err)
        case httpc.ErrorTypeValidation:
            log.Printf("请求验证失败: %v", err)
        case httpc.ErrorTypeContextCanceled:
            log.Printf("请求已取消: %v", err)
        }
    }
}
```

### 可重试判断

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // 错误可重试
    log.Println("可重试错误，稍后重试")
}
```

## 期望的错误

### 错误变量匹配

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // 客户端已关闭
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // 响应体为空
}

if errors.Is(err, httpc.ErrInvalidURL) {
    // URL 格式无效
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // 请求头无效
}
```

## 重试与错误

重试配置详见 [重试与容错](../guides/retry-fault-tolerance)，这里关注重试耗尽后的错误处理：

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("重试 %d 次后仍失败", clientErr.Attempts)
        }
    }
    return err
}
```

## 上下文取消

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.Request(ctx, "GET", url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeContextCanceled {
            log.Println("请求被取消（超时或手动取消）")
        }
    }
}
```

## 错误处理最佳实践

### 1. 区分客户端错误和服务端错误

```go
result, err := client.Get(url)
if err != nil {
    // 网络层错误
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - 客户端请求有误
    log.Printf("客户端错误: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - 服务端故障
    log.Printf("服务端错误: %d", result.StatusCode())
}
```

### 2. 使用中间件统一处理

```go
recoveryMiddleware := httpc.RecoveryMiddleware()
loggingMiddleware := httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
metricsMiddleware := httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    if err != nil {
        metrics.Increment("http.errors")
    } else {
        metrics.RecordDuration("http.duration", duration)
    }
})
```

### 3. 超时分层

```go
// 客户端默认超时
cfg.Timeouts.Request = 30 * time.Second

// 中间件强制超时
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// 单个请求覆盖
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// 上下文超时（最精确）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## 下一步

- [错误类型 API](../api-reference/errors) - 错误类型和变量参考
- [重试与容错](../guides/retry-fault-tolerance) - 重试策略配置
- [中间件链](../guides/middleware-chain) - 使用中间件统一处理错误
