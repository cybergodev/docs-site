---
title: "セキュリティモード - CyberGo JSON | API リファレンス"
description: "CyberGo JSON セキュリティ API 完全リファレンス：セキュリティ設定、AddDangerousPattern 危険パターン設定、入力バリデーション機構を含み、JSON インジェクション、深いネスト攻撃、リソース枯渇などのセキュリティ脅威を防御。カスタムセキュリティポリシーとプロテクションルール設定をサポートし、Go アプリケーションのセキュリティを保障。"
---

# セキュリティモード

セキュリティモードは危険パターン検出機能を提供し、JSON インジェクション攻撃、プロトタイプ汚染、その他のセキュリティ脅威を防止します。

## DangerousPattern 構造体

DangerousPattern はセキュリティリスクパターンを表す構造体型です。

```go
type DangerousPattern struct {
    Pattern string       // 入力内で検出する部分文字列
    Name    string       // パターンの説明名
    Level   PatternLevel // このパターンの処理方法を決定する重大度レベル
}
```

### フィールドの説明

| フィールド | 型 | 説明 |
|------|------|------|
| `Pattern` | `string` | 入力内で検出する部分文字列 |
| `Name` | `string` | パターンの説明名 |
| `Level` | `PatternLevel` | このパターンの処理方法を決定する重大度レベル |

---

## PatternLevel 型

PatternLevel は危険パターンの重大度レベルを表します。

```go
type PatternLevel int
```

### 定数

```go
const (
    // PatternLevelCritical 常に操作をブロック
    // 即座にセキュリティリスクを構成するパターンに使用（プロトタイプ汚染など）
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning 厳格モードではブロック、緩やかなモードでは警告を記録
    // 悪意のある意図を示唆するが正当な用途もあるパターンに使用
    PatternLevelWarning

    // PatternLevelInfo ログ記録のみ、ブロックしない
    // 監査/追跡目的で使用、操作を中断しない
    PatternLevelInfo
)
```

### String メソッド

```go
func (pl PatternLevel) String() string
```

PatternLevel の文字列表現を返します。

---

## 組み込み危険パターン

### デフォルトパターン

::: warning 内部 API
組み込みパターンリストは内部関数で管理されており、公開 API としてエクスポートされなくなりました。Config の `AdditionalDangerousPatterns` フィールドでカスタムパターンを管理できます。
:::

以下は組み込み危険パターンリストで、すべて Critical レベルです：

| パターン | 名前 | カテゴリ |
|------|------|------|
| `__proto__` | prototype pollution | プロトタイプ汚染 |
| `constructor[` | constructor access | コンストラクタアクセス |
| `prototype.` | prototype manipulation | プロトタイプ操作 |
| `<script` | script tag injection | HTML インジェクション |
| `<iframe` | iframe injection | HTML インジェクション |
| `<object` | object injection | HTML インジェクション |
| `<embed` | embed injection | HTML インジェクション |
| `<svg` | svg injection | HTML インジェクション |
| `javascript:` | javascript protocol | プロトコルインジェクション |
| `vbscript:` | vbscript protocol | プロトコルインジェクション |
| `eval(` | dynamic code execution | コード実行 |
| `setTimeout(` | timer manipulation | コード実行 |
| `setInterval(` | interval manipulation | コード実行 |
| `require(` | code injection | コード実行 |
| `new function(` | dynamic function creation | コード実行 |
| `document.cookie` | cookie access | DOM アクセス |
| `window.location` | redirect manipulation | DOM アクセス |
| `innerhtml` | DOM manipulation | DOM アクセス |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | イベントハンドラ |
| `fromcharcode(` | character encoding bypass | エンコーディングバイパス |
| `atob(` | base64 decoding | エンコーディングバイパス |
| `expression(` | CSS expression injection | CSS インジェクション |
| `__defineGetter__` | getter definition | プロトタイプ汚染 |
| `__defineSetter__` | setter definition | プロトタイプ汚染 |

### 重要パターン

::: warning 内部 API
`GetCriticalPatterns` は内部関数に移行し、公開 API としてエクスポートされなくなりました。重要パターン（`__proto__`、`constructor[`、`prototype.`）は常に強制的にチェックされ、無効化できません。
:::

以下の重要パターンは JSON サイズに関わらず常にフルスキャンされます：

| パターン | 説明 |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## パターン登録メソッド

危険パターンはグローバル登録関数ではなく、`Config` 構造体を通じて設定します。

### Config.AddDangerousPattern

シグネチャ：`func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

設定にカスタム危険パターンを追加します。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "カスタム危険パターン",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Config.AdditionalDangerousPatterns

`Config.AdditionalDangerousPatterns` フィールドを直接設定することも可能です：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

---

## Config 設定メソッド

### AddDangerousPattern

設定にセキュリティパターンを追加します。

```go
func (c *Config) AddDangerousPattern(pattern DangerousPattern)
```

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "custom_dangerous_string",
    Name:    "カスタム危険文字列",
    Level:   json.PatternLevelWarning,
})
```

### 設定フィールド

```go
type Config struct {
    // ... その他のフィールド ...

    // AdditionalDangerousPatterns デフォルトパターンに追加するセキュリティパターン
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns 組み込み警告レベルセキュリティパターンを無効化
    // true に設定すると AdditionalDangerousPatterns のみ使用
    // 注意：重要パターン（__proto__、constructor[、prototype.）は常に強制実行され、無効化不可
    DisableDefaultPatterns bool
}
```

---

## グローバルパターン登録

`Config` でインスタンスレベルのパターンを設定するほかに、パッケージレベル関数でグローバルパターンレジストリを管理できます。グローバルレジストリのパターンはすべての Processor インスタンスで有効になります。

### RegisterDangerousPattern

シグネチャ：`func RegisterDangerousPattern(pattern DangerousPattern)`

グローバルレジストリにカスタム危険パターンを追加します。登録されたパターンはすべての Processor インスタンスで有効になります。

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "カスタム危険パターン",
    Level:   json.PatternLevelCritical,
})
```

### UnregisterDangerousPattern

シグネチャ：`func UnregisterDangerousPattern(pattern string)`

グローバルレジストリから指定パターンを削除します。

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

### ListDangerousPatterns

シグネチャ：`func ListDangerousPatterns() []DangerousPattern`

グローバルレジストリのすべてのカスタムパターンを返します。

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("パターン: %s, 名前: %s, レベル: %s\n", p.Pattern, p.Name, p.Level)
}
```

::: tip グローバルパターン vs Config パターン
- **グローバルパターン**（`RegisterDangerousPattern`）：すべての Processor インスタンスで共有。アプリケーションレベルのセキュリティポリシーに適しています
- **Config パターン**（`Config.AddDangerousPattern`）：その Config を使用する Processor のみに影響。インスタンスレベルのカスタマイズに適しています
:::

---

## 完全な例

### カスタムセキュリティポリシー

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // 方法1：設定フィールドで
    cfg := json.DefaultConfig()
    cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
        {Pattern: "company_secret", Name: "会社の機密情報", Level: json.PatternLevelCritical},
    }

    // 方法2：設定メソッドで
    cfg.AddDangerousPattern(json.DangerousPattern{
        Pattern: "internal_api",
        Name:    "内部 API 参照",
        Level:   json.PatternLevelWarning,
    })

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 危険パターン検出のテスト
    _, err = p.Get(`{"data": "company_secret_info"}`, "data")
    if err != nil {
        fmt.Println("危険パターンを検出:", err)
    }

    // 登録済みパターンの確認
    fmt.Printf("カスタムパターン数: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

### デフォルトパターンの無効化

```go
cfg := json.DefaultConfig()

// 組み込み警告レベルパターンを無効化し、カスタムパターンのみ使用
// 注意：重要パターン（__proto__、constructor[、prototype.）は常に強制実行
cfg.DisableDefaultPatterns = true

// カスタムパターンの追加
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "xss_payload",
    Name:    "XSS 攻撃ペイロード",
    Level:   json.PatternLevelCritical,
})

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

### レベル別のパターン処理

```go
// 異なるレベルのパターンを登録
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "suspicious_but_allowed",
    Name:    "疑わしいが許可",
    Level:   json.PatternLevelInfo, // ログ記録のみ、ブロックしない
})

// 登録済みカスタムパターンの確認
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("パターン: %s, 名前: %s, レベル: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## セキュリティスキャン戦略

### 小規模 JSON（< 4KB）

常に完全なセキュリティスキャンを実行します。

### 中規模 JSON（>= 4KB）

32KB のスライディングウィンドウでスキャンし、境界をまたぐパターンの見落としを防止します。

### 大規模 JSON

- 重要パターンは常にフルスキャン
- その他のパターンはサンプリング戦略を使用
- 疑わしい文字密度をチェック

---

## 関連

- [Config](./config) - 設定オプション
- [Validator](./validator) - バリデータ
- [Hook フックシステム](./hooks) - 操作インターセプト
