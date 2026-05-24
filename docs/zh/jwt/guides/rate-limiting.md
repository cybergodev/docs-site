---
title: "速率限制 - JWT"
description: "CyberGo JWT 速率限制指南：令牌桶限流配置、内置 RateLimiter、RateLimitProvider 自定义实现、限流 Key 优先级与最佳实践。"
---

# 速率限制

速率限制用于防止令牌签发接口被滥用（如暴力破解）。

## 工作原理

使用令牌桶算法，在指定时间窗口内限制每个 key 的最大请求数。

```text
Create(claims) → 提取限流 key → 检查 RateLimitProvider → 允许/拒绝
```

## 配置

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100              // 每窗口最大请求数
cfg.RateLimitWindow = time.Minute    // 时间窗口
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `EnableRateLimit` | `false` | 是否启用限流 |
| `RateLimitRate` | `100` | 窗口内最大请求数 |
| `RateLimitWindow` | `1m` | 时间窗口 |

:::tip 注意
限流对所有令牌签发方法生效：`Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()`。不影响 `Validate()` 和 `ValidateInto()`。
:::

## 限流 Key

限流基于 key 隔离，key 的查找优先级为：

1. `RegisteredClaims.Subject` — 如果非空
2. `*Claims.UserID` — 仅对内置 Claims
3. `RateLimitKey()` — 如果实现了 `RateLimitKeyer` 接口
4. 空字符串 — 跳过限流检查

### 自定义限流 Key

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// 实现 RateLimitKeyer 接口
func (c *MyClaims) RateLimitKey() string {
    return c.Email
}
```

## 内置 RateLimiter

使用 `NewRateLimiter` 创建独立的限流器：

```go
limiter := jwt.NewRateLimiter(100, time.Minute)

if limiter.Allow("user:123") {
    // 允许
} else {
    // 拒绝
}

limiter.Reset("user:123") // 重置计数
defer limiter.Close()
```

## 自定义限流器

实现 [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) 接口：

```go
type RateLimitProvider interface {
    Allow(key string) bool
    AllowN(key string, n int) bool
    Reset(key string)
    Close()
}
```

例如对接 Redis 实现分布式限流：

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

## 超出限流

当请求超出限流阈值时，令牌签发方法（`Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()`）返回 `ErrRateLimitExceeded`：

```go
token, err := processor.Create(claims)
if errors.Is(err, jwt.ErrRateLimitExceeded) {
    // 处理限流：返回 429 Too Many Requests
}
```

## 下一步

- [API 参考 → RateLimitProvider](../api-reference/interfaces#ratelimitprovider) — 接口定义
- [API 参考 → RateLimiter](../api-reference/types#ratelimiter) — 内置实现
- [基础示例](../examples/basic) — 限流示例
