---
sidebar_label: "错误"
title: "错误参考 - CyberGo JWT | 哨兵错误清单"
description: "错误参考：CyberGo JWT 定义 20 个哨兵错误，覆盖配置校验、令牌验证、签名算法、过期、签发者与受众、黑名单、速率限制与生命周期场景。本页给出错误一览表、按场景分类、errors.Is 判断顺序与 ValidationError 的提取方式。"
sidebar_position: 70
---

# 错误

## 哨兵错误

哨兵错误通过 `errors.Is()` 判断：

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
    ErrTokenTypeMismatch     = errors.New("token type mismatch")
    ErrRefreshRotationFailed = errors.New("refresh rotation failed")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")
    ErrExpirationRequired    = errors.New("token missing expiration claim")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("blacklist store is closed")
)
```

### 错误一览

| 错误 | 说明 | 使用 `errors.Is()` 检查 |
|------|------|------------------------|
| `ErrInvalidConfig` | 配置无效 | `New()`、`Config.Validate()` |
| `ErrInvalidSecretKey` | 密钥无效 | `New()` |
| `ErrInvalidSigningMethod` | 签名方法无效 | `New()` |
| `ErrInvalidToken` | 令牌无效（签名错误等） | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` |
| `ErrEmptyToken` | 令牌为空 | 所有令牌操作方法 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrTokenRevoked` | 令牌已吊销 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrTokenMissingID` | 令牌缺少 ID | `Revoke()`、`IsRevoked()`；启用 `RotateRefreshTokens` 时的 `Refresh()` / `RefreshInto()` |
| `ErrTokenTypeMismatch` | 令牌类型不匹配（用访问令牌刷新，或用刷新令牌访问） | `Refresh()`、`RefreshInto()`；启用 `RejectRefreshAsAccess` 时的 `Parse()` / `ParseInto()` |
| `ErrRefreshRotationFailed` | 刷新令牌轮换失败（包装底层黑名单存储错误；内置存储满不会触发） | `Refresh()`、`RefreshInto()`（启用 `RotateRefreshTokens` 时） |
| `ErrTokenExpired` | 令牌过期 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrTokenNotValidYet` | 令牌尚未生效 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrTokenInvalidIssuer` | 签发者不匹配 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` |
| `ErrTokenInvalidAudience` | 受众不匹配 | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrInvalidClaims` | Claims 验证失败 | `Create()`、`CreateRefresh()`、`Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` |
| `ErrRateLimitExceeded` | 超出限流 | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` |
| `ErrBlacklistNotConfigured` | 黑名单未配置；经 `New()` 构建的处理器总是自带黑名单，实践中不可达 | `Revoke()`；启用 `RotateRefreshTokens` 时的 `Refresh()` / `RefreshInto()` |
| `ErrProcessorClosed` | Processor 已关闭 | 所有方法 |
| `ErrStoreClosed` | 存储已关闭 | `Revoke()` 等 |

::: info 判断顺序
`ErrAlgorithmMismatch` 同时满足 `errors.Is(err, ErrInvalidToken)`。分支判断时先匹配 `ErrAlgorithmMismatch`，再匹配 `ErrInvalidToken`，否则算法不匹配会被归入泛化的无效令牌分支。
:::

内置内存存储写满时不报错，而是驱逐条目（fail-open），被驱逐的吊销记录会静默失效。`ErrRefreshRotationFailed` 只在底层存储真实返回错误时出现，例如自定义存储后端不可用或已关闭。

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
| `ErrInvalidToken` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` | 签名不匹配或格式错误 |
| `ErrAlgorithmMismatch` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 令牌 header 中的算法与配置不匹配 |
| `ErrExpirationRequired` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 超过 `exp` 时间 |
| `ErrTokenNotValidYet` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 尚未到达 `nbf` 时间 |
| `ErrTokenInvalidIssuer` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` | `iss` 与 `Config.Issuer` 不匹配 |
| `ErrTokenInvalidAudience` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()`、`Revoke()`、`IsRevoked()` | `aud` 与 `Config.ExpectedAudience` 不匹配 |
| `ErrTokenRevoked` | `Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 令牌在黑名单中 |
| `ErrTokenTypeMismatch` | `Refresh()`、`RefreshInto()`；启用 `RejectRefreshAsAccess` 时的 `Parse()` / `ParseInto()` | 用访问令牌（`token_type=access`）尝试刷新，或刷新令牌被用作访问令牌 |
| `ErrInvalidClaims` | `Create()`、`CreateRefresh()`、`Parse()`、`Refresh()`、`ParseInto()`、`RefreshInto()` | 业务验证失败 |
| `ErrTokenMissingID` | `Revoke()`、`IsRevoked()`；启用 `RotateRefreshTokens` 时的 `Refresh()` / `RefreshInto()` | 令牌缺少 `jti` 字段 |

#### 限流与黑名单

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrRateLimitExceeded` | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` | 超出窗口内请求上限 |
| `ErrBlacklistNotConfigured` | `Revoke()`；启用 `RotateRefreshTokens` 时的 `Refresh()` / `RefreshInto()` | 未配置黑名单存储。`New()` 总会构造内置存储，实践中不可达 |
| `ErrRefreshRotationFailed` | `Refresh()`、`RefreshInto()`（启用 `RotateRefreshTokens` 时） | 吊销旧刷新令牌时底层存储返回错误，无新令牌签发 |
| `ErrTokenMissingID` | `Revoke()`、`IsRevoked()` | 令牌缺少 `jti` 字段 |

#### 生命周期

| 错误 | 触发方法 | 典型原因 |
|------|----------|----------|
| `ErrProcessorClosed` | 所有方法 | 调用 `Close()` 后继续操作 |
| `ErrStoreClosed` | `Revoke()` 等 | 黑名单存储已关闭 |

---

## 错误处理模式

```go
import "errors"

claims, err := processor.Parse(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 令牌过期 - 引导用户刷新
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 令牌已吊销 - 拒绝访问
    case errors.Is(err, jwt.ErrAlgorithmMismatch):
        // 算法不匹配 - 优先于 ErrInvalidToken 判断
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

字段级验证失败错误，通常被 `ErrInvalidClaims` 包装，用 `errors.As` 提取。`Err` 字段保存可选的底层错误，`Unwrap` 方法返回它，因此 `errors.Is` / `errors.As` 可以继续解链到更深层原因。字段与方法详情见 [类型与常量 → ValidationError](./types#validationerror)。

