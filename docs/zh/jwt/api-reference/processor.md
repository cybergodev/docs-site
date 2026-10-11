---
sidebar_label: "Processor"
title: "Processor - CyberGo JWT | 核心令牌操作类型"
description: "Processor 是 CyberGo JWT 核心类型：提供 Create、Parse、ParseInto、Refresh、Revoke、IsRevoked、ParseUnverified、Close 等全部令牌操作方法的签名、参数、返回值、错误与示例说明。"
sidebar_position: 20
---

# Processor

Processor 是 JWT 操作的核心类型，实现了 [`TokenManager`](./interfaces#tokenmanager) 接口。所有方法并发安全。

通过 [`jwt.New(cfg)`](./functions#new) 创建实例。

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

创建新的 JWT 访问令牌。接受任何实现 `CustomClaims` 接口的类型。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 令牌声明 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `token` | `string` | 签名的 JWT 字符串 |
| `err` | `error` | 验证或签名失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrRateLimitExceeded` | 超出限流阈值 |

### 示例

```go
// 内置 Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// 自定义 Claims
myClaims := &MyClaims{UserID: "123"}
token, err := processor.Create(myClaims)
```

---

## Parse <Badge type="tip" text="v1.2.3+" />

```go
func (p *Processor) Parse(tokenString string) (Claims, error)
```

验证 JWT 访问令牌并返回解析后的 Claims（值拷贝）。**`err` 为 nil 即令牌有效**，无需再检查布尔值。取代已弃用的 [`Validate`](#validate)。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `Claims` | 解析后的声明（值拷贝） |
| `err` | `error` | 验证失败时返回错误；nil 即有效 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 令牌为 refresh 类型且启用了 `RejectRefreshAsAccess` |

### 示例

```go
claims, err := processor.Parse(tokenString)
if err != nil {
    // 处理错误
    return
}
fmt.Println(claims.UserID)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

::: warning 已弃用
`Validate` 自 v1.2.3 起弃用：布尔返回值 `valid` 恒等于 `err == nil`，属于冗余信息。请改用返回 `(Claims, error)` 的 [`Parse`](#parse)。
:::

验证 JWT 访问令牌，返回解析后的 Claims。内部直接委托 [`Parse`](#parse)。

### 从 Validate 迁移到 Parse

`valid` 恒等于 `err == nil`，迁移时删除布尔检查即可：

```go
// 旧写法（已弃用）
parsed, valid, err := processor.Validate(token)
if valid {
    // ...
}

// 新写法：err 为 nil 即有效
parsed, err := processor.Parse(token)
if err != nil {
    // 处理错误
}
```

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `Claims` | 解析后的声明（值拷贝） |
| `valid` | `bool` | 是否有效（恒等于 `err == nil`） |
| `err` | `error` | 验证失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 令牌为 refresh 类型且启用了 `RejectRefreshAsAccess` |

### 示例

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    // 处理错误
    return
}
if valid {
    fmt.Println(claims.UserID)
}
```

---

## CreateRefresh

```go
func (p *Processor) CreateRefresh(claims CustomClaims) (string, error)
```

创建刷新令牌，使用 `RefreshTokenTTL` 而非 `AccessTokenTTL`。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 令牌声明 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `token` | `string` | 签名的刷新令牌 |
| `err` | `error` | 验证或签名失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

刷新现有的刷新令牌，返回新的访问令牌。刷新令牌会先经过完整验证（签名、过期、黑名单），通过后签发新的访问令牌；原令牌的 `IssuedAt`、`ExpiresAt`、`ID` 会被重置并重新生成。

:::info 令牌类型与轮换
- **令牌类型校验**：`token_type=access` 的令牌会被拒绝（返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)），防止用访问令牌换取新令牌；未携带 `token_type` 的旧令牌出于向后兼容仍被接受。
- **默认不自动吊销原令牌**：`Refresh` 默认不会吊销传入的刷新令牌，原令牌在过期或被显式 [`Revoke()`](#revoke) 之前始终有效。如需"一次性使用"语义，推荐启用 `Config.RotateRefreshTokens`（v1.2.3 起，吊销发生在新令牌签发之前，详见[令牌刷新与轮换](../guides/token-refresh#一次性轮换)）；手动在 `Refresh` 成功后调用 `Revoke(refreshTokenString)` 是等效替代方案。
:::

:::warning 安全说明
刷新时仅验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）和基本结构有效性（UserID 或 Username 必须存在）。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `refreshTokenString` | `string` | 刷新令牌 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `token` | `string` | 新的访问令牌 |
| `err` | `error` | 验证失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 用访问令牌（`token_type=access`）尝试刷新 |
| `ErrTokenMissingID` | 启用 `RotateRefreshTokens` 但刷新令牌缺少 `jti` 字段 |
| `ErrBlacklistNotConfigured` | 启用 `RotateRefreshTokens` 但未配置黑名单 |
| `ErrRefreshRotationFailed` | 启用 `RotateRefreshTokens` 时吊销旧刷新令牌失败（包装底层存储错误） |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## ParseInto <Badge type="tip" text="v1.2.3+" />

```go
func (p *Processor) ParseInto(tokenString string, claims CustomClaims) (CustomClaims, error)
```

验证令牌并将解析出的数据**原地填充**到自定义 Claims 结构，成功时返回传入的同一指针。**`err` 为 nil 即令牌有效**。与返回值拷贝的 [`Parse`](#parse) 不同，这里直接填充调用方提供的结构体。

::: warning 出错时的 claims 状态
验证失败时传入的 claims 可能已被**部分填充**，不应继续使用。
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |
| `claims` | `CustomClaims` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 填充后的 Claims（与传入指针相同） |
| `err` | `error` | 验证失败时返回错误；nil 即有效 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 令牌为 refresh 类型且启用了 `RejectRefreshAsAccess` |

### 示例

```go
myClaims := &MyClaims{}
result, err := processor.ParseInto(tokenString, myClaims)
if err != nil {
    // 处理错误
    return
}
fmt.Println(result.(*MyClaims).UserID)
```

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

::: warning 已弃用
`ValidateInto` 自 v1.2.3 起弃用：布尔返回值 `valid` 恒等于 `err == nil`。请改用返回 `(CustomClaims, error)` 的 [`ParseInto`](#parseinto)，迁移方式与 [`Validate → Parse`](#从-validate-迁移到-parse) 相同。
:::

验证令牌并填充到自定义 Claims 结构。返回与传入的 `claims` 相同的指针。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |
| `claims` | `CustomClaims` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 填充后的 Claims |
| `valid` | `bool` | 是否有效（恒等于 `err == nil`） |
| `err` | `error` | 验证失败时返回错误 |

### 示例

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}
```

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

使用自定义 Claims 刷新令牌。Claims 对象的时序字段（`IssuedAt`、`ExpiresAt`、`ID`）在操作后自动恢复，即使发生错误或 panic 也能保证恢复。

:::info 令牌类型校验
`token_type=access` 的令牌会被拒绝（返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)），防止用访问令牌换取新令牌；未携带 `token_type` 的旧令牌出于向后兼容仍被接受。
:::

:::warning 安全说明
刷新时仅验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）和基本结构有效性。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `refreshTokenString` | `string` | 刷新令牌 |
| `claims` | `CustomClaims` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `token` | `string` | 新的访问令牌 |
| `err` | `error` | 验证失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 用访问令牌（`token_type=access`）尝试刷新 |
| `ErrTokenMissingID` | 启用 `RotateRefreshTokens` 但刷新令牌缺少 `jti` 字段 |
| `ErrBlacklistNotConfigured` | 启用 `RotateRefreshTokens` 但未配置黑名单 |
| `ErrRefreshRotationFailed` | 启用 `RotateRefreshTokens` 时吊销旧刷新令牌失败（包装底层存储错误） |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

通过验证签名并提取令牌 ID（jti）将令牌加入黑名单。仅持有有效签名的令牌可被吊销，防止恶意调用者将任意令牌 ID 加入黑名单。

:::info TTL 行为
- 令牌的 `exp` 决定黑名单条目的 TTL
- 无 `exp` 的令牌默认 7 天 TTL
- TTL 上限 30 天，防止伪造的超长 `exp` 锁定内存（DoS 防护）
- 已过期的令牌仍可吊销；条目会由黑名单自动清理
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | 要吊销的令牌 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `err` | `error` | 吊销失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrBlacklistNotConfigured` | 黑名单未配置 |
| `ErrInvalidToken` | 签名无效或令牌格式错误 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenMissingID` | 令牌缺少 `jti` 字段 |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

检查令牌是否已被吊销。通过验证签名后查找令牌的 jti 在黑名单中的状态。当黑名单未配置时返回 `false` 和 `nil` 错误。

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `revoked` | `bool` | 是否已吊销 |
| `err` | `error` | 查询失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效或令牌格式错误 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenMissingID` | 令牌缺少 `jti` 字段 |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

解析令牌但不验证签名。适用于提取 Claims 信息但不需要信任的场景。

:::danger 警告
返回的 Claims 未经验证，**不可信任**。仅用于调试或日志场景。
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |
| `claims` | `any` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `err` | `error` | 解析失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| 包装错误 | 令牌格式错误时返回包装的解析错误（非哨兵错误，无法用 `errors.Is` 匹配） |

---

## Close

```go
func (p *Processor) Close() error
```

释放资源并安全清除密钥。可多次调用，后续调用返回 `ErrProcessorClosed`。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `err` | `error` | 关闭失败时返回错误 |

---

## IsClosed

```go
func (p *Processor) IsClosed() bool
```

检查 Processor 是否已关闭。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `closed` | `bool` | 是否已关闭 |
