---
sidebar_label: "阅读模式"
title: "阅读模式 - CyberGo html | ReadPage 与 ReadResult"
description: "CyberGo html 阅读模式 API：12 个 ReadPage 包函数与 Processor 方法签名、ReadResult 的 Render 与 RenderText、PageSection 六字段、SectionKind 五种分区及链接保留的实际语义。"
sidebar_position: 15
---

# 阅读模式

阅读模式（`ReadPage*`）返回**整页**的结构化阅读视图，而不是只选出一篇文章：页面按 `header` / `navigation` / `main` / `aside` / `footer` 分区，每个分区带文本、链接与图片，内联超链接始终保留。它面向把网页喂给 LLM、RAG 或文本分析管线的场景。

取舍：需要「只要正文」用 [Extract](./functions#extract)；需要「整页可读文本 + 结构标签」用本页 API。概念与实战见 [阅读模式指南](../../guides/core-features/reader-mode)。

| 维度 | `Extract` | `ReadPage` |
|------|-----------|-----------|
| 输出 | 选中的正文 + 元数据（`*Result`） | 整页分区（`*ReadResult`） |
| 导航、页脚 | 移除 | 保留并标注类别 |
| 内联链接 | 由 `InlineLinkFormat` 决定，默认不输出 | 始终保留 |
| 缓存 | 参与 | 不参与 |

## 包函数

12 个入口，`cfg ...Config` 遵循[包函数的解析规则](./functions#配置参数解析)（不传用 `DefaultConfig()`，传 ≥2 个返回 `ErrMultipleConfigs`）。

| 函数 | 签名 |
|------|------|
| `ReadPage` | `(htmlBytes []byte, cfg ...Config) (*ReadResult, error)` |
| `ReadPageWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*ReadResult, error)` |
| `ReadPageFromFile` | `(filePath string, cfg ...Config) (*ReadResult, error)` |
| `ReadPageFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*ReadResult, error)` |
| `ReadPageToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownText` | `(htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageToMarkdownTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdown` | `(filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownText` | `(filePath string, cfg ...Config) (string, error)` |
| `ReadPageFromFileToMarkdownTextWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

## Processor 方法

同名 12 个方法，签名与包函数一致，只是不接收 `cfg ...Config`（使用实例自身配置）。

| 方法 | 签名 |
|------|------|
| `Processor.ReadPage` | `(htmlBytes []byte) (*ReadResult, error)` |
| `Processor.ReadPageWithContext` | `(ctx context.Context, htmlBytes []byte) (*ReadResult, error)` |
| `Processor.ReadPageFromFile` | `(filePath string) (*ReadResult, error)` |
| `Processor.ReadPageFromFileWithContext` | `(ctx context.Context, filePath string) (*ReadResult, error)` |
| `Processor.ReadPageToMarkdown` | `(htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownText` | `(htmlBytes []byte) (string, error)` |
| `Processor.ReadPageToMarkdownTextWithContext` | `(ctx context.Context, htmlBytes []byte) (string, error)` |
| `Processor.ReadPageFromFileToMarkdown` | `(filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownWithContext` | `(ctx context.Context, filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownText` | `(filePath string) (string, error)` |
| `Processor.ReadPageFromFileToMarkdownTextWithContext` | `(ctx context.Context, filePath string) (string, error)` |

方法总数与其余分组见 [Processor 方法总览](./processor#方法总览)。

## ReadResult

```go
type ReadResult struct {
	Title          string        `json:"title"`
	Author         string        `json:"author,omitempty"`
	PublishedTime  time.Time     `json:"published_time,omitzero"`
	Description    string        `json:"description,omitempty"`
	SiteName       string        `json:"site_name,omitempty"`
	CanonicalURL   string        `json:"canonical_url,omitempty"`
	Sections       []PageSection `json:"sections"`
	ProcessingTime time.Duration `json:"-"`
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Title` | `string` | 文档标题，优先级与 [`Result.Title`](../types/type-defs#result) 相同 |
| `Author` | `string` | 作者（JSON-LD `author` > `<meta name="author">`） |
| `PublishedTime` | `time.Time` | 发布时间，零值表示未知 |
| `Description` | `string` | 页面摘要 |
| `SiteName` | `string` | 站点名 |
| `CanonicalURL` | `string` | 规范链接 |
| `Sections` | `[]PageSection` | 按文档顺序排列的分区；相邻同类分区合并，无内容的分区丢弃；始终非 `nil` |
| `ProcessingTime` | `time.Duration` | 本次提取的墙上时间（不参与 JSON） |

元数据字段（`Author` 至 `CanonicalURL`）只在 `Config.ExtractMetadata=true`（默认）时填充，来源优先级见[结构化元数据](#结构化元数据)。

### Render

```go
func (r *ReadResult) Render() string
```

把分区拼成一个 Markdown 文档，**带内联链接**：`Title` 非空时先输出 `# <Title>`，随后每个分区输出 `# <Kind 标签>` 标题与 `PageSection.Text`。`Kind` 对应的标题固定为 `Header` / `Navigation` / `Main Content` / `Aside` / `Footer`。无可输出内容（无标题且所有分区均被跳过）时返回空字符串。

### RenderText

```go
func (r *ReadResult) RenderText() string
```

`ReadResult.RenderText` 与 `Render` 同结构但**不带链接与图片标记**，使用 `PageSection.PlainText`：链接文字保留为普通词，图片占位符丢弃。只有链接、没有文字的图标导航会出现在 `Render` 中，在 `RenderText` 中省略。

```go
page, err := html.ReadPage(data)
if err != nil {
	log.Fatal(err)
}
fmt.Println(page.Render())     // 带内联链接的整页 Markdown
fmt.Println(page.RenderText()) // 无链接纯文本
```

需要直接输出时，`ReadPageToMarkdown` / `ReadPageToMarkdownText` 是对二者的一步封装（内部在临时 Processor 上把内联格式覆盖为 `markdown` / `none` 后再调用对应的 Render 方法）。

## PageSection

```go
type PageSection struct {
	Kind      SectionKind `json:"kind"`
	Text      string      `json:"text"`
	PlainText string      `json:"plain_text,omitempty"`
	Links     []LinkInfo  `json:"links,omitempty"`
	Images    []ImageInfo `json:"images,omitempty"`
	WordCount int         `json:"word_count"`
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `Kind` | `SectionKind` | 分区类别 |
| `Text` | `string` | 分区正文，内联链接按 `InlineLinkFormat` 渲染，图片按 `InlineImageFormat` 渲染 |
| `PlainText` | `string` | 去掉链接与图片标记的纯文本，`RenderText` 使用 |
| `Links` | `[]LinkInfo` | 分区内 `<a>`，按文档顺序；`PreserveLinks=false` 时为空 |
| `Images` | `[]ImageInfo` | 分区内 `<img>`，按文档顺序；`PreserveImages=false` 时为空（`Text` 中的内联图片仍按 `InlineImageFormat` 渲染） |
| `WordCount` | `int` | `PlainText` 的词数（CJK 逐字计数）；链接 URL 与图片占位符已在生成 `PlainText` 时去掉，不计入 |

`Links`/`Images` 的 `Position` 相对于**贡献该分区的原始区域**，而不是合并后的 `Text` 偏移。

## SectionKind

```go
type SectionKind string

const (
	SectionHeader     SectionKind = "header"
	SectionNavigation SectionKind = "navigation"
	SectionMain       SectionKind = "main"
	SectionAside      SectionKind = "aside"
	SectionFooter     SectionKind = "footer"
)
```

| 常量 | 值 | `Render` 中的标题 | 判定依据 |
|------|-----|-------------------|----------|
| `SectionHeader` | `header` | `Header` | `<header>`、`role=banner`，或 class/id 含 `header`/`masthead`；页头内嵌的 `<nav>` 归入 header 分区，首个 `main` 之前的未标记残余块也判为 header |
| `SectionNavigation` | `navigation` | `Navigation` | `<nav>`、`role=navigation`、链接密集的残余块（标签云、热门链接） |
| `SectionMain` | `main` | `Main Content` | `<main>`/`<article>` 等主内容地标；无地标时用评分器选中的正文节点 |
| `SectionAside` | `aside` | `Aside` | `<aside>`、`role=complementary`，或 class/id 含 `aside` 的次要内容区 |
| `SectionFooter` | `footer` | `Footer` | `<footer>`、`role=contentinfo`，或 class/id 含 `footer`；最后一个 `main` 之后的未标记残余块也判为 footer |

`main` 可能有多个（例如文章正文后紧跟同样被判为正文的评论区）。

## 关键语义

:::tip 链接与图片
- **链接始终保留。** `InlineLinkFormat` 在阅读模式中只决定**样式**，取值 `markdown`（`[文字](URL)`）或 `html`（`<a href>`）；配置为默认值 `none` 时按 `markdown` 处理，因此 `ReadPage` 的扁平输出不会静默丢链接。
- **`PreserveLinks=false`** 只清空 `PageSection.Links` 切片；`Text` 中仍有 `[文字](URL)`。需要真正无链接的文本时用 `RenderText()` 或 `ReadPageToMarkdownText`。
- **`PreserveImages=false`** 清空 `PageSection.Images`；已内联到 `Text` 的图片（`InlineImageFormat` 为 `markdown`/`html`）仍保留。若同时 `InlineImageFormat="none"`，图片既不进 `Text` 也不进 `Images`。
:::

:::info 缓存、实例与去重
- **不走缓存。** `ReadPage` 的结果类型与 `Result` 不同，不读也不写提取缓存，重复调用会重新处理输入。需要缓存整页结果时由调用方自行缓存。
- **统计口径。** `ReadPage` 计入 `TotalProcessed`、`ErrorCount` 与 `AverageProcessTime`，但不增加 `CacheHits`/`CacheMisses`（缓存未参与）。
- **`ReadPage*ToMarkdown*` 使用临时 Processor**：拷贝父实例的配置并把两个内联格式覆盖为所需值，缓存禁用。因此不污染父实例缓存，而统计与审计仍计入父实例（`GetStatistics`/`GetAuditLog` 可见）。
- **分区去重**：后出现的**同类型外壳分区**（`main` 以外）若文本在忽略空白后与先前的完全一致，则整段丢弃，用于消除响应式布局的重复菜单；**正文分区不参与去重**。分区根节点自身被隐藏时整段丢弃。
:::

清洗按类别区分：`main` 分区执行与文章提取相同的清洗（广告、隐藏节点、嵌套导航被移除）；外壳分区保留菜单与链接，只移除隐藏节点。

## 示例

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	page := []byte(`<html>
<head><title>季度业绩公告</title></head>
<body>
  <header><nav><a href="/">首页</a> <a href="/tech">科技</a></nav></header>
  <main><article>
    <h1>季度业绩公布</h1>
    <p>公司周二公布了强劲的季度业绩。<a href="/analysis">完整分析</a>另见。</p>
  </article></main>
  <aside><p>侧栏：市场数据摘要。</p></aside>
  <footer><p>© 2026 示例新闻</p></footer>
</body></html>`)

	md, err := html.ReadPageToMarkdown(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)

	result, err := html.ReadPage(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // 输出：季度业绩公告
	for _, sec := range result.Sections {
		fmt.Println(sec.Kind, sec.WordCount)
	}
	// 输出：
	// header 4
	// main 28
	// aside 10
	// footer 6
}
```

## 结构化元数据

`ExtractMetadata`（默认 `true`）开启时，`ReadResult` 的五个元数据字段按下列优先级填充；关闭后这些字段保持空值，标题也回退到 `<title>` 等 DOM 来源。

| 字段 | 来源优先级 |
|------|-----------|
| `Author` | JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished` |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name` |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

关闭 `ExtractMetadata` 后这五个字段保持空值，`Title` 回退到 DOM 层：`<title>`（尾段 ≤30 字符且前半段 ≥3 字符时按长度启发式剥离站点名后缀）→ 正文内 h1 → 文档首个 h1 → 首个 h2。

## 错误返回

错误返回与 [`Extract`](./processor#错误返回) 相同：`ErrProcessorClosed`、`ErrInputTooLarge`、`ErrInvalidHTML`、`ErrMaxDepthExceeded`、`ErrProcessingTimeout`、`ErrInternalPanic`、`ErrTooManyConcurrentOps`。

`*WithContext` 变体还会原样返回 `context.Canceled` / `context.DeadlineExceeded`。

包函数另有两种错误：`ErrMultipleConfigs`（传入 ≥2 个 `Config`）与包裹在 `*ConfigError` 中的 `ErrInvalidConfig`。

`*FromFile` 版本额外返回 `*FileError`，其 `FileErr` 包裹 `ErrFileNotFound` 或 `ErrInvalidFilePath`（路径遍历拒绝也包装后者，可用 `errors.Is` 命中）；`AllowedBaseDir` 越界时 `FileErr` 为 `path outside allowed directory`，不匹配任何哨兵。

## 相关文档

- [阅读模式指南](../../guides/core-features/reader-mode) — 与 `Extract` 的取舍、输出示例与配置
- [包函数](./functions) — `Extract` 系列入口
- [Processor](./processor) — 实例生命周期与统计
- [类型定义](../types/type-defs) — `Result`、`LinkInfo`、`ImageInfo`
- [配置](./config) — `InlineLinkFormat`、`ExtractMetadata` 等字段
