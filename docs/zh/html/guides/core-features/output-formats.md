---
sidebar_label: "输出格式实战"
title: "输出格式实战 - CyberGo html | 格式对比指南"
description: "CyberGo html 输出格式实战：对比纯文本、Markdown、JSON 在结构保留、图片与链接处理上的差异与适用场景，说明 InlineImageFormat、InlineLinkFormat 的取值，以及 JSON 字段的出现与省略规则。"
sidebar_position: 30
---

# 输出格式实战

库提供纯文本、Markdown、JSON 三种输出格式。本页对比三者的结构与适用场景，并说明内联格式字段的取值。

## 格式对比

| 特性 | 纯文本 | Markdown | JSON |
|------|--------|----------|------|
| 可读性 | 高 | 高 | 低（面向程序） |
| 保留结构 | 标题 ATX 标记与段落换行 | 标题/列表/链接/图片 | 完整元数据 |
| 图片处理 | 不输出 | `![alt](url)` | `ImageInfo` 列表 |
| 链接处理 | 仅可见文本 | `[text](url)` | `LinkInfo` 列表 |
| 表格支持 | 按 `TableFormat` 渲染 | Markdown 表格 | `text` 字段同上，另有结构化元数据 |
| 适用场景 | 搜索索引/文本分析 | 博客/文档/阅读器 | API 传输/数据存储 |

## 纯文本

只保留文字，去掉全部 HTML 标签与格式：

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### 适用场景

- 构建搜索索引
- 文本分析与 NLP 处理
- 生成摘要和预览
- 统计字数与阅读时间

### 特点

- 图片不输出；链接只输出可见文本，不含 URL
- 标题以 Markdown ATX 标记（`# ` 至 `###### `）写出，段落之间保留换行
- 列表内容以纯文本形式呈现
- 表格按 `TableFormat` 渲染（默认 Markdown 表格）

`ExtractText` 内部先调用 `Extract`，再返回 `.Text`；处理步骤与 `Extract` 完全相同。

## Markdown

保留标题、列表、表格与内联资源，同时保持可读性：

```go
// 方式一：包级函数
md, err := html.ExtractToMarkdown(data)

// 方式二：Processor 实例
p, _ := html.New()
defer p.Close()
md2, err := p.ExtractToMarkdown(data)
```

### 输出示例

输入 HTML：

```html
<article>
    <h1>Go 入门指南</h1>
    <p>Go 是一门编译语言。</p>
    <img src="gopher.png" alt="Gopher" />
    <a href="https://go.dev">Go 官网</a>
</article>
```

输出 Markdown：

```markdown
# Go 入门指南

Go 是一门编译语言。

![Gopher](gopher.png)
[Go 官网](https://go.dev)
```

### 格式选项

`Extract` 的文本输出中，图片与链接的呈现由两个字段控制：

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| 格式值 | 图片输出（`InlineImageFormat`） | 链接输出（`InlineLinkFormat`） |
|--------|----------|----------|
| `none` | 不输出 | 仅可见文本 |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | 不支持 |

`placeholder` 只适用于 `InlineImageFormat`，会在文本中留下 `[IMAGE:N]` 占位符，便于后续按序号替换；`InlineLinkFormat` 只接受 `none`、`markdown`、`html`。

:::tip MarkdownConfig 与 ExtractToMarkdown
`MarkdownConfig()` 把 `InlineImageFormat` 与 `InlineLinkFormat` 设为 `markdown`，作用于 `Extract` 返回的 `Text`。`ExtractToMarkdown` 固定使用 markdown 格式，与配置无关，不需要该预设。
:::

### 适用场景

- 内容迁移到 Markdown 博客/静态站
- 邮件正文生成
- 文档格式转换
- RSS / Newsletter 内容生成

## JSON

输出结构化数据，保留完整元数据：

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### 输出结构

一篇含 h1、正文与一个链接的页面，实测输出如下：

```json
{
  "text": "# Go 入门指南\n\nGo 是一门编译语言。\n\nGo 官网",
  "title": "Go 入门指南",
  "links": [
    {"url": "https://go.dev", "text": "Go 官网", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 17,
  "reading_time_ms": 3428,
  "confidence": 0.6,
  "extraction_method": "article"
}
```

`text`、`title`、`processing_time_ms`、`word_count`、`reading_time_ms`、`confidence` 六个字段恒存在（`confidence` 无 `omitempty`，`0` 也照常序列化）。其余字段按需出现：

| 字段 | 类型 | 出现条件 |
|------|------|----------|
| `images`/`links`/`videos`/`audios` | 数组 | `omitempty`：对应 `Preserve*` 为 `false` 或没有此类内容时省略 |
| `author` | 字符串 | `omitempty`：无作者时省略 |
| `description` | 字符串 | `omitempty`：无摘要时省略 |
| `site_name` | 字符串 | `omitempty`：无站点名时省略 |
| `canonical_url` | 字符串 | `omitempty`：无规范链接时省略 |
| `published_time` | RFC 3339 时间 | 零值时省略（内部用指针，不会输出 `0001-01-01T00:00:00Z`） |
| `extraction_method` | 字符串 | `omitempty`：`article`/`listing`/`body`；为空时省略，正常总有值 |

页面声明了结构化元数据（且 `ExtractMetadata` 为 `true`）时，输出会多出这些字段：

```json
{
  "author": "示例记者",
  "published_time": "2026-04-21T09:30:00Z",
  "description": "公司周二公布强劲季度业绩。",
  "site_name": "示例新闻",
  "canonical_url": "https://news.example.com/q3-results.html"
}
```

:::tip 时间字段以毫秒输出
`Result` 的 `ProcessingTime` 与 `ReadingTime` 带 `json:"-"` 标签，标准序列化会跳过它们；自定义 `MarshalJSON` 把它们写成 `processing_time_ms`、`reading_time_ms` 两个毫秒数。JSON 面向外部消费，未实现 `UnmarshalJSON`，无法原样反序列化回 `Result`。
:::

### 适用场景

- API 响应数据
- 数据库存储
- 微服务间传输
- 与前端应用集成

## 从文件提取各格式

三种格式都有对应的文件版本：

```go
// 纯文本
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## 带上下文的版本

三种格式都有 `*WithContext` 变体，支持超时与取消：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## 选型决策

```text
需要程序消费？── 是 ──→ JSON
        │
        否
        │
需要保留结构？── 是 ──→ Markdown
        │
        否
        │
        └──→ 纯文本
```

## 下一步

- [API 参考：输出格式](../../api-reference/modules/output) - 完整 API 签名
- [链接提取实战](./link-extraction) - 枚举页面引用的全部资源链接
- [配置详解](../../api-reference/core/config) - 全部配置项
