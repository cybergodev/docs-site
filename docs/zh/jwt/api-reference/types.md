---
sidebar_label: "类型与常量"
title: "类型与常量 - CyberGo JWT | 序列化与时钟类型"
description: "类型与常量参考：NumericDate 与 StringOrSlice 的序列化规则、SigningMethod 签名算法类型、ValidationError 字段级错误、RateLimiter 令牌桶的补充与驱逐、SystemClock 与 FixedClock 时钟实现，以及 12 种签名算法常量与 2 个令牌类型常量。各类型均附字段表与方法签名。"
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

结构体内嵌 `time.Time`（即 `Time` 字段），因此可以直接调用 `time.Time` 的方法（如 `Unix()`、`Before()`）参与时间比较与运算。

<Badge type="info" text="struct" />

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `MarshalJSON` | `func (date NumericDate) MarshalJSON() ([]byte, error)` | 序列化为 Unix 时间戳 JSON 数字；零时间或超出有效范围时返回 `null` |
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

字段级验证失败错误。在 [`Create`](./processor#create) / [`Parse`](./processor#parse) 路径中作为 [`ErrInvalidClaims`](./errors#哨兵错误) 的底层原因出现，可用 `errors.As` 提取，用法见[错误处理指南](../guides/error-handling)。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `Field` | `string` | 未通过验证的字段名。内置 `Claims` 用 Go 字段名（`UserID`、`Username`、`Role`、`SessionID`、`ClientID`），数组字段用小写名（`permissions`、`scopes`、`audience`），`Extra` 用 `extra.<键名>`，注册声明用 `Issuer`、`Subject`、`ID`、`TokenType` |
| `Message` | `string` | 失败原因（如超出 256 字节上限、检测到可疑模式） |
| `Err` | `error` | 可选的被包装底层错误；`Unwrap` 返回它，供 `errors.Is` / `errors.As` 解链，无底层原因时为 nil |

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *ValidationError) Error() string` | 错误消息（含字段名、原因与被包装错误） |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | 返回 `Err` 字段保存的底层错误 |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

令牌桶限流器，实现 [`RateLimitProvider`](./interfaces#ratelimitprovider) 接口。

采用令牌桶算法，令牌按经过时间**按比例补充**，而非固定窗口重置。补充后保留残余时间，以保证速率均匀。每次请求消耗令牌，令牌不足时拒绝。

内部最多跟踪 10000 个限流 key（`maxBuckets`）。达到上限时先驱逐过期桶（超过 2 倍窗口未活动）。仍满则批量驱逐最旧的约 10%，分摊 O(n) 扫描成本。

::: info 接收者为 nil 时的行为
`*RateLimiter` 的 `Allow` / `AllowN` 对 nil 接收者失败关闭，返回 `false`；`Reset` 与 `Close` 对 nil 为空操作。限流器关闭后 `Allow` 恒返回 `false`。
:::

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
