---
title: "ヘルパー関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON ヘルパーユーティリティ関数完全リファレンス：CompareJSON で 2 つの JSON の等価性比較検証、ClearCache/GetStats キャッシュ管理と統計、グローバルプロセッサ管理、セキュリティパターンヘルパーなど、日常的な開発で便利な JSON ツール関数セットを提供し、一般的な操作を効果的に簡素化。"
---

# ヘルパー関数

json パッケージは JSON 比較、キャッシュ管理、ユーティリティ処理のための豊富なヘルパー関数を提供します。

## JSON 比較関数

### CompareJSON

シグネチャ：`func CompareJSON(json1, json2 string) (bool, error)`

2 つの JSON 文字列が等しいか比較します。数値精度の差異とキー順序の差異を処理します。

```go
// キー順序は異なるが内容は同じ
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// 数値精度は異なるが値は同じ
equal, _ := json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// 内容が異なる
equal, _ := json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false
```

---

## JSON マージ関数

### MergeJSON

シグネチャ：`func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

2 つの JSON オブジェクトをマージします。Config でマージモードを設定可能。詳細は [変更関数](./functions/modify#mergejson) を参照。

---

### MergeMany

シグネチャ：`func MergeMany(jsons []string, cfg ...Config) (string, error)`

複数の JSON オブジェクトをマージします。詳細は [変更関数](./functions/modify#mergemany) を参照。

---

## キャッシュと統計

### ClearCache（パッケージレベル関数）

シグネチャ：`func ClearCache()`

グローバルプロセッサの内部キャッシュをクリアします。

```go
json.ClearCache()
```

---

### GetStats（パッケージレベル関数）

シグネチャ：`func GetStats() Stats`

グローバルプロセッサの統計情報を取得します。

```go
stats := json.GetStats()
fmt.Printf("キャッシュヒット率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("キャッシュサイズ: %d\n", stats.CacheSize)
```

---

### GetHealthStatus（パッケージレベル関数）

シグネチャ：`func GetHealthStatus() HealthStatus`

グローバルプロセッサのヘルスステータスを取得します。

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("プロセッサは正常")
}
```

---

### Processor.ClearCache

シグネチャ：`func (p *Processor) ClearCache()`

プロセッサの内部キャッシュをクリアします。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

シグネチャ：`func (p *Processor) GetStats() Stats`

プロセッサの統計情報を取得します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("キャッシュヒット率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("キャッシュサイズ: %d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

シグネチャ：`func (p *Processor) GetHealthStatus() HealthStatus`

プロセッサのヘルスステータスを取得します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("プロセッサは正常")
}
```

### WarmupCache

シグネチャ：`func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

キャッシュをウォームアップし、後続の操作のパフォーマンスを向上させます。

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("%d 個のパスのウォームアップに成功\n", result.Successful)
```

---

## グローバルプロセッサ管理

グローバルプロセッサはすべてのパッケージレベル関数（`Get`、`GetString` など）で使用されます。

### SetGlobalProcessor

シグネチャ：`func SetGlobalProcessor(processor *Processor)`

カスタムグローバルプロセッサを設定します。

```go
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

json.SetGlobalProcessor(p)

// 以降、すべてのパッケージレベル関数がこのプロセッサを使用
val := json.GetString(data, "user.name")
```

---

### ShutdownGlobalProcessor

シグネチャ：`func ShutdownGlobalProcessor()`

グローバルプロセッサをシャットダウンし、リソースを解放します。

```go
func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    json.SetGlobalProcessor(p)

    defer json.ShutdownGlobalProcessor()

    // アプリケーションロジック...
}
```

---

## 出力関数

::: warning API 変更のお知らせ
`Print`、`PrintPretty`、`PrintE`、`PrintPrettyE` は内部関数（小文字命名）に移行し、公開 API としてエクスポートされなくなりました。[Encode](./functions/encode-decode#encode)、[EncodePretty](./functions/encode-decode#encodepretty)、または [Prettify](./functions/encode-decode#prettify) を `fmt.Println` と組み合わせて使用してください。詳細は [出力関数](./print) を参照。
:::

---

## Buffer 互換関数

::: tip 説明
以下の関数は `encoding/json` 標準ライブラリと完全に互換性があり、`cfg` パラメータを通じて追加設定をサポートします。
:::

### Compact

シグネチャ：`func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON を圧縮して Buffer に書き込みます。`encoding/json.Compact` と 100% 互換。

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
```

### Indent

シグネチャ：`func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON をフォーマットして Buffer に書き込みます。`encoding/json.Indent` と 100% 互換。

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

---

### HTMLEscape

シグネチャ：`func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON を HTML エスケープして Buffer に書き込みます。`encoding/json.HTMLEscape` と 100% 互換。

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

---

## セキュリティパターン関数

### Config.AddDangerousPattern

Config の `AddDangerousPattern` メソッドまたは `AdditionalDangerousPatterns` フィールドでカスタム危険パターンを登録します。

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "カスタム悪意キーワード",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

Config 作成後に `AdditionalDangerousPatterns` フィールドを設定することも可能です：

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "カスタム悪意キーワード", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**DangerousPattern 構造体**

| フィールド | 型 | 説明 |
|------|------|------|
| `Pattern` | `string` | 検出する部分文字列 |
| `Name` | `string` | 人間可読なリスクの説明 |
| `Level` | `PatternLevel` | 重大度レベル |

**PatternLevel レベル**

| レベル | 説明 |
|------|------|
| `PatternLevelCritical` | 常に操作をブロック |
| `PatternLevelWarning` | 厳格モードではブロック、緩やかなモードでは警告を記録 |
| `PatternLevelInfo` | ログ記録のみ、ブロックしない |

---

## エラー処理関数

### SafeError

シグネチャ：`func SafeError(err error) string`

クライアントに安全なエラーメッセージを返します。内部詳細情報は含まれません。API レスポンスでの使用に適しています。

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // 安全なエラーメッセージを返す（パス、内部状態などの機密情報を含まない）
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

シグネチャ：`func RedactedPath(path string) string`

編集済みのパスを返します。セキュアなログ記録に使用します。パス内の機密部分を隠します。

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // 安全なパス表現
```

---

## AccessResult 型変換メソッド

`AccessResult` は `Processor.SafeGet()` とパッケージレベル `SafeGet()` の戻り値の型で、型安全な変換メソッドを提供します。

### AccessResult.AsString

シグネチャ：`func (r AccessResult) AsString() (string, error)`

文字列型への安全な変換。値自体が文字列の場合のみ成功します。

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

シグネチャ：`func (r AccessResult) AsStringConverted() (string, error)`

任意の値を文字列に変換します（fmt.Sprintf でフォーマット）。

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (文字列フォーマット)
```

---

### AccessResult.AsInt

シグネチャ：`func (r AccessResult) AsInt() (int, error)`

整数への安全な変換。bool から int への変換はサポートしていません。

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

シグネチャ：`func (r AccessResult) AsFloat64() (float64, error)`

float64 への安全な変換。bool から float64 への変換はサポートしていません。

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

シグネチャ：`func (r AccessResult) AsBool() (bool, error)`

ブール値への安全な変換。bool と string 型のみサポート。

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## 関連

- [クエリ取得関数](./functions/get) - Get, GetString などのクエリ操作
- [変更関数](./functions/modify) - Set, Delete などの変更操作
- [型定義](./types) - AccessResult などの型
- [設定オプション](./config) - Config 設定の詳細
