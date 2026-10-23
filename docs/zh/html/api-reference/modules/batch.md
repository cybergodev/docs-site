---
sidebar_label: "批量处理"
title: "批量处理 - CyberGo html | 并发批量提取 API"
description: "CyberGo html 并发批量提取 API 参考：详解 ExtractBatch、ExtractBatchFiles 及其 WithContext 上下文版本签名，并发度由 WorkerPoolSize 信号量控制，单批上限 10000 项，含 BatchResult 逐项结果结构、上下文取消后保留已完成结果、部分失败隔离与超限整批报错机制。"
sidebar_position: 30
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

## 并发机制

批量提取通过**信号量模式**（带缓冲通道 `chan struct{}`）控制并发度，而非一次性启动全部 goroutine：

- **并发度**由 `Config.WorkerPoolSize` 控制，默认值 `4`（`DefaultWorkerPoolSize`），取值范围 `1–256`
- 信号量容量等于 `WorkerPoolSize`：每个 goroutine 启动前必须先获取一个槽位（`sem <- struct{}{}`），结束后释放（`<-sem`），从而将**同时在运行的 goroutine 数**严格限制为 `WorkerPoolSize`
- 即使输入上万项，同一时刻也仅有 `WorkerPoolSize` 个提取任务在执行，避免 goroutine 爆炸
- **每个提取项独立运行**：自动编码检测、各自的错误隔离，单项失败不影响其他项
- **Processor 可安全并发共享**：多个 goroutine 同时调用 `Extract` 是线程安全的，批量方法复用同一个 Processor 实例

:::tip WorkerPoolSize 调参
批量处理在输入为文件时多为 I/O 密集，适当调大 `WorkerPoolSize`（如 `8–16`）可提升吞吐；纯 CPU 解析的密集场景则不宜超过 `runtime.NumCPU()`。超过 `256` 会在配置校验阶段被拒绝。
:::

## BatchResult 字段说明

`Results` 与 `Errors` 两个切片的**长度均等于输入项数量**，且**索引一一对应**：

| 字段 | 说明 |
|------|------|
| `Results[i]` | 第 `i` 个输入的提取结果；当该项失败或被取消时为 `nil` |
| `Errors[i]` | 第 `i` 个输入的错误；成功时为 `nil`，失败时为提取错误，取消时为 `ctx.Err()` |
| `Success` | 成功项计数，等于 `Results` 中非 `nil` 元素数量 |
| `Failed` | 失败项计数（提取过程返回错误） |
| `Cancelled` | 因上下文取消而未处理的项计数 |

恒等式：`Success + Failed + Cancelled == 输入项数量`。

## 上下文取消行为

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` 在三个检查点协作式响应上下文取消：

| 检查点 | 行为 |
|--------|------|
| 派发任务前 | 若 `ctx` 已取消，该项直接标记 `Cancelled`，`Errors[i] = ctx.Err()`，不启动 goroutine |
| 获取信号量后（goroutine 启动前） | 等待信号量期间若取消，同样标记 `Cancelled` |
| goroutine 内处理前 | 即将执行提取前再次检查，取消则标记 `Cancelled` 并立即返回 |

取消后的语义：

- **已完成的结果保留不变**——取消只影响尚未开始的任务
- **未开始的任务**计入 `Cancelled`，其 `Errors[i]` 填充 `ctx.Err()`（通常是 `context.Canceled` 或 `context.DeadlineExceeded`）
- 无 `WithContext` 后缀的版本内部使用 `context.Background()`，永不取消

## 输入校验

批量方法在派发任务前会做前置校验，失败时返回填充好的 `BatchResult`（而非 `error`）：

| 情况 | 返回 |
|------|------|
| 批量超过 `10000` 项 | 每项 `Errors[i]` 填充同一错误，`Failed = N`，不 panic |
| Processor 为 `nil` 或已 `Close` | 每项 `Errors[i]` 填充 `ErrProcessorClosed`，`Failed = N` |
| 输入切片为空（0 项） | 空的 `BatchResult`（`Results`/`Errors` 为空切片） |
| 包函数传入无效 `Config` | 每项填充配置错误 |

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

:::warning 批量限制
单次批量最多 10000 个项目，超出时返回一个所有项均失败的 `*BatchResult`（每项 `Errors` 填充 `html: batch size N exceeds maximum 10000`），不会触发 panic。
:::

## 相关文档

- [批量处理实战](../../guides/performance/batch-processing) — 批量提取的场景与调优
- [Processor 复用与缓存](../../guides/performance/processor-cache) — 复用 Processor 提升吞吐
