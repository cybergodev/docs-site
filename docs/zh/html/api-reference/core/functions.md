---
sidebar_label: "包函数"
title: "包函数 - CyberGo html | 签名、参数与示例"
description: "CyberGo html 包级函数参考：Extract、ExtractText、ExtractToMarkdown、ExtractBatch 与 ReadPage 阅读模式系列的签名与错误返回；说明 sync.Pool 池化复用、传入自定义 Config 时改为一次性实例的行为差异。"
sidebar_position: 10
---

# 包函数

包级函数是 `github.com/cybergodev/html` 提供的一次性调用入口：内部通过 `sync.Pool` 复用 `Processor`，你无需管理生命周期。池化实例禁用缓存，归还时重置统计并清空审计日志；需要缓存、统计或审计时，用 [html.New](./processor) 创建独立的 `Processor`。

## 内部机制

:::info 两条结论
- **池化实例没有缓存。** 包函数内部通过 `sync.Pool` 复用 `Processor`，池中实例以 `DefaultConfig()` 为基础但关闭缓存（`MaxCacheEntries`、`CacheTTL`、`CacheCleanup` 置零），归还时重置统计与审计状态。因此包函数调用不会跨调用复用结果。
- **传入自定义 `Config` 时改用一次性实例。** 池中实例的配置固定，无法安全复用不同配置，因此每次调用都会新建一个 `Processor` 并在返回前 `Close`，其缓存字段同样置零。

需要缓存、累积统计或审计日志时，用 [html.New](./processor) 创建长生命周期的 `Processor`。
:::

## 配置参数解析

除工具函数 `GroupLinksByType` 外，包函数的 `cfg ...Config` 是可选变长参数，由内部 `resolveConfig` 解析：

| 传入参数 | 行为 | 是否走池化 |
|----------|------|:----------:|
| 不传 | 使用 `DefaultConfig()` | 是（`pooled=true`） |
| 传 1 个 | 使用该 `Config`，创建一次性 Processor | **否**（`pooled=false`） |
| 传 ≥2 个 | 返回 `ErrMultipleConfigs` | — |

:::warning 需要缓存或累计统计时改用 Processor
包函数无论走池化还是一次性实例，都没有缓存、也不保留跨调用的统计与审计。需要在循环、HTTP handler 或批处理中复用自定义配置并让缓存产生收益时，直接创建 [Processor](./processor)。
:::

## 构造函数

### New

创建独立的 `Processor` 实例。缓存、累计统计与审计日志都只在实例上保留，可随时查询。

```go
func New(cfg ...Config) (*Processor, error)
```

`cfg ...Config` 遵循上表的解析规则（不传用 `DefaultConfig()`，传 ≥2 个返回 `ErrMultipleConfigs`），随后执行 `Config.Validate()`。与包函数的池化实例、一次性实例不同，`New` 返回的实例长期持有缓存与累计统计。方法列表与生命周期见 [Processor](./processor)。

## 内容提取

### Extract

从 HTML 字节中提取内容，返回完整的 `Result`。

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `htmlBytes` | `[]byte` | HTML 内容 |
| `cfg` | `...Config` | 可选配置，最多一个 |

**示例**：

```go
result, err := html.Extract(data)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

完整示例（字段访问与错误处理）：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>示例页面</title></head>
<body><h1>欢迎</h1><p>正文内容<a href="https://example.com">链接</a>。</p></body></html>`)

	// 不传 Config，走池化路径
	result, err := html.Extract(data)
	if err != nil {
		log.Fatalf("提取失败：%v", err)
	}

	fmt.Println("标题：", result.Title)
	fmt.Println("字数：", result.WordCount)
	fmt.Println("链接数：", len(result.Links))
	// 输出：
	// 标题：示例页面
	// 字数：9
	// 链接数：1
}
```

**错误返回**：`Extract` 返回与 [Processor.Extract](./processor#错误返回) 相同的错误，另有两种包函数特有的错误：

| 错误 | 条件 |
|------|------|
| `ErrMultipleConfigs` | 传入 2 个及以上 `Config` |
| `ErrInvalidConfig`（包裹在 `*ConfigError`） | 传入的 `Config` 校验失败（如 `MaxInputSize<=0`） |

### ExtractFromFile

从 HTML 文件提取内容。

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

**错误返回**：除 `Extract` 的错误外，文件访问可能返回 `*FileError`：`FileErr` 包裹 `ErrFileNotFound`（文件不存在）或 `ErrInvalidFilePath`（空路径；含 `..` 上跳组件的路径遍历拒绝同样包裹后者，`errors.Is` 可命中）。配置 `AllowedBaseDir` 后路径越界时 `FileErr` 为 `path outside allowed directory`，不匹配任何哨兵错误（见[安全防护](../modules/security)）。文件超过 `MaxInputSize` 时在读取前即被拒绝，返回包裹 `ErrInputTooLarge` 的 `*InputError`。

## 文本提取

### ExtractText

仅提取纯文本。

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

`ExtractTextFromFile` 是 `ExtractText` 的文件版本，从磁盘上的 HTML 文件提取纯文本；文件访问错误与 [`ExtractFromFile`](#extractfromfile) 相同。

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

```go
text, err := html.ExtractTextFromFile("page.html")
if err != nil {
	log.Fatal(err)
}
```

## 上下文版本

提取、输出、链接与批量函数都有带 `context.Context` 的版本，用于取消与超时控制；`New` 与 `GroupLinksByType` 没有对应变体。

| 函数 | 签名 |
|------|------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 输出格式

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | 文件 → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | 带上下文 |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | 文件 + 上下文 |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | 文件 → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | 带上下文 |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | 文件 + 上下文 |

用法与示例见 [输出格式](../modules/output)。

## 链接提取

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 提取所有链接 |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | 从文件提取链接 |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | 带上下文 |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | 文件 + 上下文 |

配套的分组工具函数：

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

按 `LinkResource.Type`（`link`/`image`/`css` 等）把链接资源分组为 `map[类型][]LinkResource`。

用法与示例见 [链接提取](../modules/links)。

## 批量处理

| 函数 | 签名 | 说明 |
|------|------|------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | 批量提取 |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | 带上下文 |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | 批量文件提取 |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | 文件 + 上下文 |

用法与示例见 [批量处理](../modules/batch)。

## 阅读模式

阅读模式返回整页分区视图（`*ReadResult`），而不是只选出一篇文章：链接始终保留，导航与页脚按类别标注。共 12 个包函数，签名、`ReadResult`/`PageSection`/`SectionKind` 结构与关键语义见 [阅读模式](./reader)。

| 函数 | 说明 |
|------|------|
| `ReadPage` | 整页分区 |
| `ReadPageWithContext` | 带上下文 |
| `ReadPageFromFile` | 从文件读取 |
| `ReadPageFromFileWithContext` | 文件 + 上下文 |
| `ReadPageToMarkdown` | 整页 Markdown（带链接） |
| `ReadPageToMarkdownWithContext` | 带上下文 |
| `ReadPageToMarkdownText` | 整页 Markdown（无链接） |
| `ReadPageToMarkdownTextWithContext` | 带上下文 |
| `ReadPageFromFileToMarkdown` | 文件 → Markdown（带链接） |
| `ReadPageFromFileToMarkdownWithContext` | 文件 + 上下文 |
| `ReadPageFromFileToMarkdownText` | 文件 → Markdown（无链接） |
| `ReadPageFromFileToMarkdownTextWithContext` | 文件 + 上下文 |

`ReadPage*` **不参与提取缓存**；`ReadPage*ToMarkdown*` 内部使用临时 Processor，不污染主缓存。详见 [阅读模式](./reader)。

## 包函数 vs Processor

两者底层都调用 `Processor`，差异在资源复用与状态保留：

| 维度 | 包函数 | [Processor](./processor) |
|------|--------|--------------------------|
| 缓存 | **无**（池化配置 `MaxCacheEntries=0`） | 有（命中返回深拷贝） |
| 统计 | 不跨调用保留（池化归还时 `ResetStatistics`；自定义 `Config` 路径实例即弃） | 累积，可随时 `GetStatistics` |
| 审计日志 | 不跨调用保留（池化归还时 `ClearAuditLog`；自定义 `Config` 路径实例即弃） | 累积，可 `GetAuditLog` 查询 |
| 自定义 `Config` | 每次创建并销毁一次性 Processor（缓存字段置零） | 复用同一实例 |
| 生命周期 | 自动管理（池或一次性实例） | 需手动 `defer Close()` |
| 适用场景 | 一次性调用、脚本、低频请求 | 高频调用、长驻服务、需缓存 |

:::tip 何时改用 Processor
单次或偶发调用用包函数即可。在循环、HTTP handler 或批处理中反复提取时，创建一个长生命周期的 `Processor` 并复用；此时缓存才会产生收益。
:::
