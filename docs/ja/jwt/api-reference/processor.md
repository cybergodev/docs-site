---
title: "Processor - CyberGo JWT | 核心トークン操作型"
description: "Processor は CyberGo JWT の核心型で、Create・Validate・Refresh・Revoke・IsRevoked・ParseUnverified・Close など全トークン操作メソッドの署名・引数・戻り値・エラー・例を説明。"
---

# Processor

Processor は JWT 操作のコア型で、[`TokenManager`](./interfaces#tokenmanager) インターフェースを実装しています。すべてのメソッドは並行安全です。

[`jwt.New(cfg)`](./functions#new) でインスタンスを作成します。

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

新しい JWT アクセストークンを作成します。`CustomClaims` インターフェースを実装する任意の型を受け付けます。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `claims` | `CustomClaims` | トークンクレーム |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `token` | `string` | 署名済み JWT 文字列 |
| `err` | `error` | 検証または署名に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |
| `ErrRateLimitExceeded` | レート制限のしきい値を超過 |

### 例

```go
// 内蔵 Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// カスタム Claims
myClaims := &MyClaims{UserID: "123"}
token, err := processor.Create(myClaims)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

JWT アクセストークンを検証し、パースされた Claims を返します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `tokenString` | `string` | JWT 文字列 |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `claims` | `Claims` | パースされたクレーム（値のコピー） |
| `valid` | `bool` | 有効かどうか |
| `err` | `error` | 検証に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrInvalidToken` | 署名が無効 |
| `ErrAlgorithmMismatch` | トークンのアルゴリズムが設定と一致しない |
| `ErrExpirationRequired` | `RequireExpiration` が有効だがトークンに `exp` クレームがない |
| `ErrTokenExpired` | トークンの有効期限切れ |
| `ErrTokenNotValidYet` | トークンがまだ有効ではない |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenRevoked` | トークンが失効済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |

### 例

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    // エラー処理
    return
}
if valid {
    fmt.Println(claims.UserID)
}
```

---

## CreateRefresh

```go
func (p *Processor) CreateRefresh(claims CustomClaims) (string, error)
```

リフレッシュトークンを作成します。`AccessTokenTTL` ではなく `RefreshTokenTTL` を使用します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `claims` | `CustomClaims` | トークンクレーム |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `token` | `string` | 署名済みリフレッシュトークン |
| `err` | `error` | 検証または署名に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |
| `ErrRateLimitExceeded` | レート制限のしきい値を超過 |

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

既存のリフレッシュトークンを更新し、新しいアクセストークンを返します。リフレッシュトークンは新しいアクセストークンを発行する前に完全に検証（署名、有効期限、ブラックリスト）され、元のトークンの `IssuedAt`、`ExpiresAt`、`ID` はリセットおよび再生成されます。

:::info トークンタイプとローテーション
- **トークンタイプチェック**：`token_type=access` のトークンは拒否され（[`ErrTokenTypeMismatch`](./errors#センチネルエラー) を返す）、アクセストークンが新たなトークン取得に使われるのを防ぎます。`token_type` を持たない古いトークンは後方互換性のため引き続き受け付けられます。
- **元のトークンを自動失効させない**：`Refresh` は渡されたリフレッシュトークンを失効させません。元のトークンは期限切れまたは明示的に [`Revoke()`](#revoke) されるまで有効なままです。ワンタイム使用のセマンティクスが必要な場合は、`Refresh` 成功後に `Revoke(refreshTokenString)` を呼び出してください。
:::

:::warning セキュリティ上の注意
リフレッシュ時は標準 JWT フィールド（exp、nbf、iss、aud、ブラックリスト）と基本構造の有効性（UserID または Username が必須）のみ検証します。深いフィールド制約（長さ制限、注入パターン）は作成時に検証済みのため、再チェックされません。
:::

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `refreshTokenString` | `string` | リフレッシュトークン |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `token` | `string` | 新しいアクセストークン |
| `err` | `error` | 検証に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrInvalidToken` | 署名が無効 |
| `ErrAlgorithmMismatch` | トークンのアルゴリズムが設定と一致しない |
| `ErrExpirationRequired` | `RequireExpiration` が有効だがトークンに `exp` クレームがない |
| `ErrTokenExpired` | トークンの有効期限切れ |
| `ErrTokenNotValidYet` | トークンがまだ有効ではない |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenRevoked` | トークンが失効済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |
| `ErrTokenTypeMismatch` | アクセストークン（`token_type=access`）でリフレッシュを試行 |
| `ErrRateLimitExceeded` | レート制限のしきい値を超過 |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

トークンを検証し、カスタム Claims 構造体に格納します。渡された `claims` と同じポインタを返します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `tokenString` | `string` | JWT 文字列 |
| `claims` | `CustomClaims` | ターゲットの Claims ポインタ |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `claims` | `CustomClaims` | 格納後の Claims |
| `valid` | `bool` | 有効かどうか |
| `err` | `error` | 検証に失敗した場合にエラーを返す |

### 例

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}
```

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrInvalidToken` | 署名が無効 |
| `ErrAlgorithmMismatch` | トークンのアルゴリズムが設定と一致しない |
| `ErrExpirationRequired` | `RequireExpiration` が有効だがトークンに `exp` クレームがない |
| `ErrTokenExpired` | トークンの有効期限切れ |
| `ErrTokenNotValidYet` | トークンがまだ有効ではない |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenRevoked` | トークンが失効済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

カスタム Claims を使用してトークンをリフレッシュします。Claims オブジェクトの時系列フィールド（`IssuedAt`、`ExpiresAt`、`ID`）は操作後に自動的に復元され、エラーや panic が発生しても復元が保証されます。

:::info トークンタイプチェック
`token_type=access` のトークンは拒否され（[`ErrTokenTypeMismatch`](./errors#センチネルエラー) を返す）、アクセストークンが新たなトークン取得に使われるのを防ぎます。`token_type` を持たない古いトークンは後方互換性のため引き続き受け付けられます。
:::

:::warning セキュリティ上の注意
リフレッシュ時は標準 JWT フィールド（exp、nbf、iss、aud、ブラックリスト）と基本構造の有効性のみ検証します。深いフィールド制約（長さ制限、注入パターン）は作成時に検証済みのため、再チェックされません。
:::

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `refreshTokenString` | `string` | リフレッシュトークン |
| `claims` | `CustomClaims` | ターゲットの Claims ポインタ |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `token` | `string` | 新しいアクセストークン |
| `err` | `error` | 検証に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrInvalidToken` | 署名が無効 |
| `ErrAlgorithmMismatch` | トークンのアルゴリズムが設定と一致しない |
| `ErrExpirationRequired` | `RequireExpiration` が有効だがトークンに `exp` クレームがない |
| `ErrTokenExpired` | トークンの有効期限切れ |
| `ErrTokenNotValidYet` | トークンがまだ有効ではない |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenRevoked` | トークンが失効済み |
| `ErrInvalidClaims` | Claims の検証に失敗 |
| `ErrTokenTypeMismatch` | アクセストークン（`token_type=access`）でリフレッシュを試行 |
| `ErrRateLimitExceeded` | レート制限のしきい値を超過 |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

トークンをブラックリストに追加します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `tokenString` | `string` | 失効させるトークン |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `err` | `error` | 失効に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrBlacklistNotConfigured` | ブラックリストが未設定 |
| `ErrInvalidToken` | 署名が無効または不正な形式のトークン |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenMissingID` | トークンに `jti` クレームがない |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

トークンが失効済みかどうかを確認します。

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `tokenString` | `string` | JWT 文字列 |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `revoked` | `bool` | 失効済みかどうか |
| `err` | `error` | 照会に失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| `ErrInvalidToken` | 署名が無効または不正な形式のトークン |
| `ErrTokenInvalidIssuer` | 発行者が一致しない |
| `ErrTokenInvalidAudience` | オーディエンスが一致しない |
| `ErrTokenMissingID` | トークンに `jti` クレームがない |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

署名を検証せずにトークンをパースします。Claims 情報を抽出するが信頼する必要がないシーンに使用します。

:::danger 警告
返される Claims は未検証のため、**信頼できません**。デバッグやログ目的でのみ使用してください。
:::

<Badge type="tip" text="v1.0.0+" />

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `tokenString` | `string` | JWT 文字列 |
| `claims` | `any` | ターゲットの Claims ポインタ |

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `err` | `error` | パースに失敗した場合にエラーを返す |

### エラー

| エラー | 発生条件 |
|--------|----------|
| `ErrProcessorClosed` | Processor がクローズ済み |
| `ErrEmptyToken` | トークンが空 |
| ラップされたエラー | 不正な形式のトークンに対するラップされたパースエラーを返す（センチネルエラーではなく、`errors.Is` で一致判定できない） |

---

## Close

```go
func (p *Processor) Close() error
```

リソースを解放し、秘密鍵を安全にクリアします。複数回呼び出し可能で、2 回目以降は `ErrProcessorClosed` を返します。

<Badge type="tip" text="v1.0.0+" />

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `err` | `error` | クローズに失敗した場合にエラーを返す |

---

## IsClosed

```go
func (p *Processor) IsClosed() bool
```

Processor がクローズ済みかどうかを確認します。

<Badge type="tip" text="v1.0.0+" />

### 戻り値

| 戻り値 | 型 | 説明 |
|--------|-----|------|
| `closed` | `bool` | クローズ済みかどうか |
