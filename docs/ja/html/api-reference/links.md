---
title: "リンク抽出 - HTML"
description: "CyberGo HTML ライブラリの独立したリンク抽出 API リファレンス。ExtractAllLinks シリーズ関数と GroupLinksByType グループ化ツールを含み、HTML からすべてのリンクリソース（CSS、JS、画像、動画、音声）を抽出してタイプ別にグループ化できます。Config によるリンクフィルタリングもサポートし、クローラーやリソース収集のユースケースに適しています。"
---

# リンク抽出

独立したリンク抽出 API で、HTML からすべてのリンクリソースを抽出し、タイプ別にグループ化できます。

## パッケージ関数

```go
func ExtractAllLinks(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFile(filePath string, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)
```

## Processor メソッド

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## グループ化ツール

### GroupLinksByType

リンクをタイプ別にグループ化します。

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, _ := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)

for typ, items := range groups {
    fmt.Printf("タイプ %s: %d 件\n", typ, len(items))
}
```

## LinkResource

```go
type LinkResource struct {
    URL   string // リンクアドレス
    Title string // リンクタイトル
    Type  string // リンクタイプ（link, image, video, audio, media, css, js, icon）
}
```

## 設定

リンク抽出の動作は `Config` のリンクフィルタフィールドで制御できます：

```go
cfg := html.DefaultConfig()
cfg.IncludeImages = true
cfg.IncludeCSS = true
cfg.IncludeJS = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"
```
