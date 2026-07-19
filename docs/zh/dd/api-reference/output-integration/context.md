---
sidebar_label: "上下文集成"
title: "上下文集成 - CyberGo DD | Context 集成"
description: "CyberGo DD 上下文集成 API：通过 WithTraceID/WithSpanID/WithRequestID 注入追踪标识，ContextKey 类型安全键与 ContextExtractor 函数类型自动提取字段，支持 OpenTelemetry 等分布式追踪框架集成。"
sidebar_position: 2
---

# 上下文集成

DD 支持 Go 标准库 `context.Context` 集成，可自动传播追踪信息和提取上下文字段。

## ContextKey 类型

`ContextKey` 是基于 `string` 的自定义键类型，避免与其他包的 context 键冲突。

```go
type ContextKey string
```

预定义三个键常量，分别对应 TraceID / SpanID / RequestID：

| 常量 | 类型 | 值 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 注入与读取

| 函数 | 签名 | 说明 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | 注入 TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | 注入 SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | 注入 RequestID |
| `GetTraceID` | `(ctx context.Context) string` | 读取 TraceID（缺失返回 `""`） |
| `GetSpanID` | `(ctx context.Context) string` | 读取 SpanID（缺失返回 `""`） |
| `GetRequestID` | `(ctx context.Context) string` | 读取 RequestID（缺失返回 `""`） |

`With*` 函数基于 `context.WithValue` 派生新 ctx（键为对应 `ContextKey` 常量），`Get*` 函数从 ctx 取出 string 值；若键不存在或值非 string，统一返回空串。

### 使用示例

<!-- check-code: skip -->
```go
func handleRequest(ctx context.Context) {
    // 注入追踪信息
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // 手动提取上下文字段传入日志
    logger.InfoWith("处理请求",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip 批量提取
手动 `Get*` 适合一次性场景。如需每条日志自动带上**全局/静态**字段（如服务名、主机名），使用下方 `ContextExtractor` 注册到 Logger，提取器在每次 `*With` 调用时执行。注意：提取器接收的是 `context.Background()`，**无法**自动获取请求作用域的 TraceID（见下方限制）。
:::

## ContextExtractor

`ContextExtractor` 是从 `context.Context` 自动提取字段的函数类型，便于对接 OpenTelemetry、Jaeger 等追踪框架。

```go
type ContextExtractor func(ctx context.Context) []Field
```

提取器由 Logger 内部持有一个线程安全的注册表（`contextExtractorRegistry`，**私有，不对外暴露**）：按添加顺序执行、读取走 `atomic.Pointer` 无锁快路径；任一提取器 panic 会被 recover 并记入 stderr，不会拖垮应用。

### 注册提取器

提取器本身在此文件只定义类型；注册/管理 API 在 Logger 上（core 域）：

<!-- check-code: skip -->
```go
// 追加一个提取器（返回 error，nil 提取器会被拒绝）
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 批量替换全部提取器
_ = logger.SetContextExtractors(extractor1, extractor2)

// 读取当前已注册的提取器快照
extractors := logger.GetContextExtractors()
```

:::warning 上下文限制（重要）
日志方法（`Info`/`InfoWith` 等）不接受 `context.Context` 参数，`ContextExtractor` 内部以 `context.Background()` 调用，因此**无法自动从请求作用域提取** TraceID/SpanID。下方 OTel 示例仅在存在全局 span 时才会产出字段；要为每次请求附加追踪 ID，请用 `WithFields()` 手动传递（见[分布式追踪集成](../../guides/context-tracing)）。
:::

### OpenTelemetry 示例

<!-- check-code: skip -->
```go
// 把 OTel span 的 trace_id / span_id 注入每条日志
otelExtractor := dd.ContextExtractor(func(ctx context.Context) []dd.Field {
    span := trace.SpanFromContext(ctx)
    if !span.SpanContext().IsValid() {
        return nil
    }
    return []dd.Field{
        dd.String("trace_id", span.SpanContext().TraceID().String()),
        dd.String("span_id", span.SpanContext().SpanID().String()),
    }
})
_ = logger.AddContextExtractor(otelExtractor)
```

## 完整示例

### HTTP 中间件

<!-- check-code: skip -->
```go
func tracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        if traceID == "" {
            traceID = generateTraceID()
        }
        ctx := dd.WithTraceID(r.Context(), traceID)
        ctx = dd.WithRequestID(ctx, generateRequestID())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### gRPC 拦截器

<!-- check-code: skip -->
```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, _ := metadata.FromIncomingContext(ctx)
    ctx = dd.WithTraceID(ctx, md.Get("trace-id")[0])
    ctx = dd.WithRequestID(ctx, md.Get("request-id")[0])

    dd.InfoWith("gRPC 请求",
        dd.String("method", info.FullMethod),
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
    return handler(ctx, req)
}
```

## 下一步

- [Logger](../core/logger) -- `AddContextExtractor` / `SetContextExtractors` / `GetContextExtractors`
- [结构化字段](./fields) -- `Field` 构造器与字段校验
- [配置](../core/config) -- `Config.ContextExtractors`
