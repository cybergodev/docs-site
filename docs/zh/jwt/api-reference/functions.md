---
sidebar_label: "包函数"
title: "包函数 - CyberGo JWT | 工厂函数与默认值"
description: "包级函数参考：New 创建并校验 Processor、DefaultConfig 与 DefaultBlacklistConfig 返回默认配置、NewNumericDate 构造时间戳、NewRateLimiter 创建令牌桶限流器。每项含完整签名、参数回退规则、默认值、使用建议与可编译示例，并说明限流器所有权。"
sidebar_position: 10
---

# 包函数

## New

```go
func New(cfg Config) (*Processor, error)
```

创建新的 JWT Processor。使用 `DefaultConfig()` 获取默认配置，修改必要字段后传入。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `cfg` | `Config` | 配置项 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `processor` | `*Processor` | JWT 处理器 |
| `err` | `error` | 配置验证失败时返回错误 |

### 示例

```go
package main

import (
	"fmt"

	"github.com/cybergodev/jwt"
)

func main() {
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	fmt.Println("Processor created successfully")
}
```

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrInvalidConfig` | 配置项不合法 |
| `ErrInvalidSecretKey` | 密钥缺失、不足 32 字节、弱密钥、类型错误或 ECDSA 曲线不匹配 |
| `ErrInvalidSigningMethod` | 不支持的签名算法 |

---

## DefaultConfig

```go
func DefaultConfig() Config
```

返回带有合理默认值的配置。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `config` | `Config` | 默认配置 |

### 默认值

| 字段 | 默认值 |
|------|--------|
| `AccessTokenTTL` | `15 * time.Minute` |
| `RefreshTokenTTL` | `7 * 24 * time.Hour` |
| `Issuer` | `"jwt-service"` |
| `SigningMethod` | `SigningMethodHS256` |
| `RateLimitRate` | `100` |
| `RateLimitWindow` | `time.Minute` |
| `Blacklist` | `DefaultBlacklistConfig()` |

### 示例

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 根据需要修改其他字段
```

---

## DefaultBlacklistConfig

```go
func DefaultBlacklistConfig() BlacklistConfig
```

返回带有合理默认值的黑名单配置。自定义黑名单参数的常见做法是：先取默认值，再覆盖需要调整的字段，最后赋给 [`Config.Blacklist`](./config#blacklistconfig)。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `config` | `BlacklistConfig` | 默认黑名单配置 |

### 默认值

| 字段 | 默认值 |
|------|--------|
| `CleanupInterval` | `5 * time.Minute` |
| `MaxSize` | `100000` |
| `EnableAutoCleanup` | `true` |

### 示例

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	blacklist := jwt.DefaultBlacklistConfig()
	blacklist.CleanupInterval = time.Minute // 覆盖需要调整的字段，其余保留默认值

	fmt.Println(blacklist.CleanupInterval)   // 输出：1m0s
	fmt.Println(blacklist.MaxSize)           // 输出：100000
	fmt.Println(blacklist.EnableAutoCleanup) // 输出：true
}
```

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

从 `time.Time` 创建 `NumericDate`。`NewNumericDate` 常用于显式构造 [`RegisteredClaims`](./claims#registeredclaims) 的时间声明字段（如 `ExpiresAt`、`NotBefore`）。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `t` | `time.Time` | 时间值 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `date` | `NumericDate` | JWT 数字日期 |

### 示例

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	date := jwt.NewNumericDate(time.Unix(1700000000, 0))

	b, err := date.MarshalJSON()
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b)) // 输出：1700000000
}
```

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

创建令牌桶限流器。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `maxRate` | `int` | 窗口内最大请求数（≤0 时默认 100） |
| `window` | `time.Duration` | 时间窗口（≤0 时默认 1 分钟） |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `limiter` | `*RateLimiter` | 限流器实例 |

### 示例

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	limiter := jwt.NewRateLimiter(5, time.Minute)
	defer limiter.Close()

	for i := 1; i <= 6; i++ {
		fmt.Printf("第 %d 次请求：%v\n", i, limiter.Allow("tenant-a"))
	}

	// 输出：
	// 第 1 次请求：true
	// 第 2 次请求：true
	// 第 3 次请求：true
	// 第 4 次请求：true
	// 第 5 次请求：true
	// 第 6 次请求：false
}
```

### 使用建议

多数场景只需设置 [`Config.EnableRateLimit`](./config#config)，`New()` 会按 `RateLimitRate` 与 `RateLimitWindow` 构造内置限流器。以下两种情况才需要直接调用 `NewRateLimiter`：

- 需要一个独立于 Processor 的限流器；
- 需要注入 [`Config.RateLimiter`](./config#config)，替换默认实现。

::: warning 所有权
`Processor.Close` 会关闭通过 `Config.RateLimiter` 注入的限流器。不要在生命周期可能互相超越的多个 Processor 之间共享同一实例——其中一个关闭后，其余实例的 `Allow` 恒返回 `false`。
:::

`AllowN(key, n)` 是 `*RateLimiter` 的扩展方法，用于一次判断 n 次请求。`n` 为负数、或大于窗口内允许的最大请求数时返回 `false`；`n` 为 0 时返回 `true`。
