---
title: "よくある質問 - HTML"
description: "CyberGo HTML ライブラリのよくある質問と回答。パッケージ関数と Processor の違いと選び方、エンコーディングの自動検出と手動指定、入力サイズ制限の設定、Markdown 出力の取得方法、バッチ処理の上限、空テキストのトラブルシューティング、統計モニタリングの使用方法、監査設定方法、カスタムスコアラーの実装など、実際の使用におけるよくある疑問を素早く解決します。"
---

# よくある質問

## パッケージ関数と Processor の違いは？

**パッケージ関数**（例：`html.Extract`）は内部で `sync.Pool` を使用して Processor を再利用し、低頻度・一度きりの呼び出しに適しています。呼び出しごとに Processor をプールに返却します。

**Processor**（例：`p := html.New()`）は高頻度の呼び出しに適しており、キャッシュと内部リソースを再利用します。統計収集と監査ログもサポートしています。

```go
// 低頻度：パッケージ関数
result, _ := html.Extract(data)

// 高頻度：Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## エンコーディングの問題をどう処理しますか？

HTML ライブラリは 15+ 種類のエンコーディング（UTF-8、GBK、Shift_JIS、Windows-1252 など）を自動検出するため、通常は手動指定は不要です。

エンコーディングを強制指定する場合：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## 入力サイズの上限は？

デフォルトは最大 50MB（`DefaultMaxInputSize = 52428800`）。設定で調整可能です：

```go
cfg.MaxInputSize = 100 * 1024 * 1024 // 100MB
```

## Markdown フォーマットの出力を取得するには？

```go
md, err := html.ExtractToMarkdown(data)
```

または Processor を使用：

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## バッチ処理の最大件数は？

1 回のバッチで最大 10000 件です。それ以上のデータセットは分割して処理してください。

## 抽出されたテキストが空になるのはなぜ？

考えられる原因：

1. **HTML 構造の問題** - コンテンツが `<script>` や `<style>` タグ内にある
2. **深度超過** - DOM ネストが `MaxDepth` 制限を超えている
3. **入力が空** - 入力バイト配列が空か確認
4. **記事認識** - `ExtractArticle` を無効にして抽出できるか試す

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // 記事認識を無効化
```

## 処理統計をモニタリングするには？

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// いくつかコンテンツを処理した後
stats := p.GetStatistics()
fmt.Printf("処理済み: %d\n", stats.TotalProcessed)
fmt.Printf("キャッシュヒット: %d\n", stats.CacheHits)
fmt.Printf("平均処理時間: %v\n", stats.AverageProcessTime)
fmt.Printf("エラー数: %d\n", stats.ErrorCount)
```

## 監査を有効にするには？

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

詳細は [監査システム](./api-reference/audit) を参照してください。

## ファイルパスは安全ですか？

`FileError` は完全なパスを自動的に切り詰め、エラーメッセージでのサーバーパス漏洩を防止します：

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // ファイル名のみ、完全パスではない
}
```

## カスタムコンテンツスコアリングを実装するには？

`Scorer` インターフェースを実装します：

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // カスタムスコアリングロジック
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // カスタム削除ロジック
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

詳細は [インターフェース定義](./api-reference/interfaces) を参照してください。
