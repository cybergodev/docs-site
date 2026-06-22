---
title: "出力フォーマット - CyberGo HTML | Markdown・JSON API"
description: "CyberGo HTML 出力フォーマット API：ExtractToMarkdown、ExtractToJSON のパッケージ関数と Processor メソッドでバイト/ファイルを Markdown/JSON に変換し、Result の直列化をサポートします。"
---

# 出力フォーマット

HTML ライブラリは抽出結果を Markdown または JSON フォーマットで出力できます。

## Markdown 出力

HTML コンテンツを抽出して Markdown フォーマットに変換します。

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

抽出結果を JSON バイトにシリアライズします。

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
