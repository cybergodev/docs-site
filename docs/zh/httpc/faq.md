---
title: 常见问题 - HTTPC
description: HTTPC 常见问题解答，涵盖包级函数选择、配置预设对比、代理设置、错误匹配、对象池管理与超时调优等高频问题。
---

# 常见问题

## 什么时候用包级函数，什么时候创建客户端？

**包级函数**适合简单场景：一次性请求、脚本、工具。

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**创建客户端**适合需要自定义配置、复用连接池、使用中间件的场景。

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## 如何选择配置预设？

| 预设 | 适用场景 |
|------|----------|
| `DefaultConfig()` | 通用场景，安全默认值 |
| `SecureConfig()` | 处理用户提供的 URL、金融/医疗场景 |
| `PerformanceConfig()` | 内部微服务通信、高并发 API |
| `TestingConfig()` | 单元测试、本地开发 |
| `MinimalConfig()` | 一次性脚本、简单 HTTP 调用 |

## 如何访问内部服务？

默认 SSRF 防护阻止私有 IP 连接。如需访问内部服务：

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // 允许所有私有 IP

// 或精确豁免
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## 如何设置代理？

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// 使用系统代理
cfg.Connection.EnableSystemProxy = true
```

## 如何处理 HTTP 错误码？

HTTPC 不会将 4xx/5xx 视为 error，需要手动检查：

```go
result, err := client.Get(url)
if err != nil {
    // 网络层错误
    return err
}

switch {
case result.IsSuccess():
    // 2xx 成功
case result.IsClientError():
    // 4xx 客户端错误
    log.Printf("请求参数错误: %d", result.StatusCode())
case result.IsServerError():
    // 5xx 服务端错误
    log.Printf("服务端故障: %d", result.StatusCode())
}
```

## 为什么需要调用 ReleaseResult？

`ReleaseResult` 将 Result 归还到对象池，减少 GC 压力。归还会对响应体整块清零以防止敏感数据残留，避免信息在对象池中泄漏。高并发场景中性能提升显著。

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// 之后不要再访问 result
```

## 如何禁用重试？

```go
// 全局禁用
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// 或使用 MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// 单个请求禁用
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## 如何设置请求超时？

四种方式，优先级从高到低：

```go
// 1. 上下文超时（推荐）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. 请求选项
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. 中间件强制超时
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. 客户端默认超时
cfg.Timeouts.Request = 30 * time.Second
```

## 如何记录请求日志？

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## TestingConfig 为什么会打印警告？

`TestingConfig` 禁用了安全特性（TLS 验证、SSRF 防护），在非测试环境使用存在安全风险。检测到非测试环境时会打印警告。

仅用于 `*_test.go` 文件或本地开发。

## 如何启用 DNS-over-HTTPS？

DoH 可以减少 DNS 解析延迟并防止 DNS 劫持：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

默认使用 Cloudflare、Google、AliDNS 三个提供商（按优先级回退）。如果所有 DoH 提供商不可用，会自动回退到系统 DNS。

:::tip
DoH 适用于对 DNS 解析安全性有要求的场景。常规 API 调用无需开启，默认 DNS 即可满足需求。
:::

## 更多资源

- [快速开始](./getting-started) - 5 分钟快速上手
- [实战教程](./guides/tutorial) - 循序渐进的完整示例
- [配置 API](./api-reference/config) - 完整配置参考
- [错误处理](./advanced/error-handling) - 错误处理指南
