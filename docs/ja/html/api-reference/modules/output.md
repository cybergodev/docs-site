---
sidebar_label: "出力形式"
title: "出力フォーマット - CyberGo html | Markdown・JSON 出力"
description: "CyberGo html 出力フォーマット API：ExtractToMarkdown、ExtractToJSON のパッケージ関数と Processor メソッドで、バイトやファイルを Markdown/JSON に変換します。"
sidebar_position: 1
---

# 出力フォーマット

HTML ライブラリは抽出結果を Markdown または JSON フォーマットで出力できます。

## Markdown 出力

HTML コンテンツを抽出して Markdown フォーマットに変換します。このメソッドはキャッシュ無効化の一時 Processor を使用し、主 Processor のキャッシュを読み書きしません。

### パッケージ関数

```go
func ExtractToMarkdown(htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFile(filePath string, cfg ...Config) (string, error)
func ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) (string, error)
```

### Processor メソッド

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

### 例

```go
cfg := html.MarkdownConfig()
md, err := html.ExtractToMarkdown(data, cfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## JSON 出力

抽出結果を JSON バイトにシリアライズします。このメソッドは主 Processor の通常 Extract を経由し（キャッシュ有効時はヒット/書き込み）、JSON にシリアライズします。

### パッケージ関数

```go
func ExtractToJSON(htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFile(filePath string, cfg ...Config) ([]byte, error)
func ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)
```

### Processor メソッド

```go
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

### 例

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

:::tip Result.MarshalJSON
`Result` は `json.Marshaler` インターフェースを実装しています。`ProcessingTime` と `ReadingTime` フィールドには `json:"-"` タグがあり（標準シリアライズではスキップされます）、カスタム `MarshalJSON()` によりミリ秒数として出力に含まれます。
:::
