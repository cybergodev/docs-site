---
sidebar_label: "基础示例"
title: "基础示例 - CyberGo JWT | HMAC 签发与吊销"
description: "基础示例集：用 HMAC 对称密钥签发并验证访问令牌、配合刷新令牌轮换获取新令牌、通过内置黑名单吊销令牌阻止已注销会话、配置令牌桶速率限制防暴力滥用，所有示例完整可独立编译运行。"
sidebar_position: 10
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
	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("UserID:", parsed.UserID) // 输出：user123
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
	_, err = processor.Parse(token)
	fmt.Println("Parse error:", err) // token revoked

	// 检查是否已吊销
	revoked, err := processor.IsRevoked(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("Is revoked:", revoked) // 输出：true
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
	cfg.RateLimitRate = 5 // 每分钟最多 5 次
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

## 受众隔离

设置 `ExpectedAudience` 后，只有 `aud` 声明包含该值的令牌才通过验证。这在微服务架构中实现服务间令牌隔离——一个服务签发的令牌无法被另一个服务接受。

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/jwt"
)

func main() {
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
	cfg.ExpectedAudience = "billing-api" // 仅接受面向 billing-api 的令牌

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// 受众匹配的令牌
	validClaims := &jwt.Claims{
		UserID: "user1",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.StringOrSlice{"billing-api"},
		},
	}
	validToken, err := processor.Create(validClaims)
	if err != nil {
		panic(err)
	}

	_, err = processor.Parse(validToken)
	if err != nil {
		panic(err)
	}
	fmt.Println("Matching audience valid:", err == nil) // 输出：true

	// 受众不匹配的令牌会被拒绝
	wrongClaims := &jwt.Claims{
		UserID: "user2",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.StringOrSlice{"admin-api"},
		},
	}
	wrongToken, err := processor.Create(wrongClaims)
	if err != nil {
		panic(err)
	}

	_, err = processor.Parse(wrongToken)
	fmt.Println("Wrong audience valid:", err == nil) // 输出：false
	fmt.Println("Wrong audience error:", err)        // 输出：token invalid audience
	fmt.Println("Is audience error:",
		errors.Is(err, jwt.ErrTokenInvalidAudience)) // 输出：true
}
```

::: tip 微服务场景
在微服务架构中，为不同服务设置不同的 `ExpectedAudience`（如 `billing-api`、`user-api`），使各服务只接受面向自己的令牌，防止令牌跨服务滥用。
:::

## Extra 扩展字段

内置 `Claims.Extra` 是 `map[string]any`，用于存储少量可选附加信息。Processor 会在创建令牌时对 Extra 执行深度验证（长度、注入检测），因此比自定义 Claims 字段更省心。

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

	// 用 Extra 存储附加业务字段（仅支持 string 和 []string 值）
	claims := &jwt.Claims{
		UserID:   "user123",
		Username: "alice",
		Role:     "engineer",
		Extra: map[string]any{
			"team_id": "team-backend",
			"level":   "senior",
			"tags":    []string{"onboarding", "mentor"},
		},
	}
	token, err := processor.Create(claims)
	if err != nil {
		panic(err)
	}

	// 验证后读取 Extra 字段
	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("UserID:", parsed.UserID) // 输出：user123

	// 类型断言读取 Extra 值
	if teamID, ok := parsed.Extra["team_id"].(string); ok {
		fmt.Println("TeamID:", teamID) // 输出：team-backend
	}
	if level, ok := parsed.Extra["level"].(string); ok {
		fmt.Println("Level:", level) // 输出：senior
	}
	if tags, ok := parsed.Extra["tags"].([]string); ok {
		fmt.Println("Tags:", tags) // 输出：[onboarding mentor]
	}
}
```

::: warning Extra 的限制
`Extra` 最多 50 个键，值仅允许 `string` 和 `[]string` 类型，不支持嵌套 map。如果需要更复杂的结构或自定义验证，请改用[自定义 Claims 类型](../guides/custom-claims#extra-字段-vs-自定义类型)。
:::

## 更多示例

- [Web 服务器集成](./web-server) — 认证中间件、RBAC、刷新、登出、优雅关闭
- [高级示例](./advanced) — RSA、ECDSA、自定义 Claims、Redis 黑名单、时钟注入
