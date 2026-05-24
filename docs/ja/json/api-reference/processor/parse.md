---
title: "Processor 解析と読み込み - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 解析と検証メソッド完全リファレンス：Valid 検証、Parse 変数への解析、ParseAny 任意型返却、PreParse 事前解析最適化、GetFromParsed 高速値取得、AllowComments コメントサポートと StrictMode 厳格モード設定。"
---

# 解析と読み込みメソッド

Processor は JSON 解析とデータ読み込み機能を提供します。

## 検証メソッド

### Valid

シグネチャ：`func (p *Processor) valid(jsonStr string, cfg ...Config) (bool, error)`

JSON 文字列が有効かどうかを検証します。

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // 有効な JSON
}
```

### ValidBytes

シグネチャ：`func (p *Processor) ValidBytes(data []byte) bool`

バイトスライスが有効な JSON かどうかを検証します。

```go
if p.ValidBytes([]byte(data)) {
    // 有効な JSON
}
```

## 解析メソッド

### Parse

シグネチャ：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

JSON 文字列をターゲット変数に解析します。標準モードと数値保持モードをサポートします。

```go
// map に解析
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// 構造体に解析
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// 数値保持モードを使用
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

シグネチャ：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

JSON 文字列を `any` 型に解析します。

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

シグネチャ：`func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

JSON データを事前解析し、同じデータに対する複数回のクエリで再解析を回避します。

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// 解析済みデータに対して複数回クエリ
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

シグネチャ：`func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

事前解析済みデータから値を取得します。`PreParse` と組み合わせて複数回クエリのパフォーマンスを向上させます。

### SetFromParsed

シグネチャ：`func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

事前解析済みデータに値を設定し、新しい `ParsedJSON` を返します。

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## ファイル読み込み

### LoadFromFile

シグネチャ：`func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

ファイルから JSON データを読み込み、元の文字列を返します。

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // 元の JSON 文字列
```

### LoadFromFileAsData（非公開化）

::: warning API 変更のお知らせ
`LoadFromFileAsData` は内部メソッド（`loadFromFileAsData`）に移行され、公開 API としてエクスポートされなくなりました。`LoadFromFile` + `Parse` の組み合わせを代替として使用してください：

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data の型は map[string]any または []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```
:::

## Reader 読み込み

### LoadFromReader

シグネチャ：`func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Reader から JSON データを読み込み、元の文字列を返します。

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData（非公開化）

::: warning API 変更のお知らせ
`LoadFromReaderAsData` は内部メソッド（`loadFromReaderAsData`）に移行され、公開 API としてエクスポートされなくなりました。`LoadFromReader` + `Parse` の組み合わせを代替として使用してください：

```go
file, _ := os.Open("data.json")
defer file.Close()

jsonStr, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
```
:::

## メソッドの選択

| シナリオ | 推奨メソッド |
|----------|-------------|
| 元の文字列が必要な場合 | `LoadFromFile` / `LoadFromReader` |
| 解析後のデータが必要な場合 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| 同じデータを複数回クエリ | `PreParse` + `GetFromParsed` |
| 有効性の検証のみ | `Valid` / `ValidBytes` |
| ターゲット変数への解析 | `Parse` |
| データをファイルに保存 | `SaveToFile` / `MarshalToFile` |
| Writer への書き込み | `SaveToWriter` |
| ファイルからの読み込みとデコード | `UnmarshalFromFile` |

## ファイル書き込み

### SaveToFile

シグネチャ：`func (p *Processor) SaveToFile(filePath string, data any, cfg ...Config) error`

データを JSON ファイルとして保存します。親ディレクトリを自動的に作成します。

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// PrettyConfig でフォーマット出力を保存
err = p.SaveToFile("data.json", data, json.PrettyConfig())
```

### MarshalToFile

シグネチャ：`func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

データを JSON にエンコードしてファイルに書き込みます。親ディレクトリを自動的に作成します。

```go
err := p.MarshalToFile("output.json", data)

// フォーマットして保存
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
```

### UnmarshalFromFile

シグネチャ：`func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

ファイルから JSON を読み込み、ターゲット変数にデコードします。

```go
var config Config
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

シグネチャ：`func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

データを JSON にエンコードして io.Writer に書き込みます。

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
```

## 関連

- [出力メソッド](./output) - Encode/EncodePretty メソッド
- [パスクエリ](./query) - Get シリーズメソッド
