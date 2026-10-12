---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo JWT | 哨兵错误匹配"
description: "错误处理指南：分类讲解 CyberGo JWT 全部 20 个哨兵错误在配置、令牌验证、限流与生命周期阶段的触发条件，演示 errors.Is 匹配、ValidationError 字段错误与标准化响应实践。"
sidebar_position: 50
---

# 错误处理

CyberGo JWT 使用哨兵错误（sentinel errors）模式，所有错误通过 `errors.Is()` 判断。

## 基本模式

```go
claims, err := processor.Parse(tokenString)
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

:::tip 使用 errors.Is()
不要使用 `err == jwt.ErrTokenExpired` 或字符串匹配。`errors.Is()` 能正确处理包装后的错误。
:::

## 错误分类

### 配置阶段

`jwt.New()` 可能返回以下错误：

| 错误 | 原因 | 解决方法 |
|------|------|----------|
| `ErrInvalidConfig` | 多项配置不合法 | 检查 Config 各字段 |
| `ErrInvalidSecretKey` | HMAC 密钥不足 32 字节或为弱密钥 | 使用更强的密钥 |
| `ErrInvalidSigningMethod` | 不支持的签名算法 | 使用内置的 12 种算法 |

### 令牌操作

| 错误 | 方法 | 处理建议 |
|------|------|----------|
| `ErrEmptyToken` | 所有令牌操作方法 | 检查请求头 |
| `ErrInvalidToken` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | 签名不匹配，拒绝访问 |
| `ErrAlgorithmMismatch` | Parse, Refresh, ParseInto, RefreshInto | 令牌算法与配置不匹配，拒绝访问 |
| `ErrExpirationRequired` | Parse, Refresh, ParseInto, RefreshInto | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenTypeMismatch` | Refresh, RefreshInto；启用 `RejectRefreshAsAccess` 时的 Parse / ParseInto | 令牌类型不符：访问令牌尝试刷新，或刷新令牌被用作访问令牌，拒绝访问 |
| `ErrTokenExpired` | Parse, Refresh, ParseInto, RefreshInto | 引导用户刷新令牌 |
| `ErrTokenNotValidYet` | Parse, Refresh, ParseInto, RefreshInto | 检查时钟同步 |
| `ErrTokenInvalidIssuer` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | 签发者不匹配 |
| `ErrTokenInvalidAudience` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | 受众不匹配 |
| `ErrTokenRevoked` | Parse, Refresh, ParseInto, RefreshInto | 令牌已吊销，拒绝访问 |
| `ErrInvalidClaims` | Create, CreateRefresh, Parse, Refresh, ParseInto, RefreshInto | 业务验证失败 |
| `ErrTokenMissingID` | Revoke, IsRevoked；启用 `RotateRefreshTokens` 时的 Refresh / RefreshInto | 令牌缺少 jti |
| `ErrRefreshRotationFailed` | Refresh, RefreshInto（启用 `RotateRefreshTokens` 时） | 轮换时吊销旧刷新令牌失败，无新令牌签发 |

### 限流与黑名单

| 错误 | 方法 | 处理建议 |
|------|------|----------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | 返回 429 |
| `ErrBlacklistNotConfigured` | Revoke；启用 `RotateRefreshTokens` 时的 Refresh / RefreshInto | 配置黑名单 |

### 生命周期

| 错误 | 方法 | 处理建议 |
|------|------|----------|
| `ErrProcessorClosed` | 所有方法 | 重新创建 Processor |
| `ErrStoreClosed` | Revoke 等 | 存储已关闭 |

## 错误类型

### ValidationError

字段级验证失败时返回，包含具体的字段和错误信息：

```go
type ValidationError struct {
    Field   string  // 出错的字段名
    Message string  // 错误描述
    Err     error   // 内部错误
}
```

## 错误包装链

CyberGo JWT 的错误分为哨兵错误（可用 `errors.Is` 匹配）和包装错误（需 `errors.As` 提取结构化信息）。理解包装链能帮你精准定位失败原因。

### ValidationError 与 errors.As

字段级校验失败（长度超限、注入检测等）返回 `*ValidationError`，包含具体的字段名和错误信息。无论它被多少层包装，`errors.As` 都能穿透：

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("字段: %s, 原因: %s\n", ve.Field, ve.Message)
        // 字段：user_id, 原因：suspicious pattern detected
        return
    }
    // 非字段级错误，走 errors.Is 分支
}
```

### ErrInvalidClaims 包装 Claims.Validate()

`Claims.Validate()`（或自定义 Claims 的 `Validate()`）返回的是**描述性错误**（如 `errors.New("user_id is required")`），而非哨兵错误。Processor 会将其包装为 `ErrInvalidClaims`：

```text
invalid claims: user_id is required
└── ErrInvalidClaims（哨兵，外层）
    └── user_id is required（描述性，内层）
```

因此匹配方式是双层的：

```go
if errors.Is(err, jwt.ErrInvalidClaims) {
    // 是 Claims 验证失败这一类别
    fmt.Println("详情：", err) // invalid claims: user_id is required
}
```

### ParseUnverified 的解析错误

[`ParseUnverified`](../api-reference/processor#parseunverified) 在令牌格式错误（如 base64 解码失败、JSON 解析失败）时返回的解析错误是**包装错误**，不是哨兵错误：

```go
err := processor.ParseUnverified(malformedToken, &claims)
if err != nil {
    // ❌ 无法用 errors.Is 匹配具体原因
    // ✅ 只能判断"解析失败"这一事实
    fmt.Println("解析失败：", err) // failed to parse token: ...
}
```

`ParseUnverified` 仅有的两个哨兵错误是 `ErrProcessorClosed`（Processor 已关闭）和 `ErrEmptyToken`（传入空字符串），其余格式错误均无法用 `errors.Is` 精确匹配。

::: tip 何时用 errors.Is vs errors.As
- **`errors.Is`**：匹配哨兵错误（`ErrTokenExpired`、`ErrInvalidClaims` 等），用于判断"是哪一类失败"。
- **`errors.As`**：提取结构化错误（`*ValidationError`），用于获取"具体哪个字段出了什么问题"。
- 两者可组合使用：先用 `errors.Is` 定位类别，再用 `errors.As` 提取细节。
:::

## HTTP 状态码映射

在 RESTful API 中，将 JWT 错误映射到合适的 HTTP 状态码是最佳实践——客户端可据此区分"凭据问题"（401）、"请求格式问题"（400）和"服务端问题"（500）。

### 映射表

| JWT 错误 | HTTP 状态码 | 客户端动作 |
|----------|-------------|------------|
| `ErrEmptyToken` | 401 Unauthorized | 提供认证令牌 |
| `ErrInvalidToken` | 401 Unauthorized | 重新登录 |
| `ErrAlgorithmMismatch` | 401 Unauthorized | 令牌来源不受信，重新登录 |
| `ErrTokenExpired` | 401 Unauthorized | 用刷新令牌换取新令牌 |
| `ErrTokenRevoked` | 401 Unauthorized | 令牌已吊销，重新登录 |
| `ErrTokenInvalidIssuer` | 401 Unauthorized | 令牌签发方不匹配 |
| `ErrTokenInvalidAudience` | 401 Unauthorized | 令牌受众不匹配 |
| `ErrTokenNotValidYet` | 401 Unauthorized | 检查客户端时钟同步 |
| `ErrTokenTypeMismatch` | 401 Unauthorized | 用正确的刷新令牌 |
| `ErrExpirationRequired` | 401 Unauthorized | 令牌缺少过期声明 |
| `ErrInvalidClaims` | 400 Bad Request | 修正 Claims 内容（创建场景） |
| `ErrRateLimitExceeded` | 429 Too Many Requests | 降低请求频率，稍后重试 |
| `ErrProcessorClosed` | 500 Internal Server Error | 服务端需重启 Processor |

::: tip RESTful 最佳实践
- **401 Unauthorized**：所有令牌有效性问题（过期、吊销、签名错误、签发者/受众不匹配）。客户端应引导用户重新认证或刷新令牌。
- **400 Bad Request**：创建令牌时 Claims 验证失败——这是调用方的编程错误，而非认证失败。
- **429 Too Many Requests**：限流触发时返回此码，并附带 `Retry-After` 头告知客户端等待时间。
- **500 Internal Server Error**：`ErrProcessorClosed` 属于服务端状态异常，不应暴露给客户端。
:::

## Web 服务中的错误处理

下面的处理器覆盖了 `Parse` 可能返回的全部常见错误，并按 [HTTP 状态码映射](#http-状态码映射) 返回合适的响应：

<!-- check-code: skip -->
```go
package main

import (
    "encoding/json"
    "errors"
    "net/http"

    "github.com/cybergodev/jwt"
)

// authError 将 JWT 错误映射为 HTTP 状态码和消息
func authError(w http.ResponseWriter, err error) {
    w.Header().Set("Content-Type", "application/json")

    switch {
    // 令牌过期 — 引导客户端刷新
    case errors.Is(err, jwt.ErrTokenExpired):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_expired",
            "message": "令牌已过期，请刷新",
        })

    // 令牌已吊销
    case errors.Is(err, jwt.ErrTokenRevoked):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_revoked",
            "message": "令牌已被吊销",
        })

    // 签发者不匹配
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_issuer",
            "message": "签发者不匹配",
        })

    // 受众不匹配
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_audience",
            "message": "受众不匹配",
        })

    // 尚未生效 — 时钟不同步
    case errors.Is(err, jwt.ErrTokenNotValidYet):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_not_valid_yet",
            "message": "令牌尚未生效",
        })

    // 算法不匹配
    case errors.Is(err, jwt.ErrAlgorithmMismatch):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "algorithm_mismatch",
            "message": "签名算法不匹配",
        })

    // 令牌无效（签名错误、格式错误、空令牌）
    case errors.Is(err, jwt.ErrInvalidToken),
        errors.Is(err, jwt.ErrEmptyToken),
        errors.Is(err, jwt.ErrExpirationRequired):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_token",
            "message": "令牌无效",
        })

    // Claims 验证失败 — 尝试提取字段级细节
    case errors.Is(err, jwt.ErrInvalidClaims):
        var ve *jwt.ValidationError
        if errors.As(err, &ve) {
            w.WriteHeader(http.StatusBadRequest)
            json.NewEncoder(w).Encode(map[string]string{
                "error":   "validation_failed",
                "field":   ve.Field,
                "message": ve.Message,
            })
        } else {
            w.WriteHeader(http.StatusBadRequest)
            json.NewEncoder(w).Encode(map[string]string{
                "error":   "validation_failed",
                "message": "声明验证失败",
            })
        }

    // 限流
    case errors.Is(err, jwt.ErrRateLimitExceeded):
        w.Header().Set("Retry-After", "60")
        w.WriteHeader(http.StatusTooManyRequests)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "rate_limited",
            "message": "请求过于频繁，请稍后重试",
        })

    // 系统错误 — Processor 已关闭
    case errors.Is(err, jwt.ErrProcessorClosed):
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "internal_error",
            "message": "服务暂时不可用",
        })

    // 兜底
    default:
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "auth_failed",
            "message": "认证失败",
        })
    }
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, err := processor.Parse(tokenString)
    if err != nil {
        authError(w, err)
        return
    }
    // 认证通过，处理请求
    _ = claims
}
```

::: tip 复用 authError
`authError` 是一个与具体路由无关的错误映射函数，可被所有需要认证的处理器复用。在[刷新端点](../examples/web-server#_5-刷新端点-refresh)中处理 `ErrTokenTypeMismatch` 时也可调用。
:::

## 下一步

- [API 参考 → 错误](../api-reference/errors) — 完整错误列表
- [API 参考 → 类型](../api-reference/types#validationerror) — 错误类型定义
