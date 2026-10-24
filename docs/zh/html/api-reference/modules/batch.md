---
sidebar_label: "批量处理"
title: "批量处理 - CyberGo html | 并发批量提取 API"
description: "CyberGo html 批量处理 API 参考：ExtractBatch 与 ExtractBatchFiles 及 WithContext 变体签名，WorkerPoolSize 信号量并发控制、单批 10000 项上限、BatchResult 逐项结果与上下文取消语义、空输入与无效配置的处理。"
sidebar_position: 30
---

# 批量处理

批量 API 并发处理多个 HTML 文档，单批最多 10000 项。并发度由 `WorkerPoolSize` 控制，每项独立提取、独立报错。

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
	Results   []*Result // 每个输入项的结果，按输入顺序索引；失败或取消时为 nil
	Errors    []error   // 每个输入项的错误，索引与 Results 一一对应
	Success   int       // 成功数量
	Failed    int       // 失败数量
	Cancelled int       // 因上下文取消而未处理的数量
}
```

## 并发机制

批量提取用**信号量**（带缓冲通道 `chan struct{}`）限制并发度，不会一次性启动全部 goroutine：

- 并发度由 `Config.WorkerPoolSize` 控制，默认 `4`（`DefaultWorkerPoolSize`），取值 `1–256`
- 信号量容量等于 `WorkerPoolSize`：每个 goroutine 启动前先获取槽位（`sem <- struct{}{}`），结束后释放（`<-sem`），因此同时在运行的提取任务数不超过 `WorkerPoolSize`
- 输入上万项时，同一时刻也仅有 `WorkerPoolSize` 个任务在执行，goroutine 数量不会随输入增长
- **每项独立运行**：各自做编码检测、各自返回错误，单项失败不影响其他项
- **Processor 可安全并发共享**：多个 goroutine 同时调用 `Extract` 是线程安全的，批量方法复用同一个 Processor 实例

:::tip WorkerPoolSize 的取值
输入为文件时多为 I/O 密集，调大到 `8–16` 可提升吞吐；纯 CPU 解析时不宜超过 `runtime.NumCPU()`。超过 `256` 会在配置校验阶段被拒绝。
:::

## BatchResult 字段说明

`Results` 与 `Errors` 两个切片的**长度都等于输入项数**，且**索引一一对应**：

| 字段 | 说明 |
|------|------|
| `Results[i]` | 第 `i` 个输入的提取结果；该项失败或被取消时为 `nil` |
| `Errors[i]` | 第 `i` 个输入的错误；成功时为 `nil`，失败时为提取错误，取消时为 `ctx.Err()` |
| `Success` | 成功项计数，等于 `Results` 中非 `nil` 元素的数量 |
| `Failed` | 失败项计数（提取过程返回了错误） |
| `Cancelled` | 因上下文取消而未处理的项数 |

恒等式：`Success + Failed + Cancelled == 输入项数`。

## 上下文取消行为

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` 在三个检查点协作式响应取消：

| 检查点 | 行为 |
|--------|------|
| 派发任务前 | `ctx` 已取消时，该项直接标记 `Cancelled`，`Errors[i] = ctx.Err()`，不启动 goroutine |
| 获取信号量后（goroutine 启动前） | 等待信号量期间被取消，同样标记 `Cancelled` |
| goroutine 内处理前 | 执行提取前再检查一次，已取消则标记 `Cancelled` 并立即返回 |

取消后的语义：

- **已完成的结果保持不变**——取消只影响尚未开始的任务
- **未开始的任务**计入 `Cancelled`，其 `Errors[i]` 为 `ctx.Err()`（通常是 `context.Canceled` 或 `context.DeadlineExceeded`）
- 不带 `WithContext` 的版本内部使用 `context.Background()`，不会取消

## 输入校验

批量方法在派发任务前做前置校验，失败时返回填充好的 `BatchResult` 而不是 `error`。检查顺序为 Processor 状态 → 项数上限 → 空输入，命中即返回：

| 情况 | 返回 |
|------|------|
| Processor 为 `nil` 或已 `Close` | 每项 `Errors[i]` 为 `ErrProcessorClosed`，`Failed = N` |
| 批量超过 `10000` 项 | 每项 `Errors[i]` 为同一错误，`Failed = N`，不 panic；可用 `errors.Is(err, html.ErrBatchTooLarge)` 判断 |
| 输入切片为空（0 项） | 空的 `BatchResult`（`Results`/`Errors` 为空切片） |
| 包函数传入无效 `Config` | 每项填充配置错误 |

空字节切片（`[]byte("")`）不算失败：提取直接返回空的 `Result`，该项计入 `Success`。

## 示例

### 基本批量提取

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := [][]byte{
		[]byte("<html><head><title>首页</title></head><body><p>欢迎访问首页。</p></body></html>"),
		[]byte("<html><head><title>关于我们</title></head><body><p>团队介绍。</p></body></html>"),
		[]byte("<html><head><title>产品列表</title></head><body><p>共三款产品。</p></body></html>"),
	}

	batch := html.ExtractBatch(pages)
	fmt.Printf("成功：%d，失败：%d，取消：%d\n", batch.Success, batch.Failed, batch.Cancelled)
	// 输出：成功：3，失败：0，取消：0

	// Results 索引与输入切片一一对应
	for i, result := range batch.Results {
		if result != nil {
			fmt.Printf("  [%d] 标题：%s，字数：%d\n", i, result.Title, result.WordCount)
		}
	}
}
```

### 带上下文取消的批量提取

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := make([][]byte, 20)
	for i := range pages {
		pages[i] = []byte("<html><head><title>页面</title></head><body><p>正文内容。</p></body></html>")
	}

	// 立即取消上下文，模拟提前终止
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	batch := html.ExtractBatchWithContext(ctx, pages)
	fmt.Printf("成功：%d，失败：%d，取消：%d\n", batch.Success, batch.Failed, batch.Cancelled)
	// 输出：成功：0，失败：0，取消：20

	// 被取消的项：Results[i] 为 nil，Errors[i] 填充 ctx.Err()
	fmt.Printf("首项错误：%v\n", batch.Errors[0])
	// 输出：首项错误：context canceled
}
```

:::warning 单批上限
单次批量最多 10000 项。超出时返回的 `*BatchResult` 中每项都失败（`Errors[i]` 为 `html: batch size exceeds maximum: N exceeds maximum 10000`，可用 `errors.Is(err, html.ErrBatchTooLarge)` 判断），不会 panic。更多项请调用方自行分批。
:::

## 相关文档

- [批量处理实战](../../guides/performance/batch-processing) — 批量提取的场景与调优
- [Processor 复用与缓存](../../guides/performance/processor-cache) — 复用 Processor 提升吞吐
