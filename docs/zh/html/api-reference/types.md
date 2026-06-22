---
title: "类型定义 - CyberGo HTML | 数据类型参考"
description: "CyberGo HTML 数据类型：Result（自定义 JSON 序列化）、ImageInfo、LinkInfo、LinkResource、Statistics、BatchResult 等核心类型字段说明。"
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

### MarshalJSON

自定义 JSON 序列化，`ProcessingTime` 和 `ReadingTime` 虽有 `json:"-"` 标签（标准序列化会跳过），但通过自定义 `MarshalJSON()` 方法将它们转为毫秒数输出。

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

## ImageInfo

图片信息。

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

## LinkInfo

链接信息。

```go
type LinkInfo struct {
    URL        string `json:"url"`         // 链接地址
    Text       string `json:"text"`        // 链接文本
    Title      string `json:"title"`       // 链接标题
    IsExternal bool   `json:"is_external"` // 是否为外部链接
    IsNoFollow bool   `json:"is_nofollow"` // 是否为 nofollow
    Position   int    `json:"position"`    // 在文档中的位置
}
```

## VideoInfo

视频信息。

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

## AudioInfo

音频信息。

```go
type AudioInfo struct {
    URL      string `json:"url"`      // 音频地址
    Type     string `json:"type"`     // 音频类型
    Duration string `json:"duration"` // 时长
}
```

## LinkResource

链接资源（用于链接提取 API）。

```go
type LinkResource struct {
    URL   string // 链接地址
    Title string // 链接标题
    Type  string // 链接类型
}
```

## Statistics

处理统计信息。

```go
type Statistics struct {
    TotalProcessed     int64         // 总处理数
    CacheHits          int64         // 缓存命中数
    CacheMisses        int64         // 缓存未命中数
    ErrorCount         int64         // 错误数
    AverageProcessTime time.Duration // 平均处理时间
}
```

## BatchResult

批量处理结果。

```go
type BatchResult struct {
    Results   []*Result // 提取结果，失败或取消时为 nil
    Errors    []error   // 失败的错误
    Success   int       // 成功数量
    Failed    int       // 失败数量
    Cancelled int       // 取消数量
}
```

## NodeAttr

HTML 节点属性。

```go
type NodeAttr struct {
    Key   string // 属性名
    Value string // 属性值
}
```
