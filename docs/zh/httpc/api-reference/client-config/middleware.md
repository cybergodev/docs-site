---
sidebar_label: "内置中间件"
title: "中间件 - CyberGo HTTPC | 七大内置中间件"
description: "HTTPC 中间件系统 API 参考：Chain 洋葱模型组合、七个内置中间件（Recovery/Logging/Timeout/Metrics/Audit 等）、各中间件配置结构体与 Default 构造函数、AuditEvent 审计事件结构。"
sidebar_position: 50
---

# 中间件

:::tip 架构总览
本页是**内置中间件参考**。Handler 管线的整体架构、洋葱模型原理与自定义中间件编写见 [处理器 / Handler 与中间件链](../handler/handler-chain)。
:::

HTTPC 采用洋葱模型中间件架构，通过 `MiddlewareFunc` 包装请求处理逻辑。

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

中间件在 `MiddlewareConfig.Middlewares` 中配置，按顺序执行。每个中间件工厂接受一个 `*XxxConfig` 配置指针，传 `nil` 时使用默认配置：

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
}
client, err := httpc.New(cfg)
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

将多个中间件组合为单个中间件。按传入顺序执行，最后一个中间件处理完后调用最终 Handler。

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
)
```

## 内置中间件

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

panic 恢复中间件。捕获处理链中的 panic，转换为包含堆栈信息的 error 返回。与客户端内置的 panic 安全网（`Request` / 下载路径）共用同一套转换逻辑，保证公共 API 不会把 panic 抛给调用方。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
}
client, _ := httpc.New(cfg)
```

### LoggingMiddleware

```go
func LoggingMiddleware(config *LoggingConfig) MiddlewareFunc
```

请求日志中间件。记录方法、URL、状态码和耗时。URL 自动脱敏（移除凭据信息）。传 `nil` 时使用 [`DefaultLoggingConfig()`](#defaultloggingconfig)（日志禁用）。

输出格式：成功时 `METHOD URL -> STATUS (DURATION)`；出错时 `METHOD URL -> error: ERR (DURATION)`。

#### LoggingConfig

```go
type LoggingConfig struct {
    // LogFunc 接收格式化日志消息（类似 log.Printf）。
    // 为 nil 时禁用日志。
    LogFunc func(format string, args ...any)
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `LoggingConfig.LogFunc` | `nil` | 日志输出函数，为 nil 时禁用日志 |

#### DefaultLoggingConfig

```go
func DefaultLoggingConfig() *LoggingConfig
```

返回日志禁用的默认配置。设置 `LogFunc` 字段以启用日志。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: log.Printf,
    }),
}
client, _ := httpc.New(cfg)
// 输出示例：GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(config *RequestIDConfig) MiddlewareFunc
```

为每个请求添加唯一 ID。传 `nil` 时使用 [`DefaultRequestIDConfig()`](#defaultrequestidconfig)（`"X-Request-ID"` 头 + `crypto/rand` 生成器）。若请求已存在同名头则保留原值不覆盖。

:::tip
默认生成器使用 `crypto/rand` 读取 16 字节并做十六进制编码（32 字符），ID 不可预测，适合安全敏感场景。
:::

#### RequestIDConfig

```go
type RequestIDConfig struct {
    // HeaderName 是请求 ID 的 HTTP 头名称。
    // 默认："X-Request-ID"。
    HeaderName string

    // Generator 生成请求 ID 字符串。为 nil 时使用加密安全的随机生成器
    //（crypto/rand，16 字节十六进制编码）。
    Generator func() string
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `RequestIDConfig.HeaderName` | `"X-Request-ID"` | 请求头名称 |
| `RequestIDConfig.Generator` | `nil`（crypto/rand） | ID 生成函数，为 nil 时使用加密安全生成器 |

#### DefaultRequestIDConfig

```go
func DefaultRequestIDConfig() *RequestIDConfig
```

返回默认配置：`HeaderName` 为 `"X-Request-ID"`，`Generator` 为 nil（运行时回退到 `crypto/rand`）。

```go
// 使用默认配置
middleware := httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig())

// 使用自定义头名
middleware := httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    HeaderName: "X-Correlation-ID",
})

// 使用自定义生成器
middleware := httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    Generator: func() string {
        return uuid.New().String()
    },
})
```

### TimeoutMiddleware

```go
func TimeoutMiddleware(config *TimeoutMiddlewareConfig) MiddlewareFunc
```

中间件级别的超时控制。传 `nil` 时使用 [`DefaultTimeoutMiddlewareConfig()`](#defaulttimeoutmiddlewareconfig)（超时禁用，中间件为透传）。若设置为正值，在客户端内置超时之前生效，超时后取消上下文并返回错误。超时上下文从**请求自身**的 `Context()` 派生（`WithContext` 预设的取消/截止会被尊重而非覆盖），派生出的 deadline 会写回请求对象传给引擎。

:::warning 不要用于 Download 或流式请求
`TimeoutMiddleware` 的 `defer cancel()` 在处理器返回（收到响应头）后立即触发，对 `Download` 或 `WithStreamBody` 请求会在读取响应体之前提前取消上下文，产生「context canceled」错误。流式/下载场景请改用 [`WithTimeout`](../core/options#withtimeout)。
:::

#### TimeoutMiddlewareConfig

```go
type TimeoutMiddlewareConfig struct {
    // Duration 是请求允许的最大时间。零或负值禁用超时（中间件原样透传请求）。
    // 默认：0（禁用）。
    Duration time.Duration
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `TimeoutMiddlewareConfig.Duration` | `0` | 超时时长，零或负值禁用 |

类型名包含 `Middleware` 以区分 `types.go` 中的客户端级 `TimeoutConfig`。

#### DefaultTimeoutMiddlewareConfig

```go
func DefaultTimeoutMiddlewareConfig() *TimeoutMiddlewareConfig
```

返回超时禁用的默认配置。设置 `Duration` 为正值以启用超时。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{
        Duration: 10 * time.Second,
    }),
}
client, _ := httpc.New(cfg)
```

### HeaderMiddleware

```go
func HeaderMiddleware(config *HeaderConfig) MiddlewareFunc
```

为每个请求添加静态请求头。传 `nil` 时使用 [`DefaultHeaderConfig()`](#defaultheaderconfig)（无头，中间件为透传）。在创建时即验证头部安全性（CRLF 注入防护）；与请求中已有的同名头冲突时会覆盖。配置 map 在创建时被**深拷贝**，之后调用方修改原 map 不影响中间件；若某个头部未通过校验，创建不会 panic，而是得到一个对每个请求都返回该校验错误的中间件。

#### HeaderConfig

```go
type HeaderConfig struct {
    // Headers 包含添加到每个请求的静态头。同键的已有头会被覆盖。
    // 头部在中间件创建时进行安全验证（CRLF 注入防护）。
    // 默认：空（无头添加，中间件为透传）。
    Headers map[string]string
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `HeaderConfig.Headers` | `nil`（空） | 静态头键值对，创建时验证安全性 |

#### DefaultHeaderConfig

```go
func DefaultHeaderConfig() *HeaderConfig
```

返回无头的默认配置。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.HeaderMiddleware(&httpc.HeaderConfig{
        Headers: map[string]string{
            "X-API-Version": "v2",
            "X-Client":      "myapp/1.0",
        },
    }),
}
client, _ := httpc.New(cfg)
```

### MetricsMiddleware

```go
func MetricsMiddleware(config *MetricsConfig) MiddlewareFunc
```

指标收集中间件。每次请求完成后调用回调，传递方法、URL、状态码、耗时和错误信息。传 `nil` 时使用 [`DefaultMetricsConfig()`](#defaultmetricsconfig)（指标禁用）。回调收到的是**脱敏后**的 URL；错误消息中若嵌有原始 URL（含凭据），同样会被替换为脱敏版本，防止指标管道泄漏凭据。

#### MetricsConfig

```go
type MetricsConfig struct {
    // OnMetrics 在每次请求完成后被调用，传入请求指标。
    // 为 nil 时禁用指标收集。
    OnMetrics func(method, url string, statusCode int, duration time.Duration, err error)
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `MetricsConfig.OnMetrics` | `nil` | 指标回调，为 nil 时禁用 |

#### DefaultMetricsConfig

```go
func DefaultMetricsConfig() *MetricsConfig
```

返回指标禁用的默认配置。设置 `OnMetrics` 字段以启用指标收集。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.MetricsMiddleware(&httpc.MetricsConfig{
        OnMetrics: func(method, url string, status int, d time.Duration, err error) {
            metrics.Record(method, status, d, err)
        },
    }),
}
client, _ := httpc.New(cfg)
```

### AuditMiddleware

```go
func AuditMiddleware(config *AuditConfig) MiddlewareFunc
```

安全审计中间件，适用于金融、医疗、政务等合规场景。记录请求/响应元信息（方法、URL、状态码、耗时、重试等），URL 自动脱敏。回调通过 `config.OnAudit` 提供；为 nil 时中间件为空操作。传 `nil` 时使用 [`DefaultAuditConfig()`](#defaultauditconfig)。

`SourceIP` 和 `UserID` 从请求上下文中通过 [`SourceIPKey`](#审计上下文键) 和 [`UserIDKey`](#审计上下文键) 提取。`Attempts`（实际尝试次数）与 `RedirectChain`（重定向链）从响应中自动提取。注意：中间件本身**不按 `Format` 分支格式化**——事件以 `AuditEvent` 结构体原样传给 `OnAudit`，`Format` 供回调方决定输出样式时读取。

#### AuditConfig

审计中间件的配置结构体，共 5 个字段：`OnAudit` 审计回调（nil 时中间件为空操作）、`Format` 输出格式提示（`"text"` / `"json"`，由回调方消费）、`IncludeHeaders` 头部记录开关、`MaskHeaders` 需脱敏的头部列表（默认六个标准敏感头，命中即替换为 `[REDACTED]`）、`SanitizeError` 错误脱敏开关。完整类型定义、逐字段说明与默认值见 [AuditConfig](../types/constants#auditconfig)。

#### DefaultAuditConfig

```go
func DefaultAuditConfig() *AuditConfig
```

返回默认审计配置：`Format` 为 `"text"`、`IncludeHeaders` 为 `false`、`MaskHeaders` 为标准敏感头部列表、`SanitizeError` 为 `true`。设置 `OnAudit` 字段以启用审计回调。

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
        event.Method, event.URL, event.StatusCode,
        event.Duration, event.UserID, event.SourceIP)
}
auditCfg.Format = "json"
auditCfg.IncludeHeaders = true

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(auditCfg),
}
client, _ := httpc.New(cfg)
```

## 审计类型

### AuditEvent

`AuditMiddleware` 在每次请求/响应周期完成后生成的安全审计事件，共 12 个字段：方法、脱敏 URL、状态码、耗时、尝试次数、重定向链与错误，以及经上下文注入的 `SourceIP`/`UserID` 和按需包含的请求/响应头。完整类型定义与逐字段明细见 [AuditEvent](../types/constants#auditevent)。

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
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"attempts":0,"durationMs":150}
```

### 审计上下文键

通过请求上下文传递审计信息：

```go
// 设置来源 IP
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// 设置用户 ID
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| 常量 | 类型 | 底层值 | 说明 |
|------|------|--------|------|
| `SourceIPKey` | `auditContextKey` | `"source_ip"` | 来源 IP 上下文键 |
| `UserIDKey` | `auditContextKey` | `"user_id"` | 用户标识上下文键 |

## 另见

- [接口定义](../types/interfaces) - MiddlewareFunc、Handler 类型定义
- [中间件链](../../guides/middleware-chain) - 中间件使用指南
- [常量与类型](../types/constants) - AuditEvent、AuditConfig 类型
