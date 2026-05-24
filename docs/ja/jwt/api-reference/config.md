---
title: "Config - JWT API リファレンス"
description: "CyberGo JWT Config API リファレンス：Config 統一設定項目（署名鍵、アルゴリズム、TTL、Issuer）と BlacklistConfig ブラックリスト設定のフィールド説明、デフォルト値および検証メソッド。"
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL    time.Duration
    RefreshTokenTTL   time.Duration
    Issuer            string
    ExpectedAudience  string

    Blacklist BlacklistConfig

    EnableRateLimit bool
    RateLimitRate   int
    RateLimitWindow time.Duration
    RateLimiter     RateLimitProvider

    Clock ClockProvider
}
```

JWT Processor の統一設定。ゼロ値フィールドは `New()` で自動的にデフォルト値が設定されます（`normalizeConfig` 経由）。

:::tip 自動設定ルール
- `RateLimitRate`、`RateLimitWindow` は `EnableRateLimit = true` の場合のみ設定されます
- 内蔵ブラックリストストアの `EnableAutoCleanup` は常に `true` に強制されます（無限増加を防止）
- `SecretKey`、`SigningKey`、`VerificationKey` は自動設定されないため、手動で設定する必要があります
:::

<Badge type="info" text="struct" />

### フィールド

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|------------|------|
| `SecretKey` | `string` | — | HMAC 秘密鍵（最低 32 バイト） |
| `SigningKey` | `any` | — | 非対称アルゴリズムの秘密鍵 (`*rsa.PrivateKey` または `*ecdsa.PrivateKey`) |
| `VerificationKey` | `any` | — | 非対称アルゴリズムの公開鍵（省略可、デフォルトは SigningKey を使用） |
| `SigningMethod` | `SigningMethod` | `HS256` | 署名アルゴリズム |
| `AccessTokenTTL` | `time.Duration` | `15m` | アクセストークンの有効期間 |
| `RefreshTokenTTL` | `time.Duration` | `168h` | リフレッシュトークンの有効期間 |
| `Issuer` | `string` | `"jwt-service"` | 発行者 |
| `ExpectedAudience` | `string` | — | 期待されるオーディエンス（省略可） |
| `Blacklist` | `BlacklistConfig` | — | ブラックリスト設定 |
| `EnableRateLimit` | `bool` | `false` | レート制限を有効化 |
| `RateLimitRate` | `int` | `100` | ウィンドウあたりの最大リクエスト数 |
| `RateLimitWindow` | `time.Duration` | `1m` | レート制限ウィンドウ |
| `RateLimiter` | `RateLimitProvider` | — | カスタムレートリミッター（省略可） |
| `Clock` | `ClockProvider` | `SystemClock{}` | クロックプロバイダー |

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `Validate` | `func (c *Config) Validate() error` | 設定の有効性を検証 |

`Validate()` のチェック項目：

| チェック項目 | 説明 |
|------------|------|
| 署名鍵 | HMAC は SecretKey ≥32 バイトかつ弱鍵でないこと。RSA/ECDSA は正しい型の SigningKey が必要。ECDSA は曲線が一致すること。VerificationKey はアルゴリズムの公開鍵型と一致すること |
| TTL の有効性 | `AccessTokenTTL` と `RefreshTokenTTL` は正の数であること |
| TTL の順序 | `AccessTokenTTL` は `RefreshTokenTTL` より小さいこと |
| 署名アルゴリズム | 内蔵サポートの 12 種のアルゴリズムのいずれかであること |
| ブラックリスト | 内蔵ストア使用時、MaxSize と CleanupInterval は正の数であること |

---

## BlacklistConfig

```go
type BlacklistConfig struct {
    CleanupInterval   time.Duration
    MaxSize           int
    EnableAutoCleanup bool
    Store             BlacklistStore
}
```

ブラックリスト設定。

<Badge type="info" text="struct" />

### フィールド

| フィールド | 型 | デフォルト値 | 説明 |
|-----------|-----|------------|------|
| `CleanupInterval` | `time.Duration` | `5m` | 期限切れクリーンアップ間隔（内蔵ストアの場合のみ有効） |
| `MaxSize` | `int` | `100000` | メモリストアの最大エントリ数（内蔵ストアの場合のみ有効） |
| `EnableAutoCleanup` | `bool` | `true` | 期限切れエントリの自動クリーンアップ（内蔵ストアの場合のみ有効） |
| `Store` | `BlacklistStore` | — | カスタムストアバックエンド（設定すると他のフィールドは無視される） |
