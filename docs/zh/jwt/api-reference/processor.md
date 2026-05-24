---
title: "Processor - JWT API 参考"
description: "CyberGo JWT Processor 核心 API 参考：Create、Validate、Refresh、Revoke、ValidateInto、RefreshInto、ParseUnverified 等全部方法签名与用法。"
---

# Processor

Processor 是 JWT 操作的核心类型，实现了 [`TokenManager`](./interfaces#tokenmanager) 接口。所有方法并发安全。

通过 [`jwt.New(cfg)`](./functions#new) 创建实例。

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

创建新的 JWT 访问令牌。接受任何实现 `CustomClaims` 接口的类型。

<Badge type="tip" text="v1.0.0+" />

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

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

验证 JWT 访问令牌，返回解析后的 Claims。

<Badge type="tip" text="v1.0.0+" />

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `Claims` | 解析后的声明（值拷贝） |
| `valid` | `bool` | 是否有效 |
| `err` | `error` | 验证失败时返回错误 |

### 错误

| 错误 | 触发条件 |
|------|----------|
| `ErrProcessorClosed` | Processor 已关闭 |
| `ErrEmptyToken` | 令牌为空 |
| `ErrInvalidToken` | 签名无效 |
| `ErrAlgorithmMismatch` | 令牌算法与配置不匹配 |
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |

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

<Badge type="tip" text="v1.0.0+" />

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

刷新现有的刷新令牌，返回新的访问令牌。

:::warning 安全说明
刷新时仅验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）和基本结构有效性（UserID 或 Username 必须存在）。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
:::

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

验证令牌并填充到自定义 Claims 结构。返回与传入的 `claims` 相同的指针。

<Badge type="tip" text="v1.0.0+" />

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |
| `claims` | `CustomClaims` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `claims` | `CustomClaims` | 填充后的 Claims |
| `valid` | `bool` | 是否有效 |
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

:::warning 安全说明
刷新时仅验证标准 JWT 字段（exp、nbf、iss、aud、黑名单）和基本结构有效性。深度字段约束（长度限制、注入模式）不会重新检查，因为它们在创建时已验证。
:::

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenExpired` | 令牌过期 |
| `ErrTokenNotValidYet` | 令牌尚未生效 |
| `ErrTokenInvalidIssuer` | 签发者不匹配 |
| `ErrTokenInvalidAudience` | 受众不匹配 |
| `ErrTokenRevoked` | 令牌已吊销 |
| `ErrInvalidClaims` | Claims 验证失败 |
| `ErrRateLimitExceeded` | 超出限流阈值 |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

将令牌加入黑名单。

<Badge type="tip" text="v1.0.0+" />

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

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

检查令牌是否已被吊销。

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenMissingID` | 令牌缺少 ID |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

解析令牌但不验证签名。适用于提取 Claims 信息但不需要信任的场景。

:::danger 警告
返回的 Claims 未经验证，**不可信任**。仅用于调试或日志场景。
:::

<Badge type="tip" text="v1.0.0+" />

### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `tokenString` | `string` | JWT 字符串 |
| `claims` | `any` | 目标 Claims 指针 |

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `err` | `error` | 解析失败时返回错误 |

---

## Close

```go
func (p *Processor) Close() error
```

释放资源并安全清除密钥。可多次调用，后续调用返回 `ErrProcessorClosed`。

<Badge type="tip" text="v1.0.0+" />

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

<Badge type="tip" text="v1.0.0+" />

### 返回值

| 返回 | 类型 | 说明 |
|------|------|------|
| `closed` | `bool` | 是否已关闭 |
