---
sidebar_label: "速率限制"
title: "速率限制 - CyberGo JWT | 令牌桶限流"
description: "速率限制指南：基于令牌桶配置签发接口每窗口的最大请求数，讲解限流键的 Subject、UserID 与 RateLimitKeyer 优先级、配置上界校验，并给出内置限流器容量策略与 Redis 分布式实现。"
sidebar_position: 40
---

# 速率限制

速率限制用于防止令牌签发接口被滥用（如暴力破解）。

## 工作原理

使用令牌桶算法，在指定时间窗口内限制每个 key 的最大请求数。

```text
Create(claims) → 提取限流 key → 检查 RateLimitProvider → 允许/拒绝
```

### 令牌桶算法详解

内置 [`RateLimiter`](../api-reference/types#ratelimiter) 采用令牌桶算法：每个限流 key 一个桶，令牌按经过时间比例补充，上限为 `maxRate`。补充后只推进与已补充令牌对应的时间，保留残余时间，避免实际速率偏高。

:::tip 令牌桶 vs 固定窗口
固定窗口计数器在窗口边界处会突发放行 `maxRate` 个请求（如第 59 秒放行 100 次、第 1 秒又放行 100 次，瞬间 200 次）。令牌桶按比例持续补充令牌，流量曲线更平滑，更适合 API 限流场景。
:::

算法语义与 `Allow` / `AllowN` 的完整说明见 [内置类型 → RateLimiter](../api-reference/types#ratelimiter)。

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

`EnableRateLimit = true` 时，`Config.Validate()` 会拒绝以下配置（返回 `ErrInvalidConfig`）：

| 检查 | 条件 |
|------|------|
| 负数 | `RateLimitRate < 0` 或 `RateLimitWindow < 0` |
| 次数上界 | `RateLimitRate > 1000000` |
| 窗口上界 | `RateLimitWindow > 30 天` |

:::tip 注意
限流对所有令牌签发方法生效：`Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()`。不影响 `Parse()` 和 `ParseInto()`。
:::

## 限流 Key

限流基于 key 隔离，key 的查找优先级为：

1. `RegisteredClaims.Subject` — 如果非空
2. `*Claims.UserID` — 仅对内置 Claims
3. `RateLimitKey()` — 如果实现了 [`RateLimitKeyer`](../api-reference/interfaces#ratelimitkeyer) 接口
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

## 批量检查 AllowN

[`Allow`](../api-reference/types#ratelimiter) 检查单次请求，而具体类型 [`*RateLimiter`](../api-reference/types#ratelimiter) 的扩展方法 `AllowN` 一次性判断 `n` 次请求是否可用：

```go
func (rl *RateLimiter) AllowN(key string, n int) bool
```

`AllowN` 的行为如下：

| 条件 | 返回值 |
|------|--------|
| `n < 0` | `false` |
| `n == 0` | `true` |
| `n > maxRate` | `false`（单次批量不可能超过窗口上限） |
| `key == ""` | `false` |
| 桶内令牌 ≥ `n` | `true`（消耗 `n` 个令牌） |
| 桶内令牌 < `n` | `false` |

适用场景：一次操作需要消耗多个配额（如批量签发、加权计费）时，用一次 `AllowN` 替代多次 `Allow`，既减少锁竞争又能保证原子性。

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	limiter := jwt.NewRateLimiter(100, time.Minute)
	defer limiter.Close()

	// 一次性申请 10 个配额（如批量签发 10 个令牌）
	if limiter.AllowN("user:123", 10) {
		fmt.Println("允许批量操作") // 输出：允许批量操作
	}

	// 剩余 90 个令牌，申请 95 个则拒绝
	fmt.Println(limiter.AllowN("user:123", 95)) // 输出：false
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

### 容量与驱逐

内置 `RateLimiter` 最多跟踪 10000 个不同的限流 key（`maxBuckets = 10000`），防止恶意构造海量 key 导致内存耗尽。当桶数量达到上限时，按以下策略驱逐：

1. **过期驱逐**：先清理 `lastRefill` 距今超过 2 倍窗口时间的桶（视为过期，不再活跃）。
2. **批量驱逐最旧 10%**：若仍满，则扫描所有桶，驱逐 `lastRefill` 最旧的约 10%（至少 1 个），为新 key 腾出空间。

:::tip 为什么批量驱逐
每次只驱逐 1 个桶需要每次插入都全量扫描（O(n)），而一次性驱逐约 10% 意味着后续约 1000 次插入无需再扫描。这让满容量时的单次驱逐均摊成本从 O(n) 降到约 O(n/1000)，显著减少锁持有时间。
:::

## 自定义限流器

实现 [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) 接口：

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

:::tip 关于 AllowN
接口本身只定义单次判断的 `Allow`。批量判断方法 `AllowN(key string, n int) bool` 是具体类型 [`*RateLimiter`](../api-reference/types#ratelimiter) 的扩展方法，不属于此接口。
:::

例如对接 Redis 实现分布式限流：

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

### Redis 分布式限流器示例

内置 `RateLimiter` 是进程内的，多实例部署时各实例计数独立、无法共享。以下是一个基于 Redis 的分布式限流器，使用固定窗口 + INCR 原子计数方案，适合多实例场景：

<!-- check-code: skip -->
```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
    "github.com/redis/go-redis/v9"
)

// RedisRateLimiter 基于 Redis 的分布式限流器（固定窗口 + INCR 原子计数）。
type RedisRateLimiter struct {
    client *redis.Client
    rate   int
    window time.Duration
}

func NewRedisRateLimiter(client *redis.Client, rate int, window time.Duration) *RedisRateLimiter {
    return &RedisRateLimiter{client: client, rate: rate, window: window}
}

// Allow 使用 Redis INCR 原子自增计数，首次自增时设置过期时间作为窗口。
func (r *RedisRateLimiter) Allow(key string) bool {
    ctx := context.Background()
    fullKey := "ratelimit:" + key

    count, err := r.client.Incr(ctx, fullKey).Result()
    if err != nil {
        return false // Redis 故障时拒绝，保护后端
    }
    if count == 1 {
        // 首次请求，设置窗口过期
        r.client.Expire(ctx, fullKey, r.window)
    }
    return count <= int64(r.rate)
}

// Reset 清除指定 key 的计数。
func (r *RedisRateLimiter) Reset(key string) {
    r.client.Del(context.Background(), "ratelimit:"+key)
}

// Close 释放资源（Redis 连接由调用方管理，此处为空实现）。
func (r *RedisRateLimiter) Close() {}

func main() {
    rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})

    limiter := NewRedisRateLimiter(rdb, 100, time.Minute)
    if limiter.Allow("user:123") {
        fmt.Println("允许") // 输出：允许
    }

    // 注入 JWT 配置，替换内置进程内限流器
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimiter = limiter

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()
    fmt.Println("处理器创建成功") // 输出：处理器创建成功
}
```

:::warning 注意
此示例使用固定窗口算法（Redis INCR + EXPIRE），与内置 `RateLimiter` 的令牌桶算法行为略有不同：固定窗口在边界处可能有突发，但对分布式场景足够实用。如需严格的令牌桶语义，可用 Lua 脚本实现令牌桶的补充逻辑。
:::

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
