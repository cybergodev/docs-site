---
title: 中间件链 - HTTPC
description: HTTPC 中间件链指南，详解洋葱模型执行原理、八个内置中间件的功能配置、Chain 组合模式与自定义中间件编写方法。
---

# 中间件链

## 洋葱模型

HTTPC 中间件采用洋葱模型，请求从外到内，响应从内到外：

```text
请求 →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
响应 ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // 最外层：panic 恢复
    httpc.LoggingMiddleware(log.Printf), // 第二层：日志记录
    httpc.RequestIDMiddleware("X-Request-ID", nil), // 最内层：请求 ID
}

client, _ := httpc.New(cfg)
```

## 内置中间件

### RecoveryMiddleware

panic 恢复，防止进程崩溃：

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

请求/响应日志，URL 自动脱敏：

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// 输出: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

为每个请求添加唯一 ID，使用 `crypto/rand` 生成：

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // 默认 32 字符 hex

// 自定义生成器
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

中间件层超时，在客户端超时之前强制执行：

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

为所有请求添加静态头：

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

收集请求指标：

```go
httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
})
```

### AuditMiddleware

安全审计，用于金融、医疗等合规场景：

```go
httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})
```

### AuditMiddlewareWithConfig

可配置的审计中间件：

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

审计事件支持从上下文提取 SourceIP 和 UserID：

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## 手动链式组合

使用 `Chain` 函数组合中间件：

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

## 自定义中间件

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // 请求阶段：修改请求
            req.SetHeader("Origin", origin)

            // 调用下一个处理器
            resp, err := next(ctx, req)

            // 响应阶段：记录或修改响应
            if resp != nil {
                log.Printf("响应状态: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

### 短路中间件

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

## 中间件配置

```go
cfg := httpc.DefaultConfig()
cfg.Middleware = httpc.MiddlewareConfig{
    Middlewares: []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
    },
    UserAgent:       "my-app/1.0",
    Headers:         map[string]string{"X-App": "my-app"},
    FollowRedirects: true,
    MaxRedirects:    10,
}

client, _ := httpc.New(cfg)
```

## 下一步

- [中间件 API](../api-reference/middleware) - 完整中间件参考
- [重试与容错](./retry-fault-tolerance) - 重试策略指南
- [安全概述](../security/) - 审计中间件安全实践
