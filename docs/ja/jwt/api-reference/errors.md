---
title: "エラー - JWT API リファレンス"
description: "CyberGo JWT エラー API リファレンス：17 個のセンチネルエラー（ErrTokenExpired、ErrTokenRevoked など）、ValidationError 型および errors.Is() エラーマッチングパターン。"
---

# エラー

## センチネルエラー

すべてのエラーは `errors.Is()` で判定します：

```go
var (
    ErrInvalidConfig        = errors.New("invalid configuration")
    ErrInvalidSecretKey     = errors.New("invalid secret key")
    ErrInvalidSigningMethod = errors.New("invalid signing method")

    ErrInvalidToken          = errors.New("invalid token")
    ErrEmptyToken            = errors.New("empty token")
    ErrAlgorithmMismatch     = errors.New("token algorithm does not match configured signing method")
    ErrTokenRevoked          = errors.New("token revoked")
    ErrTokenMissingID        = errors.New("token missing ID")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("store closed")
)
```

### エラー一覧

| エラー | 説明 | `errors.Is()` での確認 |
|--------|------|----------------------|
| `ErrInvalidConfig` | 設定が無効 | `Config.Validate()` |
| `ErrInvalidSecretKey` | 秘密鍵が無効 | `New()` |
| `ErrInvalidSigningMethod` | 署名メソッドが無効 | `New()` |
| `ErrInvalidToken` | トークンが無効（署名エラーなど） | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrEmptyToken` | トークンが空 | すべてのトークン操作メソッド |
| `ErrAlgorithmMismatch` | トークンのアルゴリズムが設定と一致しない | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenRevoked` | トークンが失効済み | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenMissingID` | トークンに ID がない | `IsRevoked()` |
| `ErrTokenExpired` | トークンの有効期限切れ | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenNotValidYet` | トークンがまだ有効ではない | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenInvalidIssuer` | 発行者が一致しない | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrInvalidClaims` | Claims の検証に失敗 | `Create()`、`CreateRefresh()`、`Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` |
| `ErrRateLimitExceeded` | レート制限を超過 | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` |
| `ErrBlacklistNotConfigured` | ブラックリストが未設定 | `Revoke()` |
| `ErrProcessorClosed` | Processor がクローズ済み | すべてのメソッド |
| `ErrStoreClosed` | ストアがクローズ済み | `Revoke()` など |

### シーン別分類

#### 設定段階

| エラー | 発生メソッド | 典型的な原因 |
|--------|------------|------------|
| `ErrInvalidConfig` | `New()` | 複数の設定項目が不正 |
| `ErrInvalidSecretKey` | `New()` | HMAC 秘密鍵が 32 バイト未満または弱鍵 |
| `ErrInvalidSigningMethod` | `New()` | 12 種の内蔵アルゴリズムにない |

#### トークン検証

| エラー | 発生メソッド | 典型的な原因 |
|--------|------------|------------|
| `ErrEmptyToken` | すべてのトークン操作メソッド | 空文字列の渡し |
| `ErrInvalidToken` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | 署名の不一致またはフォーマットエラー |
| `ErrAlgorithmMismatch` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | トークンヘッダーのアルゴリズムが設定と一致しない |
| `ErrTokenExpired` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `exp` 時刻を超過 |
| `ErrTokenNotValidYet` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `nbf` 時刻にまだ達していない |
| `ErrTokenInvalidIssuer` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `iss` が `Config.Issuer` と一致しない |
| `ErrTokenInvalidAudience` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | `aud` が `Config.ExpectedAudience` と一致しない |
| `ErrTokenRevoked` | `Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | トークンがブラックリストにある |
| `ErrInvalidClaims` | `Create()`、`CreateRefresh()`、`Validate()`、`Refresh()`、`ValidateInto()`、`RefreshInto()` | ビジネス検証の失敗 |
| `ErrTokenMissingID` | `IsRevoked()` | トークンに `jti` フィールドがない |

#### レート制限とブラックリスト

| エラー | 発生メソッド | 典型的な原因 |
|--------|------------|------------|
| `ErrRateLimitExceeded` | `Create()`、`CreateRefresh()`、`Refresh()`、`RefreshInto()` | ウィンドウ内のリクエスト上限を超過 |
| `ErrBlacklistNotConfigured` | `Revoke()` | ブラックリストストアが未設定 |
| `ErrTokenMissingID` | `IsRevoked()` | トークンに `jti` フィールドがない |

#### ライフサイクル

| エラー | 発生メソッド | 典型的な原因 |
|--------|------------|------------|
| `ErrProcessorClosed` | すべてのメソッド | `Close()` 呼び出し後に操作を継続 |
| `ErrStoreClosed` | `Revoke()` など | ブラックリストストアがクローズ済み |

---

## エラー処理パターン

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // トークン有効期限切れ - ユーザーにリフレッシュを案内
    case errors.Is(err, jwt.ErrTokenRevoked):
        // トークンが失効済み - アクセスを拒否
    case errors.Is(err, jwt.ErrInvalidToken):
        // 署名が無効 - アクセスを拒否
    case errors.Is(err, jwt.ErrProcessorClosed):
        // システムエラー - Processor がクローズ済み
    default:
        // 不明なエラー
    }
}
```

---

## エラー型

### ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

フィールドレベルの検証失敗エラー。詳細は[型と定数 → ValidationError](./types#validationerror)を参照。
