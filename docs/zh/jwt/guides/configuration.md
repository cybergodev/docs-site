---
sidebar_label: "配置详解"
title: "配置详解 - CyberGo JWT | 配置字段与安全加固"
description: "配置详解指南：讲解 Config 全部字段含签发者受众校验、时钟偏移容忍、强制过期、TTL 设计，以及内置输入校验的长度限制、注入模式检测与 ValidationError 错误处理。"
sidebar_position: 15
check_code: false
---

# 配置详解

[`Config`](../api-reference/config) 是 CyberGo JWT 的统一配置入口。本页聚焦签名算法之外的安全与行为配置字段；签名密钥与算法选择见 [签名算法](./signing-algorithms)。

## 配置概览

[`DefaultConfig()`](../api-reference/functions#defaultconfig) 提供合理的默认值，只需设置密钥即可使用：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `AccessTokenTTL` | 15 分钟 | 访问令牌有效期 |
| `RefreshTokenTTL` | 7 天 | 刷新令牌有效期 |
| `Issuer` | `"jwt-service"` | 写入 `iss` 声明并校验 |
| `SigningMethod` | `HS256` | 签名算法 |
| `ClockSkew` | 0 | 时钟偏移容忍 |
| `RequireExpiration` | `false` | 是否强制要求 `exp` 声明 |
| `RejectRefreshAsAccess` | `false` | 拒绝刷新令牌被用作访问令牌（v1.2.3 新增） |
| `RotateRefreshTokens` | `false` | 刷新时自动吊销旧刷新令牌，实现一次性轮换（v1.2.3 新增） |
| `ExpectedAudience` | `""`（不校验） | 预期受众 |

### normalizeConfig 自动填充规则

[`New()`](../api-reference/functions#new) 在校验前调用 `normalizeConfig`，对零值字段填充默认值。以下表格列出每条规则：

| 零值条件 | 填充的默认值 | 触发条件 |
|----------|-------------|----------|
| `AccessTokenTTL == 0` | 15 分钟 | 总是 |
| `RefreshTokenTTL == 0` | 7 天 | 总是 |
| `Issuer == ""` | `"jwt-service"` | 总是 |
| `SigningMethod == ""` | `HS256` | 总是 |
| `RateLimitRate == 0` | 100 | 仅 `EnableRateLimit == true` |
| `RateLimitWindow == 0` | 1 分钟 | 仅 `EnableRateLimit == true` |
| `Blacklist.MaxSize == 0` | 100000 | 仅内置存储（`Store == nil`） |
| `Blacklist.CleanupInterval == 0` | 5 分钟 | 仅内置存储 |
| `Blacklist.EnableAutoCleanup` | 强制 `true` | 仅内置存储 |

::: tip 何时触发速率限制默认值
`RateLimitRate` 和 `RateLimitWindow` 的默认值**仅在 `EnableRateLimit` 为 `true` 时**填充。若 `EnableRateLimit` 为 `false`（默认），速率限制不启用，这两个字段被忽略。详见 [速率限制](./rate-limiting)。
:::

::: warning 自定义 BlacklistStore 跳过填充
当 `Blacklist.Store` 不为 `nil`（使用自定义存储后端）时，`MaxSize`、`CleanupInterval`、`EnableAutoCleanup` 三个字段均被忽略——存储管理由后端自行负责。内置存储的 `EnableAutoCleanup` 被强制为 `true` 以防止无限内存增长。
:::

## 签发者与受众校验

### Issuer（签发者）

设置 `Issuer` 后，创建令牌时写入 `iss` 声明，验证时校验一致性：

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Issuer = "my-app-v1" // 令牌将携带 iss: "my-app-v1"
```

验证时，如果令牌的 `iss` 不等于配置值，返回 `ErrTokenInvalidIssuer`。

### ExpectedAudience（预期受众）

设置 `ExpectedAudience` 后，验证时检查令牌的 `aud` 声明是否包含此值：

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.ExpectedAudience = "billing-api"

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 受众匹配的令牌
    claims := &jwt.Claims{
        UserID: "user1",
        RegisteredClaims: jwt.RegisteredClaims{
            Audience: jwt.StringOrSlice{"billing-api"},
        },
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    _, err = processor.Parse(token)
    fmt.Println("Valid:", err == nil)
    // 输出：Valid: true

    // 受众不匹配的令牌会被拒绝
    wrongClaims := &jwt.Claims{
        UserID: "user2",
        RegisteredClaims: jwt.RegisteredClaims{
            Audience: jwt.StringOrSlice{"admin-api"},
        },
    }
    wrongToken, _ := processor.Create(wrongClaims)
    _, err = processor.Parse(wrongToken)
    fmt.Println("Wrong audience valid:", err == nil)
    // 输出：Wrong audience valid: false
}
```

::: tip 多服务场景
在微服务架构中，为不同服务设置不同的 `ExpectedAudience`，使一个服务签发的令牌无法被另一个服务接受，实现服务间令牌隔离。
:::

## 时钟偏移（ClockSkew）

`ClockSkew` 为 `exp`（过期）和 `nbf`（生效前）校验提供宽容窗口，容忍签发方与验证方之间的时钟漂移。偏移对称作用于两个时间声明：

- **`exp` 方向**：令牌在 `exp + ClockSkew` 之后才被视为过期——放宽过期校验
- **`nbf` 方向**：令牌在 `nbf - ClockSkew` 之前就已被视为生效——放宽生效前校验

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.ClockSkew = 30 * time.Second // 容忍 30 秒时钟偏差
```

::: warning 建议
分布式系统中，服务器间时钟可能存在数秒偏差。建议设置 `ClockSkew = 30s ~ 60s`。零值（默认）表示严格校验，不施加任何宽容。
:::

### ClockSkew 对令牌有效性的影响

以下表格展示 `ClockSkew = 30s` 时，一个 `exp = 12:00:00`、`nbf = 12:00:00` 的令牌在各验证时间点的有效性：

| 验证时间 | 与 exp 的关系 | 与 nbf 的关系 | 结果 |
|----------|--------------|--------------|------|
| `11:59:20` | 未到期 | `nbf - 40s`（超出偏移） | 无效：`ErrTokenNotValidYet` |
| `11:59:40` | 未到期 | `nbf - 20s`（偏移窗口内） | 有效 |
| `12:00:00` | 未到期 | `nbf` 时刻 | 有效 |
| `12:00:10` | `exp + 10s`（偏移窗口内） | 已生效 | 有效 |
| `12:00:40` | `exp + 40s`（超出偏移） | 已生效 | 无效：`ErrTokenExpired` |

::: tip 偏移仅放宽、不收紧
`ClockSkew` 只会扩大令牌的接受窗口，不会缩小严格校验下的窗口。零值等价于 RFC 7519 的严格语义：令牌恰好从 `nbf` 生效，恰好到 `exp` 过期。
:::

`ClockSkew` 不允许为负数，`Config.Validate()` 会返回 `ErrInvalidConfig`。

## 强制过期（RequireExpiration）

默认情况下（`RequireExpiration = false`），没有 `exp` 声明的令牌不会过期。这在 RFC 7519 中是合法的，但在安全敏感场景下可能是隐患。

设置 `RequireExpiration = true` 后，验证时拒绝缺少 `exp` 声明的令牌：

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.RequireExpiration = true // 拒绝没有 exp 的令牌
```

::: tip 安全加固
本库签发的令牌总是携带 `exp`（从 TTL 派生），因此 `RequireExpiration` 主要影响来自其他签发方的令牌或缺少 `exp` 的旧令牌。生产环境建议启用。
:::

## 令牌 TTL 设计

访问令牌和刷新令牌的 TTL 应根据业务场景平衡安全与体验：

| 场景 | AccessTokenTTL | RefreshTokenTTL | 说明 |
|------|----------------|-----------------|------|
| 高安全（金融、医疗） | 5 分钟 | 1 小时 | 短 TTL 限制暴露窗口 |
| Web 应用 | 15 分钟 | 7 天 | 默认值，平衡安全与体验 |
| 移动端 App | 30 分钟 | 30 天 | 较长 TTL 减少重新登录 |
| 内部服务 | 1 小时 | 24 小时 | 内网信任度较高 |

::: warning 约束
`Config.Validate()` 要求 `AccessTokenTTL < RefreshTokenTTL`，且两者必须为正数。
:::

## 配置校验矩阵

`Config.Validate()` 在 `New()` 中于 `normalizeConfig` 之后执行，返回三类错误：`ErrInvalidConfig`、`ErrInvalidSecretKey`、`ErrInvalidSigningMethod`。

### 签名密钥校验（按算法）

| 算法族 | `SigningKey` 要求 | `VerificationKey`（可选） |
|--------|-------------------|--------------------------|
| HMAC（HS256/384/512） | `SecretKey` 字符串 ≥ 32 字节 + 非弱密钥 | 不适用（HMAC 对称） |
| RSA（RS/PS 256/384/512） | `*rsa.PrivateKey` ≥ 2048 位 | `*rsa.PublicKey` ≥ 2048 位 |
| ECDSA（ES256/384/512） | `*ecdsa.PrivateKey`，曲线匹配算法 | `*ecdsa.PublicKey` |

::: tip VerificationKey 的作用
设置 `VerificationKey` 后，验证令牌时使用公钥而非私钥——适用于只验不签的服务（如资源服务器）。省略时验证使用 `SigningKey` 中的私钥。详见 [签名算法](./signing-algorithms)。
:::

### Config.Validate() 完整检查项

| 检查项 | 条件 | 返回错误 |
|--------|------|----------|
| 配置指针 | `nil` | `ErrInvalidConfig` |
| HMAC 密钥长度 | `SecretKey < 32` 字节 | `ErrInvalidSecretKey` |
| HMAC 密钥强度 | 弱密钥（低熵/低复杂度） | `ErrInvalidSecretKey` |
| RSA 签名密钥类型 | 非 `*rsa.PrivateKey` | `ErrInvalidSecretKey` |
| RSA 签名密钥强度 | `< 2048` 位 | `ErrInvalidSecretKey` |
| RSA 验证密钥类型 | 非 `*rsa.PublicKey`（设置时） | `ErrInvalidSecretKey` |
| RSA 验证密钥强度 | `< 2048` 位（设置时） | `ErrInvalidSecretKey` |
| ECDSA 签名密钥类型 | 非 `*ecdsa.PrivateKey` | `ErrInvalidSecretKey` |
| ECDSA 曲线匹配 | 曲线与算法不匹配（如 ES256 需 P-256） | `ErrInvalidSecretKey` |
| ECDSA 验证密钥类型 | 非 `*ecdsa.PublicKey`（设置时） | `ErrInvalidSecretKey` |
| 签名算法 | 不在 12 种内置算法中 | `ErrInvalidSigningMethod` |
| AccessTokenTTL | `<= 0` | `ErrInvalidConfig` |
| RefreshTokenTTL | `<= 0` | `ErrInvalidConfig` |
| TTL 关系 | `AccessTokenTTL >= RefreshTokenTTL` | `ErrInvalidConfig` |
| ClockSkew | `< 0` | `ErrInvalidConfig` |
| Blacklist MaxSize | `<= 0`（仅内置存储） | `ErrInvalidConfig` |
| Blacklist CleanupInterval | `<= 0`（仅内置存储） | `ErrInvalidConfig` |

::: tip 校验顺序
`Validate()` 先校验签名密钥（返回 `ErrInvalidSecretKey` 或 `ErrInvalidSigningMethod`），再校验 TTL、ClockSkew 和 Blacklist 配置（返回 `ErrInvalidConfig`）。若密钥不合法，后续检查不会执行——修复第一个报错后重新测试。
:::

## 输入校验与安全加固

CyberGo JWT 对 [`Claims`](../api-reference/claims) 字段实施多层输入校验，防止注入攻击和异常数据。

### 字段约束

| 校验项 | 限制 | 触发错误 |
|--------|------|----------|
| 字符串字段长度 | ≤ 256 字符 | `ValidationError` |
| 数组大小（permissions、scopes、audience） | ≤ 100 项 | `ValidationError` |
| Extra 字段数量 | ≤ 50 个 | `ValidationError` |
| Extra 值类型 | `string`、`[]string` | `ValidationError`（拒绝嵌套 map） |

受校验的字符串字段包括 `UserID`、`Username`、`Role`、`SessionID`、`ClientID` 以及 `RegisteredClaims` 中的 `Issuer`、`Subject`、`ID`、`TokenType`。

### 注入模式检测

库内置 46 种危险模式检测，覆盖 XSS、SQL 注入、路径穿越等攻击向量：

- **XSS**：`<script>`、`javascript:`、`onerror=`、`<iframe>` 等 HTML/JS 注入标签
- **SQL 注入**：`drop table`、`union select` 等
- **路径穿越**：`../`、`/etc/passwd`、`file://`
- **控制字符**：除 Tab（9）、换行（10）、回车（13）外的 ASCII < 32 字符

检测到危险模式时返回 `ValidationError`，`Field` 为字段名，`Message` 为 `"suspicious pattern detected"`。

### 处理校验错误

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("字段: %s, 原因: %s\n", ve.Field, ve.Message)
        // 字段：user_id, 原因：suspicious pattern detected
    }
}
```

`ValidationError` 同时实现了 `Unwrap()`，可以通过 `errors.Is` 和 `errors.As` 链式查找底层错误。在 `Create` 和 `Parse` 路径中，校验错误会被 `ErrInvalidClaims` 包装。

::: tip 自定义 Claims 校验
实现 `CustomClaims` 接口的类型，其自定义字段不会被深度校验——实现者需在 `Validate()` 方法中自行处理。标准 JWT 字段（`iss`、`sub`、`jti` 等）的长度和注入校验始终执行。详见 [自定义 Claims](./custom-claims)。
:::

## 下一步

- [签名算法](./signing-algorithms) — 算法选择与密钥配置
- [自定义 Claims](./custom-claims) — CustomClaims 接口实现
- [令牌刷新与轮换](./token-refresh) — 双层令牌 TTL 与轮换策略
- [Config API](../api-reference/config) — Config 完整字段参考
