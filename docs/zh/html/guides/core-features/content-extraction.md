---
sidebar_label: "内容提取实战"
title: "内容提取实战 - CyberGo html | 提取流程指南"
description: "CyberGo html 内容提取实战：Extract 处理流程（输入校验、编码检测、DOM 解析、深度验证、安全清洗、文章识别、格式化）、Result 字段含义、结构化元数据与置信度、列表页识别、自定义 Scorer 与 ArticleFinder 单遍选取、表格渲染与超时语义，附完整示例。"
sidebar_position: 10
---

# 内容提取实战

`Extract` 从 HTML 字节中提取正文、标题、图片、链接与音视频。本页覆盖处理流程、`Result` 字段含义、文章识别算法、列表页识别与提取质量信号。

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
	// 正文：# Go 入门指南
	//       Go 是一门静态类型的编译语言，内置并发支持。
	//       它编译速度快，部署简单，适合构建高性能服务。
	//       Go 官网

	fmt.Println("字数：", result.WordCount)
	// 字数：51

	fmt.Println("阅读时间：", result.ReadingTime)
	// 阅读时间：9.77s

	fmt.Println("图片：", len(result.Images))
	// 图片：1

	fmt.Println("链接：", len(result.Links))
	// 链接：1
}
```

标题标签以 Markdown ATX 标记（`# ` 至 `###### `）写入 `Text`，标记本身不计入 `WordCount`。

## Result 字段

`Result` 的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Title` | `string` | 页面标题，优先级见[标题优先级](#标题优先级) |
| `Text` | `string` | 正文（已清洗，去除标签与多余空白） |
| `Images` | `[]ImageInfo` | 提取的图片列表 |
| `Links` | `[]LinkInfo` | 提取的链接列表 |
| `Videos` | `[]VideoInfo` | 提取的视频列表 |
| `Audios` | `[]AudioInfo` | 提取的音频列表 |
| `WordCount` | `int` | 正文字数 |
| `ReadingTime` | `time.Duration` | 预估阅读时间 |
| `ProcessingTime` | `time.Duration` | 处理耗时 |
| `Author` | `string` | 作者；JSON-LD `author` > `<meta name="author">` |
| `PublishedTime` | `time.Time` | 发布时间；`article:published_time` > JSON-LD `datePublished`；零值表示未知 |
| `Description` | `string` | 页面摘要；`og:description` > JSON-LD > `<meta name="description">` |
| `SiteName` | `string` | 站点名；`og:site_name` > JSON-LD `publisher` |
| `CanonicalURL` | `string` | 规范链接；`<link rel="canonical">` > `og:url` |
| `Confidence` | `float64` | 提取置信度，`0`–`1`，分档见[质量信号](#质量信号) |
| `ExtractionMethod` | `string` | `article` / `listing` / `body`，见[质量信号](#质量信号) |

`WordCount` 按空白分词，CJK 字符逐字计数。`ReadingTime` 按脚本分别折算：空格分词的语言按 200 词/分钟，CJK 字符按 350 字/分钟，结果仅作估算。

`Author` 至 `CanonicalURL` 五个元数据字段由 `Config.ExtractMetadata`（默认 `true`）控制，关闭时不填充、保持空值。

### 标题优先级

`Result.Title` 的取值分两层：

1. **元数据层**（`ExtractMetadata = true`，默认开启）：JSON-LD `headline` > `og:title`。这类标题由内容方编写，通常已去掉站点名后缀；只有尾段精确等于声明的站点名时才剥离，长度启发式**不适用**于这一层——`GDP Falls 0.3% - Worst Quarter Since 2020` 这类带副标题的 headline 完整保留。
2. **DOM 层**（元数据标题缺失，或关闭 `ExtractMetadata`）：`<title>` → 正文内 h1 → 文档首个 h1 → 首个 h2。`<title>` 的站点名后缀按长度启发式剥离：最后一个 ` - ` / ` | ` / ` · ` 等分隔符后的尾段不超过 30 字符、且前半段至少 3 字符时才丢弃尾段。

因此 `Post Title - Example News` 会得到 `Post Title`；`Post Title - Worst Quarter Since 2020 Was Rough` 的尾段超过 30 字符，标题原样保留。

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

- 检测路径遍历（如 `../../../etc/passwd`）
- 文件大小受 `MaxInputSize` 限制
- 错误信息经 `SafePath()` 隐藏完整路径

## 文章识别算法

`ExtractArticle` 为 `true`（默认）时，库会定位页面中的主内容区域。

### 工作原理

1. **候选节点评分**：遍历 DOM，对非行内元素节点计算内容相关性分数，得分大于 0 的进入候选。
2. **选择最佳候选**：得分最高的节点作为文章容器。内置评分器还会把胜出节点按分数护栏向上扩展到包裹容器，使被拆分为标题块、正文块、署名块的文章得以完整保留。
3. **回退**：没有合适候选时回退到 `<body>`。

### 默认评分器的信号维度

内置默认评分器（内部实现，不导出）按多维信号打分，选取得分最高的容器：

| 维度 | 正面信号 | 负面信号 |
|------|----------|----------|
| **标签语义** | `<article>`(+1000)、`<main>`(+900)、`<section>`(+300)、`<body>`(+100) | `nav`/`aside`/`footer`/`header`/`script`/`style`/`noscript` 直接返回 0 |
| **class/id 模式** | `content`/`article`/`main`/`post`/`entry`/`text`/`body`/`story`（强正面）；`blog`/`news`/`detail`/`page`（中等正面） | `comment`/`sidebar`/`nav`/`navigation`/`footer`/`header`/`menu`/`ad`/`advertisement`（强负面）；`related`/`share`/`social`/`meta`/`tag`/`category`（中等负面）；`promo`/`banner`/`sponsor`（弱负面） |
| **段落密度** | 子树中 `<p>` 数量加分：≥3 段每段 +150，1–2 段每段 +80 | — |
| **文本长度** | 长文本按长度分档加分（>100、>200、>500 字节逐档提高，>500 的超出部分按 1/10 计入） | <50 字节扣 300 分 |
| **内容密度** | 块均文本密度 >0.7 时总分 ×1.2 | 密度 <0.3 时 ×0.7 |
| **链接密度** | — | 链接文本占比 >0.15 且呈导航形态（平均链接文本 <25 字节）或总文本 <500 字节时，按占比分档 ×0.2–×0.75（导航栏、站点地图被压低） |
| **标点特征** | 逗号（含中文逗号 `，`）超过 5 个时每个 +10；句末标点（含 `。！？`）超过 3 个时每个 +15 | — |
| **ARIA role** | `role="main"`/`role="article"`(+500) | `role="navigation"`/`role="complementary"`(-400) |
| **隐藏元素** | — | `style="display:none"`/`visibility:hidden`、`hidden` 属性、`aria-hidden="true"`，或 class/id 含 hidden 类 token（`hidden`/`hide`/`is-hidden`/`sr-only`/`visually-hidden`/`d-none`/`invisible`）的节点被移除 |

同一模式命中 `id` 属性时分数加倍：`id` 全文档唯一，比 `class` 更能说明节点性质（`id="content"` 强于 `class="content-utility-text"`）。

:::tip 布局包装器的豁免
class/id 同时含内容信号（`content`/`article`）与移除信号（如 `sidebar`）时，评分器不移除该节点：它包裹着主内容，典型如布局类 `content-sidebar`。

语义标签 `<article>`/`<main>`（或 `role="main"`/`role="article"`）一律豁免 class/id 移除启发式，`<article class="post-with-sidebar">` 因此不会被误删。
:::

:::warning 文章识别的适用范围
文章识别适用于新闻、博客、文档等有明确正文区域的页面。卡片式列表页由[列表页识别](#列表页识别)单独处理；导航页、图库等既无正文容器也无卡片列表的页面，识别结果可能偏离。此时把 `ExtractArticle` 设为 `false`，库会提取整个 `<body>`。
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
    // 自定义评分器下不被库调用（保留以满足接口要求）
    return node.Data() == "nav" || node.Data() == "footer"
}
```

`ShouldRemove` 只在库使用内置默认评分器时被查阅；配置自定义 `Scorer` 后，节点移除仍按内置规则执行，返回值不起作用。

要影响选取，请在 `Score` 中返回低分/负分，或实现下一节的 `ArticleFinder`。完整可运行示例见 [测试与自定义扩展](../integration/testing-custom)。

### 单遍选取：ArticleFinder

逐元素调用 `Score` 会枚举文档中所有非行内元素。自定义评分器若在 `Score` 内重新遍历子树，整体开销会退化为 O(N²)。额外实现 `ArticleFinder` 接口即可接管选取：库调用一次 `FindArticleNode`，不再枚举评分。

`FindArticleNode` 收到的是文档根节点，返回文章根元素或 `nil`；返回 `nil` 表示「没有文章」，库据此回退整个 `<body>`，与内置评分器的语义一致。接口约束（返回值必须来自 `root` 的遍历方法）与完整可运行示例见 [测试与自定义扩展](../integration/testing-custom)。

### 列表页识别

卡片式列表页（博客索引、新闻流、搜索结果）把每张卡片标成独立的 `<article>`，每张都带 +1000 的标签分。若按普通候选选取，评分器只会选中其中一张卡片。

库在文章选取**之前**先判断列表形状：容器含 **≥3 个直接子 `<article>`**，卡片合计链接文本密度超过 0.3，且卡片文本总量不少于页面可见文本的一半，即认定该容器为列表容器。判定为列表时 `ExtractionMethod` 为 `listing`，`Text` 是整份卡片列表。

列表容器本身不能是待移除的外壳（如 `related` 推荐区块的包装器），否则仍按文章路径处理。仅夹带一处卡片区块的文章页不会被误判为列表页。

:::tip 列表页与正文页的区分
`ExtractionMethod` 正是为此设计：下游按 `listing` 单独路由，既不当作单篇文章，也不必关闭 `ExtractArticle`。
:::

### 质量信号

`Result.Confidence` 是一个粗粒度的提取质量信号，取值范围 `0`–`1`。它用于分流，不是概率（下表文本长度均按 UTF-8 字节计）：

| 置信度 | 触发条件 |
|--------|----------|
| `0` | 未提取到任何文本 |
| `0.2` | `<body>` 回退且文本不足 50 字节 |
| `0.4` | `<body>` 回退且文本 50–199 字节；文章节点文本不足 50 字节；或文本不足 600 字节且开头命中付费墙/同意墙话术（列表页同样适用） |
| `0.6` | 列表页；`<body>` 回退且文本不少于 200 字节；或文章节点文本 50–199 字节 |
| `0.8` | 文章节点文本不少于 200 字节，但占页面可见文本的比例不足 5% |
| `1.0` | 文章节点文本不少于 200 字节且占比不低于 5% |

`Result.ExtractionMethod` 说明 `Text` 的来源：`article`（评分器选中正文节点）、`listing`（识别为卡片列表）、`body`（回退整个 `<body>`，或 `ExtractArticle = false`）。

:::tip 按置信度分流
常见的用法是把 `< 1.0` 的结果送去复核或走备用策略：`body` + `0.2` 往往意味着页面由 JS 渲染；`article` + `0.4` 则可能是付费墙截断。
:::

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
| `"markdown"` | Markdown 表格（含表头分隔行）；`colspan` 展开为空占位列（整列皆占位的列被过滤掉），`rowspan` 在跨行位置重复原单元格文本；仅含宽度定义的结构行被跳过 | 人类阅读、Markdown 消费 |
| `"html"` | 重新输出 `<table>` 标签（`colspan`/`rowspan` 以属性保留，对齐与宽度改写入 `style`，单元格文本经 HTML 转义）；结构行保留 | 需要精确表格结构的下游处理 |

两种情况不按数据表格渲染：

- **布局壳**：`role="presentation"` 或 `role="none"`（不区分大小写）的 `<table>` 被当作纯布局容器展平，单元格文本按段落拼接；嵌套表格且自身直接文本不足 25 字节的表同样展平。
- **旧式表现属性**：`border="0"`、`cellpadding`、`cellspacing` 不参与判定——现代数据表普遍边框为零，这些属性区分不了布局与数据。

表外的两处正文格式约定：h1–h6 写出 Markdown ATX 标题标记（`# ` 至 `###### `）；`<pre>`/`<code>` 保留内部换行，代码块与 ASCII 图不会压成一行。

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
	// # 价格表
	//
	// | 产品 | 价格 |
	// | --- | --- |
	// | 基础版 | 免费 |
	// | 专业版 | ¥99/月 |
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
GBK、Shift_JIS 等页面缺少 `<meta charset>` 时，基础检测兜底为 windows-1252，解码结果是乱码，但**不返回错误**，调用方无法从 `err` 察觉。已知来源编码时显式设置 `cfg.Encoding`。详见 [编码检测实战](./encoding-detection)。
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

- [阅读模式](./reader-mode) - 整页分区输出，保留导航与页脚
- [输出格式实战](./output-formats) - 三种输出格式的差异与取舍
- [Processor 复用与缓存](../performance/processor-cache) - 高频调用的性能优化
- [API 参考：包函数](../../api-reference/core/functions) - 完整函数签名
