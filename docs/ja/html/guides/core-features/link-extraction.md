---
sidebar_label: "リンク抽出とグループ化"
title: "リンク抽出とグループ化 - CyberGo html | リソース収集ガイド"
description: "CyberGo html リンク抽出とグループ化：ExtractAllLinks でリソースリンクを抽出しタイプ別にグループ化、Include フィルタ、相対 URL 解決、クローラーのベストプラクティスを解説。"
sidebar_position: 3
---

# リンク抽出とグループ化

コンテンツ抽出とは独立して、ライブラリは専用のリンク抽出 API を提供し、クローラーやリソース収集のシーンに適しています。

## 基本的な使い方

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}
```

出力例：

```text
[image] Gopher マスコット - gopher.png
[js] app.js - https://example.com/app.js
[css] style.css - https://example.com/style.css
[link] Go 公式サイト - https://go.dev
```

## リンクタイプ

`LinkResource` の `Type` フィールドはリソースタイプを識別します：

| タイプ | 取得元要素 | 説明 |
|------|----------|------|
| `link` | `<a>` | ページリンク |
| `image` | `<img>` | 画像リソース |
| `video` | `<video>`、および `<iframe>`/`<embed>`/`<object>`（src が動画 URL の場合のみ収録） | 動画リソース |
| `audio` | `<audio>` | 音声リソース |
| `css` | `<link rel="stylesheet">` | スタイルシート |
| `media` | `<source>` | 汎用メディアリソース（動画/音声の判定不可時） |
| `js` | `<script>` | スクリプトファイル |
| `icon` | `<link rel="icon">` | サイトアイコン |

## タイプ別グループ化

`GroupLinksByType` はリンクを `Type` フィールドでグループ化します：

```go
links, _ := html.ExtractAllLinks(data)

groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("\n=== %s (%d) ===\n", typ, len(items))
    for _, item := range items {
        fmt.Printf("  %s\n", item.URL)
    }
}
```

出力例：

```text
=== image (3) ===
  https://example.com/hero.jpg
  https://example.com/icon.svg
  https://example.com/logo.png

=== css (2) ===
  https://example.com/style.css
  https://example.com/theme.css

=== js (1) ===
  https://example.com/app.js
```

:::tip グループの順序
`GroupLinksByType` は `map` を返すため、**グループ間の反復順序は不定**です。各グループ内の URL は `ExtractAllLinks` の URL 昇順を維持します。
:::

## フィルタリングルールの設定

`Config` フィールドで抽出するリンクタイプを制御します：

```go
cfg := html.DefaultConfig()

// 画像と CSS のみ抽出
cfg.IncludeImages = true
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = true
cfg.IncludeJS = false
cfg.IncludeContentLinks = false
cfg.IncludeExternalLinks = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

### フィルタオプション

| 設定フィールド | デフォルト値 | 制御範囲 |
|----------|--------|----------|
| `IncludeImages` | `true` | `<img>` タグ |
| `IncludeVideos` | `true` | `<video>`、`<iframe>`、`<embed>`、`<object>` |
| `IncludeAudios` | `true` | `<audio>` タグ |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | `<script>` タグ |
| `IncludeContentLinks` | `true` | `<a>` サイト内リンク |
| `IncludeExternalLinks` | `true` | `<a>` サイト外リンク |
| `IncludeIcons` | `true` | `<link rel="icon">` |

## URL の解決

### 相対 URL の解決

`ResolveRelativeURLs` を有効にすると、相対パスが自動的に絶対パスに変換されます：

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

### Base URL の自動検出

`ResolveRelativeURLs = true` を設定しても `BaseURL` を設定しない場合、ライブラリは HTML から自動的に検出します：

1. `<base href="...">` タグ
2. `<meta property="og:url">` または `canonical`
3. `<link rel="canonical">`
4. ページ内の最初の絶対 URL のドメイン

## クローラーシーンの実践

### ページの全リソースを収集

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// グループ化して処理
groups := html.GroupLinksByType(links)

// すべての画像をダウンロード
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// サブページのリンクを収集してクロールを継続
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

### ページのナビゲーションリンクのみ抽出

```go
cfg := html.DefaultConfig()
cfg.IncludeContentLinks = true
cfg.IncludeExternalLinks = true
cfg.IncludeImages = false
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = false
cfg.IncludeJS = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

## ファイルから抽出

```go
// パッケージ関数
links, err := html.ExtractAllLinksFromFile("page.html")

// Processor インスタンス
p, _ := html.New()
defer p.Close()
links, err := p.ExtractAllLinksFromFile("page.html")
```

## コンテキスト付きバージョン

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## 次のステップ

- [API リファレンス：リンク抽出](../../api-reference/modules/links) - 完全な API シグネチャ
- [バッチ処理](../../api-reference/modules/batch) - リンクのバッチ抽出
- [設定詳細](../../api-reference/core/config) - リンクフィルタ設定
