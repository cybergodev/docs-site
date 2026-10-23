---
sidebar_label: "基础用法"
title: "基础用法 - CyberGo html | 典型场景代码速查"
description: "CyberGo html 基础用法场景代码速查页：正文提取与纯文本输出、文件读取、Markdown 与 JSON 转换、链接分组、媒体信息、批量并发与超时控制六类典型场景，每类附完整可编译的最小示例与详解入口，新手可直接抄代码上手并按需深入学习。"
sidebar_position: 10
---

# 基础用法

本页是**按场景抄代码**的速查索引：每个场景只给最小可运行骨架，复制即可上手；原理讲解与进阶配置请沿各节末尾的「深入」链接阅读对应指南。

| 场景 | 核心调用 | 详解页 |
|------|----------|--------|
| 正文与纯文本 | `html.Extract` / `html.ExtractText` | [内容提取实战](../guides/core-features/content-extraction) |
| 从文件提取 | `html.ExtractFromFile` | [内容提取实战](../guides/core-features/content-extraction) |
| Markdown / JSON 输出 | `html.ExtractToMarkdown` / `html.ExtractToJSON` | [输出格式实战](../guides/core-features/output-formats) |
| 链接提取 | `html.ExtractAllLinks` + `html.GroupLinksByType` | [链接提取](../guides/core-features/link-extraction) |
| 媒体信息 | `html.Extract`（`Videos` / `Audios`） | [媒体提取](../guides/core-features/media-extraction) |
| 批量与超时复用 | `html.New` + `ExtractBatchWithContext` | [批量处理实战](../guides/performance/batch-processing) |

## 正文与纯文本

`Extract` 一次取回完整 `Result`；只要纯文本时用近亲函数 `ExtractText`，直接返回 `string`：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Go 语言教程</title></head><body><article><h1>Go 入门指南</h1><p>Go 是一门静态类型的编译语言。</p><a href="https://go.dev">Go 官网</a></article></body></html>`)

	result, err := html.Extract(data) // 传入字节，返回完整 Result
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // 输出：Go 语言教程
	fmt.Println(result.Text)
	// 输出：Go 入门指南\n\nGo 是一门静态类型的编译语言。\n\nGo 官网

	text, err := html.ExtractText(data) // 只要纯文本：直接返回 string
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(text) > 0) // 输出：true（非空）
}
```

深入：[内容提取实战](../guides/core-features/content-extraction)

## 从文件提取

处理磁盘文件用 `ExtractFromFile`，内置路径穿越防护与文件大小限制：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	result, err := html.ExtractFromFile("article.html")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // 输出：article.html 的 <title> 内容
}
```

深入：[内容提取实战](../guides/core-features/content-extraction)

## Markdown / JSON 输出

内容迁移转 Markdown，程序间传输转 JSON：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<article><h1>Go 入门指南</h1><p>Go 是一门编译语言。</p><img src="gopher.png" alt="Gopher" /><a href="https://go.dev">Go 官网</a></article>`)
	// 转 Markdown：图片与链接自动变为 ![]() 与 []() 语法
	md, err := html.ExtractToMarkdown(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(md)
	// 输出：Go 入门指南\n\nGo 是一门编译语言。\n\n![Gopher](gopher.png)\n[Go 官网](https://go.dev)
	jsonBytes, err := html.ExtractToJSON(data) // 转 JSON：保留全部元数据字段
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("JSON 字节数：", len(jsonBytes))
	// JSON 字节数随内容而定（含 text/title/images/links 等字段）
}
```

深入：[输出格式实战](../guides/core-features/output-formats)

## 链接提取

独立于正文的链接提取 API，还能按类型分组：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article><h1>链接示例</h1><p><a href="https://go.dev">Go 官网</a></p></article></body></html>`)

	links, err := html.ExtractAllLinks(data) // 覆盖 a/img/video/css/js 等资源
	if err != nil {
		log.Fatal(err)
	}
	for _, link := range links {
		fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
	}
	// 输出：[link] Go 官网 - https://go.dev
	groups := html.GroupLinksByType(links) // 按类型分组
	fmt.Println("link 组：", len(groups["link"]))
	// 输出：link 组：1
}
```

深入：[链接提取](../guides/core-features/link-extraction)

## 媒体信息

视频与音频信息随 `Extract` 一并返回，无需单独调用：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article><h1>多媒体页面</h1>
<video poster="cover.jpg"><source src="https://example.com/video.mp4" type="video/mp4"></video>
<audio><source src="https://example.com/audio.mp3" type="audio/mpeg"></audio>
</article></body></html>`)
	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	for _, v := range result.Videos {
		fmt.Printf("视频：%s（%s）\n", v.URL, v.Type)
	}
	for _, a := range result.Audios {
		fmt.Printf("音频：%s（%s）\n", a.URL, a.Type)
	}
	// 输出：
	// 视频：https://example.com/video.mp4（video/mp4）
	// 音频：https://example.com/audio.mp3（audio/mpeg）
}
```

深入：[媒体提取](../guides/core-features/media-extraction)

## 批量、超时与 Processor 复用

服务端典型姿势：创建可全局复用的 `Processor`，批量并发提取，并用 context 控制单批时间：

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	p, err := html.New(html.DefaultConfig()) // 并发安全，可全局复用
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()
	pages := [][]byte{
		[]byte(`<html><body><article><h1>页面一</h1></article></body></html>`),
		[]byte(`<html><body><article><h1>页面二</h1></article></body></html>`),
	}
	batch := p.ExtractBatchWithContext(ctx, pages) // context 到期的未完成项计入 Cancelled
	fmt.Printf("成功：%d，失败：%d\n", batch.Success, batch.Failed)
	// 输出：成功：2，失败：0
}
```

深入：[批量处理实战](../guides/performance/batch-processing) 与 [Processor 复用与缓存](../guides/performance/processor-cache)
