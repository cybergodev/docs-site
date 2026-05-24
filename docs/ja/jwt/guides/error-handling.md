---
title: "エラー処理 - JWT"
description: "CyberGo JWT エラー処理ガイド：17 個のセンチネルエラーの分類、errors.Is() マッチングパターン、ValidationError 型および Web サービスでのエラー処理ベストプラクティス。"
---

# エラー処理

CyberGo JWT はセンチネルエラー（sentinel errors）パターンを使用しており、すべてのエラーは `errors.Is()` で判定します。

## 基本パターン

```go
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
        // 署名が無効またはフォーマットエラー
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor がクローズ済み
    default:
        // その他のエラー
    }
}
```

:::tip errors.Is() の使用
`err == jwt.ErrTokenExpired` や文字列マッチングは使用しないでください。`errors.Is()` はラップされたエラーも正しく処理します。
:::

## エラーの分類

### 設定段階

`jwt.New()` は以下のエラーを返す可能性があります：

| エラー | 原因 | 解決方法 |
|--------|------|----------|
| `ErrInvalidConfig` | 複数の設定項目が不正 | Config の各フィールドを確認 |
| `ErrInvalidSecretKey` | HMAC 秘密鍵が 32 バイト未満または弱鍵 | より強力な鍵を使用 |
| `ErrInvalidSigningMethod` | サポートされていない署名アルゴリズム | 内蔵の 12 種のアルゴリズムを使用 |

### トークン操作

| エラー | メソッド | 処理の推奨 |
|--------|---------|-----------|
| `ErrEmptyToken` | すべてのトークン操作メソッド | リクエストヘッダーを確認 |
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto | 署名の不一致、アクセスを拒否 |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | トークンのアルゴリズムが設定と不一致、アクセスを拒否 |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | ユーザーにトークンのリフレッシュを案内 |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | クロックの同期を確認 |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto | 発行者が一致しない |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto | オーディエンスが一致しない |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | トークンが失効済み、アクセスを拒否 |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | ビジネス検証の失敗 |
| `ErrTokenMissingID` | IsRevoked | トークンに jti がない |

### レート制限とブラックリスト

| エラー | メソッド | 処理の推奨 |
|--------|---------|-----------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | 429 を返す |
| `ErrBlacklistNotConfigured` | Revoke | ブラックリストを設定 |

### ライフサイクル

| エラー | メソッド | 処理の推奨 |
|--------|---------|-----------|
| `ErrProcessorClosed` | すべてのメソッド | Processor を再作成 |
| `ErrStoreClosed` | Revoke など | ストアがクローズ済み |

## エラー型

### ValidationError

フィールドレベルの検証失敗時に返され、具体的なフィールドとエラー情報を含みます：

```go
type ValidationError struct {
    Field   string  // エラーが発生したフィールド名
    Message string  // エラーの説明
    Err     error   // 内部エラー
}
```

## Web サービスでのエラー処理

```go
func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, valid, err := processor.Validate(tokenString)
    if err != nil {
        switch {
        case errors.Is(err, jwt.ErrTokenExpired):
            http.Error(w, "token expired", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrTokenRevoked):
            http.Error(w, "token revoked", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrInvalidToken):
            http.Error(w, "invalid token", http.StatusUnauthorized)
        default:
            http.Error(w, "auth failed", http.StatusUnauthorized)
        }
        return
    }
    if !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }
    // リクエストを処理
}
```

## 次のステップ

- [API リファレンス → エラー](../api-reference/errors) — 完全なエラーリスト
- [API リファレンス → 型](../api-reference/types#validationerror) — エラー型の定義
