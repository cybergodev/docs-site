---
sidebar_label: "Processor"
title: "Processor - CyberGo JWT | 核心令牌操作类型"
description: "Processor 是 CyberGo JWT 的核心类型，提供令牌创建、解析、刷新、吊销、不验签解析与关闭等公开方法。本页给出各方法的签名、参数、返回值、错误与示例，并集中列出通用错误表与弃用迁移路径。"
sidebar_position: 20
---

# Processor

Processor 是 JWT 操作的核心类型，实现了 [`TokenManager`](./interfaces#tokenmanager) 接口。所有方法并发安全。

通过 [`jwt.New(cfg)`](./functions#new) 创建实例。

## 方法一览

| 方法 | 说明 |
|------|------|
| [`Processor.Create`](#create) | 创建访问令牌 |
| [`Processor.CreateRefresh`](#createrefresh) | 创建刷新令牌 |
| [`Processor.Parse`](#parse) | 验证并解析访问令牌（v1.2.3+） |
| [`Processor.ParseInto`](#parseinto) | 验证并原地填充自定义 Claims（v1.2.3+） |
| [`Processor.Refresh`](#refresh) | 用刷新令牌换取新访问令牌 |
| [`Processor.RefreshInto`](#refreshinto) | 以自定义 Claims 刷新令牌 |
| [`Processor.Revoke`](#revoke) | 吊销令牌（写入黑名单） |
| [`Processor.IsRevoked`](#isrevoked) | 检查令牌是否已吊销 |
| [`Processor.ParseUnverified`](#parseunverified) | 不验签解析（仅限调试/日志） |
| [`Processor.Close`](#close) | 释放资源并清除密钥 |
| [`Processor.IsClosed`](#isclosed) | 检查是否已关闭 |

已弃用的 `Validate` / `ValidateInto` 仍可用，迁移目标分别是 `Parse` / `ParseInto`（见[从 Validate 迁移到 Parse](#从-validate-迁移到-parse)）。

::: info 接收者为 nil 时的行为
`*Processor` 的全部方法对 nil 接收者返回 `ErrProcessorClosed`，`IsClosed` 返回 `true`。nil 指针不会导致 panic，但调用方无法据此区分「未初始化」与「已关闭」。
:::

## 通用错误

`Parse`、`ParseInto`、`Refresh`、`RefreshInto` 共享同一条解析与验证管道。下表列出该管道的全部错误；各方法小节只补充该方法特有的错误，其余均指本表。

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭或为 nil |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效或令牌格式错误 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrExpirationRequired` | 启用 `RequireExpiration` 但令牌缺少 `exp` 声明 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrTokenTypeMismatch` | 令牌类型与调用场景不符（见各方法说明） |
| `ErrStoreClosed` | 黑名单存储已关闭（查询黑名单时返回） |

`Create` 与 `CreateRefresh` 的通用错误只有 `ErrProcessorClosed`、`ErrInvalidClaims`、`ErrRateLimitExceeded` 三项。

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

错误集合为 `ErrProcessorClosed`、`ErrInvalidClaims`、`ErrRateLimitExceeded` 三项。

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

错误集合同[通用错误](#通用错误)。

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
`Validate` 自 v1.2.3 起弃用，用 [`Parse`](#parse) 替代。布尔返回值 `valid` 恒等于 `err == nil`，属于冗余信息。
:::

验证 JWT 访问令牌，返回解析后的 Claims。实现直接委托 [`Parse`](#parse)。

与 [`Parse`](#parse) 的差异只有返回值：多一个 `bool`，其值恒等于 `err == nil`。参数与错误集合完全一致。

### 从 Validate 迁移到 Parse

删除布尔检查，改为直接判断 `err`。

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

参数与 [`Parse`](#parse) 相同：`tokenString string`。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `Claims` | 解析后的声明（值拷贝） |
| `valid` | `bool` | 是否有效（恒等于 `err == nil`） |
| `err` | `error` | 验证失败时返回错误 |

### 错误

错误集合同[通用错误](#通用错误)。

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

创建刷新令牌，使用 `RefreshTokenTTL` 而非 `AccessTokenTTL`。Claims 校验规则与 [`Create`](#create) 相同。

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

错误集合与 [`Create`](#create) 相同：`ErrProcessorClosed`、`ErrInvalidClaims`、`ErrRateLimitExceeded`。

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

用刷新令牌换取新的访问令牌。刷新令牌会先经过完整验证（签名、过期、黑名单），通过后签发新的访问令牌。原令牌的 `IssuedAt`、`ExpiresAt`、`ID` 会被重置并重新生成。

:::warning 自定义 Claims 的两条约束
- `Refresh` 按内置 `Claims` 重建令牌。传入自定义类型的刷新令牌时，自定义字段全部丢弃，新令牌只保留注册声明。需要保留业务字段时改用 [`RefreshInto`](#refreshinto)。
- 按内置 `Claims` 校验时，刷新令牌必须带 `UserID` 或 `Username`。只有 `Subject` 的刷新令牌会返回 `invalid claims: user_id or username is required`。
:::

:::info 令牌类型与轮换
- **令牌类型校验**：`token_type=access` 的令牌会被拒绝，返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)。未携带 `token_type` 的旧令牌出于向后兼容仍被接受。
- **默认不自动吊销原令牌**：`Refresh` 默认不吊销传入的刷新令牌。原令牌在过期或被显式 [`Revoke()`](#revoke) 之前始终有效。需要一次性使用语义时，启用 `Config.RotateRefreshTokens`。权威说明见[令牌刷新与轮换](../guides/token-refresh#一次性轮换)。
:::

:::warning 安全说明
刷新时只验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）与基本结构有效性。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
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

除[通用错误](#通用错误)外，`Refresh` 特有的错误：

| 错误 | 触发条件 |
|------|----------|
| `ErrTokenTypeMismatch` | 用访问令牌（`token_type=access`）尝试刷新 |
| `ErrTokenMissingID` | 启用 `RotateRefreshTokens` 但刷新令牌缺少 `jti` 字段 |
| `ErrBlacklistNotConfigured` | 启用 `RotateRefreshTokens` 但未配置黑名单 |
| `ErrRefreshRotationFailed` | 启用 `RotateRefreshTokens` 时，底层黑名单存储返回错误 |
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

错误集合同[通用错误](#通用错误)。

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
`ValidateInto` 自 v1.2.3 起弃用，用 [`ParseInto`](#parseinto) 替代。布尔返回值的冗余性同 [`Validate`](#validate)，迁移方式也相同。
:::

验证令牌并填充到自定义 Claims 结构。实现直接委托 [`ParseInto`](#parseinto)。

与 [`ParseInto`](#parseinto) 的差异只有返回值：多一个 `bool`，其值恒等于 `err == nil`。参数与错误集合完全一致。

### 参数

参数与 [`ParseInto`](#parseinto) 相同：`tokenString string`、`claims CustomClaims`。

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 填充后的 Claims |
| `valid` | `bool` | 是否有效（恒等于 `err == nil`） |
| `err` | `error` | 验证失败时返回错误 |

### 从 ValidateInto 迁移到 ParseInto

```go
// 旧写法（已弃用）
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}

// 新写法：err 为 nil 即有效
result, err := processor.ParseInto(tokenString, myClaims)
if err != nil {
    // 处理错误
    return
}
fmt.Println(result.(*MyClaims).UserID)
```

### 错误

错误集合同[通用错误](#通用错误)。

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

使用自定义 Claims 刷新令牌。Claims 对象的时序字段（`IssuedAt`、`ExpiresAt`、`ID`）在操作后自动恢复，即使发生错误或 panic 也能保证恢复。自定义字段随新令牌保留。

自定义 Claims 类型应使用本方法而非 [`Refresh`](#refresh)，后者按内置 `Claims` 重建令牌，自定义字段会在重建时丢失。

:::info 令牌类型校验
`token_type=access` 的令牌会被拒绝（返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)），防止用访问令牌换取新令牌；未携带 `token_type` 的旧令牌出于向后兼容仍被接受。
:::

:::warning 安全说明
刷新时只验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）与基本结构有效性。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
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

除[通用错误](#通用错误)外，`RefreshInto` 特有的错误：

| 错误 | 触发条件 |
|------|----------|
| `ErrTokenTypeMismatch` | 用访问令牌（`token_type=access`）尝试刷新 |
| `ErrTokenMissingID` | 启用 `RotateRefreshTokens` 但刷新令牌缺少 `jti` 字段 |
| `ErrBlacklistNotConfigured` | 启用 `RotateRefreshTokens` 但未配置黑名单 |
| `ErrRefreshRotationFailed` | 启用 `RotateRefreshTokens` 时，底层黑名单存储返回错误 |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

通过验证签名并提取令牌 ID（jti）将令牌加入黑名单。仅持有有效签名的令牌可被吊销，防止恶意调用者将任意令牌 ID 加入黑名单。

:::info 黑名单条目 TTL
条目存活时间取令牌的剩余有效期，但下限 7 天、上限 30 天。下限保证短有效期令牌的吊销记录不会过早消失；上限防止超长 `exp` 长期占用存储。

容量按「峰值吊销量 × 条目存活时间」估算：普通访问令牌按下限 7 天，长 TTL 刷新令牌按其剩余有效期（上限 30 天）。无 `exp` 或已过期的令牌按 7 天下限处理。已过期的令牌仍可吊销，条目由黑名单自动清理。
:::

:::warning 内置存储的饱和行为
内置存储满时先清理已过期条目，再驱逐最早过期的约 10%，然后直接写入——`Add` 不会因容量满而失败。

代价是随驱逐丢弃的吊销记录会静默失效（fail-open），被吊销的令牌恢复可用。调大 `MaxSize` 可压低 fail-open 概率。
:::

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | 要吊销的令牌 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `err` | `error` | 验证失败或黑名单存储已关闭时返回错误 |

### 错误

`Revoke` 只验证签名、签发者、受众与 jti，不检查 `exp`/`nbf`，因此不返回过期类错误。

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrBlacklistNotConfigured` | 黑名单未配置（`New()` 总会构造，实践中不可达） |
| `ErrInvalidToken` | 签名无效或令牌格式错误 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenMissingID` | 令牌缺少 `jti` 字段 |
| `ErrStoreClosed` | 黑名单存储已关闭 |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

检查令牌是否已被吊销。验证签名后查找令牌 jti 在黑名单中的状态。黑名单未配置时返回 `false` 与 `nil`。

与 `Revoke` 相同，本方法不检查 `exp`/`nbf`。

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

错误集合与 [`Revoke`](#revoke) 相同，只是黑名单未配置时返回 `false` 与 `nil`，不返回 `ErrBlacklistNotConfigured`。

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

解析令牌但不验证签名。适用于提取 Claims 信息但不需要信任的场景。

:::warning 警告
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

释放资源并清除密钥，同时关闭内部的限流器与黑名单存储。可多次调用，第二次起返回 `ErrProcessorClosed`。

清除范围随算法不同：

- **HMAC**：把 `New()` 复制进来的密钥字节清零，并清空进程级的 HMAC hasher 池。池是包级共享的，因此这一操作也会让其他存活 Processor 的缓存 hasher 失效——它们下次使用时透明重建，正确性不受影响，只有一次性性能开销。
- **非对称**：只丢弃对 `SigningKey` / `VerificationKey` 的引用，不会改写调用方持有的 `*rsa.PrivateKey` / `*ecdsa.PrivateKey`。密钥对象仍由调用方负责销毁。

关闭前会等待在途操作结束（获取写锁）。

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
