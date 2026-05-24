---
title: "内容提取实战 - HTML"
description: "CyberGo HTML 内容提取实战指南，详解提取流程概览、文章智能识别算法原理、基础文本提取与文件提取、Result 结构字段完整解读、自定义 Scorer 评分器实现方法，以及非 UTF-8 编码自动检测与手动指定的最佳实践处理策略，帮助掌握内容提取的核心用法。"
---

# 内容提取实战

本指南通过实际场景，帮助你理解 HTML 内容提取的工作原理和最佳实践。

## 提取流程概览

当你调用 `Extract` 时，库会执行以下步骤：

```text
HTML 输入 → 编码检测(自动转 UTF-8) → 安全清洗 → DOM 解析 → 深度验证
    → 文章识别(可选) → 内容提取 → 格式化 → 返回 Result
```

每一步都可以通过 [配置](../api-reference/config) 进行定制。

## 基础文本提取

最简单的用法是从 HTML 字节中提取内容：

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
                <p>Go 是一门静态类型的编译语言，内置并发支持。</p>
                <p>它编译速度快，部署简单，适合构建高性能服务。</p>
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
    // 标题: Go 语言教程

    fmt.Println("正文:", result.Text)
    // 正文: Go 入门指南
    //       Go 是一门静态类型的编译语言，内置并发支持。
    //       它编译速度快，部署简单，适合构建高性能服务。
    //       Go 官网

    fmt.Println("字数:", result.WordCount)
    // 字数: 7

    fmt.Println("阅读时间:", result.ReadingTime)
    // 阅读时间: 2.1s（按 200 词/分钟计算）

    fmt.Println("图片:", len(result.Images))
    // 图片: 1

    fmt.Println("链接:", len(result.Links))
    // 链接: 1
}
```

## 理解提取结果

`Result` 包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Title` | `string` | 页面标题，优先 `<title>`，其次 `<h1>`、`<h2>` |
| `Text` | `string` | 正文内容（已清洗，去除标签和冗余空白） |
| `Images` | `[]ImageInfo` | 提取的图片列表 |
| `Links` | `[]LinkInfo` | 提取的链接列表 |
| `Videos` | `[]VideoInfo` | 提取的视频列表 |
| `Audios` | `[]AudioInfo` | 提取的音频列表 |
| `WordCount` | `int` | 正文字数 |
| `ReadingTime` | `time.Duration` | 预估阅读时间（200 词/分钟） |
| `ProcessingTime` | `time.Duration` | 处理耗时 |

## 从文件提取

处理本地 HTML 文件时，使用 `ExtractFromFile`：

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("标题:", result.Title)
```

文件操作内置了安全检查：
- 自动检测路径穿越攻击（如 `../../../etc/passwd`）
- 文件大小受 `MaxInputSize` 限制
- 错误信息通过 `SafePath()` 隐藏完整路径

## 文章识别算法

当 `ExtractArticle` 为 `true`（默认）时，库会自动识别页面中的"主内容区域"。

### 工作原理

1. **候选节点评分**：遍历 DOM 树，对每个元素节点进行内容相关性打分
2. **选择最佳候选**：选取得分最高的节点作为文章容器
3. **回退机制**：如果没有找到合适的候选，回退到 `<body>` 节点

:::tip 适用场景
文章识别最适合新闻、博客、文档等有明确"正文区域"的页面。对于导航页、列表页，可能无法准确定位正文。
:::

### 自定义评分

通过实现 `Scorer` 接口自定义评分逻辑：

```go
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    // 根据节点特征返回评分
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    // 返回 true 表示移除该节点
    return node.Data() == "nav" || node.Data() == "footer"
}
```

:::tip 注意
此示例中的 `strings.Contains` 来自标准库 `strings` 包。完整可运行示例请参考 [测试与自定义扩展](./testing-custom)。
:::

## 仅提取文本

当你只需要纯文本，不需要图片、链接等元数据时：

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

这在文本分析、搜索索引构建等场景中非常实用。

## 处理非 UTF-8 编码

库自动检测 15+ 种字符编码（包括 UTF-8、GBK、Shift_JIS、Windows-1252 等），并自动转换为 UTF-8。

```go
// 自动检测编码
result, err := html.Extract(gbkEncodedData)

// 手动指定编码
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

## 上下文与超时

对于大文件或不可信来源的 HTML，建议使用带上下文的版本：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, html.ErrProcessingTimeout) {
    log.Println("处理超时")
}
```

## 下一步

- [输出格式选择](../guides/output-formats) - 选择适合场景的输出格式
- [Processor 复用与缓存](../guides/processor-cache) - 高频调用的性能优化
- [API 参考：包函数](../api-reference/functions) - 完整函数签名
