---
title: "リンク抽出 - CyberGo HTML | リソースリンク API"
description: "CyberGo HTML リンク抽出 API：ExtractAllLinks 系と GroupLinksByType でリソースリンクを抽出・グループ化し、Config でフィルタを制御します。"
---

# リンク抽出

独立したリンク抽出 API で、HTML からすべてのリンクリソースを抽出し、タイプ別にグループ化できます。

:::tip Extract との主な違い
`ExtractAllLinks` は **HTML サニタイズを適用しません**(ここでは `EnableSanitization` は無効です)。そのため `<script src>`、`<iframe>`、`<link>`、`<embed>` などのタグ内のリソースリンクもすべて抽出されます。これはこれらのリソースリンクを列挙できるようにするためであり、`Extract` の経路では通常サニタイズで除去されます。
:::

:::info 結果の並べ替えと重複排除
`ExtractAllLinks` の結果は **URL の昇順でソート**され、URL で重複排除されます。そのため同じ入力に対して複数回呼び出しても完全に同一の出力が得られます(v1.4.2 以降)。結果の比較、キャッシュ再利用、再現可能な下流処理に役立ちます。同じ URL が複数のタグに現れる場合は 1 件だけ保持されます。
:::

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
