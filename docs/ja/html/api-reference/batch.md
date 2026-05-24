---
title: "バッチ処理 - HTML"
description: "CyberGo HTML ライブラリの並列バッチ抽出 API リファレンス。ExtractBatch と ExtractBatchFiles シリーズ関数およびそのコンテキスト付きバージョンを含み、WorkerPoolSize による並列制御、1 バッチ最大 10000 件に対応。BatchResult には成功、失敗、キャンセルのカウントが含まれ、大規模 HTML コンテンツの並列抽出に適しています。"
---

# バッチ処理

バッチ抽出は複数の HTML ドキュメントを並列処理でき、各バッチは最大 10000 件です。

## パッケージ関数

```go
func ExtractBatch(htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchFiles(filePaths []string, cfg ...Config) *BatchResult
func ExtractBatchFilesWithContext(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult
```

## Processor メソッド

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## BatchResult

```go
type BatchResult struct {
    Results   []*Result  // 成功した抽出結果
    Errors    []error    // 失敗したエラー
    Success   int        // 成功数
    Failed    int        // 失敗数
    Cancelled int        // コンテキストキャンセルによる数
}
```

## 例

```go
pages := [][]byte{page1, page2, page3}
batch := html.ExtractBatch(pages)

fmt.Printf("成功: %d, 失敗: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    fmt.Printf("ページ %d: %s\n", i, result.Title)
}

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("ページ %d エラー: %v\n", i, err)
    }
}
```

:::warning バッチ制限
1 回のバッチは最大 10000 件です。超過するとエラーになります。
:::
