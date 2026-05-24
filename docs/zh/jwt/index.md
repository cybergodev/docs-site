---
title: "JWT - 生产级 JWT 认证库"
description: "CyberGo JWT 生产级认证库，支持 HMAC/RSA/ECDSA 多算法签名、令牌黑名单、限流保护、自定义 Claims 和时钟注入，所有方法并发安全。"
---

# JWT - 生产级 JWT 认证库

CyberGo JWT 是一个为 Go 语言设计的高性能 JWT 认证库，提供了令牌生成、验证、刷新和吊销的完整解决方案。

## 特性

- **多算法支持** — HMAC (HS256/384/512)、RSA (RS256/384/512)、RSA-PSS (PS256/384/512)、ECDSA (ES256/384/512)
- **令牌生命周期** — 创建、验证、刷新、吊销一站式管理
- **自定义 Claims** — 通过 `CustomClaims` 接口支持任意业务字段
- **黑名单管理** — 内置内存存储，支持 Redis 等自定义后端
- **限流保护** — 令牌桶算法，防止暴力破解
- **输入验证** — 字段长度限制、注入模式检测、控制字符过滤
- **时钟注入** — `ClockProvider` 接口支持测试场景
- **并发安全** — 所有导出方法可安全并发调用
- **零敏感数据泄露** — `Close()` 安全清除密钥

## 安装

```bash
go get github.com/cybergodev/jwt
```

## 快速开始

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    // 1. 创建配置
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    // 2. 创建 Processor
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 3. 签发令牌
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 4. 验证令牌
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## 架构概览

```text
┌────────────────────────────────────────────────┐
│                  Processor                      │
│  (implements TokenManager interface)            │
├────────────────────────────────────────────────┤
│  Create / Validate / Refresh / Revoke          │
│  CreateRefresh / ValidateInto / RefreshInto    │
│  ParseUnverified / IsRevoked / IsClosed / Close│
├──────────────────┬─────────────────────────────┤
│  BlacklistManager│     RateLimiter              │
│  (optional)      │     (optional)               │
├──────────────────┴─────────────────────────────┤
│                Config                           │
│  SigningMethod / TTL / Blacklist / Limit       │
└────────────────────────────────────────────────┘
```

## 下一步

- [快速开始](./getting-started) — 详细的安装和配置指南
- [签名算法](./guides/signing-algorithms) — HMAC、RSA、ECDSA 选择指南
- [自定义 Claims](./guides/custom-claims) — 定义业务字段
- [API 参考](./api-reference/) — 完整 API 参考文档
- [基础示例](./examples/basic) — HMAC、令牌对、验证示例
