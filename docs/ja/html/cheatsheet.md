---
title: "チートシート - CyberGo HTML | API 一覧"
description: "CyberGo HTML API チートシート：パッケージ関数、Processor メソッド、4 種の設定プリセット、主要設定、エラー判定、監査設定を 1 ページにまとめます。"
---

# チートシート

## パッケージ関数

### コンテンツ抽出

```go
// バイトから完全な結果を抽出
result, err := html.Extract(data)

// ファイルから抽出
result, err := html.ExtractFromFile("page.html")

// テキストのみ抽出
text, err := html.ExtractText(data)
text, err := html.ExtractTextFromFile("page.html")
```

### 出力フォーマット

```go
md, err := html.ExtractToMarkdown(data)
jsonBytes, err := html.ExtractToJSON(data)
```

### リンク抽出

```go
links, err := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)
```

### バッチ処理

```go
batch := html.ExtractBatch(pages)
// または
batch := html.ExtractBatchFiles(paths)
```

### コンテキスト付きバージョン

すべての関数に `WithContext` バリアントがあります：

```go
result, err := html.ExtractWithContext(ctx, data)
result, err = html.ExtractFromFileWithContext(ctx, path)
text, err := html.ExtractTextWithContext(ctx, data)
md, err := html.ExtractToMarkdownWithContext(ctx, data)
links, err := html.ExtractAllLinksWithContext(ctx, data)
batch := html.ExtractBatchWithContext(ctx, pages)
```

## Processor

```go
// 作成
p, err := html.New(html.DefaultConfig())
defer p.Close()

// 抽出
result, err := p.Extract(data)
result, err = p.ExtractFromFile(path)
text, err := p.ExtractText(data)

// 出力
md, err := p.ExtractToMarkdown(data)
jsonBytes, err := p.ExtractToJSON(data)

// リンク
links, err := p.ExtractAllLinks(data)

// バッチ
batch := p.ExtractBatch(pages)

// 統計
stats := p.GetStatistics()
p.ClearCache()
p.ResetStatistics()

// 監査
entries := p.GetAuditLog()
p.ClearAuditLog()
```

## 設定プリセット

```go
html.DefaultConfig()       // デフォルト設定
html.TextOnlyConfig()      // テキストのみ
html.MarkdownConfig()      // Markdown 出力
html.HighSecurityConfig()  // 高セキュリティ
```

## よく使う設定項目

```go
cfg := html.DefaultConfig()

// リソース制限
cfg.MaxInputSize = 10 * 1024 * 1024  // 最大入力 10MB
cfg.ProcessingTimeout = time.Minute   // 処理タイムアウト
cfg.MaxDepth = 200                    // 最大 DOM 深度

// コンテンツ制御
cfg.ExtractArticle = true             // スマート記事認識
cfg.PreserveImages = true             // 画像を保持
cfg.PreserveLinks = true              // リンクを保持
cfg.PreserveVideos = false            // 動画を保持しない
cfg.PreserveAudios = false            // 音声を保持しない

// 出力フォーマット
cfg.InlineImageFormat = "markdown"    // none/markdown/html/placeholder
cfg.InlineLinkFormat = "markdown"     // none/markdown/html
cfg.TableFormat = "markdown"          // markdown/html

// リンクフィルタリング
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// キャッシュ
cfg.MaxCacheEntries = 1000
cfg.CacheTTL = 30 * time.Minute
```

## エラー処理

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 入力が大きすぎる
    case errors.Is(err, html.ErrInvalidHTML):
        // 無効な HTML
    case errors.Is(err, html.ErrProcessingTimeout):
        // 処理タイムアウト
    case errors.Is(err, html.ErrFileNotFound):
        // ファイルが見つからない
    case errors.Is(err, html.ErrInvalidConfig):
        // 設定が無効
    case errors.Is(err, html.ErrProcessorClosed):
        // Processor が閉じている
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // DOM 深度が制限を超過
    case errors.Is(err, html.ErrInvalidFilePath):
        // ファイルパスが無効
    default:
        // その他のエラー
    }
}
```

## 監査システム

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// カスタム Sink を使用
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// 処理後に監査ログを取得
entries := p.GetAuditLog()
```
