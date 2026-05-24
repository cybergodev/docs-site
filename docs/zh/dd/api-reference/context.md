---
title: "上下文集成 - CyberGo DD | Context 集成"
description: "CyberGo DD 上下文集成完整 API 文档，支持 TraceID、SpanID、RequestID 自动传播与提取，提供自定义 ContextExtractor 接口实现、Context 传播配置选项和 WithContext 绑定方法，实现与 OpenTelemetry 等分布式追踪系统的无缝集成。"
---

# 上下文集成

DD 支持 Go 标准库 `context.Context` 集成，可自动传播追踪信息和提取上下文字段。

## 内置上下文键

| 函数 | 签名 | 说明 |
|------|------|------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | 添加 TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | 添加 SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | 添加 RequestID |
| `GetTraceID` | `(ctx context.Context) string` | 获取 TraceID |
| `GetSpanID` | `(ctx context.Context) string` | 获取 SpanID |
| `GetRequestID` | `(ctx context.Context) string` | 获取 RequestID |

### 使用示例

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
可通过 `ContextExtractor` 配合 `Config.ContextExtractors` 实现自动提取，提取器在每次日志调用时执行。详见下方 [ContextExtractor](#contextextractor) 章节。
:::

## ContextExtractor

上下文提取器用于从 `context.Context` 中自动提取字段。

```go
type ContextExtractor func(ctx context.Context) []Field
```

### 注册提取器

```go
// 通过 Logger 方法
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// 批量替换
logger.SetContextExtractors(extractor1, extractor2)

// 获取当前提取器
extractors := logger.GetContextExtractors()
```

## 上下文键常量

| 常量 | 类型 | 值 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 完整示例

### HTTP 中间件

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

- [Logger](./logger) -- AddContextExtractor 方法
- [接口定义](./interfaces) -- ContextExtractor 类型定义
- [结构化字段](./fields) -- Field 构造器
