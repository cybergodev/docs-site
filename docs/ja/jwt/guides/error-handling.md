---
sidebar_label: "エラー処理"
title: "エラー処理 - CyberGo JWT | センチネルエラー照合"
description: "エラー処理ガイド：CyberGo JWT 全 19 個のセンチネルエラーが設定・トークン検証・レート制限・ライフサイクル各段階で発動する条件を分類、errors.Is 照合・ValidationError 項目エラー・標準化応答の実務を示す。"
sidebar_position: 50
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
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | 署名の不一致、アクセスを拒否 |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | トークンのアルゴリズムが設定と不一致、アクセスを拒否 |
| `ErrExpirationRequired` | Validate, Refresh, ValidateInto, RefreshInto | `RequireExpiration` 有効だがトークンに `exp` クレームなし |
| `ErrTokenTypeMismatch` | Refresh, RefreshInto | アクセストークン（`token_type=access`）でリフレッシュ試行、アクセスを拒否 |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | ユーザーにトークンのリフレッシュを案内 |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | クロックの同期を確認 |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | 発行者が一致しない |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | オーディエンスが一致しない |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | トークンが失効済み、アクセスを拒否 |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | ビジネス検証の失敗 |
| `ErrTokenMissingID` | Revoke, IsRevoked | トークンに jti がない |

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
