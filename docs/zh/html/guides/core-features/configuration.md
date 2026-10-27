---
sidebar_label: "配置实战"
title: "配置实战 - CyberGo html | Config 字段选择指南"
description: "CyberGo html 配置实战：DefaultConfig、HighSecurityConfig、TextOnlyConfig、MarkdownConfig 四种预设的差异，资源管理、安全、内容提取、输出格式、链接提取与扩展六大类共 31 个字段的导览，以及爬虫与 API 后端的常见组合。"
sidebar_position: 60
---

# 配置实战

`Config` 是 html 库的统一配置结构体，共 31 个字段。多数场景只需选一个预设，再按需覆写字段；完整字段说明见 [API 参考 — 配置](../../api-reference/core/config)。

## 四种预设配置

| 预设 | 适用场景 | 关键差异 |
|------|----------|----------|
| `DefaultConfig()` | 通用提取 | 全功能开启，安全默认值 |
| `HighSecurityConfig()` | 不受信任输入 | 缩小限制、启用审计、降低深度上限 |
| `TextOnlyConfig()` | 仅需纯文本 | 关闭全部媒体保留 |
| `MarkdownConfig()` | 内联 Markdown 输出 | 图片与链接按 Markdown 格式渲染 |

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><h1>标题</h1><p>正文内容</p></body></html>`)

	// 大多数场景：直接用默认配置
	p1, err := html.New()
	if err != nil {
		log.Fatal(err)
	}
	defer p1.Close()
	r1, err := p1.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(r1.Title)
	// 输出: 标题

	// 只需要纯文本（如搜索引擎索引）
	p2, err := html.New(html.TextOnlyConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p2.Close()

	// 图片与链接以 Markdown 内联格式出现在 Text 中（如 CMS 迁移）
	p3, err := html.New(html.MarkdownConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p3.Close()
	r3, err := p3.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(r3.Text)
	// 输出: # 标题
	//       正文内容
}
```

:::warning 零值 Config 不可用
`Config{}` 无法通过 `Validate()`（`MaxInputSize` 等字段必须为正数），不要从零值开始。先取一个预设，再覆盖字段。
:::

<!-- check-code: skip -->
```go
cfg := html.HighSecurityConfig()
cfg.PreserveImages = false // 在高安全基础上额外关闭图片
processor, _ := html.New(cfg)
```

`TextOnlyConfig()` 只把 `PreserveImages`/`PreserveLinks`/`PreserveVideos`/`PreserveAudios` 设为 `false`，不影响 `ExtractAllLinks` 的 `Include*` 过滤。

`MarkdownConfig()` 只设 `InlineImageFormat` 与 `InlineLinkFormat`；`ExtractToMarkdown` 固定使用 markdown 格式，无需该预设。

## 六大类字段导览

### 资源管理

影响内存与吞吐。默认值适用于多数场景，可按负载调整。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `MaxInputSize` | 50 MB | 最大输入大小，防止内存耗尽 |
| `MaxCacheEntries` | 2000 | 缓存条目数上限；设 0 禁用缓存 |
| `CacheTTL` | 1 小时 | 缓存存活时间 |
| `CacheCleanup` | 5 分钟 | 后台清理过期缓存的间隔 |
| `WorkerPoolSize` | 4 | 批量处理并发数（1–256） |
| `ProcessingTimeout` | 30 秒 | 单文档处理超时；设 0 不限时 |

:::warning 缓存仅对 Processor 实例生效
包级函数（如 `html.Extract`）每次调用都用池化或临时 Processor，缓存不跨调用保留。需要缓存请用 `html.New()` 创建独立 Processor。详见 [Processor 复用与缓存](../performance/processor-cache)。
:::

### 安全

生产环境必须关注这一组。完整特性见 [安全概述](../security/)。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `EnableSanitization` | `true` | HTML 清洗（移除危险标签/属性） |
| `MaxDepth` | 500 | DOM 嵌套深度上限，防止栈溢出 |
| `AllowedBaseDir` | `""` | 文件操作沙箱目录；空 = 不限制 |
| `Audit` | 禁用 | 安全审计日志配置 |

:::warning AllowedBaseDir 与用户提供的路径
文件路径来自用户输入时必须设置 `AllowedBaseDir`。它通过 OS 文件句柄解析真实路径，防住符号链接与 Windows junction 绕过。
:::

### 内容提取

控制从 HTML 中提取哪些内容。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ExtractArticle` | `true` | 智能文章识别（自动定位主体内容） |
| `ExtractMetadata` | `true` | 结构化元数据：解析作者、发布时间、摘要、站点名与规范链接，并让元数据标题优先 |
| `PreserveImages` | `true` | 保留图片信息 |
| `PreserveLinks` | `true` | 保留链接信息 |
| `PreserveVideos` | `true` | 提取视频 |
| `PreserveAudios` | `true` | 提取音频 |

关闭不需要的媒体类型可以减少处理量：

```go
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
// 只提取文本、图片和链接
```

:::tip 关闭 ExtractMetadata 的影响
它同时改变标题来源：`Result.Title` 不再取 JSON-LD headline 或 `og:title`，回退到 `<title>` → 正文 h1 → 文档首个 h1 → 首个 h2 的 DOM 顺序。`Author`、`PublishedTime`、`Description`、`SiteName`、`CanonicalURL` 五个字段保持空值。
:::

### 输出格式

控制文本输出中图片与链接的呈现方式。详见 [输出格式实战](./output-formats)。

| 字段 | 默认值 | 可选值 |
|------|--------|--------|
| `InlineImageFormat` | `"none"` | `"none"`, `"markdown"`, `"html"`, `"placeholder"` |
| `InlineLinkFormat` | `"none"` | `"none"`, `"markdown"`, `"html"` |
| `TableFormat` | `"markdown"` | `"markdown"`, `"html"` |
| `Encoding` | `""`（自动） | `"utf-8"`, `"gbk"`, `"shift_jis"`, `"windows-1252"` 等 |

三个格式字段的取值可直接使用导出常量，避免拼写错误：`html.FormatNone`（`"none"`）、`html.FormatMarkdown`（`"markdown"`）、`html.FormatHTML`（`"html"`）、`html.FormatPlaceholder`（`"placeholder"`，仅 `InlineImageFormat` 接受）。常量值与字符串字面量等效，校验规则相同（大小写不敏感）；常量清单见 [API 参考：常量与错误](../../api-reference/types/constants#格式常量)。

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = html.FormatMarkdown
cfg.InlineLinkFormat = html.FormatHTML
```

`Encoding` 留空时走自动检测。已知编码时手动指定可跳过检测步骤，但仅在确知编码时使用——指定错误会得到乱码或 `encoding detection failed` 错误。详见 [编码检测实战](./encoding-detection)。

### 链接提取

以下字段在 `ExtractAllLinks` 与阅读模式（`ReadPage` 系列）中生效。详见 [链接提取实战](./link-extraction)。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ResolveRelativeURLs` | `true` | 将相对 URL 解析为绝对 URL |
| `BaseURL` | `""` | 解析基准；空时自动从 HTML 检测 |
| `IncludeImages` | `true` | 包含 `<img>` 链接 |
| `IncludeVideos` | `true` | 包含 `<video>` 与 `<iframe>`/`<embed>`/`<object>` 嵌入链接 |
| `IncludeAudios` | `true` | 包含 `<audio>` 链接 |
| `IncludeCSS` | `true` | 包含 `<link rel="stylesheet">` |
| `IncludeJS` | `true` | 包含 `<script src>` |
| `IncludeContentLinks` | `true` | 包含相对 href 的 `<a>` 链接 |
| `IncludeExternalLinks` | `true` | 包含绝对或协议相对的 `<a>` 链接 |
| `IncludeIcons` | `true` | 包含 favicon/icon |

:::tip 链接提取与内容提取互不影响
`Include*` 字段只作用于 `ExtractAllLinks`。内容提取（`Extract`）中的链接保留由 `PreserveLinks` 控制。
:::

### 扩展

| 字段 | 说明 |
|------|------|
| `Scorer` | 自定义内容评分器；nil 时使用内置默认评分器（内部实现） |

自定义 Scorer 可针对特定站点优化文章识别。详见 [测试与自定义扩展](../integration/testing-custom)。

## 常见配置组合

### Web 爬虫

批量抓取场景提高并发、缩短超时：

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.WorkerPoolSize = 8                   // 提高批量并发
	cfg.ProcessingTimeout = 10 * time.Second // 缩短超时
	cfg.PreserveVideos = false               // 爬虫不需要视频
	cfg.PreserveAudios = false

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// 批量提取
	pages := [][]byte{[]byte("<html><body>页面 1</body></html>")}
	batch := processor.ExtractBatch(pages)
	log.Printf("成功 %d, 失败 %d", batch.Success, batch.Failed)
}
```

### API 后端服务

处理用户提交的 HTML，用高安全配置并限制文件目录：

```go
package main

import (
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()
	cfg.AllowedBaseDir = "/var/www/uploads" // 限制文件目录

	processor, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// 处理用户上传的 HTML 文件
	result, err := processor.ExtractFromFile("/var/www/uploads/user.html")
	if err != nil {
		log.Fatal(err)
	}
	log.Println(result.Title)
}
```

### 内容迁移工具

把旧站 HTML 转为 Markdown：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	processor, err := html.New() // DefaultConfig
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	data := []byte(`<html><body><article><h1>旧文章</h1><a href="/post/123">链接</a></article></body></html>`)
	md, err := processor.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
}
```

`ExtractToMarkdown` 固定使用 markdown 格式，与 `InlineImageFormat`/`InlineLinkFormat` 无关，因此这里不需要 `MarkdownConfig()`。`BaseURL` 与 `ResolveRelativeURLs` 作用于 `ExtractAllLinks` 与阅读模式，不会改写 `Extract` 结果中的链接。

## Validate

传入 `html.New()` 的配置会自动校验，也可以先手动调用 `Validate()`：

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1 // 故意设错
if err := cfg.Validate(); err != nil {
    log.Fatal(err) // html: invalid config: MaxInputSize=-1, must be positive
}
```

校验覆盖字段范围与格式字符串。无效配置返回 `*ConfigError`，可用 `errors.Is(err, html.ErrInvalidConfig)` 判断。完整约束见 [API 参考 — 配置](../../api-reference/core/config)。

## 下一步

- [Processor 复用与缓存](../performance/processor-cache) - 高频调用的性能优化
- [安全概述](../security/) - 安全特性与生产环境实践
- [API 参考：配置](../../api-reference/core/config) - 完整字段参考与约束
