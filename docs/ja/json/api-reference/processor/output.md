---
title: "Processor 出力メソッド - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor 出力メソッドリファレンス：Encode エンコード、EncodePretty フォーマット、EncodeWithConfig カスタム設定、EncodeBatch/EncodeFields バッチエンコード、Compact/Indent/HTMLEscape フォーマット操作など、多様な JSON 出力ニーズに対応。"
---

# 出力メソッド

Processor は複数の JSON エンコード出力メソッドを提供します。

## 基本出力

### Encode

シグネチャ：`func (p *Processor) Encode(value any, config ...Config) (string, error)`

任意の値を JSON 文字列にエンコードします。

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

シグネチャ：`func (p *Processor) EncodePretty(value any, config ...Config) (string, error)`

任意の値をフォーマットされた JSON 文字列にエンコードします。

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## 高度なエンコード

### EncodeWithConfig

シグネチャ：`func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

指定した設定で値を JSON 文字列にエンコードします。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `value` | `any` | はい | エンコードする値 |
| `cfg` | `Config` | いいえ | エンコード設定（オプション） |

```go
// PrettyConfig を使用
result, err := p.EncodeWithConfig(data, json.PrettyConfig())

// SecurityConfig を使用
result, err := p.EncodeWithConfig(data, json.SecurityConfig())

// カスタム設定を使用
cfg := json.DefaultConfig()
cfg.Pretty = true
cfg.SortKeys = true
cfg.EscapeHTML = true
result, err := p.EncodeWithConfig(data, cfg)
```

### EncodeBatch

シグネチャ：`func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

キーと値のペアをバッチで JSON オブジェクトにエンコードします。

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

シグネチャ：`func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

指定したフィールドのみをエンコードします。部分シリアライズに便利です。

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// name と email フィールドのみエンコード
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

シグネチャ：`func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

任意の値を JSON 文字列にエンコードします。`EncodeWithConfig` の Processor メソッド形式と同等です。

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## エンコード / デコード

### Marshal

シグネチャ：`func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

Go の値を JSON バイトスライスにエンコードします。`encoding/json.Marshal` と 100% 互換性があります。

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

シグネチャ：`func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

Go の値をフォーマットされた JSON バイトスライスにエンコードします。`encoding/json.MarshalIndent` と 100% 互換性があります。

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

シグネチャ：`func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

JSON バイトスライスをターゲット変数にパースします。`encoding/json.Unmarshal` と 100% 互換性があります。

```go
var user User
err := p.Unmarshal([]byte(`{"name":"Alice","age":30}`), &user)
if err != nil {
    panic(err)
}
```

## フォーマット

### Prettify

シグネチャ：`func (p *Processor) Prettify(jsonStr string, cfg ...Config) (string, error)`

JSON 文字列をインデント付きでフォーマットします。

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// 出力:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Print（非公開化）

::: warning API 変更のお知らせ
`Print`、`PrintE`、`PrintPretty`、`PrintPrettyE` は内部メソッド（小文字命名）に移行され、公開 API としてエクスポートされなくなりました。以下の代替手段を使用してください：

```go
// コンパクト出力
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// フォーマット出力
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

シグネチャ：`func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

JSON データが指定した Schema に準拠しているか検証します。

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
    },
}

errors, err := p.ValidateSchema(jsonStr, schema)
if err != nil {
    panic(err)
}
for _, ve := range errors {
    fmt.Printf("パス %s: %s\n", ve.Path, ve.Message)
}
```

## フォーマット操作

### Compact

シグネチャ：`func (p *Processor) Compact(jsonStr string, cfg ...Config) (string, error)`

JSON 文字列を圧縮し、すべての空白文字を削除します。

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// 出力: {"name":"CyberGo"}
```

### CompactBuffer

シグネチャ：`func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON を圧縮して Buffer に書き込みます。

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

シグネチャ：`func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON をフォーマットして Buffer に書き込みます。

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

シグネチャ：`func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON を HTML エスケープして Buffer に書き込みます。

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## 関連

- [Config](../config) - 設定オプション
- [解析と読み込み](./parse) - Parse/Load メソッド
