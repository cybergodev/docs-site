---
title: "重试与容错 - HTTPC"
description: "HTTPC 重试与容错指南：默认指数退避重试策略与 RetryConfig 配置、408/429/5xx 自动重试条件、RetryPolicy 自定义接口（含内部类型限制说明）、Retry-After 响应头自动解析、退避策略选择与按请求 WithMaxRetries 控制及最佳实践。"
---

# 重试与容错

## 默认重试

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // 最多 3 次
cfg.Retry.Delay = 1 * time.Second  // 初始延迟 1s
cfg.Retry.BackoffFactor = 2.0      // 指数退避 2x
cfg.Retry.EnableJitter = true      // 启用抖动

client, _ := httpc.New(cfg)
```

默认重试延迟序列：`1s → 2s → 4s`（含随机抖动）

### 重试条件

默认情况下，以下错误会触发重试：

| 条件 | 重试 |
|------|------|
| 网络错误（连接拒绝、DNS 失败） | 是 |
| 超时错误 | 是 |
| 5xx 服务端错误（500/502/503/504） | 是 |
| 408 Request Timeout / 429 Too Many Requests | 是 |
| 其他 4xx 客户端错误 | 否 |
| 上下文取消 | 否 |
| 配置验证错误 | 否 |

## 自定义重试策略

实现 `RetryPolicy` 接口完全控制重试行为：

:::warning 内部类型
`RetryPolicy.ShouldRetry` 的 `resp` 参数类型 `ResponseReader` 为内部接口（定义在 `internal/types` 包中），外部包无法直接引用。自定义 `RetryPolicy` 必须在与 `httpc` 同一模块内的包中实现。大多数场景可通过 `RetryConfig` 字段配置满足需求。
:::

```go
// 注意：ResponseReader 是内部类型（internal/types 包）。
// 此代码仅能在 github.com/cybergodev/httpc 模块内部编译。
// 大多数用户应通过 RetryConfig 和 WithMaxRetries 配置重试。

type MyRetryPolicy struct {
    maxAttempts int
}

// 判断是否应该重试
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // 网络错误重试
    if err != nil {
        return true
    }
    // 仅 502、503、504 重试
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// 返回重试延迟
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// 最大重试次数
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// 应用自定义策略
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## 按请求控制

```go
// 单个请求重试 5 次
result, err := client.Get(url, httpc.WithMaxRetries(5))

// 禁用重试
result, err := client.Get(url, httpc.WithMaxRetries(0))

// 配合上下文超时
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-After 支持

HTTPC 自动解析服务端返回的 `Retry-After` 响应头：

```go
// 服务端返回: Retry-After: 120
// HTTPC 会等待 120 秒后重试，而不是使用指数退避延迟

// 服务端返回: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC 会等待到指定时间后重试
```

:::tip
`Retry-After` 在所有可重试的响应中生效（408、429、500、502、503、504），优先级高于指数退避延迟。
:::

## 退避策略

### 指数退避

```go
cfg.Retry.BackoffFactor = 2.0
// 延迟序列: delay, delay*2, delay*4, delay*8...
```

### 固定延迟

```go
cfg.Retry.BackoffFactor = 1.0
// 延迟序列: delay, delay, delay...
```

### 线性增长

```go
// 需要自定义 RetryPolicy 实现:
// delay * (attempt + 1)
// 详见高级示例中的自定义重试策略
```

### 随机抖动

启用抖动避免"惊群效应"：

```go
cfg.Retry.EnableJitter = true
// 在基础延迟上添加随机偏移，防止所有客户端同时重试
```

## 错误处理与重试

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

## 最佳实践

| 场景 | 建议 |
|------|------|
| API 调用 | MaxRetries=3, Delay=1s, Backoff=2.0 |
| 微服务通信 | MaxRetries=2, Delay=500ms |
| 文件下载 | MaxRetries=5, Delay=2s, Backoff=2.0 |
| 幂等操作 | 可放心重试 |
| 非幂等操作（POST） | 仅在网络错误时重试 |

:::warning
非幂等的 POST 请求默认也会重试。如需精确控制，请实现自定义 `RetryPolicy`。
:::

## 下一步

- [错误处理](../advanced/error-handling) - 完整错误处理指南
- [配置 API](../api-reference/config) - 重试配置参考
- [接口定义](../api-reference/interfaces) - RetryPolicy 接口参考
