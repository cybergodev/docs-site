---
sidebar_label: "输出格式选择"
title: "输出格式选择 - CyberGo html | 格式对比指南"
description: "CyberGo html 输出格式选择：对比纯文本、Markdown、JSON 的特点与适用场景，含 InlineImageFormat 与 InlineLinkFormat 选项配置。"
sidebar_position: 2
---

# 输出格式选择

本指南帮助你在纯文本、Markdown、JSON 三种输出格式中做出正确选择。

## 格式对比

| 特性 | 纯文本 | Markdown | JSON |
|------|--------|----------|------|
| 可读性 | 高 | 高 | 低（机器友好） |
| 保留结构 | 无 | 标题/列表/链接/图片 | 完整元数据 |
| 图片处理 | 移除 | `![alt](url)` | ImageInfo 列表 |
| 链接处理 | 仅保留文本 | `[text](url)` | LinkInfo 列表 |
| 表格支持 | 无 | Markdown 表格 | 原始数据 |
| 适用场景 | 搜索索引/文本分析 | 博客/文档/阅读器 | API 传输/数据存储 |

## 纯文本

最轻量的输出方式，仅保留文字内容，去除所有 HTML 标签和格式。

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### 适用场景

- 构建搜索索引
- 文本分析和 NLP 处理
- 生成摘要和预览
- 统计字数和阅读时间

### 特点

- 图片的 alt 文本被移除；链接保留可见文本（仅去除 URL 与 Markdown 语法）
- 标题、段落之间保留换行
- 列表内容以纯文本形式展示
- 表格按 `TableFormat` 渲染（默认 Markdown 表格）

## Markdown

保留文档结构，同时具有良好可读性，适合内容迁移和阅读场景。

```go
// 方式一：包级别函数
md, err := html.ExtractToMarkdown(data)

// 方式二：使用 Processor
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
Go 入门指南

Go 是一门编译语言。

![Gopher](gopher.png)
[Go 官网](https://go.dev)
```

### 格式选项

Markdown 格式由两个配置字段控制：

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| 格式值 | 图片输出（InlineImageFormat） | 链接输出（InlineLinkFormat） |
|--------|----------|----------|
| `none` | 移除 | 仅保留文本 |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | -（不支持） |

:::tip 使用 MarkdownConfig()
`MarkdownConfig()` 预设已将图片和链接格式设为 `markdown`，直接使用即可，无需手动配置。
:::

:::info placeholder 格式
`placeholder` 仅适用于 `InlineImageFormat`，会在文本中保留 `[IMAGE:N]` 占位符。`InlineLinkFormat` 不支持此值，仅支持 `none`、`markdown`、`html`。
:::

### 适用场景

- 内容迁移到 Markdown 博客/静态站
- 邮件正文生成
- 文档格式转换
- RSS / Newsletter 内容生成

## JSON

结构化输出，保留完整元数据，适合程序间传输和持久化存储。

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### 输出结构

```json
{
  "text": "Go 入门指南\n\nGo 是一门编译语言。\n\nGo 官网",
  "title": "Go 入门指南",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Go 官网", "title": "", "is_external": true, "is_nofollow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 6,
  "reading_time_ms": 1800
}
```

:::tip 时间字段
JSON 输出中，`ProcessingTime` 和 `ReadingTime` 自动转换为毫秒（`processing_time_ms`、`reading_time_ms`），便于前端和 API 消费。
:::

### 适用场景

- API 响应数据
- 数据库存储
- 微服务间传输
- 与前端应用集成

## 从文件提取各格式

每种格式都支持从文件读取：

```go
// 纯文本
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## 带上下文的版本

所有格式函数都有 `ExtractWithContext` 变体，支持超时和取消：

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
需要保留格式？── 是 ──→ Markdown
        │
        否
        │
        └──→ 纯文本
```

## 下一步

- [API 参考：输出格式](../../api-reference/modules/output) - 完整 API 签名
- [链接提取与分组](./link-extraction) - 提取页面资源链接
- [配置详解](../../api-reference/core/config) - 所有配置选项
