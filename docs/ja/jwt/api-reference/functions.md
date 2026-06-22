---
title: "パッケージ関数 - CyberGo JWT | ファクトリ関数と既定値"
description: "パッケージ関数参考：New で Processor を作成し検証、DefaultConfig と DefaultBlacklistConfig が既定設定を返し、NewNumericDate が時刻印を構築、NewRateLimiter がトークンバケット制限器を作成する。"
---

# パッケージ関数

## New

```go
func New(cfg Config) (*Processor, error)
```

新しい JWT Processor を作成します。`DefaultConfig()` でデフォルト設定を取得し、必要なフィールドを変更して渡します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `cfg` | `Config` | 設定項目 |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `processor` | `*Processor` | JWT プロセッサ |
| `err` | `error` | 設定の検証に失敗した場合にエラーを返す |

### 例

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    fmt.Println("Processor created successfully")
}
```

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrInvalidConfig` | 設定項目が不正 |
| `ErrInvalidSecretKey` | 鍵が不足、32 バイト未満、弱鍵、型エラー、または ECDSA 曲線が不一致 |
| `ErrInvalidSigningMethod` | サポートされていない署名アルゴリズム |

---

## DefaultConfig

```go
func DefaultConfig() Config
```

適切なデフォルト値を持つ設定を返します。

<Badge type="tip" text="v1.0.0+" />

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `config` | `Config` | デフォルト設定 |

### デフォルト値

| フィールド | デフォルト値 |
|-----------|-------------|
| `AccessTokenTTL` | `15 * time.Minute` |
| `RefreshTokenTTL` | `7 * 24 * time.Hour` |
| `Issuer` | `"jwt-service"` |
| `SigningMethod` | `SigningMethodHS256` |
| `RateLimitRate` | `100` |
| `RateLimitWindow` | `time.Minute` |
| `Blacklist` | `DefaultBlacklistConfig()` |

### 例

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 必要に応じて他のフィールドを変更
```

---

## DefaultBlacklistConfig

```go
func DefaultBlacklistConfig() BlacklistConfig
```

適切なデフォルト値を持つブラックリスト設定を返します。

<Badge type="tip" text="v1.0.0+" />

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `config` | `BlacklistConfig` | デフォルトブラックリスト設定 |

### デフォルト値

| フィールド | デフォルト値 |
|-----------|-------------|
| `CleanupInterval` | `5 * time.Minute` |
| `MaxSize` | `100000` |
| `EnableAutoCleanup` | `true` |

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

`time.Time` から `NumericDate` を作成します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `t` | `time.Time` | 時間値 |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `date` | `NumericDate` | JWT 数値日付 |

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

トークンバケットレートリミッターを作成します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `maxRate` | `int` | ウィンドウあたりの最大リクエスト数（≤0 の場合、デフォルト 100） |
| `window` | `time.Duration` | 時間ウィンドウ（≤0 の場合、デフォルト 1 分） |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `limiter` | `*RateLimiter` | レートリミッターインスタンス |
