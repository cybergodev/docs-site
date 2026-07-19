---
sidebar_label: "設定"
title: "設定 - CyberGo html | Config フィールド詳解"
description: "CyberGo html Config 設定詳解：リソース管理、セキュリティ、コンテンツ抽出、出力フォーマット、リンクフィルタに、Validate 検証メソッドを含めて解説します。"
sidebar_position: 3
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

:::tip ヒント
`MaxCacheEntries`、`CacheCleanup`、`ProcessingTimeout`を `0` に設定することはエラーではなく、明確な意味を持ちます（それぞれキャッシュ無効化、バックグラウンドクリーンアップ無効化、タイムアウトなしを意味します）。一方、`MaxInputSize`、`WorkerPoolSize`、`MaxDepth`は正の数でなければならず、そうでない場合は `ConfigError` が発生します。
:::

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

### 検証の制約

`Validate()` が数値フィールドに強制する値の範囲です（違反時は `ConfigError` を返し、`errors.Is(err, html.ErrInvalidConfig)` で判定できます）：

| フィールド | 制約 | 不正な例 |
|------|------|----------|
| `MaxInputSize` | 正の数かつ ≤ `52428800`（50MB） | `0`、`-1`、`100000000` |
| `MaxCacheEntries` | ≥ `0` かつ ≤ `100000` | `-1`、`200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | 正の数かつ ≤ `256` | `0`、`512` |
| `MaxDepth` | 正の数かつ ≤ `500` | `0`、`1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `InlineImageFormat` | 空 / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | 空 / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | 空 / `markdown` / `html` | `"csv"` |

フォーマット文字列は大文字小文字を区別せず、空の値はデフォルトとして扱われます（`InlineImageFormat`/`InlineLinkFormat` → `none`、`TableFormat` → `markdown`）。`New()` は Processor を生成する前に `Validate()` を呼び出すため、無効な設定からは使用可能な Processor は生成されません。
