---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo html | 高频问题解答"
description: "CyberGo html 常见问题高频解答：包函数与 Processor 如何选择、15+ 编码自动检测原理、输入大小限制与 DOM 深度防护、空文本结果排查、GetStatistics 统计监控启用、审计日志配置与缓存命中率优化等典型疑问的解决方案。"
sidebar_position: 1
---

# 常见问题

## 包函数和 Processor 有什么区别？

**包函数**（如 `html.Extract`）内部使用 `sync.Pool` 复用 Processor，适合低频、一次性调用。每次调用后 Processor 归还到池中。

**Processor**（如 `p := html.New()`）适合高频调用，复用缓存和内部资源。还支持统计收集和审计日志。

```go
// 低频：包函数
result, _ := html.Extract(data)

// 高频：Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## 如何处理编码问题？

HTML 库自动检测 15+ 种编码（UTF-8、GBK、Shift_JIS、Windows-1252 等），通常不需要手动指定。

如需强制指定编码：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## 输入大小限制是多少？

默认最大 50MB（`DefaultMaxInputSize = 52428800`）。可通过配置调整：

```go
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB
```

## 如何获取 Markdown 格式的输出？

```go
md, err := html.ExtractToMarkdown(data)
```

或使用 Processor：

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## 批量处理最多支持多少条？

单次批量最多 10000 个项目。更大的数据集请分批处理。

## 为什么提取的文本为空？

可能的原因：

1. **HTML 结构问题** - 内容在 `<script>` 或 `<style>` 标签中
2. **清洗后内容为空** - 若正文仅存在于被清洗移除的标签（如 `<iframe>`、`<object>`）中，结果可能为空；可对可信输入临时设置 `EnableSanitization = false` 排查
3. **输入为空** - 检查输入字节数组是否为空（空白内容会返回空 `Result`）
4. **文章识别** - 尝试关闭 `ExtractArticle` 看是否能提取

:::tip 注意区分错误与空结果
DOM 嵌套超过 `MaxDepth` 不会产生空文本，而是返回 `ErrMaxDepthExceeded` 错误。若调用返回了 `error`，请优先用 `errors.Is` 判断错误类型，而非检查文本是否为空。
:::

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // 关闭文章识别
```

## 如何监控处理统计？

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// 处理一些内容后
stats := p.GetStatistics()
fmt.Printf("已处理：%d\n", stats.TotalProcessed)
fmt.Printf("缓存命中：%d\n", stats.CacheHits)
fmt.Printf("平均耗时: %v\n", stats.AverageProcessTime)
fmt.Printf("错误数：%d\n", stats.ErrorCount)
```

## 如何启用审计？

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

详见 [审计系统](../api-reference/modules/audit)。

## 文件路径安全吗？

`FileError` 会自动截断完整路径，防止在错误消息中泄露服务器路径：

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // 仅文件名，非完整路径
}
```

## 如何实现自定义内容评分？

实现 `Scorer` 接口：

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // 自定义评分逻辑
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // 自定义移除逻辑
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

详见 [接口定义](../api-reference/types/interfaces)。

## 自定义 Scorer 是否需要并发安全？

需要。当单个 Processor 被多个并发 `Extract` 调用共享时，`Score`/`ShouldRemove` 会从多个 goroutine 同时触发。自定义 Scorer 若持有可变状态（缓存、计数器），必须自行加锁同步。库内置的默认评分器（内部实现，不导出）只读、天然并发安全。

:::warning 无状态优先
推荐将自定义 Scorer 设计为无状态（仅依据传入的 `ContentNode` 计算），既避免锁开销，也从根本上消除并发问题。需要聚合统计时，把结果写回 `Processor` 的统计通道而非 Scorer 自身。
:::

## 缓存 Key 是如何生成的？

缓存 Key 基于**原始输入字节**（而非编码转换后的 UTF-8 文本）生成，并混入处理器配置（`ExtractArticle`/`Preserve*` 等提取开关、`InlineImageFormat`/`InlineLinkFormat`/`TableFormat` 三个格式串以及 `Encoding` 强制编码设置）。算法为 hash/maphash（AES-NI 加速、进程级随机种子），64 位哈希结果经 splitmix64 扩展为 128 位（16 字节）Key：

- 小于等于 64KB（`maxCacheKeySize`）：对完整内容计算
- 大于 64KB：使用 5 点采样（头部、尾部、3 个均匀分布点），总采样预算 4096 字节（`cacheKeySample`，每点约 819 字节），并额外混入内容总长度以增强唯一性
- Key 基于原始字节计算——同一文档以不同编码存储（GBK、Shift_JIS、Windows-1252……）字节序列不同，生成**不同** Key

:::tip 为什么基于原始字节
Key 在编码检测**之前**直接对原始字节计算，缓存命中时可以完全跳过编码检测扫描（重复提取热路径上最贵的步骤之一）。代价是：同一文档以不同编码存储会得到不同 Key，无法互相命中。`Encoding` 参与计算则是因为同一份字节在不同强制编码下解码结果不同，必须区分，否则会错误共享缓存。
:::

## 为什么 ExtractAllLinks 和 Extract 的结果不同？

两者面向不同用途，处理路径与返回类型都不同：

- `Extract` 会先应用 HTML 清洗（移除 `<script>`、`<iframe>` 等标签），再从清洗后的 DOM 提取链接，结果在 `Result.Links` 中，类型为 `LinkInfo`（带 `Position`、`IsExternal` 等字段）
- `ExtractAllLinks` **不应用清洗**，枚举所有资源链接（包括 `<script src>`、`<iframe>`、`<link>`、`<embed>`），返回 `[]LinkResource`（带 `Type` 分类，如脚本、样式、媒体）

简言之：`Extract` 给你「正文里的链接」，`ExtractAllLinks` 给你「页面引用的全部资源」。

## 包级函数传入 Config 后还走池化吗？

不走。`resolveConfig` 的逻辑是：

- 无 Config → 用 `DefaultConfig()`，**走 `sync.Pool` 池化**
- 1 个 Config → 用该 Config，**创建临时 Processor（不复用池）**

因此 `html.Extract(data, cfg)` 每次都会新建并销毁一个 Processor。高频调用自定义配置时，应自行 `html.New(cfg)` 并复用 Processor 以获得缓存与统计收益。

## 内部 panic 会有什么影响？

所有提取操作都被 `recoverPanic` 包装，panic 不会逃逸到调用方，而是被恢复为 `ErrInternalPanic` 错误。隔离粒度如下：

- 单次提取：panic → `ErrInternalPanic`
- 批量处理：单项 panic 被独立 recover，只影响该项（记入 `Failed`），不影响其他项
- 审计子系统：`AuditSink` 的 `Write`/`Close` panic 被隔离（审计是 best-effort，参见 SEC-003），不会中断主提取流程
- 超时 goroutine：其内部 panic 也被独立 recover

:::warning 看到 ErrInternalPanic 怎么办
`ErrInternalPanic` 表示输入可能触发了库内部 bug。应记录原始输入（或最小复现样本）并上报，而不是简单重试——同一输入很可能再次触发。
:::

## 如何禁用缓存以节省内存？

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // 禁用缓存，跳过 Key 生成（零开销）
```

禁用后每次提取都完整处理，但避免了缓存条目带来的内存开销。适合处理大量互不相同内容的场景（如一次性抓取海量不同页面）。

:::tip 池化 Processor 已默认禁用缓存
包级函数（如 `html.Extract`）使用的池化 Processor 配置 `MaxCacheEntries = 0`、`CacheTTL = 0`——因为每次归还池时都会清空缓存，开启缓存反而徒增哈希与 map 操作开销。需要缓存请显式 `html.New(cfg)`。
:::

## ProcessingTimeout 和用户 context 超时有什么区别？

库内超时与调用方 context 协同工作，错误类型取决于触发源与配置：

| 场景 | 错误类型 | 触发方 |
|------|----------|--------|
| 配置了 `ProcessingTimeout` 且先到期 | `ErrProcessingTimeout` | 库内超时 |
| 用户 context 先于 `ProcessingTimeout` 到期 | `ErrProcessingTimeout`（被归一化） | 调用方超时 |
| 未配置 `ProcessingTimeout`，用户 context 到期 | `context.DeadlineExceeded` | 调用方超时 |
| 用户 `cancel()` | `context.Canceled` | 手动取消 |

机制：当 `ProcessingTimeout > 0` 时，库用 `context.WithTimeout(parentCtx, ProcessingTimeout)` 派生新 deadline，取**两者中较早者**；无论哪个到期，都统一报 `ErrProcessingTimeout`。只有手动 `cancel()` 产生的 `context.Canceled` 原样返回。未配置 `ProcessingTimeout` 时，用户 context 的错误直接透传。

## ExtractToMarkdown 是否使用缓存？

不使用。`ExtractToMarkdown` 内部通过 `buildFormatProcessor` 创建临时 Processor，该 Processor 显式禁用缓存（`MaxCacheEntries = 0`，内部以零容量缓存构造，不导出），既不读取也不写入主 Processor 的缓存。

:::tip 为何如此设计
Markdown 格式转换只是输出形式不同，提取本身的结果不应污染主缓存（否则同一内容会因格式不同缓存多份）。临时 Processor 复用主 Processor 的 `Scorer`，仅覆盖 `InlineImageFormat`/`InlineLinkFormat`，配置通过值拷贝隔离，避免并发修改共享状态。
:::

## 为什么 `<form>` 标签没有被清洗移除？

许多服务端框架（ASP.NET WebForms、JSF、JSP）将整个页面 `<body>` 包在单个 `<form>` 中。移除 `<form>` 会丢弃几乎所有可见内容。文本提取既不渲染也不提交表单，因此移除 `<form>` 的 CSRF/UI-redress 理由**不适用于容器本身**。但 `<input>` 和 `<button>` 等表单控件仍会被移除。

## data URL 有什么限制？

清洗器对 `data:` URL 执行多重校验：

- 仅允许白名单 MIME 类型：图片（gif/jpeg/png/webp/bmp/avif 等）、字体（woff/woff2/ttf/otf）、PDF
- **阻止 `image/svg+xml`**（SVG 可内嵌 JavaScript）
- 阻止空媒体类型（如 `data:;base64,...`）
- 有大小上限：受内部上限约束（100KB），不可通过配置调整
- base64 编码部分验证字符合法性

被拦截的 URL 会记录审计事件——配置的 `AuditSink` 会收到 `AuditEventBlockedURL` 类型的 `AuditEntry`，其 `Message` 携带拦截原因（如 `malformed data URL`、`unsafe media type in data URL`）。

## 批量处理超过 10000 项会怎样？

整批失败（不会部分处理）。`maxBatchSize` 上限为 10000，超限时每项的 `Errors` 都填充 `html: batch size N exceeds maximum 10000`，`Failed` 计数等于输入数量，`Results` 全为 `nil`。

<!-- check-code: skip -->
```go
// 超限返回的 BatchResult：Failed == len(inputs)，无部分成功
br := html.ExtractBatch(hugeSlice) // len(hugeSlice) > 10000
fmt.Println(br.Failed)             // == len(hugeSlice)
```

需要调用方自行分批（如每批 5000 项）处理更大数据集。

## 关闭 Processor 后继续调用会怎样？

返回 `ErrProcessorClosed`。Processor 内部用 `atomic.Bool` 标记关闭状态，所有提取/格式化方法入口都会检查它。行为要点：

- `Close()` 幂等，多次调用安全
- 池化 Processor 在被关闭后**不会归还到池中**（避免下次 `Get` 拿到一个已关闭、缓存清理协程已停止的实例），而是直接丢弃，由 `sync.Pool` 在下次 `Get` 时重建
- 批量方法在关闭的 Processor 上调用，返回的 `BatchResult` 中每项错误均为 `ErrProcessorClosed`

## 文章智能识别（ExtractArticle）的评分算法是怎样的？

内置默认评分器（内部实现，不导出）基于多维信号计算每个元素节点的内容相关性分数，选取得分最高的节点作为文章容器。评分维度包括：

| 维度 | 正面信号 | 负面信号 |
|------|----------|----------|
| 标签语义 | `<article>`(+1000)、`<main>`(+900)、`<section>`(+300) | `nav`/`aside`/`footer`/`header` 直接返回 0 |
| class/id 模式 | `content`/`article`/`post`/`main`/`entry` 等（强正面）；`blog`/`news`/`detail` 等（中等正面） | `comment`/`sidebar`/`nav`/`ad`/`menu` 等（强负面）；`widget`/`share`/`social` 等（中等负面） |
| 段落密度 | 子树中 `<p>` 数量 × 倍率加分 | — |
| 文本长度 | 超过阈值的长文本加分；低于阈值的短文本扣分 | — |
| 链接密度 | — | 文本短且链接密集时施加惩罚（可能是导航栏） |
| 标点特征 | 逗号密集（`,` 或 `，`）暗示散文体，加分 | — |
| 内容密度 | 文本/标签比高时乘以放大系数 | 比例低时乘以衰减系数 |
| ARIA role | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |

:::tip 布局包装器的特殊处理
当 class/id 同时含内容信号（`content`/`article`）和移除信号（如 `sidebar`）时——典型如 CSS 布局类 `content-sidebar`——评分器**不会**移除该节点，因为它包裹着主内容。语义标签 `<article>`/`<main>` 一律豁免 class/id 移除启发式。
:::

如果默认评分器不适合你的目标网站，可实现自定义 `Scorer` 接口替换。详见 [测试与自定义扩展](../guides/integration/testing-custom)。

## TableFormat 如何影响表格输出？

`TableFormat` 控制提取的纯文本/Markdown 中 HTML `<table>` 的渲染方式：

| 格式值 | 效果 | 适用场景 |
|--------|------|----------|
| `"markdown"`（默认） | 渲染为 Markdown 表格（含表头分隔行），`colspan` 展开为重复单元格，仅含宽度定义的结构行被跳过 | 人类阅读、Markdown 消费 |
| `"html"` | 保留原始 HTML `<table>` 标签（`colspan`/`rowspan` 原样保留），结构行不跳过 | 需要精确表格结构的下游处理 |

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "html" // 保留 HTML 表格
```

格式字符串大小写不敏感（`"Markdown"` 与 `"markdown"` 等效），空值回退到 `"markdown"`。

## AllowedBaseDir 在不同平台上行为一致吗？

是的，核心安全语义跨平台一致，但底层路径解析机制不同：

| 平台 | 解析方式 | 覆盖的重定向 |
|------|----------|-------------|
| Linux | 读 `/proc/self/fd/<fd>` 的 link | 符号链接（race-free） |
| macOS / BSD | 读 `/dev/fd/<fd>` 的 link | 符号链接（race-free） |
| 其他 Unix | 回退 `filepath.EvalSymlinks` | 符号链接（残留轻微 TOCTOU） |
| Windows | `GetFinalPathNameByHandleW` | 符号链接 + junction + 所有 reparse points |

关键设计：库从**已打开的 OS 文件句柄**解析真实路径（而非路径字符串），关闭了 TOCTOU 竞态窗口——校验与读取使用同一个文件句柄，路径在两者之间被替换不会影响结果。Windows 上的 junction/reparse points 无需任何特权即可创建，`filepath.EvalSymlinks` 无法解析它们，因此库专门使用 `GetFinalPathNameByHandleW`。

## 缓存命中时返回的是原始对象吗？

不是。缓存命中时返回 `cloneResult` 产生的**深拷贝**——对 `Images`/`Links`/`Videos`/`Audios` 切片都做了 `copy`。这是必须的：缓存中的条目会被多个 goroutine 并发读取，直接返回指针会导致调用方修改结果时通过别名污染缓存。

未命中路径同样先写入缓存再返回一份克隆，因此缓存条目与返回值互不别名。

## 为什么同一个视频 URL 同时出现在 Videos 和 Audios 中？

`.ogg` 是一种容器格式，可承载视频（Theora 编码）或音频（Vorbis/Opus 编码）。正则兜底扫描时，`.ogg` URL 同时匹配视频和音频扩展名列表，因此会分别出现在 `Result.Videos` 和 `Result.Audios` 中。仅音频变体 `.oga` 只出现在音频列表中。

## ProcessingTimeout 设为 0 和不设置有什么区别？

没有区别。`Config` 零值不可直接使用（需从 `DefaultConfig()` 开始），而 `DefaultConfig()` 将 `ProcessingTimeout` 设为 30 秒。手动设为 `0` 等价于「不限时」——`Extract` 不会启动超时 goroutine，也不会占用 `maxTimeoutGoroutines` 的配额。这在处理已知合法的超大文档时可以避免不必要的 goroutine 开销。

## `Extract` 和 `ExtractAllLinks` 可以混用吗？

可以，它们独立工作：

- `Extract` 返回 `*Result`，其中 `Result.Links` 是**清洗后** DOM 中的 `<a>` 链接（`LinkInfo` 类型，带 `Position`/`IsExternal` 等字段）
- `ExtractAllLinks` 返回 `[]LinkResource`，枚举**未清洗** HTML 中的所有资源链接（包括 `<script src>`、`<iframe>`、`<link>` 等），带 `Type` 分类

两者可先后调用，互不影响。典型场景：先用 `Extract` 提取正文内容，再用 `ExtractAllLinks` 收集页面引用的全部资源。

## 相关文档

- [概述](../) - 特性总览与架构概览
- [快速开始](../getting-started/) - 5 分钟入门教程
- [API 参考概览](../api-reference/) - 完整 API 文档入口
