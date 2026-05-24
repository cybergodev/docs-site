---
title: "クイックスタート - JWT"
description: "CyberGo JWT クイックスタートガイド：インストール設定、トークンの発行と検証、リフレッシュと失効、HMAC/RSA/ECDSA アルゴリズム選択、カスタム Claims、ブラックリストとレート制限の設定。"
---

# クイックスタート

## インストール

```bash
go get github.com/cybergodev/jwt
```

Go 1.25+ が必要です。

## 基本的な使い方

### 1. Processor の作成

```go
package main

import (
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!" // HMAC は最低 32 バイト
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close() // 秘密鍵を安全にクリア
}
```

### 2. トークンの発行

```go
claims := &jwt.Claims{
    UserID:   "user123",
    Username: "alice",
    Role:     "admin",
    Permissions: []string{"read", "write"},
}

// アクセストークン（短期）
accessToken, err := processor.Create(claims)
if err != nil {
    panic(err)
}

// リフレッシュトークン（長期）
refreshToken, err := processor.CreateRefresh(claims)
if err != nil {
    panic(err)
}
```

### 3. トークンの検証

```go
parsed, valid, err := processor.Validate(accessToken)
if err != nil {
    // エラー処理：有効期限切れ、署名無効など
    panic(err)
}
if valid {
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Role:", parsed.Role)
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
}
```

### 4. トークンのリフレッシュ

```go
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. トークンの失効

```go
// トークンをブラックリストに追加
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 失効済みか確認
revoked, err := processor.IsRevoked(accessToken)
if err != nil {
    panic(err)
}
fmt.Println("Revoked:", revoked) // true
```

## 署名アルゴリズム

### HMAC（対称鍵）

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // デフォルト
```

| メソッド | アルゴリズム |
|----------|-------------|
| `SigningMethodHS256` | HMAC-SHA256 |
| `SigningMethodHS384` | HMAC-SHA384 |
| `SigningMethodHS512` | HMAC-SHA512 |

### RSA（非対称鍵）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（省略可、デフォルトは SigningKey を使用）
```

| メソッド | アルゴリズム |
|----------|-------------|
| `SigningMethodRS256` | RSA-SHA256 |
| `SigningMethodRS384` | RSA-SHA384 |
| `SigningMethodRS512` | RSA-SHA512 |

### RSA-PSS（非対称鍵、推奨）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（省略可）
```

| メソッド | アルゴリズム |
|----------|-------------|
| `SigningMethodPS256` | RSA-PSS-SHA256 |
| `SigningMethodPS384` | RSA-PSS-SHA384 |
| `SigningMethodPS512` | RSA-PSS-SHA512 |

### ECDSA（非対称鍵）

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey（省略可）
```

| メソッド | アルゴリズム |
|----------|-------------|
| `SigningMethodES256` | ECDSA-SHA256 |
| `SigningMethodES384` | ECDSA-SHA384 |
| `SigningMethodES512` | ECDSA-SHA512 |

## カスタム Claims

`CustomClaims` インターフェースを実装して独自の Claims 構造体を定義します：

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

カスタム Claims の使用：

```go
claims := &MyClaims{UserID: "123", Role: "admin"}

// トークンの作成
token, err := processor.Create(claims)

// カスタム構造体に検証
result := &MyClaims{}
parsed, valid, err := processor.ValidateInto(token, result)

// カスタム構造体にリフレッシュ
newToken, err := processor.RefreshInto(refreshToken, claims)
```

## ブラックリスト設定

### 内蔵メモリストアの使用（デフォルト）

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 内蔵ブラックリストは自動的に有効
```

### カスタムストアバックエンド

`BlacklistStore` インターフェースを実装（例：Redis）：

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", time.Until(expiresAt)).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}

// 使用
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

## レート制限の設定

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100          // ウィンドウあたりの最大リクエスト数
cfg.RateLimitWindow = time.Minute // ウィンドウ時間
```

## エラー処理

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // トークン有効期限切れ
    case errors.Is(err, jwt.ErrTokenRevoked):
        // トークンが失効済み
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // 発行者が一致しない
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // オーディエンスが一致しない
    case errors.Is(err, jwt.ErrInvalidToken):
        // 署名無効またはフォーマットエラー
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor がクローズ済み
    default:
        // その他のエラー
    }
}
```

## 次のステップ

- [署名アルゴリズム](./guides/signing-algorithms) — アルゴリズムの選択と鍵の設定
- [カスタム Claims](./guides/custom-claims) — ビジネスフィールドの定義
- [トークンブラックリスト](./guides/blacklist) — 失効とカスタムストア
- [レート制限](./guides/rate-limiting) — レート制限の設定
- [エラー処理](./guides/error-handling) — エラーの分類と処理パターン
- [API リファレンス](./api-reference/) — 完全な API リファレンス
