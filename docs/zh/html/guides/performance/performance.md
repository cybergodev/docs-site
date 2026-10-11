---
sidebar_label: "性能优化"
title: "性能优化 - CyberGo html | 吞吐量提升指南"
description: "CyberGo html 性能优化总览：解析 sync.Pool 复用、缓存 Key 生成与命中率监控、批量并发控制、WorkerPoolSize 并发与 ProcessingTimeout 超时设置等内部机制，归纳输入控制、常见反模式与规避做法，并附基准测试建议，系统提升 HTML 处理吞吐量。"
sidebar_position: 3
---

# 性能优化

本页是 html 库的性能调优总览：先讲库**内部已实现的优化机制**（帮你理解性能特征），再给出**配置层调优**、**反模式规避**和**基准测试方法**。

若你需要某一主题的完整细节，参见同分组的专题页：

- [Processor 复用与缓存](./processor-cache) —— 包级函数 vs 实例、`sync.Pool` 机制、缓存策略与命中率监控
- [批量处理实战](./batch-processing) —— 四个批量 API、`BatchResult` 结构、并发控制与部分失败处理

## 内部优化机制

html 库在热路径上做了大量零分配与复用优化，理解这些机制能帮助你预判不同用法的性能特征，避免与库的优化「打架」。

### sync.Pool 复用 Processor

包级函数（如 `html.Extract`）通过 `sync.Pool` 复用 `Processor` 实例，避免每次调用重建编码检测器、评分器等重对象：

```text
html.Extract(data)
  → 从 sync.Pool 获取 Processor（命中池则复用，否则新建）
  → 执行提取
  → 归还到 sync.Pool（归零统计 + 清空审计日志 + 清空缓存）
```

池化 Processor 有两个关键设计：

- **禁用缓存**：池化实例的 `MaxCacheEntries`、`CacheTTL`、`CacheCleanup` 全部置零。因为池化实例每次归还都会 `ClearCache()`，开启缓存只会白白付出哈希计算和后台清理 goroutine 的代价（`Get` 永远 miss），却永远无法命中。
- **传自定义 Config 不走池化**：当你调用 `html.Extract(data, cfg)` 传入自定义配置时，库会创建一个**临时 Processor**（用完即 `Close()`），而非复用池中实例——因为池中实例固定使用默认配置。

:::tip 何时该自己创建实例
池化实例禁用了缓存。如果你在循环里反复处理**可能重复**的内容（爬虫去重、缓存层下游的服务），用 `html.New()` 创建一个常驻 `Processor` 实例才能享受缓存命中。详见 [Processor 复用与缓存](./processor-cache)。
:::

### 缓存 Key 生成策略

缓存 Key 是一个 `[16]byte`（128 位）值，直接用作 `map` 键，**生成 Key 不产生堆分配**。Key 的计算输入包括：

- **原始输入字节**（而非编码转换后的 UTF-8 文本）——缓存命中可跳过整个编码检测步骤；同一文档以不同编码存储会得到不同的 Key，无法互相命中；
- 内容提取开关（`ExtractArticle`、`PreserveImages` 等 5 个布尔位）打包进一个 `uint8`；
- 格式选项（`InlineImageFormat`、`InlineLinkFormat`、`TableFormat`）；
- `Encoding` 强制编码设置——同一份字节在不同 `Encoding` 配置下解码结果不同，必须区分。

针对不同大小的内容，Key 生成采用两种策略：

| 内容大小 | 策略 | 说明 |
|----------|------|------|
| ≤ 64 KB | 完整内容哈希 | 对全部字节做 hash/maphash 计算（AES-NI 加速），64 位结果经 splitmix64 扩展为 128 位 |
| > 64 KB | 5 点采样 | 头部 + 尾部 + 3 个均匀分布的采样点，总采样预算 4096 字节（每点约 819 字节） |

大文档采样是为了限制哈希成本——对 10 MB 文档做完整哈希会抵消缓存带来的收益。5 点采样兼顾了**抗哈希洪泛**（文档任意位置的修改都大概率改变 Key）与**吞吐量**。

### 预分配与对象池化

提取过程中最频繁分配的对象都已被池化或预分配：

| 对象 | 机制 | 作用 |
|------|------|------|
| 池化文本构建器（内部实现） | `sync.Pool` | 跨调用复用底层 `[]byte` 容量，避免每次提取从零增长到文档长度 |
| 链接结果切片 | 预分配容量 128 | 覆盖典型页面的链接数量，避免 `append` 触发底层数组拷贝 |
| 深度验证栈（`depthStackEntry`） | `sync.Pool` | 迭代式深度校验的栈复用，避免每次提取分配栈 |
| `[]byte` 临时缓冲区 | `sync.Pool` | 编码转换、文本拼接等高频小缓冲复用 |

:::warning 超大缓冲会被池丢弃
为防止「一次提取超大文档 → 池永久持有超大缓冲 → 后续小请求都拿到大缓冲」的经典 `sync.Pool` 陷阱，容量超过 64 KiB 的缓冲在归还时会被**丢弃**而非放回池中。这意味着处理超大文档不会获得池化收益，属正常现象。
:::

### 预计算格式字符串

`New()` 时会把 `InlineImageFormat`/`InlineLinkFormat` 经 `normalizeInlineFormat`（小写化 + trim + 空值归一为 `"none"`）预计算后存入 `Processor` 字段。提取的热路径直接比较预计算值，**避免每次提取都做 `strings.ToLower`**。

这个优化对单次提取影响微小，但在批量处理上万文档时累积可观。

### 媒体提取的惰性分配

视频/音频提取采用两级门控，让「无媒体内容」的常见场景几乎零开销：

1. **前置正则门控**：先用内部媒体引用检测（regex 门控）快速扫描，确认内容**不包含**任何媒体引用时，直接跳过所有正则扫描与 iframe/embed/object 属性提取。
2. **大小门控**：内容超过 1 MB（`maxHTMLForRegex`）时跳过正则扫描——超大文档上跑正则既慢又有 ReDoS 风险。
3. **惰性初始化**：`ensureDedup` 在首个媒体匹配出现时才分配结果切片和去重 map。无媒体的文档全程零分配。

:::tip 纯文本场景的最优配置
若你只关心正文文本、不需要图片/视频/音频信息，用 [`TextOnlyConfig()`](../../api-reference/core/config#预设配置) 一步关闭所有媒体保留，配合这里描述的惰性机制，媒体相关开销趋近于零。
:::

## 缓存深度调优

[Processor 复用与缓存](./processor-cache) 介绍了缓存基础用法与命中率监控。这里补充几个影响缓存行为的关键细节。

### 命中条件

两个输入产生**相同缓存 Key** 才会命中，这意味着：

- 相同内容 + 相同配置 → 命中；
- 同一正文以不同编码存储（如一份 GBK、一份 UTF-8）→ **不命中**（Key 基于原始输入字节计算，不同编码的字节序列不同）；
- 相同字节但 `Encoding` 配置不同 → **不命中**（`Encoding` 参与 Key 计算）；
- 相同内容但 `PreserveImages` 等开关不同 → **不命中**（开关位参与 Key 计算）。

### 命中后的克隆成本

每次缓存命中都返回 `cloneResult`（深拷贝整个 `Result`，包括 Images/Links/Videos/Audios 切片）。这是**必须的**——缓存中的条目会被并发读取，若直接返回指针，调用方修改结果会通过别名污染缓存。

代价是：当 `Result` 包含大量链接/图片时，克隆本身有一定开销。在「缓存命中率极高 + 单次结果很大」的场景（如反复提取同一个链接密集的大文档），这部分成本可能显现。

### 何时禁用缓存

`MaxCacheEntries = 0` 时，`Extract` 会**完全跳过 Key 生成**（不计算哈希、不查表、不写入），是真正的零开销，而非「开了缓存但永远 miss」。

禁用缓存适合**一次性处理大量不同内容**的场景：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	// 爬虫处理海量互不相同的页面：禁用缓存省去哈希计算与内存占用
	cfg := html.DefaultConfig()
	cfg.MaxCacheEntries = 0 // 零开销跳过整个缓存层
	cfg.CacheTTL = 0        // 同时禁用后台清理 goroutine
	cfg.CacheCleanup = 0

	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// eachPage 来自真实抓取流，几乎不会重复
	result, err := p.Extract([]byte("<html><body>每个页面都不同</body></html>"))
	if err != nil {
		panic(err)
	}
	fmt.Println("文本长度：", len(result.Text))
	// 输出：文本长度：...
}
```

### 格式转换不走主缓存

`ExtractToMarkdown` / `ExtractToMarkdownFromFile` 内部通过 `buildFormatProcessor` 创建一个**禁用缓存的临时 Processor** 来执行格式转换。这意味着：

- Markdown 转换**不读取**也**不写入**主 Processor 的缓存——即使你之前用 `Extract` 提取过同一内容，`ExtractToMarkdown` 也不会命中；
- 同一内容多次调用 `ExtractToMarkdown` 也不会互相命中。

:::warning 别期待格式转换命中缓存
如果你需要对同一内容反复取 Markdown，与其多次调用 `ExtractToMarkdown`，不如调用一次 `Extract`（配置 `InlineImageFormat`/`InlineLinkFormat` 为 `"markdown"`）——这样结果会进主缓存，重复输入可命中。
:::

## 超时与 Goroutine 管理

`ProcessingTimeout` 是协作式超时，不是强制 kill。理解它的协作点与错误语义，有助于正确处理超时与用户取消。

### 协作式取消机制

`ProcessingTimeout > 0` 时，库从传入的 context 派生一个带截止时间的子 context，处理函数在**关键检查点**轮询 `ctx.Done()`：

- 编码检测前
- DOM 解析前
- 深度验证前
- 内容提取前

如果截止时间已到，处理会在**下一个检查点**中止并返回错误。这意味着超时不是瞬时生效的——两个检查点之间的工作（如解析一个超大文档）会跑完。

### 超时 goroutine 的全局上限

每个带超时的提取会占用一个 goroutine 直到完成或超时。为防止 goroutine 泄漏耗尽资源，库设置了全局上限 `maxTimeoutGoroutines = 1000`。当并发超时操作数达到上限时，新的提取会**立即**返回 `ErrProcessingTimeout`（而非排队等待）。

:::warning 批量场景的并发上限
批量提取（`ExtractBatch`）的并发受 `WorkerPoolSize`（默认 4，上限 256）限制，通常远低于 1000 的 goroutine 上限。但若你在应用层自行并发调用大量带超时的 `ExtractWithContext`，需留意这个全局上限——它是进程级的，跨所有 Processor 共享。
:::

### 区分三种取消来源

应用层处理超时/取消时，应根据错误类型区分来源：

| 触发条件 | 返回错误 | 含义 |
|----------|----------|------|
| 库内 `ProcessingTimeout` 到期 | `ErrProcessingTimeout` | 单文档处理超过配置的超时 |
| 用户 context 的 deadline 到期 | `context.DeadlineExceeded` | 外层 context 超时（被库原样透传） |
| 用户手动取消 context | `context.Canceled` | 外层主动取消（被库原样透传） |

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 5 * time.Second // 库内超时
	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	// 外层 context 再加一道保险（可短于库内超时）
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	result, err := p.ExtractWithContext(ctx, []byte("<html></html>"))
	switch {
	case errors.Is(err, html.ErrProcessingTimeout):
		fmt.Println("库内处理超时：考虑调大 ProcessingTimeout 或减小输入")
	case errors.Is(err, context.DeadlineExceeded):
		fmt.Println("外层 context 超时")
	case errors.Is(err, context.Canceled):
		fmt.Println("调用方主动取消")
	case err != nil:
		fmt.Println("其他错误：", err)
	default:
		fmt.Println("成功，文本长度：", len(result.Text))
	}
	// 输出：成功，文本长度：...
}
```

## 批量处理性能调优

[批量处理实战](./batch-processing) 详细介绍了批量 API 的用法。这里聚焦影响吞吐量的几个调优点。

### WorkerPoolSize 的作用

`WorkerPoolSize` 通过 **semaphore**（带缓冲 channel）限制并发 goroutine 数，而非无限制 spawn：

```text
ExtractBatch(items)
  → 为每项创建 extractor
  → 循环：先获取 semaphore 槽位（满则阻塞）→ 再 spawn goroutine
  → goroutine 完成后释放槽位
```

因此无论批量多大，**同时在运行的提取数**始终不超过 `WorkerPoolSize`。默认值 4 适合 I/O 混合场景；纯 CPU 密集的提取可设到接近 `runtime.NumCPU()`（上限 256）。

```go
package main

import (
	"fmt"
	"runtime"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	// WorkerPoolSize 上限为 256，高核数机器需封顶
	n := runtime.NumCPU()
	if n > 256 {
		n = 256
	}
	cfg.WorkerPoolSize = n
	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	pages := [][]byte{
		[]byte("<html><body>页面 A</body></html>"),
		[]byte("<html><body>页面 B</body></html>"),
	}
	br := p.ExtractBatch(pages)
	fmt.Printf("成功 %d，失败 %d\n", br.Success, br.Failed)
	// 输出：成功 2，失败 0
}
```

### 批量上限与容错

| 约束 | 值 | 行为 |
|------|----|------|
| 单批最大项数 | 10000 | 超限时**整批失败**（每项都返回错误），不部分处理 |
| 单项 panic 隔离 | — | 某项提取 panic 会被 `recover`，仅标记该项失败，不影响其他项 |

:::tip 实例批量方法复用缓存
`Processor` 实例的批量方法（`p.ExtractBatch`）内部调用 `p.Extract`，因此**共享并写入主缓存**——批量处理中若出现重复内容，后续命中缓存。包级 `html.ExtractBatch` 用的是禁用缓存的池化实例，无此效果。需要批量去重加速时，优先用实例方法。
:::

## 输入控制

减小提取的工作量是最直接的优化手段：

- **限制 `MaxInputSize`**：拒绝过大的文档，避免无谓的解析开销。默认 50 MB，多数场景可调小到 5–10 MB。
- **关闭不需要的提取开关**：`PreserveImages`/`PreserveVideos`/`PreserveAudios` 等关闭后，配合媒体惰性机制可跳过相应开销。
- **纯文本用 `TextOnlyConfig()`**：已禁用所有媒体保留，再关闭 `ExtractArticle` 可进一步提升纯文本提取速度。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	// TextOnlyConfig 已禁用所有媒体保留，无需额外设置
	cfg := html.TextOnlyConfig()
	cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB，拒绝超大输入
	cfg.ExtractArticle = false          // 关闭文章识别，纯文本提取更快

	p, err := html.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	result, err := p.Extract([]byte("<html><body><p>仅需纯文本</p></body></html>"))
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Text)
	// 输出：仅需纯文本
}
```

## 性能反模式

以下是常见但会拖累性能的用法，对照表帮你快速避坑：

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| 循环里每次 `html.New()` | 每次创建+销毁 Processor，重建编码检测器、评分器等 | 循环外创建一个实例，循环内复用 |
| 包级函数期望缓存命中 | 池化 Processor 禁用缓存，永远 miss | 用 `Processor` 实例 |
| 大量不同内容却开大缓存 | 缓存膨胀、命中率极低，徒增内存与哈希开销 | `MaxCacheEntries = 0` 禁用缓存 |
| `ExtractToMarkdown` 期望命中主缓存 | 格式转换用禁用缓存的临时 Processor | 配置 `InlineImageFormat="markdown"` 后用 `Extract` |
| 超大 HTML 不设超时 | 恶意/畸形输入可能长时间占用资源 | 设 `ProcessingTimeout` 或用 `ExtractWithContext` |
| 批量项数远超 `WorkerPoolSize` 却期望线性加速 | semaphore 限制实际并发，项数再多也不加速 | 按 CPU 核数调 `WorkerPoolSize`，分批提交 |

## 基准测试建议

用 Go benchmark 量化配置变更和缓存命中的效果，是性能调优最可靠的依据。

### 基础提取基准

<!-- check-code: skip -->
```go
package html_test

import (
    "os"
    "testing"

    "github.com/cybergodev/html"
)

// 准备一份有代表性的真实 HTML（不要用极小的合成片段）
var benchDoc, _ = os.ReadFile("testdata/sample.html")

// BenchmarkExtract 测量单次提取的基线性能（含编码检测、解析、评分、提取）
func BenchmarkExtract(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()

    b.ReportAllocs() // 关键：观察每次提取的堆分配数
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := p.Extract(benchDoc)
        if err != nil {
            b.Fatal(err)
        }
    }
}
```

### 测量缓存命中的收益

对比「相同内容重复提取」与「每次不同内容」，能看出缓存是否真的在帮你：

<!-- check-code: skip -->
```go
// BenchmarkExtractCacheHit 反复提取同一内容，第二次起应命中缓存
func BenchmarkExtractCacheHit(b *testing.B) {
    p, _ := html.New(html.DefaultConfig())
    defer p.Close()
    p.Extract(benchDoc) // 预热缓存

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = p.Extract(benchDoc)
    }
}

// BenchmarkExtractNoCache 禁用缓存作为对照组
func BenchmarkExtractNoCache(b *testing.B) {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 0
    p, _ := html.New(cfg)
    defer p.Close()

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = p.Extract(benchDoc)
    }
}
```

### 对比不同配置

用 `b.Run` 子测试在一份基准里对比多种配置，便于横向比较：

<!-- check-code: skip -->
```go
func BenchmarkConfigs(b *testing.B) {
    cases := []struct {
        name string
        cfg  func() html.Config
    }{
        {"Default", html.DefaultConfig},
        {"TextOnly", html.TextOnlyConfig},
        {"NoCache", func() html.Config {
            c := html.DefaultConfig()
            c.MaxCacheEntries = 0
            return c
        }},
    }
    for _, tc := range cases {
        b.Run(tc.name, func(b *testing.B) {
            p, _ := html.New(tc.cfg())
            defer p.Close()
            b.ReportAllocs()
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                _, _ = p.Extract(benchDoc)
            }
        })
    }
}
```

:::tip 解读 benchmark 结果
- `ns/op`：单次提取耗时，越小越快；
- `B/op` 和 `allocs/op`：每次提取的堆分配字节与次数，是判断「池化是否生效」「缓存是否命中」的核心指标——缓存命中时 `allocs/op` 会显著下降；
- 对比缓存命中场景（默认配置预热后 `stats.CacheHits` > 0，注意统计字段为复数 `CacheHits`）与 `NoCache`：若两者接近，说明你的内容**没有重复**，缓存纯属负担，应禁用。
:::

运行基准：

```bash
go test -bench=. -benchmem ./...          # 运行所有 benchmark，报告内存分配
go test -bench=BenchmarkExtract -count=5  # 多次运行以观察波动
```

## 下一步

- [Processor 复用与缓存](./processor-cache) —— 深入 `sync.Pool` 机制与缓存命中率监控
- [批量处理实战](./batch-processing) —— 批量 API 的完整用法与并发控制
- [配置参考](../../api-reference/core/config) —— 所有 `Config` 字段与取值约束
- [安全生产检查清单](../security/production-checklist) —— 性能之外的生产就绪要点
