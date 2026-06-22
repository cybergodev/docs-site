---
title: "レート制限 - CyberGo JWT | トークンバケット制限"
description: "レート制限ガイド：トークンバケットで発行インターフェースのウィンドウ毎最大要求数を設定、制限鍵の Subject・UserID・RateLimitKeyer 優先順位検索を解説、内蔵とカスタム分散制限の実装を支持。"
---

# レート制限

レート制限はトークン発行インターフェースの悪用（ブルートフォース攻撃など）を防止するために使用します。

## 動作原理

トークンバケットアルゴリズムを使用し、指定した時間ウィンドウ内で各キーあたりの最大リクエスト数を制限します。

```text
Create(claims) → レート制限キーを抽出 → RateLimitProvider を確認 → 許可/拒否
```

## 設定

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100              // ウィンドウあたりの最大リクエスト数
cfg.RateLimitWindow = time.Minute    // 時間ウィンドウ
```

| フィールド | デフォルト値 | 説明 |
|-----------|-------------|------|
| `EnableRateLimit` | `false` | レート制限を有効にするかどうか |
| `RateLimitRate` | `100` | ウィンドウあたりの最大リクエスト数 |
| `RateLimitWindow` | `1m` | 時間ウィンドウ |

:::tip 注意
レート制限はすべてのトークン発行メソッドに適用されます：`Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()`。`Validate()` と `ValidateInto()` には影響しません。
:::

## レート制限キー

レート制限はキーごとに独立して適用されます。キーの検索優先順位は以下の通りです：

1. `RegisteredClaims.Subject` — 空でない場合
2. `*Claims.UserID` — 内蔵 Claims のみ
3. `RateLimitKey()` — `RateLimitKeyer` インターフェースを実装している場合
4. 空文字列 — レート制限チェックをスキップ

### カスタムレート制限キー

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// RateLimitKeyer インターフェースの実装
func (c *MyClaims) RateLimitKey() string {
    return c.Email
}
```

## 内蔵 RateLimiter

`NewRateLimiter` で独立したレートリミッターを作成できます：

```go
limiter := jwt.NewRateLimiter(100, time.Minute)

if limiter.Allow("user:123") {
    // 許可
} else {
    // 拒否
}

limiter.Reset("user:123") // カウントをリセット
defer limiter.Close()
```

## カスタムレートリミッター

[`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) インターフェースを実装します：

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

:::tip AllowN について
インターフェース自体は単一判定の `Allow` のみを定義します。バッチ判定メソッド `AllowN(key string, n int) bool` は具象型 [`*RateLimiter`](../api-reference/types#ratelimiter) の拡張メソッドであり、このインターフェースには属しません。
:::

例えば Redis を使用した分散レート制限の実装：

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

## レート制限の超過

リクエストがレート制限のしきい値を超えると、トークン発行メソッド（`Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()`）は `ErrRateLimitExceeded` を返します：

```go
token, err := processor.Create(claims)
if errors.Is(err, jwt.ErrRateLimitExceeded) {
    // レート制限の処理：429 Too Many Requests を返す
}
```

## 次のステップ

- [API リファレンス → RateLimitProvider](../api-reference/interfaces#ratelimitprovider) — インターフェース定義
- [API リファレンス → RateLimiter](../api-reference/types#ratelimiter) — 内蔵実装
- [基本サンプル](../examples/basic) — レート制限の例
