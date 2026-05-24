---
title: "错误 - JWT API 参考"
description: "CyberGo JWT 错误 API 参考：17 个哨兵错误（ErrTokenExpired、ErrTokenRevoked 等）、ValidationError 类型及 errors.Is() 错误匹配模式。"
---

# 错误

## 哨兵错误

所有错误均使用 `errors.Is()` 进行判断：

```go
var (
    ErrInvalidConfig        = errors.New("invalid configuration")
    ErrInvalidSecretKey     = errors.New("invalid secret key")
    ErrInvalidSigningMethod = errors.New("invalid signing method")

    ErrInvalidToken          = errors.New("invalid token")
    ErrEmptyToken            = errors.New("empty token")
    ErrAlgorithmMismatch     = errors.New("token algorithm does not match configured signing method")
    ErrTokenRevoked          = errors.New("token revoked")
    ErrTokenMissingID        = errors.New("token missing ID")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("store closed")
)
```

### 错误一览

| 错误 | 说明 | 使用 `errors.Is()` 检查 |
|------|------|------------------------|
| `ErrInvalidConfig` | 配置无效 | `Config.Validate()` |
| `ErrInvalidSecretKey` | 密钥无效 | `New()` |
| `ErrInvalidSigningMethod` | 签名方法无效 | `New()` |
| `ErrInvalidToken` | 令牌无效（签名错误等） | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrEmptyToken` | 令牌为空 | 所有令牌操作方法 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenRevoked` | 令牌已吊销 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenMissingID` | 令牌缺少 ID | `IsRevoked()` |
| `ErrTokenExpired` | 令牌过期 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenNotValidYet` | 令牌尚未生效 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenInvalidIssuer` | 签发者不匹配 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenInvalidAudience` | 受众不匹配 | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrInvalidClaims` | Claims 验证失败 | `Create()`、`CreateRefresh()`、`Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrRateLimitExceeded` | 超出限流 | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` |
| `ErrBlacklistNotConfigured` | 黑名单未配置 | `Revoke()` |
| `ErrProcessorClosed` | Processor 已关闭 | 所有方法 |
| `ErrStoreClosed` | 存储已关闭 | `Revoke()` 等 |

### 按场景分类

#### 配置阶段

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrInvalidConfig` | `New()` | 多个配置项不合法 |
| `ErrInvalidSecretKey` | `New()` | HMAC 密钥不足 32 字节或为弱密钥 |
| `ErrInvalidSigningMethod` | `New()` | 不在 12 种内置算法中 |

#### 令牌验证

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrEmptyToken` | 所有令牌操作方法 | 传入空字符串 |
| `ErrInvalidToken` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 签名不匹配或格式错误 |
| `ErrAlgorithmMismatch` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 令牌 header 中的算法与配置不匹配 |
| `ErrTokenExpired` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 超过 `exp` 时间 |
| `ErrTokenNotValidYet` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 尚未到达 `nbf` 时间 |
| `ErrTokenInvalidIssuer` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `iss` 与 `Config.Issuer` 不匹配 |
| `ErrTokenInvalidAudience` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `aud` 与 `Config.ExpectedAudience` 不匹配 |
| `ErrTokenRevoked` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 令牌在黑名单中 |
| `ErrInvalidClaims` | `Create()`、`CreateRefresh()`、`Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 业务验证失败 |
| `ErrTokenMissingID` | `IsRevoked()` | 令牌缺少 `jti` 字段 |

#### 限流与黑名单

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrRateLimitExceeded` | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` | 超出窗口内请求上限 |
| `ErrBlacklistNotConfigured` | `Revoke()` | 未配置黑名单存储 |
| `ErrTokenMissingID` | `IsRevoked()` | 令牌缺少 `jti` 字段 |

#### 生命周期

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrProcessorClosed` | 所有方法 | 调用 `Close()` 后继续操作 |
| `ErrStoreClosed` | `Revoke()` 等 | 黑名单存储已关闭 |

---

## 错误处理模式

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 令牌过期 - 引导用户刷新
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 令牌已吊销 - 拒绝访问
    case errors.Is(err, jwt.ErrInvalidToken):
        // 签名无效 - 拒绝访问
    case errors.Is(err, jwt.ErrProcessorClosed):
        // 系统错误 - Processor 已关闭
    default:
        // 未知错误
    }
}
```

---

## 错误类型

### ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

字段级验证失败错误。详见 [类型与常量 → ValidationError](./types#validationerror)。

