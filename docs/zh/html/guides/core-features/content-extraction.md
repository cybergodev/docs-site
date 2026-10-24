---
sidebar_label: "内容提取实战"
title: "内容提取实战 - CyberGo html | 提取流程指南"
description: "CyberGo html 内容提取实战：Extract 的完整处理流程（输入校验、编码检测、DOM 解析、深度验证、安全清洗、文章识别、格式化）、Result 各字段含义、默认评分器的评分信号与自定义 Scorer 写法、表格渲染、非 UTF-8 编码与超时语义，附完整可编译示例。"
sidebar_position: 10
---

# 内容提取实战

`Extract` 从 HTML 字节中提取正文、标题、图片、链接与音视频。本页覆盖处理流程、`Result` 字段含义与文章识别算法。

## 提取流程

`Extract` 的处理步骤：

```text
HTML 输入 → 输入校验 → 编码检测（转 UTF-8） → DOM 解析 → 深度验证
    → 安全清洗（可选） → 文章识别（可选） → 内容提取 → 格式化 → 返回 Result
```

深度验证在清洗**之前**执行。先以迭代方式校验 DOM 深度，避免递归遍历导致栈溢出；再对已解析的 DOM 树做安全清洗。两者都作用于解析后的节点树，因此 DOM 解析始终在最前。

每一步都可以通过 [配置](../../api-reference/core/config) 定制。

## 基础文本提取

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
	// 阅读时间：15.3s

	fmt.Println("图片：", len(result.Images))
	// 图片：1

	fmt.Println("链接：", len(result.Links))
	// 链接：1
}
```

## Result 字段

`Result` 的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Title` | `string` | 页面标题：优先首个 `<title>`，其次首个 `<h1>`、`<h2>` |
| `Text` | `string` | 正文（已清洗，去除标签与多余空白） |
| `Images` | `[]ImageInfo` | 提取的图片列表 |
| `Links` | `[]LinkInfo` | 提取的链接列表 |
| `Videos` | `[]VideoInfo` | 提取的视频列表 |
| `Audios` | `[]AudioInfo` | 提取的音频列表 |
| `WordCount` | `int` | 正文字数 |
| `ReadingTime` | `time.Duration` | 预估阅读时间 |
| `ProcessingTime` | `time.Duration` | 处理耗时 |

`WordCount` 按空白分词，CJK 字符逐字计数；`ReadingTime` 以 200 词/分钟换算，仅作估算。

## 从文件提取

处理本地 HTML 文件时用 `ExtractFromFile`：

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("标题：", result.Title)
```

文件操作内置三项检查：

- 检测路径穿越（如 `../../../etc/passwd`）
- 文件大小受 `MaxInputSize` 限制
- 错误信息经 `SafePath()` 隐藏完整路径

## 文章识别算法

`ExtractArticle` 为 `true`（默认）时，库会定位页面中的主内容区域。

### 工作原理

1. **候选节点评分**：遍历 DOM，对非行内元素节点计算内容相关性分数，得分大于 0 的进入候选。
2. **选择最佳候选**：得分最高的节点作为文章容器。
3. **回退**：没有合适候选时回退到 `<body>`。

### 默认评分器的信号维度

内置默认评分器（内部实现，不导出）按多维信号打分，选取得分最高的容器：

| 维度 | 正面信号 | 负面信号 |
|------|----------|----------|
| **标签语义** | `<article>`(+1000)、`<main>`(+900)、`<section>`(+300)、`<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style` 直接返回 0 |
| **class/id 模式** | `content`/`article`/`post`/`main`/`entry`/`story` 等（强正面）；`blog`/`news`/`detail`/`page` 等（中等正面） | `comment`/`sidebar`/`nav`/`ad`/`menu` 等（强负面）；`widget`/`share`/`social`/`related` 等（中等负面）；`promo`/`banner`/`sponsor` 等（弱负面） |
| **段落密度** | 子树中 `<p>` 数量乘以倍率加分 | — |
| **文本长度** | 超过阈值的长文本加分；低于阈值的短文本扣分 | — |
| **内容密度** | 文本/标签比例高时乘以放大系数 | 比例低时乘以衰减系数 |
| **链接密度** | — | 文本短且链接密集时扣分（可能是导航栏或站点地图） |
| **标点特征** | 逗号密集（含中文逗号 `，`）暗示散文体，加分 | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **隐藏元素** | — | `style="display:none"`/`visibility:hidden` 或带 `hidden` 属性的节点被移除 |

:::tip 布局包装器的豁免
class/id 同时含内容信号（`content`/`article`）与移除信号（如 `sidebar`）时，评分器不移除该节点——它包裹着主内容，典型如布局类 `content-sidebar`。语义标签 `<article>`/`<main>`（或 `role="main"`/`role="article"`）一律豁免 class/id 移除启发式，`<article class="post-with-sidebar">` 因此不会被误删。
:::

:::warning 文章识别的适用范围
文章识别适用于新闻、博客、文档等有明确正文区域的页面。导航页、列表页、图库等页面往往没有正文容器，识别结果可能偏离。此时把 `ExtractArticle` 设为 `false`，库会提取整个 `<body>`。
:::

### 自定义评分

实现 `Scorer` 接口即可替换评分逻辑：

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

示例中的 `strings.Contains` 来自标准库 `strings` 包；`ShouldRemove` 是接口要求，库当前只调用 `Score`。完整可运行示例见 [测试与自定义扩展](../integration/testing-custom)。

## 仅提取文本

只需要纯文本、不需要图片/链接等元数据时：

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

`ExtractText` 内部先调用 `Extract`，再返回 `.Text`。它省去的是取字段的代码，处理路径与 `Extract` 相同。

## 表格渲染

HTML 中的 `<table>` 按 `TableFormat` 渲染进文本。该值大小写不敏感（`"Markdown"` 与 `"markdown"` 等效），空值回退到 `"markdown"`：

```go
cfg := html.DefaultConfig()
cfg.TableFormat = "markdown" // 默认；或 "html"
```

| 格式 | 渲染效果 | 适用场景 |
|------|----------|----------|
| `"markdown"` | Markdown 表格（含表头分隔行）；`colspan` 展开为重复单元格；仅含宽度定义的结构行被跳过 | 人类阅读、Markdown 消费 |
| `"html"` | 保留原始 `<table>` 标签（`colspan`/`rowspan` 原样保留）；结构行保留 | 需要精确表格结构的下游处理 |

示例——提取含表格的 HTML：

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

编码判定顺序：`Config.Encoding` → BOM → 纯 ASCII（有 meta 声明则用声明）→ 合法 UTF-8 → meta 声明 → windows-1252 兜底。

```go
// data 为 GBK 字节；meta 声明了 charset=gbk 时可直接提取
result, err := html.Extract(gbkEncodedData)

// 无声明或已知编码：显式指定，跳过检测
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

:::warning 无声明编码的页面会得到乱码
GBK、Shift_JIS 等页面缺少 `<meta charset>` 时，基础检测兜底为 windows-1252，实测解码结果是乱码，但**不返回错误**。已知来源编码时显式设置 `cfg.Encoding`。详见 [编码检测实战](./encoding-detection)。
:::

## 上下文与超时

大文件或不可信来源的 HTML 用带上下文的版本：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, context.DeadlineExceeded) {
    log.Println("处理超时")
}
```

用户 context 到期时原样返回 `context.DeadlineExceeded`；库内 `ProcessingTimeout` 到期才返回 `ErrProcessingTimeout`。

## 下一步

- [输出格式实战](./output-formats) - 三种输出格式的差异与取舍
- [Processor 复用与缓存](../performance/processor-cache) - 高频调用的性能优化
- [API 参考：包函数](../../api-reference/core/functions) - 完整函数签名
