---
title: "テストと時計注入 - CyberGo JWT | 固定时計で再現可能テスト"
description: "テストと時計注入ガイド：ClockProvider で FixedClock 固定时計を注入し、ユニットテストで時間の経過を精密に制御、トークン有効期限・リフレッシュ・カスタム Claims 解析・失効ロジックを検証し、反復可能かつ独立に実行できる。"
---

# テストとクロック注入

`ClockProvider` インターフェースを通じてカスタムクロックを注入し、テストで時間を正確に制御できます。

## ClockProvider インターフェース

```go
type ClockProvider interface {
    Now() time.Time
}
```

ライブラリは 2 つの実装を提供しています：

| 型 | 説明 |
|-----|------|
| `SystemClock` | デフォルト、システム時刻を使用 |
| `FixedClock` | 固定時刻、テスト用途 |

## FixedClock

`FixedClock` は常に構築時に指定された時刻を返します：

```go
fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Clock = jwt.FixedClock{T: fixedTime}
```

## トークン有効期限のテスト

```go
func TestTokenExpiry(t *testing.T) {
    // 固定時刻を設定
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // now の時点でトークンを発行
    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // 現在時刻で検証 → 成功
    _, valid, err := processor.Validate(token)
    require.NoError(t, err)
    assert.True(t, valid)

    // 時間経過をシミュレートして有効期限切れに → 新しい Processor を使用
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, _, err = expiredProcessor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## リフレッシュフローのテスト

```go
func TestRefreshFlow(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    refreshToken, err := processor.CreateRefresh(claims)
    require.NoError(t, err)

    // リフレッシュトークンから新しいアクセストークンを取得
    newToken, err := processor.Refresh(refreshToken)
    require.NoError(t, err)
    assert.NotEmpty(t, newToken)
}
```

## カスタム Claims のテスト

```go
func TestCustomClaims(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "test@example.com",
    }

    token, err := processor.Create(claims)
    require.NoError(t, err)

    result := &MyClaims{}
    parsed, valid, err := processor.ValidateInto(token, result)
    require.NoError(t, err)
    assert.True(t, valid)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## エラー処理のテスト

```go
func TestRevokeToken(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // トークンを失効
    err = processor.Revoke(token)
    require.NoError(t, err)

    // 検証は失敗するはず
    _, _, err = processor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## ベストプラクティス

:::tip テストの推奨事項
- `FixedClock` を使用してテストの再現性を確保
- 各テストケースで独立した Processor を作成
- `t.Cleanup()` または `defer` で `Close()` が確実に呼ばれるようにする
- エラーの検証には `errors.Is()` を使用し、文字列マッチングは避ける
:::

## 次のステップ

- [API リファレンス → ClockProvider](../api-reference/interfaces#clockprovider) — クロックインターフェース
- [API リファレンス → FixedClock](../api-reference/types#fixedclock) — 固定クロック
- [高度なサンプル](../examples/advanced) — クロック注入の例
