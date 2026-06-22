---
title: "快速开始 - CyberGo HTML | 5分钟上手指南"
description: "CyberGo HTML 快速入门：安装、基本内容提取、四种 Config 预设、文本/Markdown/JSON 输出、上下文超时与并发安全模式，5 分钟上手 HTML 提取。"
---

# 快速开始

## 安装

```bash
go get github.com/cybergodev/html
```

要求 Go 1.25+。

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

    fmt.Println("标题:", result.Title)
    fmt.Println("正文:", result.Text)
    fmt.Println("图片数:", len(result.Images))
    fmt.Println("链接数:", len(result.Links))
    fmt.Println("字数:", result.WordCount)
}
```

输出：

```text
标题: Go 语言教程
正文: Go 入门指南

Go 是一门静态类型的编译语言。

Go 官网
图片数: 1
链接数: 1
字数: 6
```

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
| 文本 | `TextOnlyConfig()` | 仅提取纯文本，禁用媒体 |
| Markdown | `MarkdownConfig()` | 优化 Markdown 输出 |
| 高安全 | `HighSecurityConfig()` | 严格限制，完整审计 |

## 输出格式

```go
// 纯文本
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

## 上下文支持

所有函数都有带 `WithContext` 的版本，支持取消和超时：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 关键说明

### 并发安全

`Processor` 实例是并发安全的，可以在多个 goroutine 中共享使用：

```go
p, _ := html.New(html.DefaultConfig())
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

包级函数同样是并发安全的（内部使用 Processor 池）。

### 编码检测

库自动检测 HTML 编码，无需手动处理：

```go
// GBK 编码的 HTML，自动检测并正确提取
result, err := html.Extract(gbkData)

// 也可通过 Config.Encoding 手动指定
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

支持 UTF-8、GBK、Shift_JIS、EUC-JP、Windows-1252 等 15+ 编码。

## 下一步

- [内容提取实战](./guides/content-extraction) - 深入理解提取流程和文章识别
- [输出格式选择](./guides/output-formats) - 选择适合场景的输出格式
- [Processor 复用与缓存](./guides/processor-cache) - 高频调用的性能优化
- [速查表](./cheatsheet) - 常用 API 速查
