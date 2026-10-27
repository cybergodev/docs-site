---
sidebar_label: "阅读模式实战"
title: "阅读模式 - CyberGo html | LLM 纯净页面提取"
description: "CyberGo html 阅读模式：用 ReadPage 把整页切成 header/navigation/main/aside/footer 分区并保留内联链接，直接输出可喂给 LLM 的 Markdown；含 ReadResult 结构、Render 与 RenderText 差异及与 Extract 的取舍。"
sidebar_position: 15
---

# 阅读模式

阅读模式（`ReadPage` 系列）把整页按结构分区保留，而不是只选出一篇文章。它面向把网页内容喂给 LLM、RAG 或文本分析管线的场景：HTML/CSS/JS 标记被移除，导航与页脚仍在，但被标注为独立分区，内联超链接保留为 `[文字](URL)`。

## 与 Extract 的区别

| 维度 | `Extract` | `ReadPage` |
|------|-----------|-----------|
| 输出 | 选中的正文 + 元数据 | 整页分区（`[]PageSection`） |
| 导航、页脚 | 移除 | 保留并标注类别 |
| 广告、相关推荐 | 移除 | 移除 |
| 内联链接 | 由 `InlineLinkFormat` 决定，默认不输出 | 始终保留 |
| 结果类型 | `Result` | `ReadResult` |
| 缓存 | 参与 | 不参与（结果类型不同） |

需要「只要正文」时用 `Extract`；需要「整页可读文本 + 结构标签」时用 `ReadPage`。

## 一次调用输出整页

两个最常用的入口直接返回一个 Markdown 文档：

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

	// 带链接：适合需要引用来源的提示词
	md, err := html.ReadPageToMarkdown(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)

	// 不带链接：链接文字保留为普通词
	plain, err := html.ReadPageToMarkdownText(page)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(plain)
}
```

`ReadPageToMarkdown` 输出（节选）：

```text
# 季度业绩公告

# Header

[首页](/) [科技](/tech)

# Main Content

# 季度业绩公布

公司周二公布了强劲的季度业绩。[完整分析](/analysis) 另见。

# Aside

侧栏：市场数据摘要。

# Footer

© 2026 示例新闻
```

`ReadPageToMarkdownText` 输出同结构，但 `[首页](/)` 变为 `首页`。

:::tip 分区标题是英文
`Render`/`RenderText` 的分区标题固定为 `Header` / `Navigation` / `Main Content` / `Aside` / `Footer`，与 `SectionKind` 的取值（`header`/`navigation`/`main`/`aside`/`footer`）一一对应。文档标题（`ReadResult.Title`）在可用时作为最顶层的 `#` 标题。
:::

## 结构化分区

需要自行筛选分区时调用 `ReadPage`：

```go
page, err := html.ReadPage(htmlBytes)
if err != nil {
	log.Fatal(err)
}
for _, sec := range page.Sections {
	fmt.Println(sec.Kind, sec.WordCount)
}
```

`ReadResult` 与 `PageSection` 的逐字段说明见 [API 参考：ReadResult](../../api-reference/core/reader#readresult) 与 [PageSection](../../api-reference/core/reader#pagesection)。

`SectionKind` 的取值与判定依据：

| 常量 | 值 | 判定依据 |
|------|-----|----------|
| `SectionHeader` | `header` | `<header>`、`role=banner`，或 class/id 含 `header`/`masthead` |
| `SectionNavigation` | `navigation` | `<nav>`、`role=navigation`、链接密集的残余块，或 class/id 含 `nav`/`menu`/`breadcrumb` |
| `SectionMain` | `main` | `<main>`/`<article>`、`role=main/article`，或评分器选中的正文节点 |
| `SectionAside` | `aside` | `<aside>`、`role=complementary`，或 class/id 含 `sidebar`/`aside` |
| `SectionFooter` | `footer` | `<footer>`、`role=contentinfo`，或 class/id 含 `footer`/`colophon` |

同一个 `Kind` 可能出现多次：多次出现的相邻同类分区会合并，正文之后的评论区也可能再次被判为 `main`。

### 只保留正文

不想要页面外壳时，按 `Kind` 过滤后重新拼装：

```go
var main []html.PageSection
for _, sec := range page.Sections {
	if sec.Kind == html.SectionMain {
		main = append(main, sec)
	}
}
subset := html.ReadResult{Title: page.Title, Sections: main}
fmt.Println(subset.Render())     // 带链接
fmt.Println(subset.RenderText()) // 不带链接
```

`Render` 与 `RenderText` 的差异只在链接与图片：`Render` 使用 `Text`，`RenderText` 使用 `PlainText`；只有链接、没有文字的图标导航会出现在 `Render` 中，`RenderText` 中省略。

## 清理规则

分区按类型采取不同策略：

- **正文分区**（`main`）：执行与文章提取相同的清洗，广告、社交、相关推荐、评论区被整块移除。
- **页面外壳**（header/navigation/aside/footer）：保留菜单与链接（导航就是外壳的内容），只移除隐藏节点。
- **去重**：后出现的同类型外壳分区若文本（忽略空白）与已有的完全相同，即被丢弃，用于消除响应式布局的重复菜单。正文分区不参与去重。
- **隐藏分区**：分区根节点自身被隐藏（`display:none`、`hidden`）时整段丢弃。

## 配置

| 配置 | 在阅读模式中的行为 |
|------|--------------------|
| `InlineLinkFormat` | 取值 `markdown` 或 `html`；配置为默认值 `none` 时按 `markdown` 处理 |
| `InlineImageFormat` | `none` 时图片只进 `Images` 列表，不写入 `Text`；`markdown`/`html` 时内联到 `Text` |
| `PreserveLinks` | `false` 时 `PageSection.Links` 为空，但 `Text` 仍带内联链接 |
| `PreserveImages` | `false` 时 `PageSection.Images` 为空；已内联的图片（`InlineImageFormat` 非 `none`）仍保留 |
| `BaseURL` / `ResolveRelativeURLs` | 与 `ExtractAllLinks` 相同的解析规则：相对链接转绝对地址 |
| `ExtractMetadata` | 控制 `ReadResult` 的 Author / PublishedTime / Description / SiteName / CanonicalURL 是否填充 |
| `ExtractArticle` | 页面没有语义分区时，是否用评分器选出正文作为 `main` 分区 |
| `MaxInputSize` / `MaxDepth` / `ProcessingTimeout` / `EnableSanitization` | 与 `Extract` 完全一致 |

阅读模式**不受缓存影响**：`ReadPage` 每次重新处理输入。需要缓存整页结果时，自行在调用方缓存。

## 函数一览

包函数与 `Processor` 方法一一对应，差异仅在 `cfg ...Config` 参数（如包级 `ReadPageToMarkdown(htmlBytes, cfg...)` 对应实例方法 `Processor.ReadPageToMarkdown(htmlBytes)`，配置取自实例）。完整对应关系与逐个签名见 [API 参考：阅读模式](../../api-reference/core/reader#包函数)。

错误返回与 `Extract` 相同；`*FromFile` 版本另返回 `*FileError`（`ErrFileNotFound`、`ErrInvalidFilePath`、路径遍历拒绝）。

## 结构化元数据

`Extract` 与 `ReadPage` 都填充下列字段，由 `Config.ExtractMetadata`（默认 `true`）控制：

| 字段 | 来源优先级 |
|------|-----------|
| `Author` | JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished` |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name` |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

关闭元数据提取还会改变标题来源：`Title` 回退到 DOM 层——`<title>`（尾段 ≤30 字符且前半段 ≥3 字符时剥离站点名后缀，完整规则见[内容提取实战](./content-extraction#标题优先级)）→ 正文 h1 → 文档首个 h1 → 首个 h2。

## 下一步

- [内容提取实战](./content-extraction) - `Extract` 的流程、`Result` 与文章识别
- [输出格式实战](./output-formats) - Markdown / JSON 输出对比
- [API 参考：包函数](../../api-reference/core/functions) - 完整签名
