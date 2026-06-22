---
title: "バッチ処理 - CyberGo HTML | 並行バッチ API"
description: "CyberGo HTML 並行バッチ API：ExtractBatch、ExtractBatchFiles 系とコンテキスト版。WorkerPoolSize 並行、バッチ最大 10000 項目、BatchResult カウントを提供します。"
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
    Results   []*Result  // 各入力項目の結果、入力順でインデックス付け; 失敗またはキャンセル時は nil
    Errors    []error    // 各入力項目のエラー、インデックスは Results と 1 対 1 で対応
    Success   int        // 成功数
    Failed    int        // 失敗数
    Cancelled int        // コンテキストのキャンセルにより未処理のまま残った項目数
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
