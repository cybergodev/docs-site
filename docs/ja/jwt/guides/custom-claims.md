---
title: "カスタム Claims - CyberGo JWT | ビジネス宣言インターフェース"
description: "カスタム Claims ガイド：CustomClaims インターフェースを実装してビジネス専用宣言項目を定義し、内蔵 Claims とカスタム型の検証差を比較、ValidateInto と RefreshInto の解析・更新用法を示す。"
---

# カスタム Claims

内蔵の [`Claims`](../api-reference/claims#claims) 構造体は一般的なシーンをカバーしていますが、ビジネスシステムには通常追加フィールドが必要です。`CustomClaims` インターフェースを実装することで独自の Claims 構造体を定義できます。

## CustomClaims インターフェース

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

2 つのメソッドを実装するだけです：

| メソッド | 説明 |
|---------|------|
| `GetRegisteredClaims()` | 標準 JWT フィールド（iss、sub、aud など）を返す |
| `Validate()` | カスタム検証ロジック |

## カスタム Claims の定義

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
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
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}
```

:::tip ポイント
- `jwt.RegisteredClaims` の埋め込みは必須
- `GetRegisteredClaims()` は埋め込まれたフィールドのポインタを返す
- `Validate()` はトークンの作成時と検証時の両方で呼び出される
:::

## カスタム Claims の使用

### トークンの作成

```go
claims := &MyClaims{
    UserID: "user123",
    Email:  "alice@example.com",
    Role:   "admin",
}
token, err := processor.Create(claims)
```

### カスタム構造体に検証

`ValidateInto` を使用してトークンをカスタム構造体にパースします：

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(token, myClaims)
if err != nil {
    panic(err)
}
if valid {
    parsed := result.(*MyClaims)
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Email:", parsed.Email)
}
```

### カスタム構造体にリフレッシュ

`RefreshInto` を使用してトークンをリフレッシュし、カスタムフィールドを維持します：

```go
newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
if err != nil {
    panic(err)
}
```

:::warning 時系列フィールドの保護
`RefreshInto` は Claims の時系列フィールド（`IssuedAt`、`ExpiresAt`、`ID`）を自動的に復元します。操作が失敗しても復元が保証されます。
:::

## 検証の違い

内蔵 `*Claims` とカスタム型では異なる検証パスを通ります：

| 検証項目 | `*Claims` | カスタム型 |
|---------|-----------|-----------|
| `Validate()` メソッド | ✅ | ✅ |
| 文字列長制限（256 文字） | ✅ | ❌ |
| 配列サイズ制限（100 項目） | ✅ | ❌ |
| 注入パターン検出 | ✅ | ❌ |
| 制御文字フィルタリング | ✅ | ❌ |
| `Extra` フィールド制限 | ✅ | 該当なし |
| 登録クレームの文字列サニタイズ | ✅ | ✅ |

:::warning 重要
カスタム Claims のビジネスフィールドは深い検証の対象**になりません**。`Validate()` メソッドですべての必要な検証を自身で実装してください。
:::

## オプションインターフェース：RateLimitKeyer

カスタム Claims は `RateLimitKeyer` インターフェースを実装してレート制限キーを提供できます：

```go
func (c *MyClaims) RateLimitKey() string {
    return c.Email // Email をレート制限キーとして使用
}
```

レート制限キーの検索優先順位：`Subject` → `*Claims.UserID` → `RateLimitKey()`。

## 次のステップ

- [API リファレンス → インターフェース定義](../api-reference/interfaces#customclaims) — CustomClaims の完全な定義
- [API リファレンス → Processor](../api-reference/processor#validateinto) — ValidateInto / RefreshInto メソッド
- [高度なサンプル](../examples/advanced) — カスタム Claims の完全な例
