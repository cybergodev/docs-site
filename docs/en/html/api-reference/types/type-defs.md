---
sidebar_label: "Data Types"
title: "Types - CyberGo html | Data Type Reference"
description: "CyberGo html data types: fields of Result, ImageInfo, LinkInfo, LinkResource, VideoInfo, AudioInfo, Statistics, BatchResult, NodeAttr, plus custom MarshalJSON."
sidebar_position: 20
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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `Result.Text` | `string` | Extracted plain-text body |
| `Result.Title` | `string` | Document title (`<title>`; falls back to the first `<h1>`/`<h2>` when missing) |
| `Result.Images` | `[]ImageInfo` | Images in document order; empty when `PreserveImages=false` |
| `Result.Links` | `[]LinkInfo` | Links in document order; empty when `PreserveLinks=false` |
| `Result.Videos` | `[]VideoInfo` | Extracted video sources; empty when `PreserveVideos=false` |
| `Result.Audios` | `[]AudioInfo` | Extracted audio sources; empty when `PreserveAudios=false` |
| `Result.ProcessingTime` | `time.Duration` | Wall-clock time of this extraction (`processing_time_ms` in JSON output) |
| `Result.WordCount` | `int` | Word count of `Text` (whitespace tokenization; CJK characters counted one by one) |
| `Result.ReadingTime` | `time.Duration` | Reading time estimated from `WordCount` at 200 words per minute (`reading_time_ms` in JSON output) |

### MarshalJSON

Custom JSON serialization is implemented by `Result.MarshalJSON`: `ProcessingTime` and `ReadingTime` carry `json:"-"` tags (standard serialization skips them), but `Result.MarshalJSON` emits them as millisecond values.

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

:::warning
`Result` **does not implement `UnmarshalJSON`**. If you deserialize the output of `MarshalJSON()` back into a `Result`, duration fields such as `ProcessingTime` and `ReadingTime` **will be lost** — the JSON output key names (`processing_time_ms`, `reading_time_ms`) do not match the struct field names, so they cannot be restored.

This is **intentional**: the JSON format is designed for external consumption (e.g., API responses, logs, frontend display), not for bidirectional serialization.
:::

## ImageInfo

Element type of `Result.Images` (`[]ImageInfo`). `ImageInfo` holds the extraction information of a single `<img>`.

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `ImageInfo.URL` | `string` | Image URL (`src` attribute) |
| `ImageInfo.Alt` | `string` | Alternative text (`alt` attribute) |
| `ImageInfo.Title` | `string` | Advisory title (`title` attribute) |
| `ImageInfo.Width` | `string` | Raw width attribute (not parsed into a number) |
| `ImageInfo.Height` | `string` | Raw height attribute (not parsed into a number) |
| `ImageInfo.IsDecorative` | `bool` | `true` when `Alt` is empty (decorative image) |
| `ImageInfo.Position` | `int` | 1-based index in the extracted content (`0` when not located) |

### Field Semantics

| Field | Description |
|-------|-------------|
| `URL` | The `src` attribute value of the image; only valid URLs (internal validation, not exported) are included — `<img>` with an invalid URL does not appear in the result |
| `Alt` | The original `alt` attribute; when empty, `IsDecorative` is `true` |
| `Title` | The original `title` attribute (not the page title) |
| `Width`/`Height` | The **raw strings** from the HTML attributes (e.g. `"640"`, `"50%"`), not parsed into numbers — different pages may use inconsistent formats |
| `IsDecorative` | `true` when `Alt` is empty; can be used to identify and skip decorative images |
| `Position` | 1-based index in the document; when `PreserveImages = false`, the entire `Images` slice is empty |

:::warning Width/Height are string types
`Width` and `Height` are `string` types, not `int`. They preserve the original representation from the HTML source (which may include units, percentages, etc.). Parse them into numbers yourself when needed.
:::

## LinkInfo

Element type of `Result.Links` (`[]LinkInfo`). `LinkInfo` holds the extraction information of a single `<a>`.

```go
type LinkInfo struct {
    URL        string `json:"url"`         // Link URL
    Text       string `json:"text"`        // Link text
    Title      string `json:"title"`       // Link title
    IsExternal bool   `json:"is_external"` // Whether it is an external link (determined by whether the URL itself is an absolute external URL, not by comparison with BaseURL)
    IsNoFollow bool   `json:"is_nofollow"` // Whether the link is nofollow
    Position   int    `json:"position"`    // Position in the document
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `LinkInfo.URL` | `string` | Link URL (`href` attribute) |
| `LinkInfo.Text` | `string` | Visible link text (including text inside nested tags) |
| `LinkInfo.Title` | `string` | Advisory title (`title` attribute, not the link text) |
| `LinkInfo.IsExternal` | `bool` | Whether the link is external |
| `LinkInfo.IsNoFollow` | `bool` | `true` when `rel` contains `nofollow` |
| `LinkInfo.Position` | `int` | 1-based index in the extracted content (invalid `<a>` still consume index numbers, so values may be non-contiguous) |

### Field Semantics

| Field | Description |
|-------|-------------|
| `URL` | The `href` attribute value; only valid URLs (internal validation, not exported) are included — an `<a>` with an invalid URL still consumes a Position but is not added to the slice |
| `Text` | Recursive concatenation of all text nodes inside the `<a>` tag (including text inside nested tags) |
| `Title` | The original `title` attribute (not the link text) |
| `IsExternal` | Determined by whether the URL itself is an absolute external address, **not by domain comparison with `BaseURL`** — this differs from the internal/external link determination in `ExtractAllLinks` |
| `IsNoFollow` | `true` when the `rel` attribute contains `nofollow` (case-insensitive, ASCII-fold matching) |
| `Position` | 1-based index in the document; invalid `<a>` (illegal or missing href) still consume index numbers but are not added to the slice, so Position values may be non-contiguous |

## VideoInfo

Element type of `Result.Videos` (`[]VideoInfo`). `VideoInfo` holds the extraction information of a single video source.

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

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `VideoInfo.URL` | `string` | Video source URL |
| `VideoInfo.Type` | `string` | Video type (file-container MIME or `"embed"`; see the value rules below) |
| `VideoInfo.Poster` | `string` | Poster frame URL of the `<video>` (`poster` attribute) |
| `VideoInfo.Width` | `string` | Raw width attribute (not parsed into a number) |
| `VideoInfo.Height` | `string` | Raw height attribute (not parsed into a number) |
| `VideoInfo.Duration` | `string` | Raw duration attribute (not parsed into a number) |

### Type Field Value Rules

| Type value | Meaning | When it occurs |
|-----------|---------|----------------|
| `"embed"` | A video page referenced by an iframe | Embedded players such as YouTube, Vimeo, Youku, Bilibili |
| MIME type (e.g. `"video/mp4"`) | Video file container | Attribute value from `<source type="video/mp4">` |
| Empty string | No type detected | `<video src="...">` specifying the source directly with no `<source>` child element |

:::tip Three sources of video extraction
Video extraction runs in three steps — raw HTML scan, DOM traversal, regex fallback — with deduplication at each step. See [Media Extraction Guide](../../guides/core-features/media-extraction).
:::

## AudioInfo

Element type of `Result.Audios` (`[]AudioInfo`). `AudioInfo` holds the extraction information of a single audio source.

```go
type AudioInfo struct {
    URL      string `json:"url"`      // Audio URL
    Type     string `json:"type"`     // Audio type
    Duration string `json:"duration"` // Duration
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `AudioInfo.URL` | `string` | Audio source URL |
| `AudioInfo.Type` | `string` | Audio type (file-container MIME; see the value rules below) |
| `AudioInfo.Duration` | `string` | Raw duration attribute (not parsed into a number) |

### Type Field Value Rules

| Type value | When it occurs |
|-----------|----------------|
| MIME type (e.g. `"audio/mpeg"`) | Attribute value from `<source type="audio/mpeg">` |
| Empty string | `<audio src="...">` specifying the source directly with no `<source>` child element |

:::warning Duality of the .ogg extension
An OGG container can carry video or audio; a `.ogg` URL will appear in both `Videos` and `Audios`. The audio-only variant `.oga` appears only in `Audios`.
:::

## LinkResource

Link resource, the element type of the `ExtractAllLinks` function family and `GroupLinksByType`.

```go
type LinkResource struct {
    URL   string // Link URL (already resolved against BaseURL into an absolute address when ResolveRelativeURLs is enabled)
    Title string // Link title
    Type  string // Link type: "link", "image", "video", "audio", "css", "js", "icon", "media"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `LinkResource.URL` | `string` | Resource URL; resolved into an absolute address against `BaseURL` when `ResolveRelativeURLs=true` |
| `LinkResource.Title` | `string` | Human-readable resource label |
| `LinkResource.Type` | `string` | Resource type category (`link`/`image`/`video`/`audio`/`css`/`js`/`icon`/`media`) |

For the HTML tag sources and control switches corresponding to each `Type` value, see [Link Extraction](../modules/links#link-type-reference).

## Statistics

Processing statistics, returned by `Processor.GetStatistics`.

```go
type Statistics struct {
    TotalProcessed     int64         // Total processed count
    CacheHits          int64         // Cache hit count
    CacheMisses        int64         // Cache miss count
    ErrorCount         int64         // Error count
    AverageProcessTime time.Duration // Average processing time
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `Statistics.TotalProcessed` | `int64` | Number of extractions that completed without error (including cache hits) |
| `Statistics.CacheHits` | `int64` | Number of times served directly from the cache |
| `Statistics.CacheMisses` | `int64` | Number of misses requiring full processing |
| `Statistics.ErrorCount` | `int64` | Number of extractions that returned an error |
| `Statistics.AverageProcessTime` | `time.Duration` | Average wall-clock time per extraction |

## BatchResult

Batch processing result, the return type of the `ExtractBatch` function family and methods.

```go
type BatchResult struct {
    Results   []*Result // Extraction results, nil on failure or cancellation
    Errors    []error   // Failed errors
    Success   int       // Success count
    Failed    int       // Failure count
    Cancelled int       // Cancelled count
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `BatchResult.Results` | `[]*Result` | Extraction results in one-to-one correspondence with the input; failed/cancelled items are `nil` |
| `BatchResult.Errors` | `[]error` | Errors in one-to-one correspondence with the input; successful items are `nil` |
| `BatchResult.Success` | `int` | Count of successful items |
| `BatchResult.Failed` | `int` | Count of failed items |
| `BatchResult.Cancelled` | `int` | Count of items left unprocessed due to context cancellation |

For field semantics, cancellation behavior, and input validation see [Batch Processing](../modules/batch).

## NodeAttr

HTML node attribute, the element type of `ContentNode.Attrs` (`[]NodeAttr`). `NodeAttr` has only two fields, `Key` and `Value`.

```go
type NodeAttr struct {
    Key   string // Attribute name
    Value string // Attribute value
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `NodeAttr.Key` | `string` | Attribute name |
| `NodeAttr.Value` | `string` | Attribute value |
