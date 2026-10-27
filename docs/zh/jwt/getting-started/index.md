---
sidebar_label: "快速开始"
title: "快速开始 - CyberGo JWT | 5 分钟入门指南"
description: "CyberGo JWT 快速开始指南：安装库并创建 Processor，依次完成访问令牌与刷新令牌的签发、验证、刷新和吊销，涵盖核心用法、常见错误处理与进阶功能导航，示例可按顺序直接运行。"
sidebar_position: 1
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
	defer processor.Close() // 释放资源并清除密钥
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
// 本步用到 fmt，需确保已 import "fmt"
parsed, err := processor.Parse(accessToken)
if err != nil {
    // 处理错误：过期、签名无效等
    panic(err)
}
fmt.Println("UserID:", parsed.UserID)
fmt.Println("Role:", parsed.Role)
fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
```

### 4. 刷新令牌

```go
// 本步用到 fmt，需确保已 import "fmt"
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. 吊销令牌

```go
// 本步用到 fmt，需确保已 import "fmt"

// 将令牌加入黑名单
err = processor.Revoke(accessToken)
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

## 更多功能

以上涵盖了令牌生命周期的核心操作。CyberGo JWT 还提供以下功能，点击进入对应指南获取详细用法：

| 功能 | 说明 | 指南 |
|------|------|------|
| 签名算法 | HMAC、RSA、RSA-PSS、ECDSA 四类 12 种算法 | [签名算法](../guides/signing-algorithms) |
| 自定义 Claims | 通过 `CustomClaims` 接口定义业务字段 | [自定义 Claims](../guides/custom-claims) |
| 令牌刷新与轮换 | 双层令牌 TTL 设计、重用与一次性轮换策略 | [令牌刷新与轮换](../guides/token-refresh) |
| 令牌黑名单 | 吊销机制、内置存储与 Redis 自定义后端 | [令牌黑名单](../guides/blacklist) |
| 速率限制 | 令牌桶算法，防止签发接口被滥用 | [速率限制](../guides/rate-limiting) |
| 配置详解 | 签发者/受众校验、时钟偏移、强制过期、输入校验 | [配置详解](../guides/configuration) |
| 错误处理 | 20 个哨兵错误分类与 `errors.Is` 匹配 | [错误处理](../guides/error-handling) |
| 测试与时钟注入 | `FixedClock` 固定时钟，精确控制时间流逝 | [测试与时钟注入](../guides/testing) |

## 下一步

- [签名算法](../guides/signing-algorithms) — 算法选择与密钥配置
- [令牌刷新与轮换](../guides/token-refresh) — 双层令牌与轮换策略
- [配置详解](../guides/configuration) — 安全配置与输入校验
- [API 参考](../api-reference/) — 完整 API 参考文档
- [基础示例](../examples/basic) — 可运行的完整示例
- [Web 服务器集成](../examples/web-server) — 认证中间件与 RBAC 实战
