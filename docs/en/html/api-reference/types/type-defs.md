---
sidebar_label: "Data Types"
title: "Type Definitions - CyberGo html | Data Type Reference"
description: "CyberGo html data types: Result with metadata and quality signals, ReadResult, PageSection, SectionKind, ImageInfo, LinkInfo, and NodeAttr."
sidebar_position: 20
---

# Type Definitions

Extraction results are carried by a set of exported structs: `Result` (body extraction), `ReadResult`/`PageSection`/`SectionKind` (reader mode), `ImageInfo`/`LinkInfo`/`VideoInfo`/`AudioInfo` (media and links), and `Statistics`/`BatchResult` (statistics and batching). This page documents each field's value rules and JSON serialization behavior.

## Result

The extraction result, holding text, metadata, and media information.

```go
type Result struct {
	Text           string        `json:"text"`
	Title          string        `json:"title"`
	Images         []ImageInfo   `json:"images,omitempty"`
	Links          []LinkInfo    `json:"links,omitempty"`
	Videos         []VideoInfo   `json:"videos,omitempty"`
	Audios         []AudioInfo   `json:"audios,omitempty"`
	ProcessingTime time.Duration `json:"-"` // Processing duration (excluded from standard serialization)
	WordCount      int           `json:"word_count"`
	ReadingTime    time.Duration `json:"-"` // Estimated reading time (excluded from standard serialization)

	Author           string    `json:"author,omitempty"`
	PublishedTime    time.Time `json:"published_time,omitzero"`
	Description      string    `json:"description,omitempty"`
	SiteName         string    `json:"site_name,omitempty"`
	CanonicalURL     string    `json:"canonical_url,omitempty"`
	Confidence       float64   `json:"confidence"`
	ExtractionMethod string    `json:"extraction_method,omitempty"`
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `Result.Text` | `string` | Extracted plain-text body |
| `Result.Title` | `string` | Document title. When `ExtractMetadata=true` (the default) and the page declares a metadata title, the value is JSON-LD `headline` > `og:title` > the `name` of a WebPage/WebSite-typed JSON-LD node (the last resort), with the suffix stripped only when the trailing segment exactly (case-insensitively) equals the declared site name; otherwise `<title>` (with a site-name suffix strip when the trailing segment is ≤30 characters and the leading part is ≥3 characters) → h1 inside the body → first h1 in the document → first h2 |
| `Result.Images` | `[]ImageInfo` | Images in document order; empty when `PreserveImages=false` |
| `Result.Links` | `[]LinkInfo` | Links in document order; empty when `PreserveLinks=false` |
| `Result.Videos` | `[]VideoInfo` | Extracted video sources; empty when `PreserveVideos=false` |
| `Result.Audios` | `[]AudioInfo` | Extracted audio sources; empty when `PreserveAudios=false` |
| `Result.ProcessingTime` | `time.Duration` | Wall-clock time of this extraction (`processing_time_ms` in JSON) |
| `Result.WordCount` | `int` | Word count of `Text`: whitespace tokenization, CJK characters counted one by one |
| `Result.ReadingTime` | `time.Duration` | Reading-time estimate: whitespace-tokenized languages at 200 words per minute, CJK characters at 350 characters per minute, converted separately and added (`reading_time_ms` in JSON) |
| `Result.Author` | `string` | Author; multiple declarations are joined with `", "`; empty values are omitted from JSON |
| `Result.PublishedTime` | `time.Time` | Publication time; the zero time means unknown; the zero time is omitted from JSON |
| `Result.Description` | `string` | Page summary; omitted from JSON when empty |
| `Result.SiteName` | `string` | Publishing site name; omitted from JSON when empty |
| `Result.CanonicalURL` | `string` | Canonical URL; omitted from JSON when empty |
| `Result.Confidence` | `float64` | Extraction quality signal, values below; it has **no** `omitempty`, so it always appears in JSON |
| `Result.ExtractionMethod` | `string` | How the body was produced: `article` / `listing` / `body`; omitted from JSON when empty |

### Metadata Field Resolution

`Author`, `PublishedTime`, `Description`, `SiteName`, and `CanonicalURL` are filled only when `Config.ExtractMetadata=true` (the default). Each source uses the first matching element in the document; JSON-LD runs a two-pass priority (article-typed blocks first, then the remaining blocks fill gaps).

| Field | Source priority |
|-------|-----------------|
| `Author` | JSON-LD `author` (a string, a `{name}` object, or an array of either) > `<meta name="author">` |
| `PublishedTime` | `article:published_time` > JSON-LD `datePublished`; stays at the zero time when parsing fails |
| `Description` | `og:description` > JSON-LD `description` > `<meta name="description">` |
| `SiteName` | `og:site_name` > JSON-LD `publisher.name` (or the `name` of a standalone Organization/WebSite node) |
| `CanonicalURL` | `<link rel="canonical">` > `og:url` |

With `ExtractMetadata` off, those five fields stay empty and the title no longer prefers metadata titles (see `Result.Title` in the table above).

### Quality Signals

`Confidence` lies in `[0, 1]`, letting a pipeline decide whether to fall back or require manual review:

| Value | Condition |
|-------|-----------|
| `0` | No text was extracted |
| `0.2` / `0.4` / `0.6` | Fell back to `<body>` (`ExtractionMethod="body"`), graded by text length (<50 characters / <200 characters / the rest) |
| `0.4` | Short text (<600 characters) whose opening matches subscription or consent-wall wording; or an article-class node that yielded very little text |
| `0.6` | Detected as a listing page; or the article node's text is short (≥50 and <200 characters) |
| `0.8` | The article node's text is substantial (≥200 characters) but covers less than 5% of the page's visible text |
| `1.0` | The article node's text is substantial and the share is on target |

The length thresholds in the grading (50/200/600) are judged by the **byte length** of `len(text)`; the subscription/consent-wall wording is scanned only in the first 800 bytes of the text.

`ExtractionMethod` values: `article` (the scorer selected a main-content node), `listing` (detected as a card listing page; `Text` is the whole card list), `body` (fell back to the whole `<body>` because no candidate scored above 0, or because `ExtractArticle=false`).

:::tip CJK word count and reading time
`WordCount` first tokenizes on whitespace, then counts each CJK character (ideograph, kana, Hangul syllable) as one word. `ReadingTime` converts with **two rates**: non-CJK words at 200 words per minute and CJK characters at 350 characters per minute, then adds both parts. CJK content therefore has a high word count without its reading time being overestimated at the English rate. The counts and times shown in documentation examples are illustrative outputs of the current algorithm and change with the algorithm version.
:::

### MarshalJSON

`Result.MarshalJSON` customizes JSON serialization: although `ProcessingTime` and `ReadingTime` carry `json:"-"` tags, they are still emitted as millisecond values.

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

:::warning The JSON output does not round-trip
`Result` **does not implement `UnmarshalJSON`**. Deserializing the output of `MarshalJSON()` back into a `Result` **loses** `ProcessingTime` and `ReadingTime`: the JSON key names (`processing_time_ms`, `reading_time_ms`) do not match the struct field names, so they cannot be restored.

This is intentional: the format targets external consumers (API responses, logs, frontend display), not bidirectional serialization.
:::

## ReadResult

Return type of reader mode (`ReadPage*`): a reading view of the whole page split by kind, not just the selected body. Fields are abbreviated below; the full struct definition and `Render`/`RenderText` behavior are in [Reader Mode](../core/reader#readresult).

| Field | Type | Description |
|-------|------|-------------|
| `ReadResult.Title` | `string` | Document title, same priority as `Result.Title` |
| `ReadResult.Author` | `string` | Author; empty when `ExtractMetadata=false` |
| `ReadResult.PublishedTime` | `time.Time` | Publication time; the zero time means unknown |
| `ReadResult.Description` | `string` | Page summary |
| `ReadResult.SiteName` | `string` | Publishing site name |
| `ReadResult.CanonicalURL` | `string` | Canonical URL |
| `ReadResult.Sections` | `[]PageSection` | Sections in document order; adjacent same-kind sections merge, empty ones drop; never `nil` |
| `ReadResult.ProcessingTime` | `time.Duration` | Processing duration (excluded from JSON) |

## PageSection

Element type of `ReadResult.Sections`: one page region with a kind label. Only fields are listed here; cleaning rules and link-preservation semantics are in [Reader Mode](../core/reader#key-semantics).

| Field | Type | Description |
|-------|------|-------------|
| `PageSection.Kind` | `SectionKind` | Section kind |
| `PageSection.Text` | `string` | Section body; inline links follow `InlineLinkFormat` |
| `PageSection.PlainText` | `string` | Same text without link and image markup; used by `RenderText` |
| `PageSection.Links` | `[]LinkInfo` | Links in the section; empty when `PreserveLinks=false` |
| `PageSection.Images` | `[]ImageInfo` | Images in the section; empty when `PreserveImages=false` |
| `PageSection.WordCount` | `int` | Word count of `PlainText` (CJK characters count one each) |

## SectionKind

Section kinds, 5 constants in total. Detection rules are in [Reader Mode](../core/reader#sectionkind).

| Constant | Value | Heading in `Render` |
|----------|-------|--------------------|
| `SectionHeader` | `header` | `Header` |
| `SectionNavigation` | `navigation` | `Navigation` |
| `SectionMain` | `main` | `Main Content` |
| `SectionAside` | `aside` | `Aside` |
| `SectionFooter` | `footer` | `Footer` |

There can be several `main` sections (for example an article followed by a comment block that is also classified as main content).

## ImageInfo

Element type of `Result.Images` (`[]ImageInfo`). `ImageInfo` holds the extraction information of a single `<img>`.

```go
type ImageInfo struct {
	URL          string `json:"url"`           // Image URL
	Alt          string `json:"alt"`           // Alternative text
	Title        string `json:"title"`         // Raw title attribute
	Width        string `json:"width"`         // Width
	Height       string `json:"height"`        // Height
	IsDecorative bool   `json:"is_decorative"` // Whether the image is decorative
	Position     int    `json:"position"`      // Position in the document
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `ImageInfo.URL` | `string` | The `src` value; only valid URLs are kept, so an `<img>` with an invalid URL does not appear in the result (and consumes no position number) |
| `ImageInfo.Alt` | `string` | The raw `alt` attribute; when it is empty, `IsDecorative` is `true` |
| `ImageInfo.Title` | `string` | The raw `title` attribute (advisory text, not the page title) |
| `ImageInfo.Width` | `string` | The **raw string** of the width attribute (e.g. `"640"`, `"50%"`), not parsed into a number |
| `ImageInfo.Height` | `string` | The **raw string** of the height attribute, not parsed into a number |
| `ImageInfo.IsDecorative` | `bool` | `true` when `Alt` is empty; useful for skipping decorative images |
| `ImageInfo.Position` | `int` | 1-based index among valid images (an invalid `<img>` consumes no number); when `PreserveImages=false`, the whole `Images` slice is empty |

:::warning Width/Height are strings
`Width` and `Height` are `string`, not `int`, and preserve the original HTML spelling (units, percentages). Parse them into numbers yourself when needed.
:::

## LinkInfo

Element type of `Result.Links` (`[]LinkInfo`). `LinkInfo` holds the extraction information of a single `<a>`.

```go
type LinkInfo struct {
	URL        string `json:"url"`         // Link URL
	Text       string `json:"text"`        // Link text
	Title      string `json:"title"`       // Raw title attribute
	IsExternal bool   `json:"is_external"` // External link (judged from the URL alone, not against BaseURL)
	IsNoFollow bool   `json:"is_nofollow"` // Whether the link is nofollow
	Position   int    `json:"position"`    // Position in the document
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `LinkInfo.URL` | `string` | The `href` value; only valid URLs are kept — bare fragments (`#top`) and bare queries (`?page=2`) are in-page navigation, and rejected schemes such as `javascript:`/`vbscript:`/`file:` are excluded too. Such `<a>` elements are not added to the slice but still consume a `Position`, keeping `[LINK:n]` placeholders aligned with `Text` |
| `LinkInfo.Text` | `string` | Recursive concatenation of all text nodes inside the `<a>` (including text in nested tags) |
| `LinkInfo.Title` | `string` | The raw `title` attribute (advisory text, not the link text) |
| `LinkInfo.IsExternal` | `bool` | An absolute `http(s)` or protocol-relative (`//`) href is external, a relative href is internal; **no domain comparison with `BaseURL`** (a same-domain absolute link is still `true`) |
| `LinkInfo.IsNoFollow` | `bool` | `true` when `rel` contains `nofollow` (case-insensitive) |
| `LinkInfo.Position` | `int` | 1-based index in the extracted content; invalid `<a>` elements (illegal, missing, or rejected href) still consume a number, so values may be non-contiguous |

`IsNoFollow` is commonly used for SEO and outbound-link audits: links whose `rel` carries `nofollow` (sponsored, UGC, and the like) pass no search ranking weight, so an outbound-link analysis can split them into organic links versus paid or endorsed ones.

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
| `VideoInfo.Type` | `string` | Container MIME or `"embed"`; see the value rules below |
| `VideoInfo.Poster` | `string` | Poster frame URL of the `<video>` (the `poster` attribute) |
| `VideoInfo.Width` | `string` | Raw width attribute, not parsed into a number |
| `VideoInfo.Height` | `string` | Raw height attribute, not parsed into a number |
| `VideoInfo.Duration` | `string` | Raw duration attribute, not parsed into a number |

### Type Field Value Rules

The value depends on the element type:

- `<video>`, `<embed>`, `<object>`: the declared value first — `<source type>` for `<video>`, the element's own `type` attribute for `<embed>`/`<object>`. When undeclared, it is derived from the URL: an embed-host pattern (YouTube, Vimeo, Youku, Bilibili, and similar) gives `"embed"`; a recognizable extension gives the matching MIME type (`a.mp4` → `video/mp4`, `b.webm` → `video/webm`); otherwise an empty string.
- `<iframe>`: always `"embed"`. The src must itself be a video URL or a known embed-host address, or the iframe produces no `VideoInfo`.
- A URL found by the bare-URL scan: derived from the URL only, by the same rules (embed-host pattern → `"embed"`, extension → MIME type).

| Type value | Meaning | When it occurs |
|-----------|---------|----------------|
| Declared MIME type | Video container | `<source type="video/mp4">`, `<embed type="video/mp4">` |
| Derived MIME type | Video container | `<video src="a.mp4">` and similar, with no `type` but a recognizable extension |
| `"embed"` | Embedded player page | An `<iframe>` src, or an `<embed>`/`<object>` or bare URL matching an embed-host pattern |
| Empty string | Unrecognized | `<video src="/stream/abc">` and similar: no extension, not an embed address, no `type` |

:::tip Three sources of video extraction
Video extraction has three sources: the raw-HTML tag scan (`<iframe>`/`<embed>`/`<object>`), the DOM walk, and the bare-URL scan. Results are deduplicated by URL. See [Media Extraction](../../guides/core-features/media-extraction).
:::

## AudioInfo

`AudioInfo` is the element type of `Result.Audios` (`[]AudioInfo`). It holds the extraction information of a single audio source.

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
| `AudioInfo.Type` | `string` | Container MIME; see the value rules below |
| `AudioInfo.Duration` | `string` | Raw duration attribute, not parsed into a number |

### Type Field Value Rules

| Type value | When it occurs |
|-----------|----------------|
| Declared MIME type | The value of `<source type="audio/mpeg">` |
| Derived MIME type | `<audio src="a.mp3">` and similar, with no `type` but a recognizable extension (e.g. `audio/mpeg`) |
| Empty string | No recognizable extension and no `type` declaration |

:::warning `.ogg` appears in both slices
An OGG container can carry video or audio, so a `.ogg` URL lands in both `Videos` and `Audios`. The audio-only `.oga` appears only in `Audios`.
:::

## LinkResource

Link resource, the element type of the `ExtractAllLinks` family and `GroupLinksByType`.

```go
type LinkResource struct {
	URL   string // Link URL (resolved against BaseURL when ResolveRelativeURLs is on)
	Title string // Resource label
	Type  string // Type: "link", "image", "video", "audio", "css", "js", "icon", "media"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `LinkResource.URL` | `string` | Resource URL; resolved into an absolute address against `BaseURL` when `ResolveRelativeURLs=true` |
| `LinkResource.Title` | `string` | Human-readable resource label |
| `LinkResource.Type` | `string` | Resource type (`link`/`image`/`video`/`audio`/`css`/`js`/`icon`/`media`) |

For the HTML tag sources and control switches behind each `Type`, see [Link Extraction](../modules/links#link-type-reference).

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
| `Statistics.TotalProcessed` | `int64` | Extractions that completed without error (including cache hits) |
| `Statistics.CacheHits` | `int64` | Times served directly from the cache |
| `Statistics.CacheMisses` | `int64` | Misses that required full processing (not counted when the cache is disabled) |
| `Statistics.ErrorCount` | `int64` | Extractions that failed after processing started: oversized input, encoding-conversion failures, and every error raised during processing (including processing timeouts and cancellations landing in that phase). Not counted: context cancellations observed before processing starts, calls rejected by a closed processor, and file-read errors |
| `Statistics.AverageProcessTime` | `time.Duration` | Average wall-clock time per extraction; cache hits count into the sample too (with near-zero duration) |

## BatchResult

Batch processing result, the return type of the `ExtractBatch` family.

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
| `BatchResult.Results` | `[]*Result` | Results in one-to-one correspondence with the input; failed/cancelled items are `nil` |
| `BatchResult.Errors` | `[]error` | Errors in one-to-one correspondence with the input; successful items are `nil` |
| `BatchResult.Success` | `int` | Count of successful items |
| `BatchResult.Failed` | `int` | Count of failed items |
| `BatchResult.Cancelled` | `int` | Count of items left unprocessed due to context cancellation |

For field semantics, cancellation behavior, and input validation see [Batch Processing](../modules/batch).

## NodeAttr

`NodeAttr` represents an HTML node attribute and is the element type of `ContentNode.Attrs` (`[]NodeAttr`): `Key` holds the attribute name (e.g. `href`, `class`) and `Value` the corresponding attribute value.

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
