---
sidebar_label: "数据类型"
title: "类型定义 - CyberGo html | 数据类型参考"
description: "CyberGo html 核心数据类型参考：详解 Result 内容提取结果、ImageInfo 图片信息、LinkInfo 链接信息、VideoInfo 与 AudioInfo 视频音频元数据、LinkResource 链接资源、Statistics 处理统计、BatchResult 批量结果、NodeAttr 节点属性等结构体的字段含义，含 MarshalJSON 自定义序列化行为说明。"
sidebar_position: 20
---

# 类型定义

## Result

提取结果，包含文本、元数据和媒体信息。

```go
type Result struct {
    Text           string        `json:"text"`
    Title          string        `json:"title"`
    Images         []ImageInfo   `json:"images,omitempty"`
    Links          []LinkInfo    `json:"links,omitempty"`
    Videos         []VideoInfo   `json:"videos,omitempty"`
    Audios         []AudioInfo   `json:"audios,omitempty"`
    ProcessingTime time.Duration `json:"-"`       // 处理耗时（不参与标准序列化）
    WordCount      int           `json:"word_count"`
    ReadingTime    time.Duration `json:"-"`       // 预估阅读时间（不参与标准序列化）
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
| `Result.ProcessingTime` | `time.Duration` | 本次提取的墙上时间（JSON 输出中为 `processing_time_ms`） |
| `Result.WordCount` | `int` | `Text` 的词数（空白分词，CJK 字符逐字计数） |
| `Result.ReadingTime` | `time.Duration` | 按 `WordCount` 与 200 词/分钟估算的阅读时间（JSON 输出中为 `reading_time_ms`） |

:::tip CJK 词数与阅读时间
`WordCount` 对 CJK 文本（中文/日文等）**逐字计数**——每个字符计为 1「词」，而非按空格分词；`ReadingTime` 采用 200 词/分钟的**英文阅读速率基准**。因此对 CJK 内容，词数会被高估，阅读时间估算相应**偏长**。文档示例中出现的字数/阅读时间数值为当前算法下的示意输出，随算法版本调整可能变化。
:::

### MarshalJSON

自定义 JSON 序列化由 `Result.MarshalJSON` 实现：`ProcessingTime` 和 `ReadingTime` 虽有 `json:"-"` 标签（标准序列化会跳过），但 `Result.MarshalJSON` 会将它们转为毫秒数输出。

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

:::warning 注意：不支持 round-trip
`Result` **未实现 `UnmarshalJSON`**。如果将 `MarshalJSON()` 的输出反序列化回 `Result`，会**丢失 `ProcessingTime`、`ReadingTime` 等 duration 字段**——JSON 输出的键名（`processing_time_ms`、`reading_time_ms`）与 struct 字段名不一致，无法对应还原。

这是**有意设计**：该 JSON 格式面向外部消费（如 API 响应、日志、前端展示），不是为双向序列化准备的。
:::

## ImageInfo

`Result.Images`（`[]ImageInfo`）的元素类型。`ImageInfo` 保存单个 `<img>` 的提取信息。

```go
type ImageInfo struct {
    URL          string `json:"url"`           // 图片地址
    Alt          string `json:"alt"`           // 替代文本
    Title        string `json:"title"`         // 标题
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
| `ImageInfo.Title` | `string` | 咨询标题（`title` 属性） |
| `ImageInfo.Width` | `string` | 宽度属性原文（未解析为数字） |
| `ImageInfo.Height` | `string` | 高度属性原文（未解析为数字） |
| `ImageInfo.IsDecorative` | `bool` | `Alt` 为空时为 `true`（装饰性图片） |
| `ImageInfo.Position` | `int` | 在提取内容中的 1-based 序号（未定位时为 `0`） |

### 字段语义

| 字段 | 说明 |
|------|------|
| `URL` | 图片的 `src` 属性值；仅包含合法 URL（内部校验，不导出），无效 URL 的 `<img>` 不会出现在结果中 |
| `Alt` | `alt` 属性原文；为空时 `IsDecorative` 为 `true` |
| `Title` | `title` 属性原文（非页面标题） |
| `Width`/`Height` | HTML 属性中的**原始字符串**（如 `"640"`、`"50%"`），未解析为数字——不同页面的写法可能不一致 |
| `IsDecorative` | `Alt` 为空时为 `true`，可用于识别装饰性图片并跳过 |
| `Position` | 在文档中的 1-based 序号；当 `PreserveImages = false` 时整个 `Images` 切片为空 |

:::warning Width/Height 非数值类型
`Width` 和 `Height` 是 `string` 类型而非 `int`，保留 HTML 源码中的原始表示（可能含单位、百分比等）。需要数值时由调用方自行解析。
:::

## LinkInfo

`Result.Links`（`[]LinkInfo`）的元素类型，保存单个 `<a>` 的提取信息。

```go
type LinkInfo struct {
    URL        string `json:"url"`         // 链接地址
    Text       string `json:"text"`        // 链接文本
    Title      string `json:"title"`       // 链接标题
    IsExternal bool   `json:"is_external"` // 是否为外部链接（基于 URL 本身是否为绝对外部 URL 判定，不与 BaseURL 对比）
    IsNoFollow bool   `json:"is_nofollow"` // 是否为 nofollow
    Position   int    `json:"position"`    // 在文档中的位置
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `LinkInfo.URL` | `string` | 链接地址（`href` 属性） |
| `LinkInfo.Text` | `string` | 链接可见文本（含嵌套标签内的文本） |
| `LinkInfo.Title` | `string` | 咨询标题（`title` 属性，非链接文本） |
| `LinkInfo.IsExternal` | `bool` | 是否为外部链接 |
| `LinkInfo.IsNoFollow` | `bool` | `rel` 含 `nofollow` 时为 `true` |
| `LinkInfo.Position` | `int` | 在提取内容中的 1-based 序号（无效 `<a>` 仍消耗序号，可能不连续） |

### 字段语义

| 字段 | 说明 |
|------|------|
| `URL` | `href` 属性值；仅包含合法 URL（内部校验，不导出），无效 URL 的 `<a>` 消耗 Position 但不加入切片 |
| `Text` | `<a>` 标签内所有文本节点的递归拼接（含嵌套标签中的文本） |
| `Title` | `title` 属性原文（非链接文本） |
| `IsExternal` | 基于 URL 本身是否为绝对外部地址判定，**不与 `BaseURL` 做域名比较**——这与 `ExtractAllLinks` 中的内外链判定不同 |
| `IsNoFollow` | `rel` 属性中包含 `nofollow`（大小写不敏感，ASCII 折叠匹配）时为 `true` |
| `Position` | 在文档中的 1-based 序号；无效 `<a>`（href 非法或缺失）仍消耗序号但不加入切片，因此 Position 可能不连续 |

## VideoInfo

`Result.Videos`（`[]VideoInfo`）的元素类型。`VideoInfo` 保存单个视频源的提取信息。

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
| `VideoInfo.Type` | `string` | 视频类型（文件容器 MIME 或 `"embed"`，见下方取值规则） |
| `VideoInfo.Poster` | `string` | `<video>` 的封面帧地址（`poster` 属性） |
| `VideoInfo.Width` | `string` | 宽度属性原文（未解析为数字） |
| `VideoInfo.Height` | `string` | 高度属性原文（未解析为数字） |
| `VideoInfo.Duration` | `string` | 时长属性原文（未解析为数字） |

### Type 字段取值规则

| Type 值 | 含义 | 产生场景 |
|---------|------|----------|
| `"embed"` | iframe 引用的视频页面 | YouTube、Vimeo、优酷、Bilibili 等嵌入式播放器 |
| MIME 类型（如 `"video/mp4"`） | 视频文件容器 | `<source type="video/mp4">` 属性值 |
| 空字符串 | 未检测到类型 | `<video src="...">` 直接指定源且无 `<source>` 子元素 |

:::tip 视频提取的三来源
视频提取按原始 HTML 扫描 → DOM 遍历 → 正则兜底三步执行，每步去重。详见 [媒体提取实战](../../guides/core-features/media-extraction)。
:::

## AudioInfo

`Result.Audios`（`[]AudioInfo`）的元素类型。`AudioInfo` 保存单个音频源的提取信息。

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
| `AudioInfo.Type` | `string` | 音频类型（文件容器 MIME，见下方取值规则） |
| `AudioInfo.Duration` | `string` | 时长属性原文（未解析为数字） |

### Type 字段取值规则

| Type 值 | 产生场景 |
|---------|----------|
| MIME 类型（如 `"audio/mpeg"`） | `<source type="audio/mpeg">` 属性值 |
| 空字符串 | `<audio src="...">` 直接指定源且无 `<source>` 子元素 |

:::warning .ogg 扩展名的双重性
OGG 容器可承载视频或音频，`.ogg` URL 会同时出现在 `Videos` 和 `Audios` 中。仅音频变体 `.oga` 只出现在 `Audios`。
:::

## LinkResource

链接资源，`ExtractAllLinks` 系列函数与 `GroupLinksByType` 的元素类型。

```go
type LinkResource struct {
    URL   string // 链接地址（启用 ResolveRelativeURLs 时已基于 BaseURL 解析为绝对地址）
    Title string // 链接标题
    Type  string // 链接类型："link"、"image"、"video"、"audio"、"css"、"js"、"icon"、"media"
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `LinkResource.URL` | `string` | 资源地址；`ResolveRelativeURLs=true` 时已基于 `BaseURL` 解析为绝对地址 |
| `LinkResource.Title` | `string` | 人类可读的资源标签 |
| `LinkResource.Type` | `string` | 资源类型分类（`link`/`image`/`video`/`audio`/`css`/`js`/`icon`/`media`） |

各 `Type` 取值对应的 HTML 标签来源与控制开关详见 [链接提取](../modules/links#链接类型详解)。

## Statistics

处理统计信息，由 `Processor.GetStatistics` 返回。

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
| `Statistics.CacheMisses` | `int64` | 未命中、需完整处理的次数 |
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
| `BatchResult.Results` | `[]*Result` | 与输入一一对应的提取结果，失败/取消项为 `nil` |
| `BatchResult.Errors` | `[]error` | 与输入一一对应的错误，成功项为 `nil` |
| `BatchResult.Success` | `int` | 成功项计数 |
| `BatchResult.Failed` | `int` | 失败项计数 |
| `BatchResult.Cancelled` | `int` | 因 context 取消而未处理的项计数 |

字段语义、取消行为与输入校验详见 [批量处理](../modules/batch)。

## NodeAttr

HTML 节点属性，`ContentNode.Attrs`（`[]NodeAttr`）的元素类型。`NodeAttr` 仅 `Key` 与 `Value` 两个字段。

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
