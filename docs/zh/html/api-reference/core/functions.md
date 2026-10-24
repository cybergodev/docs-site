---
sidebar_label: "包函数"
title: "包函数 - CyberGo html | 签名、参数与示例"
description: "CyberGo html 包级函数参考：Extract、ExtractText、ExtractToMarkdown 与 ExtractBatch 等函数的签名、参数、示例与错误返回；说明 sync.Pool 池化复用机制，以及传入自定义 Config 时改为一次性实例的行为差异。"
sidebar_position: 10
---

# 包函数

包级函数是 `github.com/cybergodev/html` 提供的一次性调用入口：内部通过 `sync.Pool` 复用 `Processor`，你无需管理生命周期。池化实例禁用缓存，归还时重置统计并清空审计日志；需要缓存、统计或审计时，用 [html.New](./processor) 创建独立的 `Processor`。

## 内部机制

:::info 包函数底层的池化设计
包函数维护一个 `sync.Pool`，在调用之间复用 `Processor` 实例，避免重复分配。实现上有四点：

- **池化配置禁用缓存**：池用配置（`poolCfg`）以 `DefaultConfig()` 为基础，但显式置零 `MaxCacheEntries`、`CacheTTL`、`CacheCleanup`。池化实例每次归还都会调用 `ClearCache()`，缓存本就为空；若开启缓存，只会付出哈希与 map 写入开销（`Get` 始终 miss），并额外启动一个清扫空缓存的 goroutine。
- **归还时重置状态**：归还前依次执行 `ResetStatistics`、`audit.Wait()`、`ClearAuditLog`、`ClearCache`，避免统计、审计与缓存状态跨调用泄漏。
- **已关闭的实例不归还**：使用过程中被关闭的 `Processor`（属于误用）会被丢弃，不放回池中；`sync.Pool` 允许缺少 `Put`，下次 `Get` 时由 `pool.New` 重建。
- **panic 兜底**：`pool.New` 仅在库不变量被破坏时 panic（`poolCfg` 由 `DefaultConfig()` 派生，构造即合法）。该 panic 由 `getPooledProcessorSafe` 捕获并包装为 `ErrInternalPanic` 返回，不会逃逸到公开 API。
:::

## 配置参数解析

所有包函数的 `cfg ...Config` 是可选变长参数，由内部 `resolveConfig` 解析：

| 传入参数 | 行为 | 是否走池化 |
|----------|------|:----------:|
| 不传 | 使用 `DefaultConfig()` | 是（`pooled=true`） |
| 传 1 个 | 使用该 `Config`，创建一次性 Processor | **否**（`pooled=false`） |
| 传 ≥2 个 | 返回 `ErrMultipleConfigs` | — |

:::warning 传入自定义 Config 时不走池化
池中只存放基于 `DefaultConfig()` 的实例，无法安全复用配置不同的实例。传入自定义 `Config` 时，每次调用都会 `New` 一个一次性 Processor，用完即 `Close`；同时 `MaxCacheEntries`、`CacheTTL`、`CacheCleanup` 被强制置零，因此该实例同样没有缓存。需要在高频调用中复用自定义配置时，直接创建 [Processor](./processor)。
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

**错误返回**：除 `Extract` 的错误外，文件访问还可能返回 `*FileError`，包裹 `ErrFileNotFound`、`ErrInvalidFilePath` 或路径遍历拒绝（见 [安全防护](../modules/security) 的 `AllowedBaseDir`）。

## 文本提取

### ExtractText

仅提取纯文本。

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

`ExtractText` 的文件版本，从磁盘上的 HTML 文件提取纯文本；文件访问错误同样包裹为 `*FileError`（`ErrFileNotFound`、`ErrInvalidFilePath` 或路径遍历拒绝）。

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
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

## 包函数 vs Processor

两者底层都调用 `Processor`，差异在资源复用与状态保留：

| 维度 | 包函数 | [Processor](./processor) |
|------|--------|--------------------------|
| 缓存 | **无**（池化配置 `MaxCacheEntries=0`） | 有（命中返回深拷贝） |
| 统计 | 每次重置（归还时 `ResetStatistics`） | 累积，可随时 `GetStatistics` |
| 审计日志 | 每次清空（归还时 `ClearAuditLog`） | 累积，可 `GetAuditLog` 查询 |
| 自定义 `Config` | 每次创建并销毁一次性 Processor（缓存字段置零） | 复用同一实例 |
| 生命周期 | 自动管理（池或一次性实例） | 需手动 `defer Close()` |
| 适用场景 | 一次性调用、脚本、低频请求 | 高频调用、长驻服务、需缓存 |

:::tip 何时改用 Processor
单次或偶发调用用包函数即可。在循环、HTTP handler 或批处理中反复提取时，创建一个长生命周期的 `Processor` 并复用；此时缓存才会产生收益。
:::
