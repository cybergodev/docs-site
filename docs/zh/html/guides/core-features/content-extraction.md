---
sidebar_label: "内容提取实战"
title: "内容提取实战 - CyberGo html | 提取流程指南"
description: "CyberGo html 内容提取实战指南：详解完整提取流程（输入校验、编码检测、DOM 解析、安全清洗、文章智能识别与格式化）、候选节点评分算法原理、Result 结构体各字段含义、自定义 Scorer 评分器与编码自动检测机制及最佳实践。"
sidebar_position: 10
---

# 内容提取实战

本指南通过实际场景，帮助你理解 HTML 内容提取的工作原理和最佳实践。

## 提取流程概览

当你调用 `Extract` 时，库会执行以下步骤：

```text
HTML 输入 → 输入校验 → 编码检测 (自动转 UTF-8) → DOM 解析 → 深度验证
    → 安全清洗 (可选) → 文章识别 (可选) → 内容提取 → 格式化 → 返回 Result
```

深度验证在清洗**之前**执行：先以迭代方式校验 DOM 深度（避免递归遍历导致栈溢出），再对已解析的 DOM 树进行安全清洗。两者均针对解析后的节点树，因此 DOM 解析始终先于二者。

每一步都可以通过 [配置](../../api-reference/core/config) 进行定制。

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

	fmt.Println("标题：", result.Title)
	// 标题：Go 语言教程

	fmt.Println("正文：", result.Text)
	// 正文：Go 入门指南
	//       Go 是一门静态类型的编译语言，内置并发支持。
	//       它编译速度快，部署简单，适合构建高性能服务。
	//       Go 官网

	fmt.Println("字数：", result.WordCount)
	// 字数：51

	fmt.Println("阅读时间：", result.ReadingTime)
	// 阅读时间：15.3s（按 200 词/分钟计算）

	fmt.Println("图片：", len(result.Images))
	// 图片：1

	fmt.Println("链接：", len(result.Links))
	// 链接：1
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
fmt.Println("标题：", result.Title)
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

### 默认评分器的信号维度

内置默认评分器（内部实现，不导出）基于多维信号综合打分，选取得分最高的容器：

| 维度 | 正面信号 | 负面信号 |
|------|----------|----------|
| **标签语义** | `<article>`(+1000)、`<main>`(+900)、`<section>`(+300)、`<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style` 直接返回 0 |
| **class/id 模式** | `content`/`article`/`post`/`main`/`entry`/`story` 等（强正面）；`blog`/`news`/`detail`/`page` 等（中等正面） | `comment`/`sidebar`/`nav`/`ad`/`menu` 等（强负面）；`widget`/`share`/`social`/`related` 等（中等负面）；`promo`/`banner`/`sponsor` 等（弱负面） |
| **段落密度** | 子树中 `<p>` 数量乘以倍率加分（段落越多越可能为正文） | — |
| **文本长度** | 超过阈值的长文本加分；低于阈值的短文本扣分 | — |
| **内容密度** | 文本/标签比例高时乘以放大系数 | 比例低时乘以衰减系数 |
| **链接密度** | — | 文本短且链接密集时施加惩罚（可能是导航栏或站点地图） |
| **标点特征** | 逗号密集（含中文逗号 `，`）暗示散文体，加分 | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **隐藏元素** | — | `style="display:none"`/`visibility:hidden` 或 `hidden` 属性的节点被移除 |

:::tip 布局包装器的豁免
当 class/id 同时含内容信号（`content`/`article`）和移除信号（如 `sidebar`）时——典型如 CSS 布局类 `content-sidebar`——评分器**不会**移除该节点，因为它包裹着主内容。语义标签 `<article>`/`<main>`（或 `role="main"`/`role="article"`）一律豁免 class/id 移除启发式，确保 `<article class="post-with-sidebar">` 不会被误删。
:::

:::warning 文章识别不是万能的
文章识别最适合新闻、博客、文档等有明确"正文区域"的页面。对于导航页、列表页、图库等非文章型页面，可能无法准确定位正文——此时可设 `ExtractArticle = false` 提取整个 `<body>` 内容。
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
    // 预留：当前版本不被库调用（实现以满足接口要求）
    return node.Data() == "nav" || node.Data() == "footer"
}
```

:::tip 注意
此示例中的 `strings.Contains` 来自标准库 `strings` 包。完整可运行示例请参考 [测试与自定义扩展](../integration/testing-custom)。
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

## 表格渲染

HTML 中的 `<table>` 会按 `TableFormat` 配置渲染到提取的文本中：

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "markdown" // 默认；或 "html"
```

| 格式 | 渲染效果 | 适用场景 |
|------|----------|----------|
| `"markdown"` | Markdown 表格（含表头分隔行）；`colspan` 展开为重复单元格；仅含宽度定义的结构行被跳略 | 人类阅读、Markdown 消费 |
| `"html"` | 保留原始 HTML `<table>` 标签（`colspan`/`rowspan` 原样保留）；结构行保留 | 需精确表格结构的下游处理 |

:::tip 格式大小写不敏感
`TableFormat` 值大小写不敏感（`"Markdown"` 与 `"markdown"` 等效），空值回退到 `"markdown"`。
:::

示例——提取包含表格的 HTML：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><body><article>
        <h1>价格表</h1>
        <table>
            <tr><th>产品</th><th>价格</th></tr>
            <tr><td>基础版</td><td>免费</td></tr>
            <tr><td>专业版</td><td>¥99/月</td></tr>
        </table>
    </article></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text)
	// 输出（TableFormat = "markdown" 时）：
	// 价格表
	//
	// | 产品   | 价格    |
	// |--------|---------|
	// | 基础版 | 免费    |
	// | 专业版 | ¥99/月  |
}
```

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

- [输出格式实战](./output-formats) - 选择适合场景的输出格式
- [Processor 复用与缓存](../performance/processor-cache) - 高频调用的性能优化
- [API 参考：包函数](../../api-reference/core/functions) - 完整函数签名
