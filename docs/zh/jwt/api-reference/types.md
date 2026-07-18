---
sidebar_label: "类型与常量"
title: "类型与常量 - CyberGo JWT | 序列化与时钟类型"
description: "类型与常量参考：NumericDate 与 StringOrSlice 序列化类型、SigningMethod 算法类型、ValidationError 字段级错误、RateLimiter、SystemClock 与 FixedClock 时钟及 12 种算法常量。"
sidebar_position: 60
---

# 类型与常量

## NumericDate

```go
type NumericDate struct {
    time.Time
}
```

JWT 数字日期值（Unix 时间戳）。有效范围为 0 至 253402300799（9999-12-31 23:59:59 UTC）。

<Badge type="info" text="struct" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `MarshalJSON` | `func (date *NumericDate) MarshalJSON() ([]byte, error)` | 序列化为 Unix 时间戳 JSON 数字；零时间或超出有效范围时返回 `null` |
| `UnmarshalJSON` | `func (date *NumericDate) UnmarshalJSON(b []byte) error` | 从 JSON 数字或字符串解析 Unix 时间戳；拒绝负值和超出有效范围的值 |

---

## StringOrSlice

```go
type StringOrSlice []string
```

持有 `[]string`，可从 JSON 字符串或字符串数组反序列化；单元素切片序列化为 JSON 字符串，多元素序列化为数组，符合 RFC 7519 §4.1.3。

<Badge type="info" text="type" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `MarshalJSON` | `func (s StringOrSlice) MarshalJSON() ([]byte, error)` | 单元素切片序列化为 JSON 字符串，多元素序列化为数组（符合 RFC 7519 §4.1.3） |
| `UnmarshalJSON` | `func (s *StringOrSlice) UnmarshalJSON(b []byte) error` | 从 JSON 字符串或数组解析 |

---

## SigningMethod

```go
type SigningMethod string
```

签名算法类型。

<Badge type="info" text="type" />

---

## ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

字段级验证失败错误。

<Badge type="info" text="struct" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *ValidationError) Error() string` | 错误消息 |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | 解包内部错误 |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

令牌桶限流器，实现 [`RateLimitProvider`](./interfaces#ratelimitprovider) 接口。

<Badge type="info" text="struct" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Allow` | `func (rl *RateLimiter) Allow(key string) bool` | 检查单次请求 |
| `AllowN` | `func (rl *RateLimiter) AllowN(key string, n int) bool` | 检查 n 次请求 |
| `Reset` | `func (rl *RateLimiter) Reset(key string)` | 重置指定 key |
| `Close` | `func (rl *RateLimiter) Close()` | 释放资源 |

---

## SystemClock

```go
type SystemClock struct{}
```

系统时钟，[`ClockProvider`](./interfaces#clockprovider) 的默认实现。

<Badge type="info" text="struct" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Now` | `func (SystemClock) Now() time.Time` | 返回当前系统时间 |

---

## FixedClock

```go
type FixedClock struct {
    T time.Time
}
```

固定时间时钟，用于测试。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `T` | `time.Time` | 固定时间值 |

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Now` | `func (c FixedClock) Now() time.Time` | 返回固定时间 |

---

## 签名算法常量

```go
const (
    SigningMethodHS256 SigningMethod = "HS256"
    SigningMethodHS384 SigningMethod = "HS384"
    SigningMethodHS512 SigningMethod = "HS512"

    SigningMethodRS256 SigningMethod = "RS256"
    SigningMethodRS384 SigningMethod = "RS384"
    SigningMethodRS512 SigningMethod = "RS512"

    SigningMethodPS256 SigningMethod = "PS256"
    SigningMethodPS384 SigningMethod = "PS384"
    SigningMethodPS512 SigningMethod = "PS512"

    SigningMethodES256 SigningMethod = "ES256"
    SigningMethodES384 SigningMethod = "ES384"
    SigningMethodES512 SigningMethod = "ES512"
)
```

| 常量 | 值 | 算法 | 类型 |
|------|-----|------|------|
| `SigningMethodHS256` | `"HS256"` | HMAC-SHA256 | 对称 |
| `SigningMethodHS384` | `"HS384"` | HMAC-SHA384 | 对称 |
| `SigningMethodHS512` | `"HS512"` | HMAC-SHA512 | 对称 |
| `SigningMethodRS256` | `"RS256"` | RSA-SHA256 | 非对称 |
| `SigningMethodRS384` | `"RS384"` | RSA-SHA384 | 非对称 |
| `SigningMethodRS512` | `"RS512"` | RSA-SHA512 | 非对称 |
| `SigningMethodPS256` | `"PS256"` | RSA-PSS-SHA256 | 非对称 |
| `SigningMethodPS384` | `"PS384"` | RSA-PSS-SHA384 | 非对称 |
| `SigningMethodPS512` | `"PS512"` | RSA-PSS-SHA512 | 非对称 |
| `SigningMethodES256` | `"ES256"` | ECDSA-SHA256 | 非对称 |
| `SigningMethodES384` | `"ES384"` | ECDSA-SHA384 | 非对称 |
| `SigningMethodES512` | `"ES512"` | ECDSA-SHA512 | 非对称 |

---

## 令牌类型常量

```go
const (
    TokenTypeAccess  = "access"
    TokenTypeRefresh = "refresh"
)
```

写入 [`RegisteredClaims.TokenType`](./claims#registeredclaims) 字段的令牌类型常量。

- 访问令牌由 [`Processor.Create`](./processor#create) 创建
- 刷新令牌由 [`Processor.CreateRefresh`](./processor#createrefresh) 创建
- [`Processor.Refresh`](./processor#refresh) 与 [`Processor.RefreshInto`](./processor#refreshinto) 会拒绝 `TokenTypeAccess` 的令牌

| 常量 | 值 | 说明 |
|------|-----|------|
| `TokenTypeAccess` | `"access"` | 访问令牌 |
| `TokenTypeRefresh` | `"refresh"` | 刷新令牌 |
