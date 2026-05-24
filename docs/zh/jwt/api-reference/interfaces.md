---
title: "接口定义 - JWT API 参考"
description: "CyberGo JWT 接口定义参考：TokenManager、CustomClaims、BlacklistStore、RateLimitProvider、ClockProvider 和 RateLimitKeyer 接口。"
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

方法按职责分为三组：
- **令牌创建**：`Create`、`CreateRefresh`
- **验证与刷新**：`Validate`、`ValidateInto`、`Refresh`、`RefreshInto`
- **通用操作**：`Revoke`、`IsRevoked`、`ParseUnverified`、`Close`、`IsClosed`

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Create` | `Create(claims CustomClaims) (string, error)` | 创建访问令牌 |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | 验证令牌 |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | 创建刷新令牌 |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | 刷新令牌 |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | 验证到自定义 Claims |
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

自定义 Claims 接口。用于 [`Create`](./processor#create)、[`ValidateInto`](./processor#validateinto)、[`RefreshInto`](./processor#refreshinto) 等方法。

<Badge type="info" text="interface" />

### 验证契约

Processor 对 `*Claims` 和其他类型执行不同的验证路径：

| 类型 | 验证行为 |
|------|----------|
| `*Claims` | 深度验证：所有字段（长度限制、注入模式、控制字符） |
| 其他类型 | 调用 `Validate()` + 注册声明字符串清洗（Issuer、Subject、ID、Audience） |

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
    AllowN(key string, n int) bool
    Reset(key string)
    Close()
}
```

限流接口。

<Badge type="info" text="interface" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Allow` | `Allow(key string) bool` | 检查单次请求是否允许 |
| `AllowN` | `AllowN(key string, n int) bool` | 检查 n 次请求是否允许 |
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

可选接口，自定义 Claims 可实现此接口提供限流 key。限流 key 查找优先级：`Subject` → `*Claims.UserID` → `RateLimitKey()`。

<Badge type="info" text="interface" />
