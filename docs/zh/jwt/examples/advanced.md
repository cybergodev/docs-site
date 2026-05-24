---
title: "高级示例 - JWT"
description: "CyberGo JWT 高级示例：RSA/ECDSA 非对称签名、自定义 Claims、Redis 黑名单后端、时钟注入测试、未验证解析与 Web 服务集成。"
---

# 高级示例

## RSA 非对称签名

使用 RSA 私钥签名，公钥验证。适用于微服务架构，验证端无需持有私钥。

```go
package main

import (
    "crypto/rand"
    "crypto/rsa"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // 生成 RSA 密钥对（实际使用中从文件加载）
    privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodRS256
    cfg.SigningKey = privateKey
    cfg.VerificationKey = &privateKey.PublicKey // 可选，不设置则使用 SigningKey

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user456", Username: "bob"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("RSA Token:", token)

    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## ECDSA 非对称签名

使用 ECDSA 椭圆曲线签名，密钥更短、性能更好。

```go
package main

import (
    "crypto/ecdsa"
    "crypto/elliptic"
    "crypto/rand"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // 生成 ECDSA 密钥对
    privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodES256
    cfg.SigningKey = privateKey

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user789", Username: "charlie"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("ECDSA Token:", token)
}
```

## 自定义 Claims

定义自己的 Claims 结构，添加业务字段。

```go
package main

import (
    "errors"
    "fmt"

    "github.com/cybergodev/jwt"
)

// 自定义 Claims 结构
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
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
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "alice@example.com",
        Role:   "admin",
    }

    // 创建令牌
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 验证到自定义 Claims
    myClaims := &MyClaims{}
    result, valid, err := processor.ValidateInto(token, myClaims)
    if err != nil {
        panic(err)
    }
    if valid {
        parsed := result.(*MyClaims)
        fmt.Println("UserID:", parsed.UserID) // 输出: user123
        fmt.Println("Email:", parsed.Email)   // 输出: alice@example.com
    }

    // 刷新到自定义 Claims
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }
    newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
    if err != nil {
        panic(err)
    }
    fmt.Println("New Token:", newToken)
}
```

## 自定义黑名单后端（Redis）

```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

// RedisBlacklistStore 实现 BlacklistStore 接口
// 注意：实际使用时需引入 Redis 客户端（如 github.com/redis/go-redis）
type RedisBlacklistStore struct {
    // client *redis.Client
}

func (s *RedisBlacklistStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil
    }
    // return s.client.Set(context.Background(), "blacklist:"+tokenID, "1", ttl).Err()
    fmt.Printf("Redis ADD: %s, TTL: %v\n", tokenID, ttl)
    return nil
}

func (s *RedisBlacklistStore) Contains(tokenID string) (bool, error) {
    // return s.client.Exists(context.Background(), "blacklist:"+tokenID).Result()
    return false, nil
}

func (s *RedisBlacklistStore) Close() error {
    // return s.client.Close()
    return nil
}

func main() {
    _ = context.Background() // 保持 context 导入可用（实际使用时取消注释 Redis 调用）

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Blacklist.Store = &RedisBlacklistStore{}

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

    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked via Redis backend")
}
```

## 时钟注入（测试场景）

使用 `FixedClock` 在测试中控制时间。

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: fixedTime}

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

    parsed, _, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("IssuedAt:", parsed.IssuedAt.Time)   // 输出: 2026-01-01 00:00:00
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time) // 输出: 2026-01-01 00:15:00
}
```

## 解析未验证令牌

提取 Claims 信息但不验证签名，用于调试或日志。

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

    // 不验证签名解析
    parsed := &jwt.Claims{}
    err = processor.ParseUnverified(token, parsed)
    if err != nil {
        panic(err)
    }
    fmt.Println("UserID (unverified):", parsed.UserID)
}
```

## 完整 Web 服务示例

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "strings"

    "github.com/cybergodev/jwt"
)

var processor *jwt.Processor

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Issuer = "my-web-service"
    cfg.ExpectedAudience = "my-app"

    var err error
    processor, err = jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    http.HandleFunc("/login", handleLogin)
    http.HandleFunc("/protected", handleProtected)

    fmt.Println("Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
    // 实际场景中验证用户名密码
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }

    accessToken, err := processor.Create(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    fmt.Fprintf(w, `{"access_token":"%s","refresh_token":"%s"}`, accessToken, refreshToken)
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
    auth := r.Header.Get("Authorization")
    if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
        http.Error(w, "missing token", http.StatusUnauthorized)
        return
    }

    tokenString := strings.TrimPrefix(auth, "Bearer ")
    claims, valid, err := processor.Validate(tokenString)
    if err != nil || !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }

    fmt.Fprintf(w, "Hello, %s (ID: %s, Role: %s)",
        claims.Username, claims.UserID, claims.Role)
}
```
