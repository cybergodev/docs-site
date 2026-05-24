---
title: "Types - HTML"
description: "Data type reference for CyberGo HTML, including Result, ImageInfo, LinkInfo, VideoInfo, AudioInfo, LinkResource, Statistics, BatchResult, and NodeAttr types."
---

# Types

## Result

Extraction result containing text, metadata, and media information.

```go
type Result struct {
    Text           string        `json:"text"`
    Title          string        `json:"title"`
    Images         []ImageInfo   `json:"images,omitempty"`
    Links          []LinkInfo    `json:"links,omitempty"`
    Videos         []VideoInfo   `json:"videos,omitempty"`
    Audios         []AudioInfo   `json:"audios,omitempty"`
    ProcessingTime time.Duration `json:"-"`       // Processing duration (excluded from standard serialization)
    WordCount      int           `json:"word_count"`
    ReadingTime    time.Duration `json:"-"`       // Estimated reading time (excluded from standard serialization)
}
```

### MarshalJSON

Custom JSON serialization. `ProcessingTime` and `ReadingTime` have `json:"-"` tags (standard serialization skips them), but the custom `MarshalJSON()` method includes them as millisecond values.

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

## ImageInfo

Image information.

```go
type ImageInfo struct {
    URL          string `json:"url"`           // Image URL
    Alt          string `json:"alt"`           // Alternative text
    Title        string `json:"title"`         // Title
    Width        string `json:"width"`         // Width
    Height       string `json:"height"`        // Height
    IsDecorative bool   `json:"is_decorative"` // Whether the image is decorative
    Position     int    `json:"position"`      // Position in the document
}
```

## LinkInfo

Link information.

```go
type LinkInfo struct {
    URL        string `json:"url"`         // Link URL
    Text       string `json:"text"`        // Link text
    Title      string `json:"title"`       // Link title
    IsExternal bool   `json:"is_external"` // Whether the link is external
    IsNoFollow bool   `json:"is_nofollow"` // Whether the link is nofollow
    Position   int    `json:"position"`    // Position in the document
}
```

## VideoInfo

Video information.

```go
type VideoInfo struct {
    URL      string `json:"url"`      // Video URL
    Type     string `json:"type"`     // Video type
    Poster   string `json:"poster"`   // Poster image URL
    Width    string `json:"width"`    // Width
    Height   string `json:"height"`   // Height
    Duration string `json:"duration"` // Duration
}
```

## AudioInfo

Audio information.

```go
type AudioInfo struct {
    URL      string `json:"url"`      // Audio URL
    Type     string `json:"type"`     // Audio type
    Duration string `json:"duration"` // Duration
}
```

## LinkResource

Link resource (used by link extraction API).

```go
type LinkResource struct {
    URL   string // Link URL
    Title string // Link title
    Type  string // Link type
}
```

## Statistics

Processing statistics.

```go
type Statistics struct {
    TotalProcessed    int64         // Total processed count
    CacheHits         int64         // Cache hit count
    CacheMisses       int64         // Cache miss count
    ErrorCount        int64         // Error count
    AverageProcessTime time.Duration // Average processing time
}
```

## BatchResult

Batch processing result.

```go
type BatchResult struct {
    Results   []*Result // Extraction results, nil on failure or cancellation
    Errors    []error   // Failed errors
    Success   int       // Success count
    Failed    int       // Failure count
    Cancelled int       // Cancelled count
}
```

## NodeAttr

HTML node attribute.

```go
type NodeAttr struct {
    Key   string // Attribute name
    Value string // Attribute value
}
```
