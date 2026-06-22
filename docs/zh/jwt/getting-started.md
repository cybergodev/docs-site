---
title: "快速开始 - CyberGo JWT | 5分钟入门指南"
description: "CyberGo JWT 快速开始指南：安装库并创建 Processor，完成访问令牌与刷新令牌的签发、验证、刷新和吊销，涵盖四类算法选择、自定义 Claims、内置黑名单与令牌桶速率限制等核心用法。"
---

# 快速开始

## 安装

```bash
go get github.com/cybergodev/jwt
```

要求 Go 1.25+。

## 基础使用

### 1. 创建 Processor

```go
package main

import (
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!" // HMAC 至少 32 字节
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close() // 安全清除密钥
}
```

### 2. 签发令牌

```go
claims := &jwt.Claims{
    UserID:   "user123",
    Username: "alice",
    Role:     "admin",
    Permissions: []string{"read", "write"},
}

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
```

### 3. 验证令牌

```go
parsed, valid, err := processor.Validate(accessToken)
if err != nil {
    // 处理错误：过期、签名无效等
    panic(err)
}
if valid {
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Role:", parsed.Role)
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
}
```

### 4. 刷新令牌

```go
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. 吊销令牌

```go
// 将令牌加入黑名单
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 检查是否已吊销
revoked, err := processor.IsRevoked(accessToken)
if err != nil {
    panic(err)
}
fmt.Println("Revoked:", revoked) // true
```

## 签名算法

### HMAC（对称密钥）

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // 默认
```

| 方法 | 算法 |
|------|------|
| `SigningMethodHS256` | HMAC-SHA256 |
| `SigningMethodHS384` | HMAC-SHA384 |
| `SigningMethodHS512` | HMAC-SHA512 |

### RSA（非对称密钥）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选，默认使用 SigningKey）
```

| 方法 | 算法 |
|------|------|
| `SigningMethodRS256` | RSA-SHA256 |
| `SigningMethodRS384` | RSA-SHA384 |
| `SigningMethodRS512` | RSA-SHA512 |

### RSA-PSS（非对称密钥，推荐）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选）
```

| 方法 | 算法 |
|------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 |
| `SigningMethodPS384` | RSA-PSS-SHA384 |
| `SigningMethodPS512` | RSA-PSS-SHA512 |

### ECDSA（非对称密钥）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey（可选）
```

| 方法 | 算法 |
|------|------|
| `SigningMethodES256` | ECDSA-SHA256 |
| `SigningMethodES384` | ECDSA-SHA384 |
| `SigningMethodES512` | ECDSA-SHA512 |

## 自定义 Claims

实现 `CustomClaims` 接口来定义自己的 Claims 结构：

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

使用自定义 Claims：

```go
claims := &MyClaims{UserID: "123", Role: "admin"}

// 创建令牌
token, err := processor.Create(claims)

// 验证到自定义结构
result := &MyClaims{}
parsed, valid, err := processor.ValidateInto(token, result)

// 刷新到自定义结构
newToken, err := processor.RefreshInto(refreshToken, claims)
```

## 黑名单配置

### 使用内置内存存储（默认）

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 内置黑名单已自动启用
```

### 自定义存储后端

实现 `BlacklistStore` 接口（如 Redis）：

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", time.Until(expiresAt)).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}

// 使用
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

## 限流配置

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100          // 每窗口最大请求数
cfg.RateLimitWindow = time.Minute // 窗口时间
```

## 错误处理

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 令牌过期
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 令牌已吊销
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // 签发者不匹配
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // 受众不匹配
    case errors.Is(err, jwt.ErrInvalidToken):
        // 签名无效或格式错误
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor 已关闭
    default:
        // 其他错误
    }
}
```

## 下一步

- [签名算法](./guides/signing-algorithms) — 算法选择与密钥配置
- [自定义 Claims](./guides/custom-claims) — 定义业务字段
- [令牌黑名单](./guides/blacklist) — 吊销与自定义存储
- [速率限制](./guides/rate-limiting) — 限流配置
- [错误处理](./guides/error-handling) — 错误分类与处理模式
- [API 参考](./api-reference/) — 完整 API 参考文档
