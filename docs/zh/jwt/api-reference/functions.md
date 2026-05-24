---
title: "包函数 - JWT API 参考"
description: "CyberGo JWT 包级函数参考：New 创建 Processor、DefaultConfig 默认配置、DefaultBlacklistConfig 黑名单配置、NewNumericDate、NewRateLimiter。"
---

# 包函数

## New

```go
func New(cfg Config) (*Processor, error)
```

创建新的 JWT Processor。使用 `DefaultConfig()` 获取默认配置，修改必要字段后传入。

<Badge type="tip" text="v1.0.0+" />

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

<Badge type="tip" text="v1.0.0+" />

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

返回带有合理默认值的黑名单配置。

<Badge type="tip" text="v1.0.0+" />

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

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

从 `time.Time` 创建 `NumericDate`。

<Badge type="tip" text="v1.0.0+" />

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `t` | `time.Time` | 时间值 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `date` | `NumericDate` | JWT 数字日期 |

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

创建令牌桶限流器。

<Badge type="tip" text="v1.0.0+" />

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `maxRate` | `int` | 窗口内最大请求数（≤0 时默认 100） |
| `window` | `time.Duration` | 时间窗口（≤0 时默认 1 分钟） |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `limiter` | `*RateLimiter` | 限流器实例 |
