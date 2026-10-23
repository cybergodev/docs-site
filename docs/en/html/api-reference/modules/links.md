---
sidebar_label: "Link Extraction"
title: "Link Extraction - CyberGo html | Resource Link API"
description: "CyberGo html link extraction API: ExtractAllLinks family and GroupLinksByType for script, style, and image links, type grouping, filtering, URL dedup, sorting."
sidebar_position: 20
---

# Link Extraction

A standalone link extraction API that extracts all link resources from HTML and groups them by type.

:::tip
`ExtractAllLinks` does **not** apply HTML sanitization (`EnableSanitization` has no effect here), so resource links inside tags such as `<script src>`, `<iframe>`, `<link>`, and `<embed>` are extracted in full. This lets those resource links be enumerated — in the `Extract` path they are normally removed during sanitization.
:::

:::info
`ExtractAllLinks` returns results **sorted by URL ascending** and deduplicated by URL. Calling it repeatedly on the same input therefore yields identical output, which eases result comparison, cache reuse, and reproducible downstream processing. When the same URL appears in multiple tags, only one record is kept.
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

Group links by their type. Links with an empty `Type` are grouped under the `unknown` key.

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

## Link Type Reference

Each `Type` corresponds to a specific HTML tag source:

| Type value | Source HTML tags | Control switch |
|------------|------------------|----------------|
| `link` | `<a href>` | `IncludeContentLinks` / `IncludeExternalLinks` |
| `image` | `<img src>` | `IncludeImages` |
| `video` | `<video src>`, `<source type="video/*">`, `<iframe>`/`<embed>`/`<object>` (video URLs) | `IncludeVideos` |
| `audio` | `<audio src>`, `<source type="audio/*">` | `IncludeAudios` |
| `media` | `<source>` when video/audio cannot be determined | `IncludeVideos` / `IncludeAudios` |
| `css` | `<link rel="stylesheet">` | `IncludeCSS` |
| `js` | `<script src>` | `IncludeJS` |
| `icon` | `<link rel="icon">`, `<link rel="apple-touch-icon">`, etc. | `IncludeIcons` |

:::info
The `src`/`data` of `<iframe>`, `<embed>`, and `<object>` is only extracted when judged to be a **video URL** (matching embed patterns for YouTube, Vimeo, Dailymotion, etc.), in which case the type is recorded as `video`. Non-video URLs are not collected.
:::

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

### Relative URL Resolution

When `ResolveRelativeURLs=true` (default), relative URLs of all types are uniformly resolved to absolute URLs based on `BaseURL`:

- The resolution logic is handled centrally inside the library (not exported), treating content links, images, media, source, script, embed, and link tags **identically**
- Setting `BaseURL` explicitly **skips auto-detection** and directly uses the value provided by the caller
- When `BaseURL` is empty and `ResolveRelativeURLs=true`, BaseURL is auto-derived from the document (see the tip below)

### Internal vs External Links

Content links (`<a href>`) control internal and external links via two separate switches:

| Switch | Scope | Determination |
|--------|-------|---------------|
| `IncludeContentLinks` | Internal links | The URL itself is a relative path (when `BaseURL` is set, it resolves to the same domain) |
| `IncludeExternalLinks` | External links | The URL itself is an absolute external address (`http(s)://` or protocol-relative `//`) — always treated as external regardless of whether it shares the `BaseURL` domain |

Both default to `true` (extracting all content links). Other resource types (images, CSS, JS, etc.) are not subject to the internal/external distinction and are controlled only by their respective `Include*` switches.

### preload / prefetch Handling

`<link rel="preload" as="...">` and `rel="prefetch"` are routed to different types based on the `as` attribute:

| `as` value | Routed to type | Control switch |
|------------|----------------|----------------|
| `style` | `css` | `IncludeCSS` |
| `script` | `js` | `IncludeJS` |
| `image` | `image` | `IncludeImages` |
| `video` | `video` | `IncludeVideos` |
| `audio` | `audio` | `IncludeAudios` |

`dns-prefetch` and `preconnect` go through the same routing but typically carry no `as` attribute, so they are not collected.

:::tip
When `ResolveRelativeURLs=true` and `BaseURL` is **empty**, the library automatically derives BaseURL from the HTML document itself, trying each of the following **in priority order** and returning the first match:

1. the `<base href>` tag;
2. the `content` of `<meta property="og:url">` or `<meta property="canonical">`;
3. `<link rel="canonical" href>`;
4. the first absolute URL found in the document (extracting the base from its `href`/`src`).

Setting `BaseURL` explicitly **skips auto-detection** and uses the value provided by the caller.
:::

## Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head>
<link rel="stylesheet" href="/css/main.css">
<link rel="icon" href="/favicon.ico">
<script src="/js/app.js"></script>
</head><body>
<a href="/about">About Us</a>
<img src="/img/logo.png" alt="Logo">
<video src="/media/intro.mp4"></video>
</body></html>`)

	cfg := html.DefaultConfig()
	cfg.BaseURL = "https://example.com"
	links, err := html.ExtractAllLinks(data, cfg)
	if err != nil {
		log.Fatal(err)
	}

	// Group by type and iterate to print
	groups := html.GroupLinksByType(links)
	for typ, items := range groups {
		fmt.Printf("%s (%d):\n", typ, len(items))
		for _, l := range items {
			fmt.Printf("  - %s [%s]\n", l.URL, l.Title)
		}
	}
}
```

## Related Documentation

- [Link Extraction](../../guides/core-features/link-extraction) — Scenario-based link extraction usage
- [Config](../core/config) — Link filtering fields such as `Include*` and `BaseURL`
