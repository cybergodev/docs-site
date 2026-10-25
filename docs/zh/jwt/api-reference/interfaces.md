---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo JWT | 核心扩展接口"
description: "接口定义参考：TokenManager 令牌操作核心接口、CustomClaims 自定义声明与验证契约、BlacklistStore 黑名单后端、RateLimitProvider 限流器、ClockProvider 时钟注入，以及可选的 RateLimitKeyer 限流键接口，并给出各接口的内置实现类型，便于替换默认实现。"
sidebar_position: 50
---

# 接口定义

## TokenManager

```go
type TokenManager interface {
    Create(claims CustomClaims) (string, error)
    Validate(tokenString string) (Claims, bool, error)
    CreateRefresh(claims CustomClaims) (string, error)
    Refresh(refreshTokenString string) (string, error)
    ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
    RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
    Revoke(tokenString string) error
    IsRevoked(tokenString string) (bool, error)
    ParseUnverified(tokenString string, claims any) error
    Close() error
    IsClosed() bool
}
```

JWT 令牌操作核心接口。所有实现必须并发安全。默认实现为 [`*Processor`](./processor)。

::: info 兼容性说明
接口有意保留 `Validate` / `ValidateInto`，尽管二者已在 `*Processor` 上弃用（应改用 [`Parse`](./processor#parse) / [`ParseInto`](./processor#parseinto)）。在此处增删或替换方法会破坏第三方 `TokenManager` 实现。
:::

::: warning `TokenManager` 不含 `Parse` / `ParseInto`
`Parse` 与 `ParseInto` 只定义在 `*Processor` 上，不在 `TokenManager` 接口内。通过 `TokenManager` 变量调用时只能用已弃用的 `Validate` / `ValidateInto`；需要新方法时，在消费方定义只含所需方法的小接口（`*Processor` 自动满足）。
:::

方法按职责分为三组：
- **令牌创建**：`Create`、`CreateRefresh`
- **验证与刷新**：`Validate`、`ValidateInto`、`Refresh`、`RefreshInto`
- **通用操作**：`Revoke`、`IsRevoked`、`ParseUnverified`、`Close`、`IsClosed`

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Create` | `Create(claims CustomClaims) (string, error)` | 创建访问令牌 |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | 验证令牌（已在 `*Processor` 上弃用，改用 `Parse`） |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | 创建刷新令牌 |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | 刷新令牌 |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | 验证到自定义 Claims（已在 `*Processor` 上弃用，改用 `ParseInto`） |
| `RefreshInto` | `RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)` | 刷新到自定义 Claims |
| `Revoke` | `Revoke(tokenString string) error` | 吊销令牌 |
| `IsRevoked` | `IsRevoked(tokenString string) (bool, error)` | 检查是否已吊销 |
| `ParseUnverified` | `ParseUnverified(tokenString string, claims any) error` | 解析但不验证 |
| `Close` | `Close() error` | 释放资源 |
| `IsClosed` | `IsClosed() bool` | 是否已关闭 |

### 实现类型

| 类型 | 说明 |
|------|------|
| `*Processor` | 默认实现 |

---

## CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

自定义 Claims 接口。用于 [`Create`](./processor#create)、[`ParseInto`](./processor#parseinto)、[`RefreshInto`](./processor#refreshinto) 等方法。

<Badge type="info" text="interface" />

### 验证契约

Processor 对 `*Claims` 和其他类型执行不同的创建路径校验：

| 类型 | 创建时的验证行为 |
|------|------------------|
| `*Claims` | 深度验证：所有字段（长度上限、注入模式、控制字符） |
| 其他类型 | 调用 `Validate()` + 注册声明字符串清洗（Issuer、Subject、ID、TokenType、Audience） |

深度字段校验只在令牌创建时执行。验证路径只调用 `Validate()`（必填字段）并清洗标准声明字符串。

:::warning 注意
对于非 `*Claims` 类型，自定义结构体字段**不会**被深度验证。实现者须在 `Validate()` 方法中自行校验所有业务字段。
:::

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetRegisteredClaims` | `GetRegisteredClaims() *RegisteredClaims` | 返回标准 JWT 字段 |
| `Validate` | `Validate() error` | 自定义验证逻辑 |

### 实现类型

| 类型 | 说明 |
|------|------|
| `*Claims` | 内置 Claims 实现 |

---

## BlacklistStore

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

黑名单存储后端接口。

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Add` | `Add(tokenID string, expiresAt time.Time) error` | 添加到黑名单 |
| `Contains` | `Contains(tokenID string) (bool, error)` | 检查是否在黑名单中 |
| `Close` | `Close() error` | 释放资源 |

---

## RateLimitProvider

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

限流接口。Processor 在创建令牌时调用 `Allow(key)` 做单次判断。

:::tip 关于 AllowN
接口本身只定义单次判断的 `Allow`。批量判断方法 `AllowN(key string, n int) bool` 是具体类型 [`*RateLimiter`](./types#ratelimiter) 的扩展方法，不属于此接口。
:::

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Allow` | `Allow(key string) bool` | 检查单次请求是否允许 |
| `Reset` | `Reset(key string)` | 重置指定 key 的限流状态 |
| `Close` | `Close()` | 释放资源 |

### 实现类型

| 类型 | 说明 |
|------|------|
| `*RateLimiter` | 内置令牌桶实现 |

---

## ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

时钟接口，用于注入时间（测试场景）。

<Badge type="info" text="interface" />

### 实现类型

| 类型 | 说明 |
|------|------|
| `SystemClock` | 系统时钟 |
| `FixedClock` | 固定时间时钟 |

---

## RateLimitKeyer

```go
type RateLimitKeyer interface {
    RateLimitKey() string
}
```

可选接口，自定义 Claims 可实现此接口提供限流 key。限流 key 查找优先级：`Subject` → `*Claims.UserID` → `RateLimitKey()`；查得的 key 为空时跳过限流。

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `RateLimitKey` | `RateLimitKey() string` | 返回限流 key（`Subject` 与 `*Claims.UserID` 均为空时使用） |
