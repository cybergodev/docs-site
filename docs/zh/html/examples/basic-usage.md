---
title: "基础用法 - HTML"
description: "CyberGo HTML 库基础用法示例集合，展示基本内容提取、从文件提取、纯文本提取、Markdown 格式输出、链接提取与分组、Processor 实例复用、带超时控制的上下文提取、并发批量处理和 JSON 序列化输出等多种常见开发场景，所有示例均可直接复制运行。"
---

# 基础用法

## 基本提取

从 HTML 字节中提取标题、正文和媒体信息：

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
                <p>Go 是一门由 Google 开发的开源编程语言。</p>
                <img src="gopher.png" alt="Gopher 吉祥物" />
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
    fmt.Println("字数:", result.WordCount)
    fmt.Println("阅读时间:", result.ReadingTime)
    // 输出:
    // 标题: Go 语言教程
    // 正文: Go 入门指南
    //
    //       Go 是一门由 Google 开发的开源编程语言。
    //
    //       Go 官网
    // 字数: 8
    // 阅读时间: 2.4s
}
```

## 从文件提取

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title)
```

## 仅提取文本

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

## Markdown 输出

```go
md, err := html.ExtractToMarkdown(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## 提取链接

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}

// 按类型分组
groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("%s: %d 个\n", typ, len(items))
}
```

## 使用 Processor

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// 复用 Processor 处理多个页面
for _, page := range pages {
    result, err := p.Extract(page)
    if err != nil {
        log.Printf("处理失败: %v", err)
        continue
    }
    fmt.Println(result.Title)
}

// 查看统计
stats := p.GetStatistics()
fmt.Printf("已处理: %d, 缓存命中: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

## 带超时控制

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    log.Fatal(err)
}
```

## 批量处理

```go
pages := [][]byte{page1, page2, page3}

p, _ := html.New(html.DefaultConfig())
defer p.Close()

batch := p.ExtractBatch(pages)
fmt.Printf("成功: %d, 失败: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    if result != nil {
        fmt.Printf("页面 %d: %s\n", i, result.Title)
    }
}
```

## JSON 输出

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```
