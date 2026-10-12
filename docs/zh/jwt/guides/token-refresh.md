---
sidebar_label: "令牌刷新与轮换"
title: "令牌刷新与轮换 - CyberGo JWT | 访问与刷新令牌策略"
description: "令牌刷新与轮换指南：讲解访问令牌与刷新令牌的双层 TTL 设计、CreateRefresh 签发与 Refresh 轮换流程、自定义 Claims 的 RefreshInto 用法，以及重用（默认不自动吊销）与一次性轮换（内建 RotateRefreshTokens 开关）两种策略。"
sidebar_position: 25
check_code: false
---

# 令牌刷新与轮换

CyberGo JWT 采用双层令牌设计：短期**访问令牌**（access token）用于接口认证，长期**刷新令牌**（refresh token）用于在访问令牌过期后换取新令牌。这种设计平衡了安全性与用户体验。

## 双层令牌模型

| 令牌类型 | 签发方法 | 默认 TTL | 用途 |
|----------|----------|----------|------|
| 访问令牌 | [`Create`](../api-reference/processor#create) | 15 分钟 | 接口认证，频繁验证 |
| 刷新令牌 | [`CreateRefresh`](../api-reference/processor#createrefresh) | 7 天 | 换取新访问令牌，使用频率低 |

令牌类型通过 `token_type` 声明标记（`access` / `refresh`）。[`Refresh`](../api-reference/processor#refresh) 方法会拒绝 access 类型的令牌，防止访问令牌被用于刷新。

### TTL 配置

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.AccessTokenTTL = 15 * time.Minute    // 访问令牌有效期
cfg.RefreshTokenTTL = 7 * 24 * time.Hour // 刷新令牌有效期（必须 > AccessTokenTTL）
```

::: tip 约束
`Config.Validate()` 要求 `RefreshTokenTTL > AccessTokenTTL`，否则返回 `ErrInvalidConfig`。
:::

## 基本刷新流程

### 1. 签发令牌对

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
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}

    // 访问令牌（短期）
    accessToken, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // 刷新令牌（长期）
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }

    fmt.Println("Access Token:", accessToken)
    fmt.Println("Refresh Token:", refreshToken)
}
```

### 2. 刷新获取新访问令牌

当访问令牌过期后，用刷新令牌换取新的访问令牌：

```go
// refreshToken 是之前通过 CreateRefresh 签发的令牌
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 刷新令牌已过期，用户需要重新登录
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 刷新令牌已被吊销
    case errors.Is(err, jwt.ErrTokenTypeMismatch):
        // 传入了访问令牌而非刷新令牌
    default:
        // 其他错误
    }
    return
}
fmt.Println("New Access Token:", newAccessToken)
```

`Refresh` 会完整校验刷新令牌：签名、过期、签发者、受众、黑名单状态。

## 自定义 Claims 刷新

使用自定义 Claims 类型时，用 [`RefreshInto`](../api-reference/processor#refreshinto) 将解析结果填充到自定义结构：

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

```go
// 用自定义 Claims 签发刷新令牌
refreshToken, err := processor.CreateRefresh(&MyClaims{UserID: "123", Role: "admin"})

// 刷新到自定义结构
result := &MyClaims{}
newToken, err := processor.RefreshInto(refreshToken, result)
```

## 轮换策略

### 重用模式（默认）

默认情况下，`Refresh` **不会**吊销原刷新令牌。原令牌在过期或被显式吊销前保持有效，可以多次使用：

```go
// 第一次刷新
token1, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}

// 同一个 refreshToken 仍然有效，可以再次刷新
token2, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
```

**适用场景**：移动端 App、单设备登录。用户无需频繁重新登录，刷新令牌可在 TTL 内反复使用。

### 一次性轮换

对安全性要求更高的场景，让每个刷新令牌仅能使用一次。v1.2.3 起推荐启用内建轮换开关 `Config.RotateRefreshTokens` <Badge type="tip" text="v1.2.3+" />：

```go
cfg := jwt.DefaultConfig()
// ...密钥与 TTL 等必要配置
cfg.RotateRefreshTokens = true // 一次性使用：Refresh 先吊销旧令牌再签发新令牌

processor, err := jwt.New(cfg)
if err != nil {
    panic(err)
}

// Refresh / RefreshInto 会自动吊销旧刷新令牌（按 jti 拉黑）再签发新访问令牌
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
```

::: warning fail-closed 语义与并发窗口
- **吊销先于签发**：旧令牌的 jti 会在新令牌铸造**之前**被拉黑。若随后签发失败（如触发限流），旧令牌已失效，用户须重新认证——这是刻意的 fail-closed 设计，保证已接受的刷新令牌无法事后重放。
- **错误**：吊销旧令牌失败时返回 `ErrRefreshRotationFailed`（包装底层黑名单存储错误），且不会有新令牌签发；缺少 `jti` 的刷新令牌无法吊销，直接返回 `ErrTokenMissingID`；未配置黑名单的处理器则返回 `ErrBlacklistNotConfigured`（`Revoke()` 同样如此）。经 `jwt.New()` 构建的处理器总是自带黑名单——`DefaultConfig()` 默认启用，零值字段也会在 `New()` 中补全默认——常规使用不会遇到该错误。
- **并发**：轮换收窄但不消除重放窗口——两个并发的 `Refresh` 可能都在吊销生效前通过验证。如需严格的单次使用保证，请自定义 `BlacklistStore` 实现原子 check-and-add。
:::

无法调整配置时，手动 `Refresh` + `Revoke` 是等效的替代方案：

```go
// 刷新并立即吊销旧令牌
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}

// 吊销旧刷新令牌，使其不可再次使用
if err := processor.Revoke(refreshToken); err != nil {
    panic(err)
}
```

注意：手动方案存在窗口期——`Refresh` 成功到 `Revoke` 生效之间旧令牌仍可使用；且第一步成功、第二步失败时需自行处理。

**适用场景**：Web 应用、高安全要求系统。每次刷新后旧令牌立即失效，降低令牌泄露风险。

### 策略对比

| 维度 | 重用模式 | 一次性轮换 |
|------|----------|------------|
| 安全性 | 较低（令牌泄露后可反复使用） | 较高（泄露令牌仅限单次使用） |
| 用户体验 | 较好（无需频繁重新登录） | 一般（刷新失败需重新登录） |
| 实现复杂度 | 零额外代码 | 一个配置开关（`RotateRefreshTokens`），或手动调用 `Revoke` |
| 黑名单压力 | 低 | 较高（每次刷新产生一条记录） |

::: warning 刷新令牌泄露检测
一次性轮换模式下，如果攻击者使用了已被吊销的刷新令牌，`Refresh` 会返回 `ErrTokenRevoked`。应用层可据此检测令牌泄露并强制用户重新认证。
:::

## 类型安全

CyberGo JWT 通过 `token_type` 声明区分令牌类型。`Refresh` 和 `RefreshInto` 会拒绝访问令牌：

```go
// 用访问令牌尝试刷新会被拒绝
_, err := processor.Refresh(accessToken)
// err 包装了 ErrTokenTypeMismatch: expected refresh token, got access token
```

这防止了访问令牌被用于获取新令牌，确保双层模型的类型隔离。

没有 `token_type` 声明的令牌（旧版本签发的令牌）会被接受，保持向后兼容。

## 安全注意事项

- **Refresh 默认不自动吊销**：原刷新令牌在 `Refresh` 后仍然有效。如需一次性使用语义，启用 `Config.RotateRefreshTokens`（推荐，见[一次性轮换](#一次性轮换)）或手动调用 `Revoke`。
- **Claims 不深度校验**：`Refresh` 验证标准 JWT 字段（签名、过期、签发者、受众、黑名单）和基本结构（UserID 或 Username 非空），但不重新检查字段长度限制和注入模式，信任创建时已校验。
- **签名一致性**：新访问令牌使用与刷新令牌相同的签名算法和密钥，不支持跨算法刷新。

## 下一步

- [令牌黑名单](./blacklist) — 吊销机制与自定义存储后端
- [错误处理](./error-handling) — 全部哨兵错误分类与处理
- [配置详解](./configuration) — TTL、签发者、受众与时钟偏移配置
- [Processor API](../api-reference/processor) — `Refresh`、`RefreshInto`、`CreateRefresh` 完整签名
