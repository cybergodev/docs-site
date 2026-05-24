---
title: "Processor - HTML"
description: "CyberGo HTML ライブラリの Processor プロセッサの完全な API リファレンス。New での作成、Extract 抽出メソッドファミリー、GetStatistics 統計照会、GetAuditLog 監査ログ、ClearCache キャッシュ管理、ResetStatistics リセット、Close ライフサイクル管理を含み、高頻度呼び出しでのリソース再利用に適したプロダクション環境の高性能処理のコアコンポーネントです。"
---

# Processor

`Processor` は HTML ライブラリのコア処理エンジンです。パッケージ関数と比較して、Processor は内部リソース（キャッシュ、エンコーディング検出器）を再利用し、高頻度の呼び出しに適しています。

## 作成

### New

Processor インスタンスを作成します。オプションで設定を渡せます。

```go
func New(cfg ...Config) (*Processor, error)
```

**パラメータ**：最大 1 つの `Config`。未指定時は `DefaultConfig()` が使用されます。

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## コンテンツ抽出

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

HTML バイトからコンテンツを抽出し、エンコーディングを自動検出します。

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

ファイルからコンテンツを抽出します。

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

プレーンテキストのみを返します。

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

ファイルからプレーンテキストを抽出します。

## コンテキスト付きバージョン

すべての抽出メソッドには `WithContext` 付きのバージョンがあります：

```go
func (p *Processor) ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
func (p *Processor) ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)
func (p *Processor) ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

## 出力フォーマット

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
```

コンテキスト付きバージョン：

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

## リンク抽出

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## バッチ処理

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## 統計とキャッシュ

### GetStatistics

現在の処理統計情報を返します。

```go
func (p *Processor) GetStatistics() Statistics
```

```go
stats := p.GetStatistics()
fmt.Printf("処理済み: %d, キャッシュヒット: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

キャッシュをクリアし、累積統計は保持します。

```go
func (p *Processor) ClearCache()
```

### ResetStatistics

すべての統計カウンターをリセットします。

```go
func (p *Processor) ResetStatistics()
```

## 監査

### GetAuditLog

監査ログエントリを取得します。

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

監査ログをクリアします。

```go
func (p *Processor) ClearAuditLog()
```

## ライフサイクル

### Close

Processor が保持しているリソースを解放します。使用後に必ず呼び出してください。

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... p を使って抽出処理
```
