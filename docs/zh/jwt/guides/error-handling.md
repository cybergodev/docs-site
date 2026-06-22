---
title: "错误处理 - CyberGo JWT | 哨兵错误匹配"
description: "错误处理指南：分类讲解 CyberGo JWT 全部 19 个哨兵错误在配置、令牌验证、限流与生命周期阶段的触发条件，演示 errors.Is 匹配、ValidationError 字段错误与标准化响应实践。"
---

# 错误处理

CyberGo JWT 使用哨兵错误（sentinel errors）模式，所有错误通过 `errors.Is()` 判断。

## 基本模式

```go
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
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | 签名不匹配，拒绝访问 |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | 令牌算法与配置不匹配，拒绝访问 |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | 引导用户刷新令牌 |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | 检查时钟同步 |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | 签发者不匹配 |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | 受众不匹配 |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | 令牌已吊销，拒绝访问 |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | 业务验证失败 |
| `ErrTokenMissingID` | Revoke, IsRevoked | 令牌缺少 jti |

### 限流与黑名单

| 错误 | 方法 | 处理建议 |
|------|------|----------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | 返回 429 |
| `ErrBlacklistNotConfigured` | Revoke | 配置黑名单 |

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

## Web 服务中的错误处理

```go
func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, valid, err := processor.Validate(tokenString)
    if err != nil {
        switch {
        case errors.Is(err, jwt.ErrTokenExpired):
            http.Error(w, "token expired", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrTokenRevoked):
            http.Error(w, "token revoked", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrInvalidToken):
            http.Error(w, "invalid token", http.StatusUnauthorized)
        default:
            http.Error(w, "auth failed", http.StatusUnauthorized)
        }
        return
    }
    if !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }
    // 处理请求
}
```

## 下一步

- [API 参考 → 错误](../api-reference/errors) — 完整错误列表
- [API 参考 → 类型](../api-reference/types#validationerror) — 错误类型定义
