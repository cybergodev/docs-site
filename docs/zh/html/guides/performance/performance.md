---
sidebar_label: "性能优化"
title: "性能优化 - CyberGo html | 吞吐量与调优指南"
description: "CyberGo html 性能总览：sync.Pool 复用 Processor、缓存 Key 全量哈希与 6 个开关的命中条件、批量并发与 WorkerPoolSize 调优、ProcessingTimeout 语义与错误类型、输入控制、常见反模式与基准测试方法。"
sidebar_position: 30
---

# 性能优化

提取开销取决于三件事：库内已实现的优化、配置层的取舍、输入本身的规模。本页依次说明这三层，并给出反模式与基准测试方法。

专题页：

- [Processor 复用与缓存](./processor-cache) —— 包级函数与实例的区别、`sync.Pool` 机制、缓存 Key 与命中率监控
- [批量处理实战](./batch-processing) —— 批量 API、`BatchResult` 结构、并发控制与部分失败处理

## 内部优化机制

热路径上的分配复用与对象池化决定了不同用法的性能特征。按下文描述的模式调用，这些优化才会生效。

### sync.Pool 复用 Processor

包级函数（如 `html.Extract`）通过 `sync.Pool` 复用 `Processor` 实例，避免每次调用重建编码检测器、评分器等重对象：

```text
html.Extract(data)
  → 从 sync.Pool 获取 Processor（命中池则复用，否则新建）
  → 执行提取
  → 归还到 sync.Pool（归零统计 + 清空审计日志 + 清空缓存）
```

池化 Processor 的两个设计要点：

- **禁用缓存**：池化实例的 `MaxCacheEntries`、`CacheTTL`、`CacheCleanup` 全部为 0，且每次归还都会 `ClearCache()`。池化实例若开启缓存，每次调用都要付出哈希与 map 写入开销（`Get` 始终 miss），`New` 还会启动一个清理空缓存的 goroutine——因此池化配置把这三个参数全部置零。
- **传自定义 Config 不走池化**：调用 `html.Extract(data, cfg)` 传入自定义配置时，库创建一个一次性 Processor（用完即 `Close()`），并把其中的缓存字段强制置零——一次性实例的缓存不会被再次读取。

:::tip 何时自己创建实例
循环中反复处理重复内容（爬虫去重、缓存层下游服务）时，用 `html.New()` 创建常驻 `Processor` 实例才能获得缓存命中。详见 [Processor 复用与缓存](./processor-cache)。
:::

### 缓存 Key 生成

缓存 Key 是一个 `[16]byte` 值，直接用作 `map` 键，生成 Key 不产生堆分配。Key 的输入有两部分：

- **完整原始输入字节**：用 `hash/maphash` 对全部字节做哈希。全量哈希意味着文档任意位置的字节改动都会改变 Key；同一文档以不同编码存储，字节不同，Key 也不同。
- **配置项**：6 个布尔开关（`ExtractArticle`、`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios`、`ExtractMetadata`）打包成 1 字节，随后混入三个格式串（`InlineImageFormat`、`InlineLinkFormat`、`TableFormat`）和 `Encoding`——同一份字节在不同 `Encoding` 下解码结果不同，因此必须区分。

由此得到一条对调优重要的推论：**输入字节或任一参与哈希的配置项不同，Key 就不同**。Key 的推导细节（maphash + splitmix64 拼成 128 位、有效碰撞强度约 64 位、全零 Key 视为「无 Key」）见 [Processor 复用与缓存](./processor-cache#缓存-key-生成)。

### 预分配与对象池化

提取过程中最频繁分配的对象都已池化：

| 对象 | 机制 | 作用 |
|------|------|------|
| 文本构建器 | `sync.Pool` | 保留底层 `[]byte` 容量，避免每次提取从零增长到文档长度 |
| 图片/链接结果切片 | 池化 scratch 切片 | 追加写入可复用的池化切片，最后按精确长度拷出，返回的切片不带多余容量 |
| 深度验证栈 | `sync.Pool` | 迭代式深度校验的栈复用，避免每次提取分配栈 |
| `[]byte` 临时缓冲区 | `sync.Pool` | 编码转换、文本拼接等高频小缓冲复用 |

:::warning 超大缓冲会被池丢弃
一次提取超大文档会使池长期持有超大缓冲，后续小请求都拿到它。因此超出上限的缓冲在归还时被丢弃：`[]byte` 与文本构建器为 64 KiB，结果 scratch 切片为 512 个元素，节点切片为 8192 个条目。处理超大文档的那一次不享受池化收益，属预期行为。
:::

### 预计算格式字符串

`New()` 会把 `InlineImageFormat`/`InlineLinkFormat` 做小写化与 trim（空值归一为 `"none"`）后存入 `Processor` 字段。提取的热路径直接比较预计算值，不再每次提取都做 `strings.ToLower`。

差别在单次提取上难以观察；处理的文档越多，省下的重复归一化开销随之累积。

### 媒体提取的惰性分配

视频/音频提取分三层门控。无媒体引用的页面在媒体环节只付一次字节扫描；内容超过 1,000,000 字节（约 1 MB）时连这次扫描也跳过：

1. **前置扫描门控**：先逐字节查表判断内容是否含媒体引用。不含时跳过对原始 HTML 的媒体扫描与 iframe/embed/object 属性提取，只保留 DOM 遍历。
2. **大小门控**：内容超过 1,000,000 字节时跳过原始 HTML 的媒体扫描。超限文档的媒体 URL 只来自 DOM 遍历。
3. **惰性初始化**：某一类媒体（视频或音频）出现首个匹配时，才为该类创建结果切片与去重 map，两类各自独立。

:::tip 纯文本场景的最优配置
只需正文文本、不需要图片/视频/音频信息时，用 [`TextOnlyConfig()`](../../api-reference/core/config#预设配置) 关闭全部媒体保留：`PreserveVideos`/`PreserveAudios` 为 false 时媒体提取整段不执行。
:::

## 缓存调优

缓存的基础用法与命中率监控见 [Processor 复用与缓存](./processor-cache)，Key 的计算输入见上文[缓存 Key 生成](#缓存-key-生成)。

### 命中后的克隆成本

每次缓存命中都返回 `cloneResult`（深拷贝整个 `Result`，包括 Images/Links/Videos/Audios 切片）。这一步不可省略：缓存条目会被并发读取，直接返回指针时，调用方的修改会经由别名污染缓存。

克隆开销与结果规模成正比。只有「同一输入重复出现」时，命中省下的解析与提取成本才大于克隆成本；结果很大、重复很少时，缓存只会把内存占用和克隆成本一起放大。

### 何时禁用缓存

`MaxCacheEntries = 0` 时，`Extract` 完全跳过 Key 生成：不计算哈希、不查表、不写入。

禁用缓存适合一次性处理互不相同内容的场景：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// 输入互不相同的页面：禁用缓存省去哈希计算与内存占用
	cfg := html.DefaultConfig()
	cfg.MaxCacheEntries = 0 // 零开销跳过整个缓存层
	cfg.CacheTTL = 0        // 同时禁用后台清理 goroutine
	cfg.CacheCleanup = 0

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 输入来自真实抓取流，重复极少
	result, err := p.Extract([]byte("<html><body>每个页面都不同</body></html>"))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("文本：", result.Text)
	// 输出：文本：每个页面都不同
}
```

### 格式转换不经过主缓存

`ExtractToMarkdown` / `ExtractToMarkdownFromFile` 内部创建一个禁用缓存的临时 Processor 来执行转换。该临时 Processor 复制主 Processor 的配置，只改写两个内联格式字段：

- Markdown 转换既不读也不写主 Processor 的缓存——即使此前用 `Extract` 提取过同一内容，`ExtractToMarkdown` 也不会命中；
- 多次调用 `ExtractToMarkdown` 之间也不会互相命中。

`ExtractToJSON` 走的是 `p.Extract` 再序列化，因此读写主缓存。格式转换临时 Processor 的审计事件与统计仍计入主 Processor。

:::warning 反复取 Markdown 时改用 Extract
需要对同一内容反复取 Markdown 时，用 `Extract` 并在配置中设置 `InlineImageFormat`/`InlineLinkFormat` 为 `"markdown"`——结果会进入主缓存，重复输入可命中。不必多次调用 `ExtractToMarkdown`。
:::

## 超时与 Goroutine 管理

`ProcessingTimeout` 是协作式超时，不是强制 kill。它决定在哪些点检查截止时间，以及超时返回哪一种错误。

### 协作式取消

`ProcessingTimeout > 0` 时，库从传入的 context 派生一个带截止时间的子 context，处理过程在固定检查点轮询 `ctx.Done()`：

- 提取入口
- 编码检测之前（缓存检查之后）
- 内容处理开始之前
- DOM 解析之前
- 深度校验之前
- 内容提取之前

截止时间到后，处理在下一个检查点中止并返回错误。超时不会瞬时生效：两个检查点之间的工作（例如解析一个超大文档）会先执行完，但库立即把超时错误返回给调用方，不必等这段工作结束。

### 超时 goroutine 的进程级上限

每个带超时的提取会占用一个看门 goroutine，直到提取完成或超时。库用进程级计数器 `activeTimeoutGoroutines` 把并发数限制在 1000（`maxTimeoutGoroutines`）。计数器跨所有 Processor 共享，达到上限时新的提取立即返回一个包装了 `ErrTooManyConcurrentOps` 的错误，不排队等待。

批量提取的并发由 `WorkerPoolSize`（默认 4，上限 256）限制，远低于 1000。只有应用层自行并发调用许多带超时的 `ExtractWithContext`（例如在多个 Processor 上同时跑批量）时，才可能触及这个上限。

### 区分三种超时来源

超时错误按触发源区分：库只把「派生 deadline 触发且 `ctx.Err() == nil`」的情形归一化为 `ErrProcessingTimeout`；用户 ctx 自己到期或 `cancel()` 时，`context.DeadlineExceeded` / `context.Canceled` 原样返回。用 `errors.Is` 判断时要同时检查这两类错误。四种场景的完整对照表见[错误处理](./error-handling#超时与取消)。

报 `ErrProcessingTimeout` 时，库立刻把错误返回给调用方，提取 goroutine 在下一个协作检查点退出。用户 ctx 到期时，内层检查点看到同一个 ctx 而中止——两者都在检查点退出，不是强制终止。

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 5 * time.Second // 库内超时
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 外层 context 作为兜底；这里设为 8s，比库内超时更宽松
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
	// 输出：成功，文本长度：0
}
```

## 批量处理性能调优

批量 API 的用法见 [批量处理实战](./batch-processing)。以下是影响吞吐量的调优点。

### WorkerPoolSize 的作用

`WorkerPoolSize` 用信号量（带缓冲 channel）限制并发 goroutine 数：

```text
ExtractBatch(items)
  → 为每项创建提取函数
  → 循环：先获取信号量槽位（满则阻塞）→ 再启动 goroutine
  → goroutine 完成后释放槽位
```

因此同时运行的提取数始终不超过 `WorkerPoolSize`。默认 4；纯 CPU 密集的提取可设到 `runtime.NumCPU()`（上限 256）。超出槽位数的项排队等待，并发度由槽位数决定，不随项数增长。

```go
package main

import (
	"fmt"
	"log"
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
		log.Fatal(err)
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
| 单批最大项数 | 10000 | 超限时整批失败，每项的错误都包装了 `ErrBatchTooLarge`，不部分处理 |
| 单项 panic 隔离 | — | 某项提取 panic 会被 `recover`，返回包装了 `ErrInternalPanic` 的错误，仅标记该项失败 |
| 上下文取消 | — | `ExtractBatchWithContext` 在 ctx 取消后跳过未开始项，计入 `Cancelled`，`Errors[i]` 为该 ctx 错误 |

:::tip 实例批量方法复用缓存
`p.ExtractBatch` 内部逐项调用 `p.Extract`，因此共享并写入主缓存：批量中出现重复内容时，后续项命中缓存。包级 `html.ExtractBatch` 使用禁用缓存的池化实例（或一次性实例），没有这个效果。需要在批量内去重时用实例方法。
:::

## 输入控制

减小单次提取的工作量是最直接的优化手段：

- **限制 `MaxInputSize`**：拒绝过大的文档，省去解析开销。默认 50 MB，上限也是 50 MB；多数场景可调到 5–10 MB。
- **关闭不需要的提取开关**：`PreserveImages`/`PreserveVideos`/`PreserveAudios` 关闭后，对应环节由媒体的惰性机制跳过。
- **纯文本用 `TextOnlyConfig()`**：已关闭全部媒体保留；再关闭 `ExtractArticle` 可省去文章识别评分。

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	// TextOnlyConfig 已关闭全部媒体保留，无需额外设置
	cfg := html.TextOnlyConfig()
	cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB，拒绝超大输入
	cfg.ExtractArticle = false          // 关闭文章识别，省去评分开销

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	result, err := p.Extract([]byte("<html><body><p>仅需纯文本</p></body></html>"))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text)
	// 输出：仅需纯文本
}
```

`ExtractText` 内部就是 `Extract` 后取 `result.Text`，省掉的只是调用方取字段的代码。提取路径与 `Extract` 相同，不会更快，也不会少占内存。

## 性能反模式

常见反模式与对应做法：

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| 循环里每次 `html.New()` | 每次创建 + 销毁 Processor，重建编码检测器、评分器等 | 循环外创建一个实例，循环内复用 |
| 包级函数期望缓存命中 | 池化实例禁用缓存，`Get` 始终 miss | 用 `Processor` 实例 |
| 内容互不相同却开大缓存 | 命中率低，缓存条目只占内存并带来哈希开销 | `MaxCacheEntries = 0` 禁用缓存 |
| `ExtractToMarkdown` 期望命中主缓存 | 格式转换用禁用缓存的临时 Processor | 配置 `InlineImageFormat="markdown"` 后用 `Extract` |
| 超大 HTML 不设超时 | 畸形输入可长时间占用 CPU | 设 `ProcessingTimeout` 或用 `ExtractWithContext` |
| 批量项数远超 `WorkerPoolSize` 却期望线性加速 | 信号量把实际并发限制在槽位数，项数增加只延长排队 | 按 CPU 核数设 `WorkerPoolSize`，分批提交 |

## 基准测试

用 Go benchmark 量化配置变更和缓存命中的效果，是调优的判断依据。

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

    b.ReportAllocs() // 观察每次提取的堆分配数
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

对比「相同内容重复提取」与「每次不同内容」，可以判断缓存是否带来收益：

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

用 `b.Run` 子测试在一份基准里对比多种配置：

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
- `B/op` 与 `allocs/op`：每次提取的堆分配字节与次数，用来判断池化是否生效；命中路径跳过解析与提取，两项指标通常显著低于完整提取（仍包含 `cloneResult` 的拷贝分配）；
- 对比命中场景与 `NoCache`：两者接近说明命中省下的解析成本没有超过克隆成本，缓存没有收益，应禁用。
:::

运行基准：

```bash
go test -bench=. -benchmem ./...             # 运行全部 benchmark，报告内存分配
go test -bench=Extract -benchmem -count=5 ./... # 只跑提取基准，重复 5 次以观察波动
```

## 下一步

- [Processor 复用与缓存](./processor-cache) —— `sync.Pool` 机制与缓存命中率监控
- [批量处理实战](./batch-processing) —— 批量 API 用法与并发控制
- [配置参考](../../api-reference/core/config) —— 所有 `Config` 字段与取值约束
- [安全生产检查清单](../security/production-checklist) —— 性能之外的上线要点
