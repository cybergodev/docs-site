---
sidebar_label: "Link Extraction"
title: "Link Extraction - CyberGo html | Resource Link API"
description: "CyberGo html link extraction API: ExtractAllLinks family and GroupLinksByType to extract resource links, group them by type, with configurable filtering."
sidebar_position: 2
---

# Link Extraction

Standalone link extraction API that can extract all link resources from HTML and group them by type.

:::tip Key difference from Extract
`ExtractAllLinks` does **not** apply HTML sanitization (`EnableSanitization` has no effect here), so resource links inside tags such as `<script src>`, `<iframe>`, `<link>`, and `<embed>` are extracted in full. This lets those resource links be enumerated — in the `Extract` path they are normally removed during sanitization.
:::

:::info Result ordering and deduplication
`ExtractAllLinks` returns results **sorted by URL ascending** and deduplicated by URL. Calling it repeatedly on the same input therefore yields identical output (since v1.4.2), which eases result comparison, cache reuse, and reproducible downstream processing. When the same URL appears in multiple tags, only one record is kept.
:::

## Package Functions

```go
func ExtractAllLinks(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFile(filePath string, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)
```

## Processor Methods

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## Grouping Utility

### GroupLinksByType

Group links by their type.

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, _ := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)

for typ, items := range groups {
    fmt.Printf("Type %s: %d items\n", typ, len(items))
}
```

## LinkResource

```go
type LinkResource struct {
    URL   string // Link URL
    Title string // Link title
    Type  string // Link type (link, image, video, audio, media, css, js, icon)
}
```

## Configuration

Link extraction behavior is controlled via `Config` link filtering fields:

```go
cfg := html.DefaultConfig()
cfg.IncludeImages = true
cfg.IncludeCSS = true
cfg.IncludeJS = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"
```

:::tip
When `ResolveRelativeURLs=true` and `BaseURL` is **empty**, the library automatically derives BaseURL from the HTML document itself, trying each of the following **in priority order** and returning the first match:

1. the `<base href>` tag;
2. the `content` of `<meta property="og:url">` or `<meta property="canonical">`;
3. `<link rel="canonical" href>`;
4. the first absolute URL found in the document (extracting the base from its `href`/`src`).

Setting `BaseURL` explicitly **skips auto-detection** and uses the value provided by the caller.
:::
