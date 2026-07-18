---
sidebar_label: "エンコード出力"
title: "エンコード出力関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON エンコード出力関数：Marshal/Unmarshal シリアライズ、Compact/Indent/HTMLEscape フォーマット、Encode/EncodePretty/Prettify 設定可能エンコード、標準ライブラリ 100% 互換。"
sidebar_position: 5
---

# エンコード出力関数

json パッケージが提供するエンコード・デコード関数には、シリアライズ、デシリアライズ、フォーマット、設定可能エンコードが含まれます。

## シリアライズ関数

### Marshal

シグネチャ：`func Marshal(value any, cfg ...Config) ([]byte, error)`

Go の値を JSON バイトスライスにシリアライズします。`encoding/json.Marshal` と 100% 互換性があります：cfg なしで `json.Marshal(v)` を呼び出すと標準ライブラリと完全に一致します。

オプションの末尾 `Config` でエンコード動作（インデント、数値処理など）を制御でき、`Processor.Marshal` とパッケージレベル/インスタンスレベルのミラーを形成します。

```go
// encoding/json 互換（cfg なし）
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}

// 設定付き（非破壊的なオプションパラメータ）
data, err = json.Marshal(value, json.PrettyConfig())
```

### Unmarshal

シグネチャ：`func Unmarshal(data []byte, value any, cfg ...Config) error`

JSON バイトスライスを Go の値にデシリアライズします。`encoding/json.Unmarshal` と 100% 互換性があります：cfg なしで `json.Unmarshal(data, &v)` を呼び出すと標準ライブラリと完全に一致します。

オプションの末尾 `Config` でセキュリティ制限や数値保持などを制御でき、`Processor.Unmarshal` とミラーを形成します。

```go
var result struct {
    Name string `json:"name"`
}
// encoding/json 互換（cfg なし）
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)

// 設定付き
err = json.Unmarshal(data, &v, json.SecurityConfig())
```

### MarshalIndent

シグネチャ：`func MarshalIndent(v any, prefix, indent string, cfg ...Config) ([]byte, error)`

インデント付きシリアライズ。`encoding/json.MarshalIndent` と 100% 互換性があります：cfg なしで `json.MarshalIndent(v, prefix, indent)` を呼び出すと標準ライブラリと完全に一致します。

オプションの末尾 `Config` で設定を追加できます。`prefix` と `indent` パラメータは `Config` 内の対応するフィールドを上書きします。

```go
// encoding/json 互換（cfg なし）
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))

// 設定付き
data, err = json.MarshalIndent(v, "", "  ", json.SecurityConfig())
```

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

### CompactString

シグネチャ：`func CompactString(jsonStr string, cfg ...Config) (string, error)`

文字列入力/文字列出力の形式で JSON を圧縮し、不要な空白文字を削除します。`Processor.Compact` のパッケージレベルミラーであり、`Prettify`（`Processor.Prettify` のミラー）と対称です。

::: info Compact と CompactString
- `Compact(dst, src)`：バッファ形式、`encoding/json.Compact` 互換、`Processor.CompactBuffer` のミラー
- `CompactString(s)`：文字列形式、`Processor.Compact` のミラー
:::

```go
compact, err := json.CompactString(`{
    "name": "Alice",
    "age": 30
}`)
// compact == `{"name":"Alice","age":30}`

// 設定付き（例：元の数値フォーマットを保持）
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
compact, err = json.CompactString(jsonStr, cfg)
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

JSON コンテンツの HTML エスケープを行い、`<`、`>`、`&` などの特殊文字（および U+2028、U+2029）を対応する Unicode エスケープシーケンスに置き換え、結果を `dst` に書き込みます。戻り値はありません。

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
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

::: warning 非推奨
`Encode` は機能的に [`EncodeWithConfig`](#encodewithconfig) と完全に同じです（両者は同じ実装に委譲します）。代わりに `EncodeWithConfig` を使用するか、`[]byte` 出力で問題ない場合は [`Marshal`](#marshal) を使用してください。`Encode` は将来のメジャーバージョンで削除されます。
:::

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

複数の値を JSON 配列ストリーム（array stream）としてエンコードします。`values` は通常スライスまたは列挙可能なコレクションで、`[v1,v2,...]` 形式の JSON 配列文字列を出力します。

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

JSON バイトを圧縮し `dst` バッファに書き込みます。パッケージレベルの `Compact` 関数はこのメソッドに委譲します。

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
cfg = json.PrettyConfig()

// セキュリティ設定
cfg = json.SecurityConfig()
```

::: tip
完全な Config フィールドのドキュメントについては、[設定](../config) を参照してください。
:::

## 関連

- [クエリと取得関数](./query) - Get、GetString などのクエリ操作
- [変更関数](./modify) - Set、Delete などの変更操作
- [ファイル操作](./file-io) - LoadFromFile、SaveToFile などのファイル操作
- [設定](../config) - Config 型とオプション
- [インターフェース](../interfaces) - Processor、Encoder、Decoder 型
