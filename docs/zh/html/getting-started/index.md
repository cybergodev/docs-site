---
sidebar_label: "快速开始"
title: "快速开始 - CyberGo html | 5 分钟入门指南"
description: "CyberGo html 快速入门：安装、从字节与文件提取内容、四种 Config 预设的选择、30+ 编码检测的边界、阅读模式与 Markdown/JSON 输出，以及 WithContext 超时控制与 Processor 并发安全调用实践。"
sidebar_position: 10
---

# 快速开始

安装库、完成第一次提取，再按场景选择配置预设与输出格式。

## 安装

```bash
go get github.com/cybergodev/html
```

要求 Go 1.26+。

## 基本提取

从 HTML 字节中提取内容：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html>
        <head><title>Go 语言教程</title></head>
        <body>
            <article>
                <h1>Go 入门指南</h1>
                <p>Go 是一门静态类型的编译语言。</p>
                <img src="gopher.png" alt="Gopher" />
                <a href="https://go.dev">Go 官网</a>
            </article>
        </body>
    </html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	fmt.Println("正文：", result.Text)
	fmt.Println("图片数：", len(result.Images))
	fmt.Println("链接数：", len(result.Links))
	fmt.Println("字数：", result.WordCount)
}
```

输出：

```text
标题：Go 语言教程
正文：# Go 入门指南

Go 是一门静态类型的编译语言。

Go 官网
图片数：1
链接数：1
字数：22
```

`WordCount` 按空白分词，CJK 字符每个另计 1 词。`ReadingTime` 按脚本分别折算：空格分词的语言按 200 词/分钟，CJK 字符按 350 字/分钟。标题标签以 Markdown ATX 标记（`# ` 至 `###### `）写入 `Text`；ATX 标记本身不计入字数，标题文本仍按词计入。

## 从文件提取

```go
result, err := html.ExtractFromFile("page.html")
if err != nil {
    log.Fatal(err)
}
```

## 使用配置

通过 `Config` 自定义提取行为：

```go
cfg := html.MarkdownConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

result, err := p.Extract(data)
```

### 预设配置

| 预设 | 函数 | 说明 |
|------|------|------|
| 默认 | `DefaultConfig()` | 均衡配置，适合通用场景 |
| 文本 | `TextOnlyConfig()` | 图片、链接、视频、音频均不保留；`ExtractAllLinks` 的 `Include*` 开关不受影响 |
| Markdown | `MarkdownConfig()` | 将 `InlineImageFormat` 与 `InlineLinkFormat` 设为 `markdown`；`ExtractToMarkdown` 固定输出 Markdown，无需该预设 |
| 高安全 | `HighSecurityConfig()` | 收紧输入大小、深度与超时限制，并启用完整审计 |

## 输出格式

```go
// 纯文本
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

`ExtractText` 内部先调用 `Extract` 再取 `.Text`，处理路径与 `Extract` 相同。

## 上下文支持

提取类函数都有带 `*WithContext` 后缀的变体（如 `ExtractWithContext`、`ExtractTextWithContext`），支持取消和超时：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

库内 `ProcessingTimeout` 到期返回 `ErrProcessingTimeout`；调用方 ctx 到期则原样返回 `context.DeadlineExceeded`。两者的完整对照见[常见问题](../faq/#processingtimeout-和用户-context-超时有什么区别)。

## 使用要点

### 并发安全

`Processor` 实例是并发安全的，可以在多个 goroutine 中共享：

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// 多个 goroutine 安全调用
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        result, err := p.Extract(fetchHTML(u))
        // ...
    }(url)
}
wg.Wait()
```

包级函数同样并发安全：内部从 Processor 池取用实例，池化实例禁用缓存，归还时重置统计并清空审计日志，因此没有缓存收益。需要缓存请用 `html.New(cfg)` 创建常驻 Processor。

### 编码检测

库按 BOM、`<meta charset>` 声明与字节统计判断编码：

```go
// 声明了编码或字节可判定时，自动检测即可
result, err := html.Extract(pageData)

// 已知来源编码时显式指定，最可靠
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

支持 UTF-8、GBK、Shift_JIS、EUC-JP、Windows-1252 等 30+ 编码。没有 `<meta charset>` 的 GBK 或 Shift_JIS 页面会被当作 windows-1252 解码成乱码，且不返回错误。

生产环境应显式设置 `Config.Encoding`，详见[编码检测](../guides/core-features/encoding-detection)。

## 下一步

- [内容提取](../guides/core-features/content-extraction) - 提取流程与文章识别
- [阅读模式](../guides/core-features/reader-mode) - 整页分区输出，适合喂给 LLM
- [输出格式](../guides/core-features/output-formats) - 选择适合场景的输出格式
- [Processor 复用与缓存](../guides/performance/processor-cache) - 高频调用的性能优化
- [速查表](./cheatsheet) - 常用 API 速查
