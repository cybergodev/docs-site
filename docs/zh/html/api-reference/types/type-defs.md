---
sidebar_label: "数据类型"
title: "类型定义 - CyberGo html | 数据类型参考"
description: "CyberGo html 数据类型参考：Result（含元数据与质量信号）、ReadResult、PageSection、SectionKind、ImageInfo、LinkInfo、NodeAttr 等类型的字段含义、取值规则与 JSON 序列化行为。"
sidebar_position: 20
---

# 类型定义

提取结果由一组导出结构体承载：`Result`（正文提取）、`ReadResult`/`PageSection`/`SectionKind`（阅读模式）、`ImageInfo`/`LinkInfo`/`VideoInfo`/`AudioInfo`（媒体与链接）、`Statistics`/`BatchResult`（统计与批量）。本页逐字段给出它们的取值规则与 JSON 序列化行为。

## Result

提取结果，包含文本、元数据与媒体信息。

```go
type Result struct {
	Text           string        `json:"text"`
	Title          string        `json:"title"`
	Images         []ImageInfo   `json:"images,omitempty"`
	Links          []LinkInfo    `json:"links,omitempty"`
	Videos         []VideoInfo   `json:"videos,omitempty"`
	Audios         []AudioInfo   `json:"audios,omitempty"`
	ProcessingTime time.Duration `json:"-"` // 处理耗时（不参与标准序列化）
	WordCount      int           `json:"word_count"`
	ReadingTime    time.Duration `json:"-"` // 预估阅读时间（不参与标准序列化）

	Author           string    `json:"author,omitempty"`
	PublishedTime    time.Time `json:"published_time,omitzero"`
	Description      string    `json:"description,omitempty"`
	SiteName         string    `json:"site_name,omitempty"`
	CanonicalURL     string    `json:"canonical_url,omitempty"`
	Confidence       float64   `json:"confidence"`
	ExtractionMethod string    `json:"extraction_method,omitempty"`
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `Result.Text` | `string` | 提取的正文纯文本 |
| `Result.Title` | `string` | 文档标题。`ExtractMetadata=true`（默认）且页面声明了元数据标题时，取 JSON-LD `headline` > `og:title` > WebPage/WebSite 类型 JSON-LD 节点的 `name`（最后兜底），仅当尾段精确（大小写不敏感）等于声明的站点名时才剥离该后缀；否则按 `<title>`（尾段 ≤30 字符且前半段 ≥3 字符时剥离站点名后缀）→ 正文内 h1 → 文档首个 h1 → 首个 h2 |
| `Result.Images` | `[]ImageInfo` | 按文档顺序排列的图片；`PreserveImages=false` 时为空 |
| `Result.Links` | `[]LinkInfo` | 按文档顺序排列的链接；`PreserveLinks=false` 时为空 |
| `Result.Videos` | `[]VideoInfo` | 提取的视频源；`PreserveVideos=false` 时为空 |
| `Result.Audios` | `[]AudioInfo` | 提取的音频源；`PreserveAudios=false` 时为空 |
| `Result.ProcessingTime` | `time.Duration` | 本次提取的墙上时间（JSON 中为 `processing_time_ms`） |
| `Result.WordCount` | `int` | `Text` 的词数：空白分词，CJK 字符逐字计数 |
| `Result.ReadingTime` | `time.Duration` | 阅读时间估算：空白分词的语言按 200 词/分钟，CJK 字符按 350 字/分钟，分别折算后相加（JSON 中为 `reading_time_ms`） |
| `Result.Author` | `string` | 作者，多个声明时以 `", "` 连接；空值不进入 JSON |
| `Result.PublishedTime` | `time.Time` | 发布时间，零值表示未知；零值不进入 JSON |
| `Result.Description` | `string` | 页面摘要；空值不进入 JSON |
| `Result.SiteName` | `string` | 站点名；空值不进入 JSON |
| `Result.CanonicalURL` | `string` | 规范链接；空值不进入 JSON |
| `Result.Confidence` | `float64` | 提取质量信号，取值见下；**无** `omitempty`，总是出现在 JSON 中 |
| `Result.ExtractionMethod` | `string` | 正文产出的方式：`article` / `listing` / `body`；空值不进入 JSON |

### 元数据字段的取值规则

`Author`、`PublishedTime`、`Description`、`SiteName`、`CanonicalURL` 只在 `Config.ExtractMetadata=true`（默认）时填充。每个来源取文档中第一个匹配元素；JSON-LD 使用两遍优先级（先取 article 类型的块，再补齐其余块）。

| 字段 | 来源优先级 |
|------|-----------|
| `Author` | JSON-LD `author`（字符串、`{name}` 对象或二者的数组）> `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished`；解析失败时保持零值 |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name`（或独立 Organization/WebSite 节点的 `name`） |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

关闭 `ExtractMetadata` 后这五个字段保持空值，且标题不再优先取元数据标题（见上表 `Result.Title`）。

### 质量信号取值规则

`Confidence` 在 `[0, 1]` 区间，供管线判断是否回退或人工复核：

| 取值 | 条件 |
|------|------|
| `0` | 未提取到任何文本 |
| `0.2` / `0.4` / `0.6` | 回退到 `<body>`（`ExtractionMethod="body"`），按文本长度分档（<50 字符 / <200 字符 / 其余） |
| `0.4` | 短文本（<600 字符）且开头命中订阅/同意墙话术；或文章类节点只产出极少文本 |
| `0.6` | 识别为列表页；或文章节点文本较短（≥50 且 <200 字符） |
| `0.8` | 文章节点文本充分（≥200 字符）但占页面可见文本比例低于 5% |
| `1.0` | 文章节点文本充分且占比达标 |

分档中的长度阈值（50/200/600）按 `len(text)` 的**字节长度**判定；订阅/同意墙话术只扫描文本开头 800 字节。

`ExtractionMethod` 的取值：`article`（评分器选出主内容节点）、`listing`（识别为卡片列表页，`Text` 为整份卡片列表）、`body`（回退整页 `<body>`，没有候选节点得分大于 0，或 `ExtractArticle=false`）。

:::tip CJK 词数与阅读时间
`WordCount` 先按空白分词，再把 CJK 字符（汉字、假名、谚文音节）各计为 1 个词。`ReadingTime` 用**两种速率**折算：非 CJK 词按 200 词/分钟，CJK 字符按 350 字/分钟，两部分相加。因此 CJK 内容虽然词数偏高，阅读时间并不会被按英文速率高估。文档示例中的字数与阅读时间为当前算法下的示意输出，随算法版本变化。
:::

### MarshalJSON

`Result.MarshalJSON` 自定义 JSON 序列化：`ProcessingTime` 与 `ReadingTime` 虽带 `json:"-"` 标签，仍会被输出为毫秒数。

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

:::warning JSON 输出不可往返
`Result` **未实现 `UnmarshalJSON`**。把 `MarshalJSON()` 的输出反序列化回 `Result`，`ProcessingTime`、`ReadingTime` 会**丢失**：JSON 键名（`processing_time_ms`、`reading_time_ms`）与结构体字段名不对应，无法还原。

这是有意设计：该 JSON 面向外部消费（API 响应、日志、前端展示），不用于双向序列化。
:::

## ReadResult

阅读模式（`ReadPage*`）的返回类型：整页按类别分区的阅读视图，而不是只选出的正文。精简字段如下，完整结构体定义与 `Render`/`RenderText` 行为见 [阅读模式](../core/reader#readresult)。

| 字段 | 类型 | 说明 |
|------|------|------|
| `ReadResult.Title` | `string` | 文档标题，优先级与 `Result.Title` 相同 |
| `ReadResult.Author` | `string` | 作者；`ExtractMetadata=false` 时为空 |
| `ReadResult.PublishedTime` | `time.Time` | 发布时间，零值表示未知 |
| `ReadResult.Description` | `string` | 页面摘要 |
| `ReadResult.SiteName` | `string` | 站点名 |
| `ReadResult.CanonicalURL` | `string` | 规范链接 |
| `ReadResult.Sections` | `[]PageSection` | 按文档顺序的分区；相邻同类合并、无内容丢弃，始终非 `nil` |
| `ReadResult.ProcessingTime` | `time.Duration` | 处理耗时（不参与 JSON） |

## PageSection

`ReadResult.Sections` 的元素类型，一个带类别标签的页面区域。只列字段；清洗规则与链接保留语义见 [阅读模式](../core/reader#关键语义)。

| 字段 | 类型 | 说明 |
|------|------|------|
| `PageSection.Kind` | `SectionKind` | 分区类别 |
| `PageSection.Text` | `string` | 分区正文，内联链接按 `InlineLinkFormat` 渲染 |
| `PageSection.PlainText` | `string` | 去掉链接与图片标记的纯文本，供 `RenderText` 使用 |
| `PageSection.Links` | `[]LinkInfo` | 分区内链接；`PreserveLinks=false` 时为空 |
| `PageSection.Images` | `[]ImageInfo` | 分区内图片；`PreserveImages=false` 时为空 |
| `PageSection.WordCount` | `int` | `PlainText` 的词数（CJK 逐字计） |

## SectionKind

分区类别，共 5 个常量。判定依据见 [阅读模式](../core/reader#sectionkind)。

| 常量 | 值 | `Render` 中的标题 |
|------|-----|-------------------|
| `SectionHeader` | `header` | `Header` |
| `SectionNavigation` | `navigation` | `Navigation` |
| `SectionMain` | `main` | `Main Content` |
| `SectionAside` | `aside` | `Aside` |
| `SectionFooter` | `footer` | `Footer` |

`main` 分区可能有多个（例如文章正文后紧跟同样被判为正文的评论区）。

## ImageInfo

`Result.Images`（`[]ImageInfo`）的元素类型，保存单个 `<img>` 的提取信息。

```go
type ImageInfo struct {
	URL          string `json:"url"`           // 图片地址
	Alt          string `json:"alt"`           // 替代文本
	Title        string `json:"title"`         // title 属性原文
	Width        string `json:"width"`         // 宽度
	Height       string `json:"height"`        // 高度
	IsDecorative bool   `json:"is_decorative"` // 是否为装饰性图片
	Position     int    `json:"position"`      // 在文档中的位置
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `ImageInfo.URL` | `string` | `src` 属性值；仅保留合法 URL，无效 URL 的 `<img>` 不出现在结果中（也不占用序号） |
| `ImageInfo.Alt` | `string` | `alt` 属性原文；为空时 `IsDecorative` 为 `true` |
| `ImageInfo.Title` | `string` | `title` 属性原文（提示性文本，不是页面标题） |
| `ImageInfo.Width` | `string` | 宽度属性**原始字符串**（如 `"640"`、`"50%"`），未解析为数字 |
| `ImageInfo.Height` | `string` | 高度属性**原始字符串**，未解析为数字 |
| `ImageInfo.IsDecorative` | `bool` | `Alt` 为空时为 `true`，可用于跳过装饰性图片 |
| `ImageInfo.Position` | `int` | 有效图片中的 1-based 序号（无效 `<img>` 不占用序号）；`PreserveImages=false` 时整个 `Images` 切片为空 |

:::warning Width/Height 是字符串
`Width` 与 `Height` 为 `string` 而非 `int`，保留 HTML 源码中的原始写法（含单位、百分比等）。需要数值时由调用方自行解析。
:::

## LinkInfo

`Result.Links`（`[]LinkInfo`）的元素类型，保存单个 `<a>` 的提取信息。

```go
type LinkInfo struct {
	URL        string `json:"url"`         // 链接地址
	Text       string `json:"text"`        // 链接文本
	Title      string `json:"title"`       // title 属性原文
	IsExternal bool   `json:"is_external"` // 是否为外部链接（只看 URL 本身，不与 BaseURL 对比）
	IsNoFollow bool   `json:"is_nofollow"` // 是否为 nofollow
	Position   int    `json:"position"`    // 在文档中的位置
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `LinkInfo.URL` | `string` | `href` 属性值；仅保留合法 URL——纯片段（`#top`）与纯查询（`?page=2`）属页内导航，`javascript:`/`vbscript:`/`file:` 等被拒协议同样排除。这些 `<a>` 不进入切片，但仍消耗 `Position`，使 `[LINK:n]` 占位符与 `Text` 保持对齐 |
| `LinkInfo.Text` | `string` | `<a>` 内所有文本节点的递归拼接（含嵌套标签中的文本） |
| `LinkInfo.Title` | `string` | `title` 属性原文（提示性文本，不是链接文本） |
| `LinkInfo.IsExternal` | `bool` | 绝对 `http(s)` 或协议相对（`//`）的 href 为外部，相对 href 为内部；**不与 `BaseURL` 比较域名**（同域绝对链接也为 `true`） |
| `LinkInfo.IsNoFollow` | `bool` | `rel` 含 `nofollow`（大小写不敏感）时为 `true` |
| `LinkInfo.Position` | `int` | 提取内容中的 1-based 序号；无效 `<a>`（href 非法、缺失或被拒）仍消耗序号，因此可能不连续 |

`IsNoFollow` 常用于 SEO 与外链审计：`rel` 中带 `nofollow` 的链接（赞助、UGC 等）不传递搜索权重，可据此把外链分析分为自然链接与付费/推荐链接两类。

## VideoInfo

`Result.Videos`（`[]VideoInfo`）的元素类型，保存单个视频源的提取信息。

```go
type VideoInfo struct {
	URL      string `json:"url"`      // 视频地址
	Type     string `json:"type"`     // 视频类型
	Poster   string `json:"poster"`   // 封面图地址
	Width    string `json:"width"`    // 宽度
	Height   string `json:"height"`   // 高度
	Duration string `json:"duration"` // 时长
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `VideoInfo.URL` | `string` | 视频源地址 |
| `VideoInfo.Type` | `string` | 容器 MIME 或 `"embed"`，见下方取值规则 |
| `VideoInfo.Poster` | `string` | `<video>` 的封面帧地址（`poster` 属性） |
| `VideoInfo.Width` | `string` | 宽度属性原文，未解析为数字 |
| `VideoInfo.Height` | `string` | 高度属性原文，未解析为数字 |
| `VideoInfo.Duration` | `string` | 时长属性原文，未解析为数字 |

### Type 字段取值规则

按元素类型分别取值：

- `<video>`、`<embed>`、`<object>`：先取声明值——`<video>` 取子元素 `<source type>`，`<embed>`/`<object>` 取自身 `type` 属性。未声明时按 URL 判定：命中嵌入平台模式（YouTube、Vimeo、优酷、Bilibili 等）为 `"embed"`；扩展名可识别则为对应 MIME 类型（`a.mp4` → `video/mp4`，`b.webm` → `video/webm`）；两者都不匹配时为空字符串。
- `<iframe>`：一律为 `"embed"`。该 src 必须本身是视频 URL 或已知嵌入平台地址，否则整个 iframe 不产生 `VideoInfo`。
- 裸 URL 扫描命中的 URL：只按 URL 判定，规则同上（嵌入平台模式 → `"embed"`，扩展名 → MIME 类型）。

| Type 值 | 含义 | 产生场景 |
|---------|------|----------|
| 声明的 MIME 类型 | 视频容器 | `<source type="video/mp4">`、`<embed type="video/mp4">` |
| 推导的 MIME 类型 | 视频容器 | `<video src="a.mp4">` 等无 `type` 声明但 URL 有可识别扩展名 |
| `"embed"` | 嵌入式播放器页面 | `<iframe>` 的 src；或命中嵌入平台模式的 `<embed>`/`<object>` 与裸 URL |
| 空字符串 | 无法识别 | `<video src="/stream/abc">` 等无扩展名、非嵌入地址且无 `type` 声明 |

:::tip 视频提取的三个来源
视频提取有三个来源：原始 HTML 标签扫描（`<iframe>`/`<embed>`/`<object>`）、DOM 遍历、裸 URL 扫描。结果按 URL 去重。详见 [媒体提取实战](../../guides/core-features/media-extraction)。
:::

## AudioInfo

`AudioInfo` 是 `Result.Audios`（`[]AudioInfo`）的元素类型，保存单个音频源的提取信息。

```go
type AudioInfo struct {
	URL      string `json:"url"`      // 音频地址
	Type     string `json:"type"`     // 音频类型
	Duration string `json:"duration"` // 时长
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `AudioInfo.URL` | `string` | 音频源地址 |
| `AudioInfo.Type` | `string` | 容器 MIME，见下方取值规则 |
| `AudioInfo.Duration` | `string` | 时长属性原文，未解析为数字 |

### Type 字段取值规则

| Type 值 | 产生场景 |
|---------|----------|
| 声明的 MIME 类型 | `<source type="audio/mpeg">` 的属性值 |
| 推导的 MIME 类型 | `<audio src="a.mp3">` 等无 `type` 声明但 URL 有可识别扩展名（如 `audio/mpeg`） |
| 空字符串 | URL 无可识别扩展名，且未声明 `type` |

:::warning `.ogg` 会同时出现在两个切片
OGG 容器可承载视频或音频，`.ogg` URL 会同时进入 `Videos` 与 `Audios`。仅音频的 `.oga` 只出现在 `Audios`。
:::

## LinkResource

链接资源，`ExtractAllLinks` 系列函数与 `GroupLinksByType` 的元素类型。

```go
type LinkResource struct {
	URL   string // 链接地址（启用 ResolveRelativeURLs 时已基于 BaseURL 解析）
	Title string // 资源标签
	Type  string // 类型："link"、"image"、"video"、"audio"、"css"、"js"、"icon"、"media"
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `LinkResource.URL` | `string` | 资源地址；`ResolveRelativeURLs=true` 时已基于 `BaseURL` 解析为绝对地址 |
| `LinkResource.Title` | `string` | 人类可读的资源标签 |
| `LinkResource.Type` | `string` | 资源类型（`link`/`image`/`video`/`audio`/`css`/`js`/`icon`/`media`） |

各 `Type` 对应的 HTML 标签来源与控制开关见 [链接提取](../modules/links#链接类型详解)。

## Statistics

处理统计，由 `Processor.GetStatistics` 返回。

```go
type Statistics struct {
	TotalProcessed     int64         // 总处理数
	CacheHits          int64         // 缓存命中数
	CacheMisses        int64         // 缓存未命中数
	ErrorCount         int64         // 错误数
	AverageProcessTime time.Duration // 平均处理时间
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `Statistics.TotalProcessed` | `int64` | 完成且无错误的提取次数（含缓存命中） |
| `Statistics.CacheHits` | `int64` | 由缓存直接命中的次数 |
| `Statistics.CacheMisses` | `int64` | 未命中、需完整处理的次数（禁用缓存时不计数） |
| `Statistics.ErrorCount` | `int64` | 处理开始后失败的提取次数：超限输入、编码转换失败，以及处理阶段内抛出的全部错误（含处理超时与落在该阶段的取消）。不计入：处理开始前观察到的 context 取消、已关闭处理器的拒绝调用、文件读取错误 |
| `Statistics.AverageProcessTime` | `time.Duration` | 每次提取的平均墙上时间；缓存命中同样计入样本（耗时近似为 0） |

## BatchResult

批量处理结果，`ExtractBatch` 系列函数与方法的返回类型。

```go
type BatchResult struct {
	Results   []*Result // 提取结果，失败或取消时为 nil
	Errors    []error   // 失败的错误
	Success   int       // 成功数量
	Failed    int       // 失败数量
	Cancelled int       // 取消数量
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `BatchResult.Results` | `[]*Result` | 与输入一一对应的结果，失败/取消项为 `nil` |
| `BatchResult.Errors` | `[]error` | 与输入一一对应的错误，成功项为 `nil` |
| `BatchResult.Success` | `int` | 成功项计数 |
| `BatchResult.Failed` | `int` | 失败项计数 |
| `BatchResult.Cancelled` | `int` | 因 context 取消而未处理的项计数 |

字段语义、取消行为与输入校验见 [批量处理](../modules/batch)。

## NodeAttr

`NodeAttr` 表示 HTML 节点属性，是 `ContentNode.Attrs`（`[]NodeAttr`）的元素类型：`Key` 为属性名（如 `href`、`class`），`Value` 为对应的属性值。

```go
type NodeAttr struct {
	Key   string // 属性名
	Value string // 属性值
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `NodeAttr.Key` | `string` | 属性名 |
| `NodeAttr.Value` | `string` | 属性值 |
