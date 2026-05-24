---
title: "トークンブラックリスト - JWT"
description: "CyberGo JWT トークンブラックリストガイド：内蔵メモリストアの設定、BlacklistStore カスタムバックエンド（Redis）、失効メカニズム、自動クリーンアップと本番環境のベストプラクティス。"
---

# トークンブラックリスト

ブラックリストはトークンの有効期限前に能動的に無効化するために使用します。ユーザーのログアウト、パスワード変更、権限変更などのシーンに適しています。

## 動作原理

```text
Revoke(token) → jti + exp を抽出 → BlacklistStore に書き込み
Validate(token) → 署名を検証 → ブラックリストを確認 → 結果を返す
```

## 内蔵メモリストア

デフォルトでメモリストアを使用し、すぐに利用可能です：

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// ブラックリストは自動的に有効、DefaultBlacklistConfig() を使用
```

### 設定項目

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // クリーンアップ間隔
cfg.Blacklist.MaxSize = 100000                     // 最大エントリ数
cfg.Blacklist.EnableAutoCleanup = true             // 自動クリーンアップ
```

| フィールド | デフォルト値 | 説明 |
|-----------|-------------|------|
| `CleanupInterval` | `5m` | 期限切れエントリのクリーンアップ間隔 |
| `MaxSize` | `100000` | 最大エントリ数 |
| `EnableAutoCleanup` | `true` | 自動クリーンアップ（強制的に true） |

:::tip 自動クリーンアップ
内蔵ストアの `EnableAutoCleanup` は常に `true` に強制され、メモリの無限増加を防止します。
:::

## トークンの失効

```go
// 失効
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 確認
revoked, err := processor.IsRevoked(accessToken)
fmt.Println("Revoked:", revoked) // true

// 失効したトークンの検証は失敗する
_, _, err = processor.Validate(accessToken)
// err → jwt.ErrTokenRevoked
```

## カスタムストアバックエンド

[`BlacklistStore`](../api-reference/interfaces#blackliststore) インターフェースを実装して外部ストア（Redis、データベースなど）に接続します：

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

### Redis の例

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // 期限切れのトークンは保存不要
    }
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", ttl).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}
```

カスタムストアの使用：

```go
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

:::tip TTL 最適化
`time.Until(expiresAt)` を Redis TTL として使用すると、トークンの有効期限後にブラックリストから自動的に削除され、追加のクリーンアップが不要になります。
:::

## 本番環境での推奨事項

:::warning 注意事項
- 内蔵メモリストアはプロセス間で共有されないため、マルチインスタンスデプロイでは外部ストアの使用が必要
- `MaxSize` の上限に達すると、新しく失効させたトークンが最も古いエントリを押し出す
- カスタムストアの実装ではネットワークタイムアウトとリトライを処理すること
:::

## 次のステップ

- [API リファレンス → BlacklistStore](../api-reference/interfaces#blackliststore) — インターフェース定義
- [API リファレンス → BlacklistConfig](../api-reference/config#blacklistconfig) — 設定フィールド
- [API リファレンス → Revoke](../api-reference/processor#revoke) — 失効メソッド
- [高度なサンプル](../examples/advanced) — Redis ブラックリストの例
