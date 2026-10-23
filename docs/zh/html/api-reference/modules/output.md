---
sidebar_label: "输出格式"
title: "输出格式 - CyberGo html | Markdown 与 JSON 输出"
description: "CyberGo html 输出格式 API 参考：详解 ExtractToMarkdown 与 ExtractToJSON 的包函数及 Processor 方法签名，均有 WithContext 上下文变体，支持从字节或文件提取并转换为 Markdown、JSON 格式，说明 Markdown 临时 Processor 缓存隔离、占位符替换与防注入转义原理及 JSON 输出结构。"
sidebar_position: 10
---

# 输出格式

HTML 库支持将提取结果输出为 Markdown 或 JSON 格式。

## Markdown 输出

将 HTML 内容提取并转换为 Markdown 格式。内部会把 `InlineImageFormat` 和 `InlineLinkFormat` 都设为 `markdown` 后再提取，最终返回 `Result.Text`。

:::warning 缓存行为差异
`ExtractToMarkdown` 不会命中、也不会写入主 Processor 的缓存。它通过 `buildFormatProcessor` 构造一个**临时 Processor**：

- 对当前配置做**值拷贝**（`config` 在 `New()` 后不可变，拷贝无需加锁），再覆盖两个格式字段——格式设置不会回写到共享配置
- **禁用缓存**（`MaxCacheEntries = 0`）：既不读取也不写入主 Processor 的缓存，避免格式特定的结果污染主缓存
- **复用主 Processor 的 Scorer**（打分器），但使用**独立的、禁用的审计收集器**，确保主 Processor 的 `Close()` 不会与进行中的提取产生竞争
- 该机制是线程安全的

如需让提取走缓存，请改用普通 `Extract` 并自行配置 `InlineImageFormat`/`InlineLinkFormat`。
:::

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

	md, err := html.ExtractToMarkdown(data, html.MarkdownConfig())
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// 输出：含图片与链接的 Markdown 文本，
	//       如 ![示例图片](/img/photo.png) 与 [示例站点](https://example.com)
}
```

### 格式选项

`ExtractToMarkdown` 固定使用 `markdown` 格式。若需其他内联格式，可用普通 `Extract` 配合以下 `Config` 字段：

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
2. **格式化阶段**：根据 `InlineImageFormat`/`InlineLinkFormat`，将占位符替换为目标格式（markdown/html），或直接移除（none）

为防止图片 alt 文本与链接文本中的 `[`、`]`、`\` 破坏 Markdown 链接/图片语法（Markdown 注入），**格式化阶段**输出 `markdown` 格式时会将这些字符转义为 `\[`、`\]`、`\\`（转义仅发生在 markdown 分支）。转义**不会还原**——保留转义正是防注入的目的。

## JSON 输出

将提取结果序列化为 JSON 字节。与 Markdown 不同，该方法走主 Processor 的正常 `Extract`（启用缓存时会命中/写入缓存），再通过 `json.Marshal` 序列化。

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

| JSON 字段 | 类型 | 来源 |
|-----------|------|------|
| `text` | string | `Result.Text`（提取的正文） |
| `title` | string | `Result.Title`（文档标题） |
| `images` | array | `Result.Images`（`omitempty`，空时省略） |
| `links` | array | `Result.Links`（`omitempty`） |
| `videos` | array | `Result.Videos`（`omitempty`） |
| `audios` | array | `Result.Audios`（`omitempty`） |
| `processing_time_ms` | int | `Result.ProcessingTime` 转为**毫秒数** |
| `word_count` | int | `Result.WordCount` |
| `reading_time_ms` | int | `Result.ReadingTime` 转为**毫秒数** |

注意 `ProcessingTime` 与 `ReadingTime` 在 `Result` 结构体上带 `json:"-"` 标签（标准序列化会跳过），自定义 `MarshalJSON` 才以毫秒数形式包含在输出中。JSON 格式面向外部消费，**未实现 `UnmarshalJSON`**，无法原样反序列化回 `Result`。

:::tip Result.MarshalJSON
`Result` 实现了 `json.Marshaler` 接口。`ProcessingTime` 和 `ReadingTime` 字段带有 `json:"-"` 标签（标准序列化会跳过），但自定义 `MarshalJSON()` 会将它们以毫秒数形式包含在输出中。
:::
