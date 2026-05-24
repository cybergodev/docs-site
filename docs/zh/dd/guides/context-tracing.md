---
title: "分布式追踪集成 - CyberGo DD | Context 与追踪指南"
description: "CyberGo DD 分布式追踪集成指南，涵盖 TraceID、SpanID、RequestID 上下文传播、ContextExtractor 自定义提取器、HTTP 中间件集成模式、请求作用域日志以及与 OpenTelemetry 等追踪系统的集成方式，帮助开发者在微服务架构中实现端到端日志追踪。"
---

# 分布式追踪集成

DD 支持通过 `context.Context` 自动传播追踪标识（TraceID、SpanID、RequestID），在微服务架构中实现端到端的日志关联。

## 上下文键

DD 预定义三种上下文键：

| 键 | 说明 | 用途 |
|-----|------|------|
| `ContextKeyTraceID` | 追踪 ID | 跨服务追踪，关联一次完整请求链路 |
| `ContextKeySpanID` | Span ID | 服务内操作追踪 |
| `ContextKeyRequestID` | 请求 ID | 单次请求唯一标识 |

## 基本用法

### 设置和获取

```go
ctx := context.Background()

// 设置追踪标识
ctx = dd.WithTraceID(ctx, "trace-abc123")
ctx = dd.WithSpanID(ctx, "span-def456")
ctx = dd.WithRequestID(ctx, "req-789")

// 获取追踪标识
traceID := dd.GetTraceID(ctx)    // "trace-abc123"
spanID := dd.GetSpanID(ctx)      // "span-def456"
requestID := dd.GetRequestID(ctx) // "req-789"
```

### 自动提取到日志

:::warning 当前限制
DD 的日志方法（`Info`、`InfoWith` 等）不直接接受 `context.Context` 参数。上下文提取器在内部使用 `context.Background()` 调用，因此无法直接从请求作用域的 context 中获取 TraceID 等值。推荐使用手动传递字段的方式（见下方 HTTP 中间件集成）。
:::

```go
// 上下文提取器用于配置中预设的静态上下文字段
// 注意：由于日志方法不接受 context，提取器中的 GetTraceID 等函数
// 无法获取请求作用域的 context 值

// 推荐方式：使用 WithFields 手动传递追踪字段
reqLog := logger.WithFields(
    dd.String("trace_id", traceID),
    dd.String("request_id", requestID),
)
reqLog.Info("处理请求")
```

## HTTP 中间件集成

### 基本追踪中间件

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // 从请求头提取或生成追踪标识
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            // 注入到 context
            ctx := r.Context()
            ctx = dd.WithTraceID(ctx, traceID)
            ctx = dd.WithRequestID(ctx, requestID)

            // 创建请求作用域的日志 Entry
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // 将 Logger 传递给处理器（使用自定义类型键避免冲突）
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("请求完成",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### 完整的请求追踪示例

```go
package main

import (
    "context"
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 从 context 获取追踪信息
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("查询用户",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // 业务逻辑...

    h.log.InfoWith("查询完成",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor 自定义提取器

`ContextExtractor` 可用于从 context 中提取字段。注意：由于日志方法不接受 context 参数，提取器在内部以 `context.Background()` 调用，适用于以下场景：

- 从全局 context 或 goroutine-local 存储提取静态字段
- 结合 HTTP 中间件手动将追踪字段传递给 `WithFields`

### 推荐模式：中间件 + WithFields

```go
// HTTP 中间件中手动传递追踪字段
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            // 将追踪字段注入请求作用域日志
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("path", r.URL.Path),
            )

            next.ServeHTTP(w, r)
            reqLog.Info("请求完成")
        })
    }
}
```

## 微服务间传播

在微服务调用中，追踪标识通过 HTTP 头传播：

```go
// 发送端：将追踪标识注入请求头
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

    // 传播追踪标识
    if traceID := dd.GetTraceID(ctx); traceID != "" {
        req.Header.Set("X-Trace-ID", traceID)
    }
    if reqID := dd.GetRequestID(ctx); reqID != "" {
        req.Header.Set("X-Request-ID", reqID)
    }

    return http.DefaultClient.Do(req)
}
```

## 请求作用域日志模式

```go
type RequestLogger struct {
    log    *dd.LoggerEntry
    ctx    context.Context
    start  time.Time
}

func NewRequestLogger(logger *dd.Logger, r *http.Request) *RequestLogger {
    ctx := r.Context()
    ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))
    ctx = dd.WithRequestID(ctx, r.Header.Get("X-Request-ID"))

    return &RequestLogger{
        log: logger.WithFields(
            dd.String("trace_id", dd.GetTraceID(ctx)),
            dd.String("request_id", dd.GetRequestID(ctx)),
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        ),
        ctx:   ctx,
        start: time.Now(),
    }
}

func (rl *RequestLogger) Info(msg string, fields ...dd.Field) {
    rl.log.InfoWith(msg, fields...)
}

func (rl *RequestLogger) Finish(status int) {
    rl.log.InfoWith("请求完成",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## 下一步

- [钩子系统](./hooks) -- 生命周期钩子扩展
- [审计日志](./audit-logging) -- 安全审计
- [API 参考 - Context](../api-reference/context) -- Context 完整 API
- [Web 服务示例](../examples/web-service) -- 完整 Web 服务示例
