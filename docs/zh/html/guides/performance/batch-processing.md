---
sidebar_label: "批量处理实战"
title: "批量处理实战 - CyberGo html | 并发提取与失败隔离"
description: "CyberGo html 批量处理实战：四个批量 API 的调用方式与返回结构、包级函数与 Processor 实例的缓存差异、WorkerPoolSize 信号量并发控制、单批 10000 项上限、context 取消语义与单项失败隔离的写法。"
sidebar_position: 20
---

# 批量处理实战

批量 API 用 `WorkerPoolSize` 个并发槽位并行处理多个文档，单批上限 10000 项。本页覆盖四个批量函数、并发控制、取消语义与失败隔离；字段定义与完整签名见 [API 参考：批量处理](../../api-reference/modules/batch)。

## 四个批量 API

按输入类型与是否带 context 组合：

| API | 输入 | 上下文 |
|-----|------|--------|
| `ExtractBatch` | `[][]byte` | 无 |
| `ExtractBatchFiles` | `[]string` | 无 |
| `ExtractBatchWithContext` | `[][]byte` | 有 |
| `ExtractBatchFilesWithContext` | `[]string` | 有 |

四个函数都有包级与 `Processor` 实例两种形式，返回 `*BatchResult`：

```go
// 包级（内部池化 Processor，缓存禁用）
br := html.ExtractBatch(pages)

// Processor 实例（复用缓存）
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()
br = p.ExtractBatch(pages)
```

`Results[i]`、`Errors[i]` 与第 `i` 个输入一一对应：成功时 `Results[i]` 非 nil 且 `Errors[i]` 为 nil，失败或取消时 `Results[i]` 为 nil。三者恒有 `Success + Failed + Cancelled == 输入项数`。

## 基础示例

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

	br := html.ExtractBatch(pages)

	fmt.Printf("成功：%d，失败：%d，取消：%d\n", br.Success, br.Failed, br.Cancelled)
	// 输出：成功：3，失败：0，取消：0

	for i, result := range br.Results {
		if result != nil {
			fmt.Printf("[%d] 标题：%s\n", i, result.Title)
		}
	}
	// 输出：
	// [0] 标题：第一页
	// [1] 标题：第二页
	// [2] 标题：第三页
}
```

## 包级函数与 Processor 实例

| 调用方式 | 缓存 | 适用场景 |
|----------|------|----------|
| `html.ExtractBatch(pages)` | 禁用：池化 Processor 的 `MaxCacheEntries = 0`，归还时还会清空 | 一次性批量任务 |
| `p.ExtractBatch(pages)` | 启用：复用 Processor 缓存 | 高频批量、批内或跨批有重复内容 |

:::warning 包级函数不做缓存

无参调用走 `sync.Pool` 里的 Processor，其缓存配置恒为 0，每次归还还会 `ClearCache()`；传入 `Config` 时改用一次性 Processor，缓存同样被关闭。批内有重复内容时，只有自己 `html.New()` 的常驻实例才会命中缓存。机制见 [Processor 复用与缓存](./processor-cache)。

:::

```go
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()

for batch := range batchQueue {
	br := p.ExtractBatch(batch) // 同一 Processor 的缓存跨批生效
	processResult(br)
}
```

## 并发控制

`WorkerPoolSize` 是并发上限。批量方法为它建一个带缓冲通道作为信号量，每个任务先取到槽位再启动 goroutine，因此同时运行的任务数不超过 `WorkerPoolSize`，与输入项数无关。

```go
cfg := html.DefaultConfig()

n := runtime.NumCPU()
if n > 256 {
	n = 256
}
cfg.WorkerPoolSize = n

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

br := p.ExtractBatch(pages)
```

| 配置 | 默认值 | 取值范围 |
|------|--------|----------|
| `WorkerPoolSize` | 4 | 1–256（超出在 `Validate()` 阶段被拒绝） |

:::tip 按负载类型取值

纯 CPU 解析取 `runtime.NumCPU()`；`ExtractBatchFiles` 这类以文件读取为主的任务可适当调大（如 8–16）。超过 256 会在配置校验阶段报错，不会静默截断。

:::

## 单批上限 10000 项

超过 `maxBatchSize`（10000）时，整批不处理任何项，而是给每个 `Errors[i]` 填入同一个错误，`Failed` 等于输入项数：

```go
huge := make([][]byte, 10001)

br := html.ExtractBatch(huge)

fmt.Printf("失败：%d\n", br.Failed)
// 输出：失败：10001

fmt.Println(br.Errors[0])
// 输出：html: batch size exceeds maximum: 10001 exceeds maximum 10000

fmt.Println(errors.Is(br.Errors[0], html.ErrBatchTooLarge))
// 输出：true
```

:::warning 超限是整批失败，不是 panic

`maxBatchSize = 10000` 是硬上限，没有配置项可调。超限时调用正常返回，`Failed` 等于输入项数。要处理更多，按 ≤10000 分批调用；判断错误用 `errors.Is(err, html.ErrBatchTooLarge)`，不要比对字符串。

:::

## 上下文取消

`ExtractBatchWithContext` / `ExtractBatchFilesWithContext` 在三个位置检查 `ctx`：派发任务前、取得信号量后、goroutine 内实际提取前。取消后的行为：

| 项的状态 | 处理方式 |
|----------|----------|
| 已完成 | 结果保留在 `Results` 中 |
| 正在运行 | 正常跑完并记录结果 |
| 未开始 | 跳过，`Cancelled` 加一，`Errors[i] = ctx.Err()` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

br := p.ExtractBatchWithContext(ctx, pages)

fmt.Printf("成功：%d，失败：%d，取消：%d\n", br.Success, br.Failed, br.Cancelled)
```

:::tip 取消后已完成的结果仍然可用

取消只影响尚未开始的任务，已完成的 `Results[i]` 保持非 nil，可以继续使用，不必因取消丢弃整批输出。

:::

## 部分失败隔离

单项失败不打断整批。下面的例子用文件输入演示：第二个路径不存在，只影响该项，`Errors[1]` 命中 `ErrFileNotFound`，其余两项照常返回结果。

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/cybergodev/html"
)

func main() {
	dir, err := os.MkdirTemp("", "html-batch")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(dir)

	content := map[string]string{
		"a.html": `<html><body><article><h1>第一页</h1><p>正文。</p></article></body></html>`,
		"b.html": `<html><body><article><h1>第二页</h1><p>正文。</p></article></body></html>`,
	}
	for name, body := range content {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			log.Fatal(err)
		}
	}

	files := []string{
		filepath.Join(dir, "a.html"),
		filepath.Join(dir, "missing.html"), // 不存在
		filepath.Join(dir, "b.html"),
	}

	p, err := html.New()
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	br := p.ExtractBatchFiles(files)

	fmt.Printf("成功：%d，失败：%d，取消：%d\n", br.Success, br.Failed, br.Cancelled)
	// 输出：成功：2，失败：1，取消：0

	for i, result := range br.Results {
		if result == nil {
			fmt.Printf("[%d] 失败：%v（ErrFileNotFound=%v）\n",
				i, br.Errors[i], errors.Is(br.Errors[i], html.ErrFileNotFound))
			continue
		}
		fmt.Printf("[%d] 标题：%s\n", i, result.Title)
	}
	// 输出：
	// [0] 标题：第一页
	// [1] 失败：html: ReadFile "missing.html": file not found（ErrFileNotFound=true）
	// [2] 标题：第二页
}
```

:::warning 空输入不算失败

`[]byte("")` 或纯空白输入不报错：提取返回一个空 `Result`，在批量中该项计入 `Success`。输入切片为空时返回空 `BatchResult`，`Results` / `Errors` 都是空切片。整批级失败（超过 10000 项、Processor 已关闭、包级函数传入无效 `Config`）会把同一个错误填进每一项。

:::

## 分批处理

| 文档数量 | 推荐方式 | 说明 |
|----------|----------|------|
| 1–10 | 逐个 `Extract` | 批量调度开销大于并发收益 |
| 10–10000 | `ExtractBatch` | 包级函数即可，无需管理 Processor |
| 10000+ | 按 ≤10000 分批 + Processor 实例 | 超出单批上限；分片也避免一次性持有全部结果 |

```go
p, err := html.New()
if err != nil {
	log.Fatal(err)
}
defer p.Close()

const batchSize = 5000
for i := 0; i < len(allPages); i += batchSize {
	end := min(i+batchSize, len(allPages))

	br := p.ExtractBatch(allPages[i:end])
	// 处理本批结果...
}
```

## 下一步

- [Processor 复用与缓存](./processor-cache) - 包函数与实例的缓存区别
- [错误处理](./error-handling) - 哨兵错误、超时语义与批量错误
- [API 参考：批量处理](../../api-reference/modules/batch) - 完整签名与 `BatchResult` 字段
