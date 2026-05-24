---
title: "エンコード・デコード関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON エンコード・デコード関数リファレンス：Marshal/Unmarshal シリアライズ、Compact/Indent/HTMLEscape フォーマット、Encode/EncodePretty/EncodeWithConfig/Prettify 設定可能エンコード、encoding/json と 100% 互換。"
---

# エンコード・デコード関数

json パッケージが提供するエンコード・デコード関数には、シリアライズ、デシリアライズ、フォーマット、設定可能エンコードが含まれます。

## シリアライズ関数

### Marshal

シグネチャ：`func Marshal(value any) ([]byte, error)`

Go の値を JSON バイトスライスにシリアライズします。`encoding/json.Marshal` と 100% 互換性があります。

```go
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}
```

::: tip
`Marshal` は設定パラメータを受け付けません。設定可能なエンコードが必要な場合は、[EncodeWithConfig](#encodewithconfig) を使用してください。
:::

### Unmarshal

シグネチャ：`func Unmarshal(data []byte, value any) error`

JSON バイトスライスを Go の値にデシリアライズします。`encoding/json.Unmarshal` と 100% 互換性があります。

```go
var result struct {
    Name string `json:"name"`
}
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)
```

### MarshalIndent

シグネチャ：`func MarshalIndent(v any, prefix, indent string) ([]byte, error)`

インデント付きシリアライズ。`encoding/json.MarshalIndent` と 100% 互換性があります。

```go
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

::: tip
`MarshalIndent` は設定パラメータを受け付けません。設定可能なエンコードが必要な場合は、[EncodeWithConfig](#encodewithconfig) を使用してください。
:::

## フォーマット関数

### Compact

シグネチャ：`func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON を圧縮し、不要な空白文字を削除して結果を `dst` に書き込みます。`encoding/json.Compact` と互換性があります。

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

### Indent

シグネチャ：`func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

JSON をフォーマットしインデントを追加して、結果を `dst` に書き込みます。`encoding/json.Indent` と互換性があります。

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(buf.String())
// {
//   "name": "test"
// }
```

### HTMLEscape

シグネチャ：`func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

JSON コンテンツの HTML エスケープを行い、特殊文字（`&`、`<`、`>`）を Unicode エスケープシーケンスに置き換え、結果を `dst` に書き込みます。戻り値はありません。

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"<script>alert(1)</script>"}
```

### Prettify

シグネチャ：`func Prettify(jsonStr string, cfg ...Config) (string, error)`

デフォルトのプリティプリントインデントを使用して JSON 文字列をフォーマットし、フォーマット後の文字列を返します。

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "Alice",
//   "age": 30
// }
```

## 設定可能エンコード関数

### Encode

シグネチャ：`func Encode(value any, cfg ...Config) (string, error)`

Go の値を JSON 文字列にエンコードします。オプションの設定パラメータをサポートします。

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**設定付き**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

シグネチャ：`func EncodePretty(value any, cfg ...Config) (string, error)`

Go の値をフォーマットされた JSON 文字列（インデント付き）にエンコードします。オプションの設定パラメータをサポートします。

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**設定付き**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

シグネチャ：`func EncodeWithConfig(value any, cfg ...Config) (string, error)`

指定された設定を使用して Go の値を JSON 文字列にエンコードします。エンコード動作をきめ細かく制御したい場合に適しています。

```go
// プリティプリント設定を使用
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**セキュリティ設定の使用**

```go
result, err := json.EncodeWithConfig(data, json.SecurityConfig())
```

## バッチエンコード関数

### EncodeBatch

シグネチャ：`func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

キーと値のペアを JSON オブジェクト文字列としてバッチエンコードします。

```go
result, err := json.EncodeBatch(map[string]any{
    "name":  "Alice",
    "age":   30,
    "email": "alice@example.com",
})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"age":30,"email":"alice@example.com","name":"Alice"}
```

### EncodeFields

シグネチャ：`func EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

指定されたフィールドのみをエンコードし、フィールドフィルタリング出力を実現します。

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// 公開フィールドのみ出力
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

シグネチャ：`func EncodeStream(values any, cfg ...Config) (string, error)`

ストリーミングエンコードで、値を JSON 文字列にエンコードします。統一されたエンコードインターフェースが必要な場面に適しています。

```go
values := []map[string]any{
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
}

result, err := json.EncodeStream(values)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Processor フォーマットメソッド

`Processor` 型は追加のフォーマットメソッドを提供します。`json.New()` を使用して Processor を作成します（`(*Processor, error)` を返します）：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

シグネチャ：`func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

JSON バイトを圧縮し `dst` バッファに書き込みます。パッケージレベルの `Compact` 関数に委譲します。

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "Alice"}`))
// buf.String() => {"name":"Alice"}
```

### Processor.Indent

シグネチャ：`func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

インデント付きフォーマットの JSON を `dst` バッファに書き込みます。`encoding/json.Indent` と互換性があります。

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"Alice"}`), "", "  ")
```

### Processor.HTMLEscape

シグネチャ：`func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML エスケープされた JSON を `dst` バッファに書き込みます。戻り値はありません。`encoding/json.HTMLEscape` と互換性があります。

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

::: tip
完全な Processor ドキュメントについては、[Processor](../interfaces) を参照してください。
:::

## 設定プリセット

以下のヘルパー関数は事前設定された `Config` 値を返し、`...Config` を受け付ける任意の関数に渡すことができます：

```go
// デフォルト設定
cfg := json.DefaultConfig()

// プリティプリント設定
cfg := json.PrettyConfig()

// セキュリティ設定
cfg := json.SecurityConfig()
```

::: tip
完全な Config フィールドのドキュメントについては、[設定](../config) を参照してください。
:::

## 関連

- [クエリ取得関数](./get) - Get、GetString などのクエリ操作
- [変更関数](./modify) - Set、Delete などの変更操作
- [ファイル操作](./file-io) - LoadFromFile、SaveToFile などのファイル操作
- [設定](../config) - Config 型とオプション
- [インターフェース](../interfaces) - Processor、Encoder、Decoder 型
