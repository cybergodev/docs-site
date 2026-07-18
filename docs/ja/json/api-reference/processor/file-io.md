---
sidebar_label: "ファイル I/O"
title: "Processor ファイル I/O - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor ファイルメソッド：LoadFromFile/LoadFromReader ロード、SaveToFile/MarshalToFile 保存、UnmarshalFromFile 読込、SaveToWriter ストリーム書込に対応します。"
sidebar_position: 9
---

# ファイル I/O メソッド

Processor はファイル、`io.Reader`、`io.Writer` の 3 種類のデータソースを扱う JSON ファイル読み書きおよびストリーミング読み込みメソッドを提供します。

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
LoadFromFileAsData は内部メソッド（`loadFromFileAsData`）に移行され、公開 API としてエクスポートされなくなりました。`LoadFromFile` + `Parse` の組み合わせを代替として使用してください：

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
LoadFromReaderAsData は内部メソッド（`loadFromReaderAsData`）に移行され、公開 API としてエクスポートされなくなりました。`LoadFromReader` + `Parse` の組み合わせを代替として使用してください：

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

## メソッドの選択

| シナリオ | 推奨メソッド |
|----------|-------------|
| 元の文字列が必要な場合 | `LoadFromFile` / `LoadFromReader` |
| 解析後のデータが必要な場合 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| データをファイルに保存 | `SaveToFile` / `MarshalToFile` |
| Writer への書き込み | `SaveToWriter` |
| ファイルからの読み込みとデコード | `UnmarshalFromFile` |

## 関連

- [パースと検証](./parse) - Parse/Valid 解析メソッド
- [ファイル I/O 関数](../functions/file-io) - パッケージレベルファイル関数
