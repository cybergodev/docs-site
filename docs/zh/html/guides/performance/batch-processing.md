---
sidebar_label: "批量处理实战"
title: "批量处理实战 - CyberGo html | 并发提取指南"
description: "CyberGo html 批量处理实战指南：ExtractBatch 等四个批量 API 详解、BatchResult 结果结构、WorkerPoolSize 并发控制、context 上下文取消、部分失败处理与按数据量规模的分级性能调优建议。"
sidebar_position: 2
---

# 批量处理实战

处理大量 HTML 文档时，批量 API 自动并发执行，比循环逐个调用快数倍。本指南涵盖四个批量 API、结果结构与并发调优。

## 批量 API 总览

库提供四个批量函数，分别对应字节输入/文件输入 × 无上下文/带上下文：

| API | 输入 | 上下文 | 说明 |
|-----|------|--------|------|
| `ExtractBatch` | `[][]byte` | 无 | 批量提取字节切片 |
| `ExtractBatchFiles` | `[]string` | 无 | 批量提取文件路径 |
| `ExtractBatchWithContext` | `[][]byte` | 有 | 支持超时/取消 |
| `ExtractBatchFilesWithContext` | `[]string` | 有 | 支持超时/取消 |

所有函数均可在 `Processor` 实例或包级别调用：

```go
// 包级别（使用内部池化 Processor）
br := html.ExtractBatch(pages)

// Processor 实例（复用缓存）
p, _ := html.New()
defer p.Close()
br := p.ExtractBatch(pages)
```

## BatchResult 结构

批量操作返回 `*BatchResult`，包含逐项结果和汇总计数：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Results` | `[]*Result` | 每项的提取结果；失败或取消的项为 `nil` |
| `Errors` | `[]error` | 每项的错误；成功项为 `nil`；索引与输入一一对应 |
| `Success` | `int` | 成功提取的数量 |
| `Failed` | `int` | 失败提取的数量 |
| `Cancelled` | `int` | 因上下文取消而跳过的数量 |

:::tip 索引对应关系
`Results[i]`、`Errors[i]` 与第 `i` 个输入项一一对应。成功时 `Results[i]` 非 nil 且 `Errors[i]` 为 nil；失败时反之。
:::

## 基础示例

批量提取 3 个 HTML 字节切片：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	pages := [][]byte{
		[]byte(`<html><body><article><h1>第一页</h1><p>Go 语言教程。</p></article></body></html>`),
		[]byte(`<html><body><article><h1>第二页</h1><p>并发编程指南。</p></article></body></html>`),
		[]byte(`<html><body><article><h1>第三页</h1><p>性能优化技巧。</p></article></body></html>`),
	}

	// 批量并发提取（使用包级函数）
	br := html.ExtractBatch(pages)

	fmt.Printf("成功：%d，失败：%d，取消：%d\n", br.Success, br.Failed, br.Cancelled)
	// 成功：3，失败：0，取消：0

	// 遍历结果（索引与输入对应）
	for i, result := range br.Results {
		if result != nil {
			fmt.Printf("  [%d] 标题：%s\n", i+1, result.Title)
		} else if br.Errors[i] != nil {
			fmt.Printf("  [%d] 错误：%v\n", i+1, br.Errors[i])
		}
	}
	// [1] 标题：第一页
	// [2] 标题：第二页
	// [3] 标题：第三页
}
```

## 从文件批量提取

```go
files := []string{"page1.html", "page2.html", "page3.html"}

br := html.ExtractBatchFiles(files)

fmt.Printf("成功：%d，失败：%d\n", br.Success, br.Failed)

for i, err := range br.Errors {
    if err != nil {
        fmt.Printf("文件 %s 失败：%v\n", files[i], err)
    }
}
```

## 包级函数 vs Processor 实例

两种调用方式的缓存行为不同：

| 调用方式 | 缓存 | 适用场景 |
|----------|------|----------|
| `html.ExtractBatch(pages)` | 禁用（池化 Processor 每次清空缓存） | 一次性批量任务 |
| `p.ExtractBatch(pages)` | 启用（复用 Processor 缓存） | 高频批量、重复内容 |

:::warning 包级函数不缓存
包级函数使用内部 `sync.Pool` 管理的 Processor，其配置已禁用缓存（`MaxCacheEntries = 0`），且每次归还时清空缓存。如果批量中有重复内容，应使用 Processor 实例以利用缓存加速。详见 [Processor 复用与缓存](./processor-cache)。
:::

```go
// 推荐：高频批量场景复用 Processor
p, _ := html.New()
defer p.Close()

for batch := range batchQueue {
    br := p.ExtractBatch(batch) // 缓存生效，重复内容直接命中
    processResult(br)
}
```

## 并发控制

`WorkerPoolSize` 控制批量处理的并发工作数（默认 4，最大 256）：

```go
cfg := html.DefaultConfig()

// 按 CPU 核心数设置并发（封顶 256）
n := runtime.NumCPU()
if n > 256 {
    n = 256
}
cfg.WorkerPoolSize = n

p, _ := html.New(cfg)
defer p.Close()

br := p.ExtractBatch(pages)
```

| 配置 | 默认值 | 上限 | 说明 |
|------|--------|------|------|
| `WorkerPoolSize` | 4 | 256 | 并发 worker 数量，必须为正整数 |

:::tip WorkerPoolSize 调优
CPU 密集型任务设为 CPU 核心数；I/O 密集型（如文件读取）可适当增大。超出 256 会被配置校验拒绝。
:::

## 批量上限

单个批量最多支持 10000 项。超出时**所有项**返回错误（而非部分处理）：

```go
huge := make([][]byte, 10001) // 超出上限

br := html.ExtractBatch(huge)

fmt.Printf("失败：%d\n", br.Failed)
// 失败：10001

fmt.Printf("第一项错误：%v\n", br.Errors[0])
// 第一项错误：html: batch size 10001 exceeds maximum 10000
```

:::warning 超限行为
`maxBatchSize = 10000` 是硬上限。超限时不会处理任何项，而是对全部输入返回统一错误。如需处理更多，请分批调用。
:::

## 上下文取消

`ExtractBatchWithContext` 在上下文取消时优雅终止：

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

br := p.ExtractBatchWithContext(ctx, pages)

fmt.Printf("成功：%d，失败：%d，取消：%d\n",
    br.Success, br.Failed, br.Cancelled)
```

| 项的状态 | 处理方式 |
|----------|----------|
| 已完成 | 结果保留在 `Results` 中 |
| 正在进行 | 完成后正常记录 |
| 未开始 | 跳过，计入 `Cancelled`，`Errors[i]` 设为 `ctx.Err()` |

:::tip 部分结果可用
上下文取消后，已完成项的结果仍然保留在 `br.Results` 中（非 nil）。可安全使用已完成的结果，无需因取消丢弃全部输出。
:::

## 部分失败处理

批量是**部分成功**的——一项失败不影响其他项：

```go
pages := [][]byte{
    validHTML,   // 正常
    []byte(""),  // 空输入，触发错误
    validHTML2,  // 正常
}

br := p.ExtractBatch(pages)

// 第 2 项失败，第 1、3 项仍成功
fmt.Printf("成功：%d，失败：%d\n", br.Success, br.Failed)
// 成功：2，失败：1

// 逐项处理，跳过失败项
for i, result := range br.Results {
    if result == nil {
        fmt.Printf("[%d] 失败：%v\n", i, br.Errors[i])
        continue
    }
    fmt.Printf("[%d] 标题：%s\n", i, result.Title)
}
```

## 性能建议

| 文档数量 | 推荐策略 | 说明 |
|----------|----------|------|
| 1–10 | 逐个 `Extract` | 批量调度开销可能超过并发收益 |
| 10–1000 | `ExtractBatch` + 包级函数 | 自动并发，无需管理 Processor |
| 1000+ | `p.ExtractBatch` + Processor 实例 | 复用缓存，分批处理避免内存峰值 |
| 10000+ | 分批（每批 ≤10000）+ Processor 实例 | 超出单批上限，分片处理 |

```go
// 大规模分批处理示例
p, _ := html.New()
defer p.Close()

const batchSize = 5000
for i := 0; i < len(allPages); i += batchSize {
    end := i + batchSize
    if end > len(allPages) {
        end = len(allPages)
    }

    br := p.ExtractBatch(allPages[i:end])
    // 处理本批结果...
}
```

## 下一步

- [Processor 复用与缓存](./processor-cache) - 包函数与实例的缓存区别
- [性能优化](./performance) - 吞吐量提升与超时设置
- [错误处理](./error-handling) - 哨兵错误与批量错误处理
- [API 参考：批量处理](../../api-reference/modules/batch) - 完整 API 签名
