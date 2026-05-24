---
title: "基础示例 - JWT"
description: "CyberGo JWT 基础示例：HMAC 签名令牌创建与验证、访问令牌与刷新令牌、令牌吊销与黑名单管理、限流保护的完整可运行代码。"
---

# 基础示例

## HMAC 签名

最常见的方式，使用对称密钥签名和验证。

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

    // 签发
    claims := &jwt.Claims{
        UserID:      "user123",
        Username:    "alice",
        Role:        "admin",
        Permissions: []string{"read", "write", "delete"},
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Access Token:", token)

    // 验证
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)          // 输出: true
    fmt.Println("UserID:", parsed.UserID) // 输出: user123
}
```

## 访问令牌与刷新令牌

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

    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
    }

    // 创建访问令牌（短期）
    accessToken, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // 创建刷新令牌（长期）
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }

    fmt.Println("Access Token:", accessToken)
    fmt.Println("Refresh Token:", refreshToken)

    // 使用刷新令牌获取新的访问令牌
    newAccessToken, err := processor.Refresh(refreshToken)
    if err != nil {
        panic(err)
    }
    fmt.Println("New Access Token:", newAccessToken)
}
```

## 令牌吊销（黑名单）

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

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // 吊销令牌
    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked")

    // 再次验证会失败
    _, _, err = processor.Validate(token)
    fmt.Println("Validate error:", err) // token revoked

    // 检查是否已吊销
    revoked, err := processor.IsRevoked(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Is revoked:", revoked) // 输出: true
}
```

## 限流保护

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
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 5              // 每分钟最多 5 次
    cfg.RateLimitWindow = time.Minute

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}

    // 正常请求
    for i := 0; i < 5; i++ {
        _, err := processor.Create(claims)
        if err != nil {
            fmt.Printf("Request %d: %v\n", i+1, err)
        } else {
            fmt.Printf("Request %d: success\n", i+1)
        }
    }

    // 第 6 次请求被限流
    _, err = processor.Create(claims)
    fmt.Println("Request 6:", err) // rate limit exceeded
}
```

## 更多示例

- [高级示例](./advanced) — RSA、ECDSA、自定义 Claims、Redis 黑名单、Web 服务
