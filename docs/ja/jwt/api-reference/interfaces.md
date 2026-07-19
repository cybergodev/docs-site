---
sidebar_label: "インターフェース定義"
title: "インターフェース定義 - CyberGo JWT | 核心拡張インターフェース"
description: "インターフェース参考：TokenManager トークン操作核心、CustomClaims カスタム宣言、BlacklistStore ブラックリスト、RateLimitProvider 制限器、ClockProvider 時計注入、任意 RateLimitKeyer。"
sidebar_position: 50
---

# インターフェース定義

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

JWT トークン操作のコアインターフェース。すべての実装は並行安全である必要があります。デフォルト実装は [`*Processor`](./processor) です。

メソッドは責務別に 3 つのグループに分かれます：
- **トークン作成**：`Create`、`CreateRefresh`
- **検証とリフレッシュ**：`Validate`、`ValidateInto`、`Refresh`、`RefreshInto`
- **汎用操作**：`Revoke`、`IsRevoked`、`ParseUnverified`、`Close`、`IsClosed`

<Badge type="info" text="interface" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Create` | `Create(claims CustomClaims) (string, error)` | アクセストークンを作成 |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | トークンを検証 |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | リフレッシュトークンを作成 |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | トークンをリフレッシュ |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | カスタム Claims に検証 |
| `RefreshInto` | `RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)` | カスタム Claims にリフレッシュ |
| `Revoke` | `Revoke(tokenString string) error` | トークンを失効 |
| `IsRevoked` | `IsRevoked(tokenString string) (bool, error)` | 失効済みかどうかを確認 |
| `ParseUnverified` | `ParseUnverified(tokenString string, claims any) error` | 検証せずにパース |
| `Close` | `Close() error` | リソースを解放 |
| `IsClosed` | `IsClosed() bool` | クローズ済みかどうか |

### 実装型

| 型 | 説明 |
|-----|------|
| `*Processor` | デフォルト実装 |

---

## CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

カスタム Claims インターフェース。[`Create`](./processor#create)、[`ValidateInto`](./processor#validateinto)、[`RefreshInto`](./processor#refreshinto) などのメソッドで使用されます。

<Badge type="info" text="interface" />

### 検証コントラクト

Processor は `*Claims` とその他の型で異なる検証パスを実行します：

| 型 | 検証動作 |
|-----|---------|
| `*Claims` | 深い検証：すべてのフィールド（長さ制限、注入パターン、制御文字） |
| その他の型 | `Validate()` の呼び出し + 登録クレームの文字列サニタイズ（Issuer、Subject、ID、TokenType、Audience） |

:::warning 注意
`*Claims` 以外の型では、カスタム構造体フィールドは深い検証の対象**になりません**。実装者は `Validate()` メソッドですべてのビジネスフィールドを自身で検証する必要があります。
:::

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `GetRegisteredClaims` | `GetRegisteredClaims() *RegisteredClaims` | 標準 JWT フィールドを返す |
| `Validate` | `Validate() error` | カスタム検証ロジック |

### 実装型

| 型 | 説明 |
|-----|------|
| `*Claims` | 内蔵 Claims 実装 |

---

## BlacklistStore

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

ブラックリストストアバックエンドインターフェース。

<Badge type="info" text="interface" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Add` | `Add(tokenID string, expiresAt time.Time) error` | ブラックリストに追加 |
| `Contains` | `Contains(tokenID string) (bool, error)` | ブラックリストに含まれるか確認 |
| `Close` | `Close() error` | リソースを解放 |

---

## RateLimitProvider

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

レート制限インターフェース。Processor はトークン作成時に `Allow(key)` を呼び出して単一チェックを行います。

:::tip AllowN について
このインターフェース自体は単一リクエストのチェックとして `Allow` のみを定義します。バッチメソッド `AllowN(key string, n int) bool` は具象型 [`*RateLimiter`](./types#ratelimiter) の拡張メソッドであり、このインターフェースの一部ではありません。
:::

<Badge type="info" text="interface" />

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Allow` | `Allow(key string) bool` | 単一リクエストが許可されるか確認 |
| `Reset` | `Reset(key string)` | 指定したキーのレート制限状態をリセット |
| `Close` | `Close()` | リソースを解放 |

### 実装型

| 型 | 説明 |
|-----|------|
| `*RateLimiter` | 内蔵トークンバケット実装 |

---

## ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

クロックインターフェース。時刻の注入に使用（テストシナリオ）。

<Badge type="info" text="interface" />

### 実装型

| 型 | 説明 |
|-----|------|
| `SystemClock` | システムクロック |
| `FixedClock` | 固定時刻クロック |

---

## RateLimitKeyer

```go
type RateLimitKeyer interface {
    RateLimitKey() string
}
```

オプションインターフェース。カスタム Claims はこのインターフェースを実装してレート制限キーを提供できます。レート制限キーの検索優先順位：`Subject` → `*Claims.UserID` → `RateLimitKey()`。

<Badge type="info" text="interface" />
