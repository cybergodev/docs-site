---
title: "核心概念 - CyberGo JWT | 架构与令牌模型"
description: "CyberGo JWT 核心概念：Processor 中心类型与并发安全的签发、验证、刷新、吊销方法，访问令牌与刷新令牌的双层模型，Claims 声明结构与 CustomClaims 接口，以及注册声明的自动填充与校验范围。"
sidebar_label: "核心概念"
sidebar_position: 2
---

# 核心概念

本页解释 CyberGo JWT 的核心抽象与设计模型，用于建立整体认知。如需直接动手，请跳转 [快速开始](./index)。

## Processor——核心类型

[Processor](../api-reference/processor) 是库的中心类型，通过 [`jwt.New(cfg)`](../api-reference/functions#new) 创建。它封装了令牌签发、验证、刷新和吊销的全部逻辑，所有方法**并发安全**，可在多个 goroutine 间共享同一实例。

使用完毕后调用 [`Close()`](../api-reference/processor#close) 释放资源并清除密钥：

<!-- check-code: skip -->
```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "your-32-byte-secret-key-here-minimum"

processor, err := jwt.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer processor.Close()
```

Processor 实现了 [`TokenManager`](../api-reference/interfaces#tokenmanager) 接口，便于依赖注入和测试替换。

## 令牌生命周期

一张令牌从签发到失效，经过以下环节：

```text
签发    Create(claims)           → 访问令牌（短期）
        CreateRefresh(claims)     → 刷新令牌（长期）

验证    Parse(token)             → Claims（检查签名、过期、签发者、黑名单）

刷新    Refresh(refreshToken)    → 新访问令牌

吊销    Revoke(token)            → 加入黑名单
查询    IsRevoked(token)         → bool
```

每个环节都返回**哨兵错误**（如 `ErrTokenExpired`、`ErrTokenRevoked`），可通过 `errors.Is()` 精确匹配。详见 [错误处理](../guides/error-handling)。

## 为什么需要双层令牌？

CyberGo JWT 采用访问令牌 + 刷新令牌的双层设计：

| | 访问令牌 | 刷新令牌 |
|---|---------|---------|
| **用途** | API 认证 | 换取新访问令牌 |
| **默认 TTL** | 15 分钟 | 7 天 |
| **签发方法** | `Create` | `CreateRefresh` |
| **刷新方法** | — | `Refresh` |

**为什么用两层？** 访问令牌有效期短，泄露后的风险窗口也小。刷新令牌有效期长，但只用于换取新访问令牌，不直接用于 API 认证。这种设计在安全性与用户体验之间取得平衡：不必频繁登录，访问令牌过期后可静默刷新。

::: tip 轮换语义
`Refresh` 默认不自动吊销刷新令牌，原令牌在过期或显式 `Revoke` 前仍然有效。一次性使用语义与轮换细节见 [令牌刷新与轮换](../guides/token-refresh#轮换策略)。
:::

## Claims 结构

Claims 携带令牌中的用户身份数据。CyberGo JWT 提供两层结构：

**RegisteredClaims**（RFC 7519 标准声明：创建时自动填充；验证时校验 `exp`、`nbf`、`iss`、`aud`）：

| 字段 | claim | 说明 |
|------|-------|------|
| Issuer | `iss` | 签发方标识，验证时比对配置 |
| Subject | `sub` | 主体标识（也用作限流键） |
| Audience | `aud` | 目标受众，验证时比对配置 |
| ExpiresAt | `exp` | 过期时间，验证时校验 |
| NotBefore | `nbf` | 生效时间，验证时校验 |
| IssuedAt | `iat` | 签发时间，仅写入，不参与校验 |
| ID | `jti` | 唯一标识（黑名单键） |
| TokenType | `token_type` | `access` 或 `refresh` |

> 库只补零值：调用方显式赋值的 `iss`/`exp`/`iat`/`jti` 会原样使用，覆盖配置与 TTL。

**Claims**（内置业务声明，嵌入 RegisteredClaims）：

<!-- check-code: skip -->
```go
type Claims struct {
    UserID      string         // 用户 ID
    Username    string         // 用户名
    Role        string         // 角色
    Permissions []string       // 权限列表
    Scopes      []string       // OAuth 作用域
    SessionID   string         // 会话 ID
    ClientID    string         // 客户端 ID
    Extra       map[string]any // 额外字段
    RegisteredClaims           // 标准声明（嵌入）
}
```

内置 `Claims` 的字段在**创建令牌时**经过深度校验，包括字符串长度（≤ 256 字节，UTF-8 编码，中文约 85 字）、数组规模（≤ 100 项）与 XSS/SQLi 注入模式检测。验证路径只执行 `Validate()` 必填校验与标准声明字符串清洗。

## CustomClaims 接口

当内置 Claims 无法满足业务需求时，实现 [`CustomClaims`](../api-reference/interfaces#customclaims) 接口定义自己的声明结构：

<!-- check-code: skip -->
```go
type AppClaims struct {
    UserID string   `json:"user_id"`
    TeamID string   `json:"team_id"`
    Roles  []string `json:"roles,omitempty"`
    jwt.RegisteredClaims
}

func (c *AppClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *AppClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

自定义类型通过 `ParseInto` 验证、`RefreshInto` 刷新——Processor 会解析令牌并填充目标结构体。详见 [自定义 Claims](../guides/custom-claims)。

## Config 配置概览

[`Config`](../api-reference/config) 是 Processor 的统一配置入口。通过 `DefaultConfig()` 获取合理默认值后，只需设置密钥即可使用：

| 分组 | 字段 | 说明 |
|------|------|------|
| **签名** | `SecretKey` / `SigningKey` / `VerificationKey` / `SigningMethod` | HMAC 用 SecretKey，RSA/ECDSA 用 SigningKey |
| **令牌** | `AccessTokenTTL` / `RefreshTokenTTL` | 访问与刷新令牌有效期 |
| **校验** | `Issuer` / `ExpectedAudience` / `RequireExpiration` / `ClockSkew` | 签发者、受众、强制过期、时钟容忍 |
| **安全** | `Blacklist` / `EnableRateLimit` / `RejectRefreshAsAccess` / `RotateRefreshTokens` | 吊销存储、速率限制与刷新令牌安全开关 |
| **扩展** | `Clock` | 时钟注入（测试用） |

签名算法选型见 [签名算法](../guides/signing-algorithms)，完整字段说明见 [配置详解](../guides/configuration)。

## 扩展接口

CyberGo JWT 通过接口实现可扩展性：

| 接口 | 用途 |
|------|------|
| [`TokenManager`](../api-reference/interfaces#tokenmanager) | Processor 实现的核心接口。可定义自己的小子集接口（只需 `Create` + `Parse`），实现依赖注入与解耦 |
| [`BlacklistStore`](../api-reference/interfaces#blackliststore) | 自定义黑名单后端（如 Redis），实现 `Add` / `Contains` / `Close` 三方法即可对接外部存储 |
| [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) | 自定义限流器，实现 `Allow` / `Reset` / `Close` 即可替换内置令牌桶 |
| [`ClockProvider`](../api-reference/interfaces#clockprovider) | 时钟注入。`FixedClock` 返回固定时间，在测试中精确控制令牌过期与刷新逻辑 |

## 下一步

- [签名算法](../guides/signing-algorithms) — HMAC、RSA、ECDSA 选型指南
- [配置详解](../guides/configuration) — 完整配置字段与安全加固
- [Web 服务器集成](../examples/web-server) — 认证中间件与 RBAC 实战
