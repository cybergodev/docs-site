---
title: "セキュリティ概要 - CyberGo JSON | セキュリティベストプラクティス"
description: "CyberGo JSON セキュリティベストプラクティスガイド：入力バリデーションとサニタイズ、MaxNestingDepthSecurity/MaxMemory リソース制限防御、パストラバーサル攻撃対策、JSON インジェクション対策、機密データフィルタリング、監査ログ設定を網羅し、開発者がプロダクション環境での JSON データセキュリティを確保できるよう支援します。"
---

# セキュリティ概要

JSON データを処理する際のセキュリティ上の考慮事項とベストプラクティス。

## 一般的なセキュリティリスク

### 1. リソース枯渇攻撃

悪意を持って構成された JSON は、メモリ枯渇や CPU の過負荷を引き起こす可能性があります。

**防御策：**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // ネスト深度の制限
cfg.MaxJSONSize = 10 * 1024 * 1024             // JSON サイズの制限 (10MB)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // セキュリティ検証制限を 100MB に増加（デフォルト 10MB）
```

### 2. パストラバーサル攻撃

悪意のあるパスが意図しないデータにアクセスする可能性があります。

**防御策：**

```go
// ユーザー入力のパスをバリデーション
func safePath(path string) bool {
    // 特殊文字を禁止
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

### 3. JSON インジェクション

悪意のあるデータが JSON 構造を破壊する可能性があります。

**防御策：**

```go
// 常にライブラリ関数を使用してシリアライズし、文字列の連結は行わない
data := map[string]any{
    "user": userInput, // ライブラリが自動的にエスケープ
}
bytes, _ := json.Marshal(data)
```

### 4. 機密データの漏洩

ログやエラーメッセージが機密データを露出する可能性があります。

**防御策：**

```go
// カスタムフックを使用して機密フィールドをフィルタリング
type FilterFieldsHook struct {
    fields map[string]bool
}

func (h *FilterFieldsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *FilterFieldsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&FilterFieldsHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "secret":   true,
}})
```

## セキュリティ設定の推奨事項

### 危険パターン管理

ライブラリにはデフォルトの危険パターン検出が組み込まれており、カスタムパターンの登録、解除、照会もサポートしています。

#### RegisterDangerousPattern

シグネチャ：`func RegisterDangerousPattern(pattern DangerousPattern)`

グローバル危険パターンを登録します。登録されたパターンは、デフォルトのセキュリティ設定を使用するすべての操作で有効になります。

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

シグネチャ：`func UnregisterDangerousPattern(pattern string)`

パターン文字列でグローバル危険パターンを解除します。パラメータ `pattern` は解除する危険パターンの部分文字列です（`DangerousPattern.Pattern` フィールドに対応）。

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

シグネチャ：`func ListDangerousPatterns() []DangerousPattern`

登録されているすべての危険パターン（デフォルトパターンとカスタムパターンを含む）を一覧表示します。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("パターン: %s, 名前: %s, レベル: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### 危険パターンレベル

| 定数 | 型 | 値 | 説明 |
|------|------|-----|------|
| `PatternLevelCritical` | `int` | `0` | 致命レベル、一致時に操作を拒否 |
| `PatternLevelWarning` | `int` | `1` | 警告レベル、厳格モードでは操作を拒否 |
| `PatternLevelInfo` | `int` | `2` | 情報レベル、ログ記録のみ |

::: tip
`PatternLevel` の `String()` メソッドは対応する文字列表現（`"critical"`、`"warning"`、`"info"`）を返し、ログ出力に便利です。
:::

#### デフォルトパターンの無効化

`Config.DisableDefaultPatterns` で組み込みのデフォルト警告レベルパターンを無効にできます：

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true
```

::: warning 注意
`__proto__`、`constructor[`、`prototype.` などの致命的パターンは常に強制チェックされ、無効化できません。
:::

### プロダクション環境の設定

```go
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()
    cfg.AddHook(&AuditHook{logger: prodLogger})
    return cfg
}
```

### 開発環境の設定

```go
func DevelopmentConfig() json.Config {
    cfg := json.DefaultConfig()
    cfg.MaxNestingDepthSecurity = 100
    cfg.AddHook(json.LoggingHook(devLogger))
    return cfg
}
```

## 入力バリデーション

### カスタムバリデーター

`Validator` インターフェース（`Validate(jsonStr string) error`）を実装して入力バリデーションを行います：

```go
// カスタムバリデーターの実装
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    // JSON 文字列の内容をバリデーション
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return err
    }
    email, ok := data["email"].(string)
    if !ok {
        return nil
    }
    if !strings.Contains(email, "@") {
        return errors.New("invalid email format")
    }
    return nil
}

// カスタムバリデーターの使用
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### スキーマバリデーション

Schema は構造体型であり、JSON 構造のバリデーションに使用できます：

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"id", "name", "email"},
    Properties: map[string]*json.Schema{
        "id":    {Type: "string", Pattern: `^[a-zA-Z0-9]+$`},
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number", Minimum: 0, Maximum: 150},
    },
}
```

## エラー処理

### セキュアなエラーメッセージ

```go
val, err := json.Get(data, path)
if err != nil {
    // 内部エラーの詳細を露出しない
    return errors.New("データ形式が無効です")
}
```

## 監査ログ

### 重要な操作の記録

`Hook` インターフェース（`Before` は `error` を返し、`After` は `(HookContext, any, error)` を受け取って `(any, error)` を返す）を使用して監査ログを記録します：

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("JSON 操作開始", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("JSON 操作完了", "op", ctx.Operation)
    return result, err
}
```

## 関連

- [プロダクションチェックリスト](./production-checklist)
- [Config 設定](../api-reference/config)
- [Validator](../api-reference/validator)
