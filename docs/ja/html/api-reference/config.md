---
title: "設定 - CyberGo HTML | Config フィールド詳解"
description: "CyberGo HTML Config 詳解：リソース管理（MaxInputSize・キャッシュ・タイムアウト）、セキュリティ、コンテンツ抽出、出力フォーマット、リンクフィルタ、Validate 検証を扱います。"
---

# 設定

## Config 構造体

`Config` は HTML ライブラリの統一設定構造体で、リソース管理、セキュリティ、コンテンツ抽出、出力フォーマット、リンクフィルタリングを網羅しています。

### リソース管理

| フィールド | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `MaxInputSize` | `int` | `52428800` (50MB) | 最大入力サイズ（バイト） |
| `MaxCacheEntries` | `int` | `2000` | キャッシュ最大エントリ数 |
| `CacheTTL` | `time.Duration` | `1h` | キャッシュ有効期限 |
| `CacheCleanup` | `time.Duration` | `5m` | キャッシュクリーンアップ間隔 |
| `WorkerPoolSize` | `int` | `4` | ワーカープールサイズ |
| `ProcessingTimeout` | `time.Duration` | `30s` | 処理タイムアウト時間 |

### セキュリティ

| フィールド | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | コンテンツクリーニングを有効化、信頼できる入力に対してのみ無効化可能 |
| `MaxDepth` | `int` | `500` | 最大 DOM 深度 |
| `AllowedBaseDir` | `string` | `""` | ファイル操作をこのディレクトリに制限します。空(既定値)は制限なしを意味します。信頼できないファイルパスの入力を受け取る場合に使用してください |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | 監査設定 |

### コンテンツ抽出

| フィールド | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `ExtractArticle` | `bool` | `true` | スマート記事認識を有効化 |
| `PreserveImages` | `bool` | `true` | 画像情報を保持 |
| `PreserveLinks` | `bool` | `true` | リンク情報を保持 |
| `PreserveVideos` | `bool` | `true` | 動画情報を保持 |
| `PreserveAudios` | `bool` | `true` | 音声情報を保持 |

### 出力フォーマット

| フィールド | 型 | デフォルト値 | 選択肢 | 説明 |
|------|------|--------|--------|------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | インライン画像フォーマット |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | インラインリンクフォーマット |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | テーブルフォーマット |
| `Encoding` | `string` | `""` | - | エンコーディングを指定（空で自動検出） |

### リンク抽出

| フィールド | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `ResolveRelativeURLs` | `bool` | `true` | 相対 URL を解決、BaseURL の設定が必要 |
| `BaseURL` | `string` | `""` | ベース URL（相対パスの解決に使用） |
| `IncludeImages` | `bool` | `true` | 画像リンクを含める |
| `IncludeVideos` | `bool` | `true` | 動画リンクを含める |
| `IncludeAudios` | `bool` | `true` | 音声リンクを含める |
| `IncludeCSS` | `bool` | `true` | CSS リンクを含める |
| `IncludeJS` | `bool` | `true` | JS リンクを含める |
| `IncludeContentLinks` | `bool` | `true` | コンテンツリンクを含める |
| `IncludeExternalLinks` | `bool` | `true` | 外部リンクを含める |
| `IncludeIcons` | `bool` | `true` | アイコンリンクを含める |

### 拡張

| フィールド | 型 | デフォルト値 | 説明 |
|------|------|--------|------|
| `Scorer` | `Scorer` | `nil` | カスタムコンテンツスコアラー、空の場合はデフォルトのスコアラーを使用 |

## プリセット設定

### DefaultConfig

バランスの取れた設定、一般的な用途に適しています。

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

プレーンテキストのみ抽出し、すべてのメディアとリンクの保持を無効化（`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios` すべて `false` に設定）。

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

Markdown 出力に最適化。インライン画像とリンクに Markdown フォーマットを使用。

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

高セキュリティ設定：制限を縮小、より短いタイムアウト、完全な監査。

```go
cfg := html.HighSecurityConfig()
```

`DefaultConfig()` からの上書き値：

| フィールド | デフォルト値 | 高セキュリティ値 |
|------|--------|----------|
| `MaxInputSize` | `52428800` (50MB) | `10485760` (10MB) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1h` | `30m` |
| `CacheCleanup` | `5m` | `1m` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30s` | `10s` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

## Validate

設定の有効性を検証します。

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // ConfigError を返す
```
