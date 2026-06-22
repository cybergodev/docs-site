---
title: "よくある質問 - CyberGo HTML | 質問と回答"
description: "CyberGo HTML よくある質問：パッケージ関数と Processor の選択、エンコーディング検出、入力制限、バッチ上限、空テキスト診断、統計、監査、カスタムスコアラーに答えます。"
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
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB
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

1. **HTML 構造の問題** - コンテンツが `<script>` または `<style>` タグの中にある
2. **サニタイズ後にコンテンツが空になる** - 本文がサニタイズで除去されるタグ(例: `<iframe>`、`<object>`)にしか存在しない場合、結果が空になることがあります。信頼できる入力であれば、一時的に `EnableSanitization = false` を設定して調査できます
3. **入力が空** - 入力バイト配列が空でないか確認してください(空白のコンテンツは空の `Result` を返します)
4. **記事検出** - `ExtractArticle` を無効にして抽出できるか試してください

:::tip エラーと空の結果の区別
DOM のネストが `MaxDepth` を超えると、空のテキストではなく `ErrMaxDepthExceeded` エラーを返します。呼び出しが `error` を返した場合、テキストが空かを確認するよりも `errors.Is` でエラー型を先に判定してください。
:::

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
