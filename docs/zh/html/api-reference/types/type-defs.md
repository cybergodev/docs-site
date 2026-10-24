---
sidebar_label: "数据类型"
title: "类型定义 - CyberGo html | 数据类型参考"
description: "CyberGo html 数据类型参考：Result、ImageInfo、LinkInfo、VideoInfo、AudioInfo、LinkResource、Statistics、BatchResult 与 NodeAttr 的字段含义、取值规则与 JSON 序列化行为。"
sidebar_position: 20
---

# 类型定义

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
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `Result.Text` | `string` | 提取的正文纯文本 |
| `Result.Title` | `string` | 文档标题（`<title>`，缺失时取首个 `<h1>`/`<h2>`） |
| `Result.Images` | `[]ImageInfo` | 按文档顺序排列的图片；`PreserveImages=false` 时为空 |
| `Result.Links` | `[]LinkInfo` | 按文档顺序排列的链接；`PreserveLinks=false` 时为空 |
| `Result.Videos` | `[]VideoInfo` | 提取的视频源；`PreserveVideos=false` 时为空 |
| `Result.Audios` | `[]AudioInfo` | 提取的音频源；`PreserveAudios=false` 时为空 |
| `Result.ProcessingTime` | `time.Duration` | 本次提取的墙上时间（JSON 中为 `processing_time_ms`） |
| `Result.WordCount` | `int` | `Text` 的词数：空白分词，CJK 字符逐字计数 |
| `Result.ReadingTime` | `time.Duration` | 按 `WordCount` 与 200 词/分钟估算的阅读时间（JSON 中为 `reading_time_ms`） |

:::tip CJK 词数与阅读时间
`WordCount` 先按空白分词，再把 CJK 字符（汉字、假名、谚文音节）各计为 1 个词。`ReadingTime` 按 200 词/分钟的**英文阅读速率**折算。因此 CJK 内容的词数偏高，阅读时间估算也偏长。文档示例中的字数与阅读时间为当前算法下的示意输出，随算法版本变化。
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
| `ImageInfo.URL` | `string` | 图片地址（`src` 属性） |
| `ImageInfo.Alt` | `string` | 替代文本（`alt` 属性） |
| `ImageInfo.Title` | `string` | `title` 属性原文（提示性文本） |
| `ImageInfo.Width` | `string` | 宽度属性原文，未解析为数字 |
| `ImageInfo.Height` | `string` | 高度属性原文，未解析为数字 |
| `ImageInfo.IsDecorative` | `bool` | `Alt` 为空时为 `true` |
| `ImageInfo.Position` | `int` | 在有效图片中的 1-based 序号（无效 `<img>` 不占用序号） |

### 字段语义

| 字段 | 说明 |
|------|------|
| `ImageInfo.URL` | `src` 属性值；仅保留合法 URL，无效 URL 的 `<img>` 不出现在结果中 |
| `ImageInfo.Alt` | `alt` 属性原文；为空时 `IsDecorative` 为 `true` |
| `ImageInfo.Title` | `title` 属性原文（不是页面标题） |
| `ImageInfo.Width` / `ImageInfo.Height` | HTML 属性中的**原始字符串**（如 `"640"`、`"50%"`），未解析为数字 |
| `ImageInfo.IsDecorative` | `Alt` 为空时为 `true`，可用于跳过装饰性图片 |
| `ImageInfo.Position` | 在有效图片中的 1-based 序号；`PreserveImages=false` 时整个 `Images` 切片为空 |

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
| `LinkInfo.URL` | `string` | 链接地址（`href` 属性） |
| `LinkInfo.Text` | `string` | 链接可见文本（含嵌套标签内的文本） |
| `LinkInfo.Title` | `string` | `title` 属性原文（提示性文本，不是链接文本） |
| `LinkInfo.IsExternal` | `bool` | 是否为外部链接 |
| `LinkInfo.IsNoFollow` | `bool` | `rel` 含 `nofollow` 时为 `true` |
| `LinkInfo.Position` | `int` | 在提取内容中的 1-based 序号（无效 `<a>` 仍消耗序号，可能不连续） |

### 字段语义

| 字段 | 说明 |
|------|------|
| `LinkInfo.URL` | `href` 属性值；仅保留合法 URL，无效 URL 的 `<a>` 消耗 `Position` 但不进入切片 |
| `LinkInfo.Text` | `<a>` 内所有文本节点的递归拼接（含嵌套标签中的文本） |
| `LinkInfo.Title` | `title` 属性原文（不是链接文本） |
| `LinkInfo.IsExternal` | 绝对 `http(s)` 或协议相对（`//`）的 href 为外部，相对 href 为内部；**不与 `BaseURL` 比较域名** |
| `LinkInfo.IsNoFollow` | `rel` 含 `nofollow`（大小写不敏感，ASCII 折叠匹配）时为 `true` |
| `LinkInfo.Position` | 文档中的 1-based 序号；无效 `<a>`（href 非法或缺失）仍消耗序号，因此 `Position` 可能不连续 |

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
| `Statistics.ErrorCount` | `int64` | 返回错误的提取次数 |
| `Statistics.AverageProcessTime` | `time.Duration` | 每次提取的平均墙上时间 |

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

`NodeAttr` 表示 HTML 节点属性，是 `ContentNode.Attrs`（`[]NodeAttr`）的元素类型。

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
