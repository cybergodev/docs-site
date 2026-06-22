---
title: "Claims - CyberGo JWT | 内蔵宣言構造体"
description: "Claims は CyberGo JWT の内蔵宣言構造体で、UserID・Username・Role・権限・スコープなどのビジネス項目と RFC 7519 RegisteredClaims を含み、フィールド長・配列サイズ・注入モードの検証制約を備える。"
---

# Claims

## Claims

```go
type Claims struct {
    UserID      string         `json:"user_id,omitempty"`
    Username    string         `json:"username,omitempty"`
    Role        string         `json:"role,omitempty"`
    Permissions []string       `json:"permissions,omitempty"`
    Scopes      []string       `json:"scopes,omitempty"`
    Extra       map[string]any `json:"extra,omitempty"`
    SessionID   string         `json:"session_id,omitempty"`
    ClientID    string         `json:"client_id,omitempty"`
    RegisteredClaims
}
```

内蔵 Claims 構造体。一般的なビジネスフィールドと標準 JWT フィールドを含みます。

<Badge type="info" text="struct" />

### フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `UserID` | `string` | ユーザー ID |
| `Username` | `string` | ユーザー名 |
| `Role` | `string` | ロール |
| `Permissions` | `[]string` | 権限リスト |
| `Scopes` | `[]string` | スコープリスト |
| `Extra` | `map[string]any` | カスタム拡張フィールド |
| `SessionID` | `string` | セッション ID |
| `ClientID` | `string` | クライアント ID |
| `RegisteredClaims` | `RegisteredClaims` | 標準 JWT フィールド |

### 検証ルール

`Validate()` メソッドは `UserID` または `Username` のいずれかが空でないことを確認します。

Processor はトークンの作成と検証時に追加の深い検証を実行します（内部 `validateClaims` 関数経由）：

| ルール | 制限 |
|--------|------|
| 文字列フィールドの長さ | 最大 256 文字 |
| 配列フィールドのサイズ | 最大 100 項目 |
| `Extra` フィールド数 | 最大 50 キー |
| `Extra` 値の型 | `string`、`[]string` のみ許可。ネストされた map とその他の型は拒否 |
| 制御文字 | タブ、改行、復帰以外の制御文字は拒否 |
| 注入パターン検出 | HTML/SQL/パストラバーサルなどの危険なパターンを含む場合は拒否 |

### メソッド

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | 埋め込まれた標準フィールドを返す |
| `Validate` | `func (c *Claims) Validate() error` | UserID または Username のいずれかが空でないことを確認 |

---

## RegisteredClaims

```go
type RegisteredClaims struct {
    Issuer    string        `json:"iss,omitempty"`
    Subject   string        `json:"sub,omitempty"`
    Audience  StringOrSlice `json:"aud,omitempty"`
    ExpiresAt NumericDate   `json:"exp"`
    NotBefore NumericDate   `json:"nbf"`
    IssuedAt  NumericDate   `json:"iat"`
    ID        string        `json:"jti,omitempty"`
    TokenType string        `json:"token_type,omitempty"`
}
```

標準 JWT 登録クレーム（RFC 7519）。

<Badge type="info" text="struct" />

### フィールド

| フィールド | 型 | JSON タグ | 説明 |
|-----------|-----|----------|------|
| `Issuer` | `string` | `iss` | 発行者 |
| `Subject` | `string` | `sub` | サブジェクト |
| `Audience` | `StringOrSlice` | `aud` | オーディエンス |
| `ExpiresAt` | `NumericDate` | `exp` | 有効期限 |
| `NotBefore` | `NumericDate` | `nbf` | 有効開始時刻 |
| `IssuedAt` | `NumericDate` | `iat` | 発行時刻 |
| `ID` | `string` | `jti` | トークン ID |
| `TokenType` | `string` | `token_type` | トークンタイプ（`access` または `refresh`、[トークンタイプ定数](./types#トークンタイプ定数)を参照） |
