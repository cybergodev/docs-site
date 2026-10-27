---
sidebar_label: "输出格式"
title: "输出格式 - CyberGo html | Markdown 与 JSON 输出"
description: "CyberGo html 输出格式 API 参考：ExtractToMarkdown 与 ExtractToJSON 的包函数与 Processor 方法签名、WithContext 变体，Markdown 一次性 Processor 的缓存隔离、JSON 完整字段映射与省略规则。"
sidebar_position: 10
---

# 输出格式

`ExtractToMarkdown` 把提取结果输出为 Markdown 文本，`ExtractToJSON` 输出 JSON 字节。

## Markdown 输出

`ExtractToMarkdown` 内部把 `InlineImageFormat` 和 `InlineLinkFormat` 都固定设为 `markdown` 后再提取，返回 `Result.Text`。传入的 `Config` 中这两个字段的取值不影响结果，因此无需 `html.MarkdownConfig()`。

### 缓存与实例行为

作为 Processor 方法调用时，`ExtractToMarkdown` 不命中、也不写入主 Processor 的缓存。它基于当前配置构造一个**一次性 Processor**：

- 对配置做**值拷贝**（配置在 `New()` 后不可变，拷贝无需加锁），再覆盖两个格式字段；格式设置不会回写到共享配置
- **禁用缓存**（`MaxCacheEntries = 0`）：既不读也不写主缓存，避免格式特定的结果污染主缓存
- **复用主 Processor 的 Scorer、审计收集器与统计计数器**：转换过程中的审计事件与统计会计入主 Processor，`GetAuditLog` 与 `GetStatistics` 都能看到
- 该机制是线程安全的

需要让提取结果进入主缓存时，改用 `Extract` 并自行设置 `InlineImageFormat`/`InlineLinkFormat`。

### 包函数

```go
func ExtractToMarkdown(htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFile(filePath string, cfg ...Config) (string, error)
func ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) (string, error)
```

### Processor 方法

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

### 示例

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>示例文档</title></head><body>
<p>正文段落，包含一张图片。</p>
<p><img src="/img/photo.png" alt="示例图片"></p>
<p>访问 <a href="https://example.com">示例站点</a> 了解更多。</p>
</body></html>`)

	md, err := html.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// 输出：含图片与链接的 Markdown 文本，
	//       如 ![示例图片](/img/photo.png) 与 [示例站点](https://example.com)
}
```

### 格式选项

`ExtractToMarkdown` 固定使用 `markdown` 格式。需要其他内联格式时，用 `Extract` 配合以下 `Config` 字段：

| 字段 | 可选值 | 效果 |
|------|--------|------|
| `InlineImageFormat` | `none`（默认） | 图片不内联到文本 |
| | `markdown` | 输出 `![alt](url)` |
| | `html` | 输出 `<img src="url" alt="alt">` |
| | `placeholder` | 输出占位符 `[IMAGE:N]` |
| `InlineLinkFormat` | `none`（默认） | 链接不内联到文本 |
| | `markdown` | 输出 `[text](url)` |
| | `html` | 输出 `<a href="url">text</a>` |

### Markdown 格式化机制

内联图片与链接通过**占位符替换**实现，分两步：

1. **文本提取阶段**：每个 `<img>` 在文本流中插入占位符 `[IMAGE:N]`，每个 `<a>` 插入成对的 `[LINK:N]...[/LINK]`（`N` 为位置序号，与 `Images`/`Links` 切片中的 `Position` 一一对应）
2. **格式化阶段**：根据 `InlineImageFormat`/`InlineLinkFormat`，把占位符替换为目标格式（markdown/html），或直接移除（none）。链接先于图片替换：链接文本里残留的 `[IMAGE:N]` 占位符会在图片阶段嵌套渲染，得到 `[文本 ![alt](img)](url)` 形式的链接图片

输出 `markdown` 格式时，格式化阶段会把图片 alt 文本与链接文本中的 `[`、`]`、`\`、`|` 转义为 `\[`、`\]`、`\\`、`\|`，避免它们破坏 Markdown 链接/图片语法（裸 `|` 还会切断 Markdown 表格单元格）。链接/图片目标 URL 中的 `(`、`)`、空格、`|` 则被百分号编码为 `%28`、`%29`、`%20`、`%7C`，保持目标仍是可复制的合法 URL。转义与编码只发生在 markdown 分支，且**不会还原**——保留它们正是防注入的目的。

## JSON 输出

`ExtractToJSON` 先走正常的 `Extract`，再用 `json.Marshal` 序列化。Processor 方法会命中/写入主缓存；包函数使用池化或一次性 Processor，缓存不跨调用保留。

### 包函数

```go
func ExtractToJSON(htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFile(filePath string, cfg ...Config) ([]byte, error)
func ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)
```

### Processor 方法

```go
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

### 示例

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>示例文档</title></head><body>
<p>这是一段正文。</p>
<p><img src="/img/photo.png" alt="示例图片"></p>
<a href="https://example.com">示例站点</a>
</body></html>`)

	jsonBytes, err := html.ExtractToJSON(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(jsonBytes))
	// 输出：包含 text/title/images/links 等字段的 JSON 字符串
}
```

### JSON 输出结构

JSON 序列化由 `Result.MarshalJSON()` 自定义实现，对应内部结构 `jsonResult`：

| JSON 字段 | 类型 | 来源 | 省略规则 |
|-----------|------|------|----------|
| `text` | string | `Result.Text`（提取的正文） | 总是输出 |
| `title` | string | `Result.Title`（文档标题） | 总是输出 |
| `images` | array | `Result.Images` | `omitempty`，空时省略 |
| `links` | array | `Result.Links` | `omitempty`，空时省略 |
| `videos` | array | `Result.Videos` | `omitempty`，空时省略 |
| `audios` | array | `Result.Audios` | `omitempty`，空时省略 |
| `processing_time_ms` | int | `Result.ProcessingTime` | 总是输出（毫秒数） |
| `word_count` | int | `Result.WordCount` | 总是输出 |
| `reading_time_ms` | int | `Result.ReadingTime` | 总是输出（毫秒数） |
| `author` | string | `Result.Author` | `omitempty`，空时省略 |
| `published_time` | string | `Result.PublishedTime`（RFC 3339） | 零值时省略（内部用指针，不会输出 `0001-01-01T00:00:00Z`） |
| `description` | string | `Result.Description` | `omitempty`，空时省略 |
| `site_name` | string | `Result.SiteName` | `omitempty`，空时省略 |
| `canonical_url` | string | `Result.CanonicalURL` | `omitempty`，空时省略 |
| `confidence` | number | `Result.Confidence` | 总是输出（**无** `omitempty`，`0` 也会序列化） |
| `extraction_method` | string | `Result.ExtractionMethod` | `omitempty`，空时省略 |

`ProcessingTime` 与 `ReadingTime` 在 `Result` 结构体上带 `json:"-"` 标签，标准序列化会跳过它们；自定义 `MarshalJSON` 才把二者以毫秒数写入输出。JSON 面向外部消费，**未实现 `UnmarshalJSON`**，无法原样反序列化回 `Result`。

### 示例输出

下面是一篇含 h1、两段正文、一张图片与一个链接的示例页面的输出（`processing_time_ms` 随机器而变；`reading_time_ms`、`confidence`、`extraction_method` 为实测值）：

```json
{
  "text": "# Go 入门指南\n\nGo 是一门编译语言。\n\nGo 官网",
  "title": "Go 入门指南",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
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

`reading_time_ms` 为 3428：空格分词按 200 词/分钟、CJK 字符按 350 字/分钟分别折算后相加。`confidence=0.6` 表示选中了文章节点但文本较短；`extraction_method=article` 表示正文由评分器选出的节点产出。分档规则见[类型定义](../types/type-defs#质量信号取值规则)。

页面声明了结构化元数据时，输出会多出这些字段（值为示例）：

```json
{
  "author": "示例记者",
  "published_time": "2026-04-21T09:30:00Z",
  "description": "公司周二公布强劲季度业绩。",
  "site_name": "示例新闻",
  "canonical_url": "https://news.example.com/q3-results.html"
}
```

它们只在 `ExtractMetadata=true`（默认）且页面确实声明了对应元数据时出现，来源优先级见[类型定义](../types/type-defs#元数据字段的取值规则)。
