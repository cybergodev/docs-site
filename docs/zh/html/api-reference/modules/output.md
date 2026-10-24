---
sidebar_label: "输出格式"
title: "输出格式 - CyberGo html | Markdown 与 JSON 输出"
description: "CyberGo html 输出格式 API 参考：ExtractToMarkdown 与 ExtractToJSON 的包函数与 Processor 方法签名、WithContext 变体，Markdown 一次性 Processor 的缓存隔离与 JSON 字段映射。"
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
2. **格式化阶段**：根据 `InlineImageFormat`/`InlineLinkFormat`，把占位符替换为目标格式（markdown/html），或直接移除（none）

输出 `markdown` 格式时，格式化阶段会把图片 alt 文本与链接文本中的 `[`、`]`、`\` 转义为 `\[`、`\]`、`\\`，避免它们破坏 Markdown 链接/图片语法。转义只发生在 markdown 分支，且**不会还原**——保留转义正是防注入的目的。

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

`ProcessingTime` 与 `ReadingTime` 在 `Result` 结构体上带 `json:"-"` 标签，标准序列化会跳过它们；自定义 `MarshalJSON` 才把二者以毫秒数写入输出。JSON 面向外部消费，**未实现 `UnmarshalJSON`**，无法原样反序列化回 `Result`。
