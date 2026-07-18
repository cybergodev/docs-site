---
sidebar_label: "型と定数"
title: "型と定数 - CyberGo JWT | 直列化と時計型"
description: "型と定数参考：NumericDate と StringOrSlice 直列化型、SigningMethod アルゴリズム型、ValidationError 項目級エラー、RateLimiter・SystemClock・FixedClock 時計と 12 種アルゴリズム定数。"
sidebar_position: 60
---

# 型と定数

## NumericDate

```go
type NumericDate struct {
    time.Time
}
```

JWT 数値日付値（Unix タイムスタンプ）。有効範囲は 0 から 253402300799（9999-12-31 23:59:59 UTC）まで。

<Badge type="info" text="struct" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `MarshalJSON` | `func (date *NumericDate) MarshalJSON() ([]byte, error)` | Unix タイムスタンプの JSON 数値にシリアライズ。ゼロ時刻または有効範囲外の場合は `null` を返す |
| `UnmarshalJSON` | `func (date *NumericDate) UnmarshalJSON(b []byte) error` | JSON 数値または文字列から Unix タイムスタンプをパース。負の値と有効範囲外の値を拒否 |

---

## StringOrSlice

```go
type StringOrSlice []string
```

JSON 文字列または JSON 配列のいずれかからデシリアライズ可能な `[]string` を保持する型。要素数 1 のスライスは JSON 文字列として、複数要素のスライスは配列としてマーシャルされ、RFC 7519 §4.1.3 に準拠する。

<Badge type="info" text="type" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `MarshalJSON` | `func (s StringOrSlice) MarshalJSON() ([]byte, error)` | 要素数 1 のスライスは JSON 文字列として、複数要素は配列としてマーシャル（RFC 7519 §4.1.3） |
| `UnmarshalJSON` | `func (s *StringOrSlice) UnmarshalJSON(b []byte) error` | JSON 文字列または配列からパース |

---

## SigningMethod

```go
type SigningMethod string
```

署名アルゴリズム型。

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

フィールドレベルの検証失敗エラー。

<Badge type="info" text="struct" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Error` | `func (e *ValidationError) Error() string` | エラーメッセージ |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | 内部エラーをアンラップ |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

トークンバケットレートリミッター。[`RateLimitProvider`](./interfaces#ratelimitprovider) インターフェースを実装。

<Badge type="info" text="struct" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Allow` | `func (rl *RateLimiter) Allow(key string) bool` | 単一リクエストをチェック |
| `AllowN` | `func (rl *RateLimiter) AllowN(key string, n int) bool` | n 回のリクエストをチェック |
| `Reset` | `func (rl *RateLimiter) Reset(key string)` | 指定したキーをリセット |
| `Close` | `func (rl *RateLimiter) Close()` | リソースを解放 |

---

## SystemClock

```go
type SystemClock struct{}
```

システムクロック。[`ClockProvider`](./interfaces#clockprovider) のデフォルト実装。

<Badge type="info" text="struct" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Now` | `func (SystemClock) Now() time.Time` | 現在のシステム時刻を返す |

---

## FixedClock

```go
type FixedClock struct {
    T time.Time
}
```

固定時刻クロック。テスト用途。

<Badge type="info" text="struct" />

### フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `T` | `time.Time` | 固定時刻値 |

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Now` | `func (c FixedClock) Now() time.Time` | 固定時刻を返す |

---

## 署名アルゴリズム定数

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

| 定数 | 値 | アルゴリズム | 型 |
|------|-----|------------|-----|
| `SigningMethodHS256` | `"HS256"` | HMAC-SHA256 | 対称 |
| `SigningMethodHS384` | `"HS384"` | HMAC-SHA384 | 対称 |
| `SigningMethodHS512` | `"HS512"` | HMAC-SHA512 | 対称 |
| `SigningMethodRS256` | `"RS256"` | RSA-SHA256 | 非対称 |
| `SigningMethodRS384` | `"RS384"` | RSA-SHA384 | 非対称 |
| `SigningMethodRS512` | `"RS512"` | RSA-SHA512 | 非対称 |
| `SigningMethodPS256` | `"PS256"` | RSA-PSS-SHA256 | 非対称 |
| `SigningMethodPS384` | `"PS384"` | RSA-PSS-SHA384 | 非対称 |
| `SigningMethodPS512` | `"PS512"` | RSA-PSS-SHA512 | 非対称 |
| `SigningMethodES256` | `"ES256"` | ECDSA-SHA256 | 非対称 |
| `SigningMethodES384` | `"ES384"` | ECDSA-SHA384 | 非対称 |
| `SigningMethodES512` | `"ES512"` | ECDSA-SHA512 | 非対称 |

---

## トークンタイプ定数

```go
const (
    TokenTypeAccess  = "access"
    TokenTypeRefresh = "refresh"
)
```

[`RegisteredClaims.TokenType`](./claims#registeredclaims) フィールドに書き込まれるトークンタイプ定数。

- アクセストークンは [`Processor.Create`](./processor#create) が生成する
- リフレッシュトークンは [`Processor.CreateRefresh`](./processor#createrefresh) が生成する
- [`Processor.Refresh`](./processor#refresh) と [`Processor.RefreshInto`](./processor#refreshinto) は `TokenTypeAccess` のトークンを拒否する

| 定数 | 値 | 説明 |
|------|-----|------|
| `TokenTypeAccess` | `"access"` | アクセストークン |
| `TokenTypeRefresh` | `"refresh"` | リフレッシュトークン |
