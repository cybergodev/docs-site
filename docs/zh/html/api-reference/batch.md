---
title: "批量处理 - CyberGo HTML | 并发批量 API"
description: "CyberGo HTML 并发批量 API：ExtractBatch、ExtractBatchFiles 系列及上下文版本，WorkerPoolSize 并发，单批最多 10000 项，BatchResult 含成功/失败/取消计数。"
---

# 批量处理

批量提取支持并发处理多个 HTML 文档，每个批次最多 10000 个项目。

## 包函数

```go
func ExtractBatch(htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchFiles(filePaths []string, cfg ...Config) *BatchResult
func ExtractBatchFilesWithContext(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult
```

## Processor 方法

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## BatchResult

```go
type BatchResult struct {
    Results   []*Result  // 每个输入项的结果，按输入顺序索引；失败或取消时为 nil
    Errors    []error    // 每个输入项的错误，索引与 Results 一一对应
    Success   int        // 成功数量
    Failed    int        // 失败数量
    Cancelled int        // 因上下文取消而未处理的数量
}
```

## 示例

```go
pages := [][]byte{page1, page2, page3}
batch := html.ExtractBatch(pages)

fmt.Printf("成功: %d, 失败: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    fmt.Printf("页面 %d: %s\n", i, result.Title)
}

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("页面 %d 错误: %v\n", i, err)
    }
}
```

:::warning 批量限制
单次批量最多 10000 个项目，超出将导致错误。
:::
