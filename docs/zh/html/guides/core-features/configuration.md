---
sidebar_label: "配置实战"
title: "配置实战 - CyberGo html | Config 字段选择指南"
description: "CyberGo html 配置实战指南：DefaultConfig、HighSecurityConfig、TextOnlyConfig、MarkdownConfig 四种预设选择建议、六大类字段导览、常见配置组合与 Validate 验证，助新手快速选型。"
sidebar_position: 6
---

# 配置实战

`Config` 结构体有 30+ 个字段，但日常使用只需理解几组关键配置。本指南帮助你快速选择适合场景的配置方案，完整字段说明详见 [API 参考 — 配置](../../api-reference/core/config)。

## 四种预设配置

库提供四种预设，覆盖大多数场景：

| 预设 | 适用场景 | 关键差异 |
|------|----------|----------|
| `DefaultConfig()` | 通用提取 | 全功能开启，安全默认值 |
| `HighSecurityConfig()` | 不受信任输入 | 缩小限制、启用审计、降低深度上限 |
| `TextOnlyConfig()` | 仅需纯文本 | 关闭所有媒体保留，最大性能 |
| `MarkdownConfig()` | 输出 Markdown | 内联图片/链接转 Markdown 格式 |

```go
package main

import (
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><h1>标题</h1><p>正文内容</p></body></html>`)

	// 大多数场景：直接用默认配置
	p1, _ := html.New()
	defer p1.Close()
	r1, _ := p1.Extract(data)
	fmt.Println(r1.Title)

	// 只需要纯文本（如搜索引擎索引）
	p2, _ := html.New(html.TextOnlyConfig())
	defer p2.Close()

	// 输出 Markdown（如 CMS 迁移）
	p3, _ := html.New(html.MarkdownConfig())
	defer p3.Close()
	md, _ := p3.ExtractToMarkdown(data)
	fmt.Println(md)
}
```

:::tip 从预设开始
不确定时，从 `DefaultConfig()` 开始，按需调整个别字段。预设之间可以组合——先取一个预设，再覆盖字段：
:::

<!-- check-code: skip -->
```go
cfg := html.HighSecurityConfig()
cfg.PreserveImages = false // 在高安全基础上额外关闭图片
processor, _ := html.New(cfg)
```

## 六大类字段导览

### 资源管理

控制内存使用和性能。日常开发通常不需要调整。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `MaxInputSize` | 50 MB | 最大输入大小，防止内存耗尽 |
| `MaxCacheEntries` | 2000 | 缓存条目数上限；设 0 禁用缓存 |
| `CacheTTL` | 1 小时 | 缓存存活时间 |
| `CacheCleanup` | 5 分钟 | 后台清理过期缓存间隔 |
| `WorkerPoolSize` | 4 | 批量处理并发数（1–256） |
| `ProcessingTimeout` | 30 秒 | 单文档处理超时；设 0 不限时 |

:::warning 缓存仅对 Processor 实例生效
包级函数（如 `html.Extract`）使用池化 Processor，每次调用后清空缓存。需要缓存请用 `html.New()` 创建独立 Processor。详见 [Processor 复用与缓存](../performance/processor-cache)。
:::

### 安全

安全配置是生产环境必须关注的重点。完整安全特性介绍详见 [安全概述](../security/)。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `EnableSanitization` | `true` | HTML 消毒（移除危险标签/属性） |
| `MaxDepth` | 500 | DOM 嵌套深度上限，防止栈溢出 |
| `AllowedBaseDir` | `""` | 文件操作沙箱目录；空 = 不限制 |
| `Audit` | 禁用 | 安全审计日志配置 |

:::warning AllowedBaseDir
处理用户提供文件路径时，务必设置 `AllowedBaseDir`。它通过 OS 文件句柄解析真实路径（防符号链接和 Windows junction 绕过）。
:::

### 内容提取

控制从 HTML 中提取哪些内容。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ExtractArticle` | `true` | 智能文章识别（自动定位主体内容） |
| `PreserveImages` | `true` | 保留图片信息 |
| `PreserveLinks` | `true` | 保留链接信息 |
| `PreserveVideos` | `true` | 提取视频 |
| `PreserveAudios` | `true` | 提取音频 |

关闭不需要的媒体类型可提升性能：

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
// 只提取文本、图片和链接
```

### 输出格式

控制文本输出中图片和链接的呈现方式。详见 [输出格式实战](./output-formats)。

| 字段 | 默认值 | 可选值 |
|------|--------|--------|
| `InlineImageFormat` | `"none"` | `"none"`, `"markdown"`, `"html"`, `"placeholder"` |
| `InlineLinkFormat` | `"none"` | `"none"`, `"markdown"`, `"html"` |
| `TableFormat` | `"markdown"` | `"markdown"`, `"html"` |
| `Encoding` | `""`（自动） | `"utf-8"`, `"gbk"`, `"shift_jis"`, `"windows-1252"` 等 |

`Encoding` 留空时自动检测。手动指定可跳过检测步骤提升性能，但仅在确知编码时使用。详见 [编码检测实战](./encoding-detection)。

### 链接提取

以下字段仅在 `ExtractAllLinks` 中生效，控制提取哪些类型的资源链接。详见 [链接提取实战](./link-extraction)。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `ResolveRelativeURLs` | `true` | 将相对 URL 解析为绝对 URL |
| `BaseURL` | `""` | 解析基准；空时自动从 HTML 检测 |
| `IncludeImages` | `true` | 包含 `<img>` 链接 |
| `IncludeVideos` | `true` | 包含 `<video>`/`<iframe>` 链接 |
| `IncludeAudios` | `true` | 包含 `<audio>` 链接 |
| `IncludeCSS` | `true` | 包含 `<link rel="stylesheet">` |
| `IncludeJS` | `true` | 包含 `<script src>` |
| `IncludeContentLinks` | `true` | 包含 `<a href>` 内部链接 |
| `IncludeExternalLinks` | `true` | 包含外部链接 |
| `IncludeIcons` | `true` | 包含 favicon/icon |

:::tip 链接提取 vs 内容提取
`Include*` 字段仅影响 `ExtractAllLinks`。内容提取（`Extract`）中的链接保留由 `PreserveLinks` 控制。
:::

### 扩展

| 字段 | 说明 |
|------|------|
| `Scorer` | 自定义内容评分器；nil 时使用内置默认评分器（内部实现） |

自定义 Scorer 可针对特定网站优化文章识别。详见 [测试与自定义扩展](../integration/testing-custom)。

## 常见配置组合

### Web 爬虫

高频批量抓取场景，提高并发并缩短超时：

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
	pages := [][]byte{[]byte("<html><body>页面1</body></html>")}
	batch := processor.ExtractBatch(pages)
	log.Printf("成功 %d, 失败 %d", batch.Success, batch.Failed)
}
```

### API 后端服务

处理用户提交 HTML，使用高安全配置并限制文件目录：

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

将旧站 HTML 转为 Markdown，保留链接并解析相对 URL：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.MarkdownConfig()
	cfg.ResolveRelativeURLs = true
	cfg.BaseURL = "https://old-site.example.com"

	processor, err := html.New(cfg)
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

## Validate

所有配置在传入 `html.New()` 时自动验证。也可手动调用 `Validate()` 提前检查：

<!-- check-code: skip -->
```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1 // 故意设错
if err := cfg.Validate(); err != nil {
    log.Fatal(err) // html: invalid config: MaxInputSize=-1, must be positive
}
```

验证规则包括字段范围检查和格式字符串校验。无效配置返回 `*ConfigError`，可用 `errors.Is(err, html.ErrInvalidConfig)` 判断。完整字段约束详见 [API 参考 — 配置](../../api-reference/core/config)。
