---
sidebar_label: "高级示例"
title: "高级示例 - CyberGo JWT | 非对称签名与自定义存储"
description: "高级示例集：RSA、RSA-PSS 与 ECDSA 非对称签名的完整示例，密钥分离下的跨服务验证与占位私钥用法，PEM 私钥与公钥的加载，CustomClaims 自定义声明与 ParseInto/RefreshInto，Redis 黑名单后端、FixedClock 时钟注入及未验证令牌解析。"
sidebar_position: 20
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

	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("UserID:", parsed.UserID)
}
```

## RSA-PSS 签名

RSA-PSS（RS256/384/512 的现代替代）使用概率签名方案（PSS）填充，安全性优于 PKCS#1 v1.5。密钥与 RSA 完全相同，无需额外生成。

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
	// 生成 RSA 密钥对（RSA-PSS 与 RSA 共用同一密钥类型）
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}

	cfg := jwt.DefaultConfig()
	cfg.SigningMethod = jwt.SigningMethodPS256
	cfg.SigningKey = privateKey
	cfg.VerificationKey = &privateKey.PublicKey

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	claims := &jwt.Claims{UserID: "user_ps", Username: "diana"}
	token, err := processor.Create(claims)
	if err != nil {
		panic(err)
	}
	fmt.Println("RSA-PSS Token:", token)

	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("UserID:", parsed.UserID)
}
```

:::tip 推荐替代 RSA
新项目建议优先使用 RSA-PSS（PS256/384/512）。PSS 填充比 PKCS#1 v1.5 具备更强的可证明安全性，且密钥与 RSA 完全通用。
:::

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

## 密钥分离模式

模拟微服务架构中的跨服务令牌验证：认证服务持有私钥签发令牌，API 服务通过公钥验证。

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
	// 生成 RSA 密钥对
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	publicKey := &privateKey.PublicKey

	// --- 认证服务：持有私钥，签发令牌 ---
	authCfg := jwt.DefaultConfig()
	authCfg.SigningMethod = jwt.SigningMethodRS256
	authCfg.SigningKey = privateKey
	authCfg.Issuer = "auth-service"

	authProcessor, err := jwt.New(authCfg)
	if err != nil {
		panic(err)
	}
	defer authProcessor.Close()

	claims := &jwt.Claims{UserID: "user_dist", Username: "charlie"}
	token, err := authProcessor.Create(claims)
	if err != nil {
		panic(err)
	}
	fmt.Println("认证服务签发令牌（私钥）")

	// --- API 服务：通过公钥验证令牌 ---
	// 当前 API 要求 SigningKey 非空，这里放一个占位私钥；
	// 只要设置了 VerificationKey，验证就只使用该公钥，占位私钥不参与任何运算。
	placeholderKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}

	apiCfg := jwt.DefaultConfig()
	apiCfg.SigningMethod = jwt.SigningMethodRS256
	apiCfg.SigningKey = placeholderKey // 占位私钥，不参与验证
	apiCfg.VerificationKey = publicKey // 验证时实际使用此公钥
	apiCfg.Issuer = "auth-service"     // 必须与签发方一致

	apiProcessor, err := jwt.New(apiCfg)
	if err != nil {
		panic(err)
	}
	defer apiProcessor.Close()

	parsed, err := apiProcessor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("API 服务验证通过（公钥）")
	fmt.Println("UserID:", parsed.UserID) // 输出：user_dist
}
```

:::warning 仅验证实例不要签发
当前 API 要求 `SigningKey` 非空且必须是合法的 `*rsa.PrivateKey`，因此 API 服务仍需填入私钥。占位私钥即可：验证只使用 `VerificationKey`，与签发密钥无关。但仅验证的 Processor 不应调用 `Create` / `CreateRefresh`，那会用占位私钥签出无法验证的令牌。
:::

## 从 PEM 文件加载密钥

生产环境通常将非对称密钥以 PEM 文件存储。以下示例展示如何用 `pem.Decode` + `x509.ParsePKCS8PrivateKey` 加载私钥、`x509.ParsePKIXPublicKey` 加载公钥。

<!-- check-code: skip -->
```go
package main

import (
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "fmt"
    "os"

    "github.com/cybergodev/jwt"
)

func main() {
    // --- 加载 RSA 私钥 ---
    keyData, err := os.ReadFile("private_key.pem")
    if err != nil {
        fmt.Println("读取私钥失败：", err)
        return
    }

    block, _ := pem.Decode(keyData)
    if block == nil {
        fmt.Println("私钥 PEM 解码失败")
        return
    }

    parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
    if err != nil {
        fmt.Println("解析私钥失败：", err)
        return
    }
    privateKey, ok := parsedKey.(*rsa.PrivateKey)
    if !ok {
        fmt.Println("密钥类型不是 RSA")
        return
    }

    // --- 加载 RSA 公钥 ---
    pubData, err := os.ReadFile("public_key.pem")
    if err != nil {
        fmt.Println("读取公钥失败：", err)
        return
    }

    pubBlock, _ := pem.Decode(pubData)
    if pubBlock == nil {
        fmt.Println("公钥 PEM 解码失败")
        return
    }

    parsedPub, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
    if err != nil {
        fmt.Println("解析公钥失败：", err)
        return
    }
    publicKey, ok := parsedPub.(*rsa.PublicKey)
    if !ok {
        fmt.Println("公钥类型不是 RSA")
        return
    }

    // --- 配置 Processor ---
    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodRS256
    cfg.SigningKey = privateKey
    cfg.VerificationKey = publicKey

    processor, err := jwt.New(cfg)
    if err != nil {
        fmt.Println("初始化失败：", err)
        return
    }
    defer processor.Close()
    fmt.Println("密钥已从 PEM 文件加载") // 输出：密钥已从 PEM 文件加载
}
```

:::tip 密钥格式
- 私钥 PEM 标头为 `-----BEGIN PRIVATE KEY-----`（PKCS#8）或 `-----BEGIN RSA PRIVATE KEY-----`（PKCS#1）。PKCS#8 用 `x509.ParsePKCS8PrivateKey`，PKCS#1 用 `x509.ParsePKCS1PrivateKey`。
- 公钥 PEM 标头为 `-----BEGIN PUBLIC KEY-----`，用 `x509.ParsePKIXPublicKey` 解析。
- `ParsePKCS8PrivateKey` / `ParsePKIXPublicKey` 返回 `any`，需类型断言为 `*rsa.PrivateKey` / `*rsa.PublicKey`（ECDSA 同理，断言为 `*ecdsa.PrivateKey` / `*ecdsa.PublicKey`）。
:::

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
	result, err := processor.ParseInto(token, myClaims)
	if err != nil {
		panic(err)
	}
	parsed := result.(*MyClaims)
	fmt.Println("UserID:", parsed.UserID) // 输出：user123
	fmt.Println("Email:", parsed.Email)   // 输出：alice@example.com

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

	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("IssuedAt:", parsed.IssuedAt.Time)   // 输出：2026-01-01 00:00:00 +0000 UTC
	fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time) // 输出：2026-01-01 00:15:00 +0000 UTC
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

## 更多示例

- [Web 服务器集成](./web-server) — 认证中间件、RBAC、刷新、登出、优雅关闭
- [基础示例](./basic) — HMAC、令牌对、吊销、限流
