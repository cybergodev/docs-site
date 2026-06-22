---
title: "中间件 - CyberGo HTTPC | 八大内置中间件"
description: "HTTPC 中间件系统 API 参考：Chain 洋葱模型组合、八个内置中间件（Recovery/Logging/Timeout/Metrics/Audit 等）、AuditMiddlewareWithConfig 配置化审计与 AuditEvent 事件结构。"
---

# 中间件

HTTPC 采用洋葱模型中间件架构，通过 `MiddlewareFunc` 包装请求处理逻辑。

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

中间件在 `Config.Middleware.Middlewares` 中配置，按顺序执行：

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
            httpc.LoggingMiddleware(log.Printf),
            httpc.RequestIDMiddleware("X-Request-ID", nil),
        },
    },
})
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

将多个中间件组合为单个中间件。按传入顺序执行，最后一个中间件处理完后调用最终 Handler。

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
)
```

## 内置中间件

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

panic 恢复中间件。捕获处理链中的 panic，转换为包含堆栈信息的 error 返回。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
        },
    },
})
```

### LoggingMiddleware

```go
func LoggingMiddleware(log func(format string, args ...any)) MiddlewareFunc
```

请求日志中间件。记录方法、URL、状态码和耗时。URL 自动脱敏（移除凭据信息）。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.LoggingMiddleware(log.Printf),
        },
    },
})
// 输出示例: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(headerName string, generator func() string) MiddlewareFunc
```

为每个请求添加唯一 ID。默认使用 `crypto/rand` 生成 32 字符十六进制 ID。

| 参数 | 说明 |
|------|------|
| `headerName` | 请求头名称，如 `"X-Request-ID"` |
| `generator` | 自定义 ID 生成函数，传 `nil` 使用默认的加密安全生成器 |

```go
// 使用默认生成器
middleware := httpc.RequestIDMiddleware("X-Request-ID", nil)

// 使用自定义生成器
middleware := httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

:::tip
默认生成器使用 `crypto/rand`，生成的 ID 不可预测，适合安全敏感场景。
:::

### TimeoutMiddleware

```go
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc
```

中间件级别的超时控制。在客户端内置超时之前生效，超时后取消上下文并返回错误。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.TimeoutMiddleware(10 * time.Second),
        },
    },
})
```

### HeaderMiddleware

```go
func HeaderMiddleware(headers map[string]string) MiddlewareFunc
```

为每个请求添加静态请求头。在创建时即验证头部安全性（CRLF 注入防护）。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.HeaderMiddleware(map[string]string{
                "X-API-Version": "v2",
                "X-Client":      "myapp/1.0",
            }),
        },
    },
})
```

### MetricsMiddleware

```go
func MetricsMiddleware(onMetrics func(method, url string, statusCode int, duration time.Duration, err error)) MiddlewareFunc
```

指标收集中间件。每次请求完成后调用回调，传递方法、URL、状态码、耗时和错误信息。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.MetricsMiddleware(func(method, url string, status int, d time.Duration, err error) {
                metrics.Record(method, status, d, err)
            }),
        },
    },
})
```

### AuditMiddleware

```go
func AuditMiddleware(onAudit func(event AuditEvent)) MiddlewareFunc
```

安全审计中间件，适用于金融、医疗、政务等合规场景。记录完整的请求/响应信息，URL 自动脱敏。

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddleware(func(event httpc.AuditEvent) {
                log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
                    event.Method, event.URL, event.StatusCode,
                    event.Duration, event.UserID, event.SourceIP)
            }),
        },
    },
})
```

### AuditMiddlewareWithConfig

```go
func AuditMiddlewareWithConfig(onAudit func(event AuditEvent), config *AuditMiddlewareConfig) MiddlewareFunc
```

带配置的安全审计中间件。

```go
config := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
                data, _ := json.Marshal(event)
                auditLog.Write(data)
            }, config),
        },
    },
})
```

## 审计类型

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`              // 已脱敏（移除凭据）
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

安全审计事件。

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

自定义 JSON 序列化，处理两个特殊字段：

| 字段 | 转换规则 |
|------|----------|
| `Duration` | 新增 `durationMs`（毫秒整数），保留原 `duration` 字段（纳秒） |
| `Error` | 转为 `error`（错误消息字符串），nil 时省略 |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"durationMs":150,"attempts":0}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text"（默认）或 "json"
    IncludeHeaders bool     // 是否包含请求/响应头
    MaskHeaders    []string // 需要脱敏的头部名称
    SanitizeError  bool     // 是否脱敏错误信息
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| Format | `"text"` | 输出格式 |
| IncludeHeaders | `false` | 是否记录头部 |
| MaskHeaders | `["Authorization", "Cookie", ...]` | 标准敏感头部列表 |
| SanitizeError | `true` | 错误信息替换为 `[sanitized]` |

### DefaultAuditMiddlewareConfig

```go
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig
```

返回默认审计配置。

### 审计上下文键

通过请求上下文传递审计信息：

```go
// 设置来源 IP
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// 设置用户 ID
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| 常量 | 类型 | 说明 |
|------|------|------|
| `SourceIPKey` | `auditContextKey` | 来源 IP 上下文键 |
| `UserIDKey` | `auditContextKey` | 用户标识上下文键 |

## 另见

- [接口定义](./interfaces) - MiddlewareFunc、Handler 类型定义
- [中间件链](../guides/middleware-chain) - 中间件使用指南
- [常量与类型](./constants) - AuditEvent、AuditMiddlewareConfig 类型
