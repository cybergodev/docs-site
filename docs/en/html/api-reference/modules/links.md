---
sidebar_label: "Link Extraction"
title: "Link Extraction - CyberGo html | Resource Link API"
description: "CyberGo html link extraction API: ExtractAllLinks, GroupLinksByType, link type sources, internal/external rules, and BaseURL detection."
sidebar_position: 20
---

# Link Extraction

`ExtractAllLinks` enumerates every resource link an HTML document references, tagging each with a type that `GroupLinksByType` can group. It is independent of `Extract`'s body extraction and is not subject to HTML sanitization.

## Difference from Extract

`ExtractAllLinks` does **not** apply HTML sanitization (`EnableSanitization` has no effect here). Resource links inside `<script src>`, `<iframe>`, `<link>`, and `<embed>` are extracted in full; the same tags are normally removed during sanitization on the `Extract` path.

## Sorting and Deduplication

Results are **sorted by URL ascending** and deduplicated by URL. Repeated calls on the same input return identical output, which makes comparison and cache reuse straightforward. When one URL appears in several tags, only one record is kept.

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

Groups links by type. Links with an empty `Type` land in the `unknown` group.

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
	log.Fatal(err)
}
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

Only resolvable references are reported: an href that is a bare anchor (`#top`) or a bare query string (`?page=2`) is in-page navigation and produces no `LinkResource`; an href that fails URL validation is likewise skipped. The rule matches `LinkInfo` on the `Extract` path.

`Title` is the human-readable label, with a fixed fallback order per type: for `<a>`, the `title` attribute, then the link text, with `"Link"` as the last resort; for images, `title`, `alt`, then the last URL segment, with `"Image"` as the last resort; media, script, and stylesheet links without a `title` attribute use the last URL segment (falling back to `"Video"` / `"Audio"` / `"Media"` / `"Script"` / the capitalized type name).

## Link Type Reference

Each `Type` value maps to specific HTML tag sources:

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

:::info When embed links are collected
The `src`/`data` of `<iframe>`, `<embed>`, and `<object>` is extracted only when it is judged a **video URL** (matching embed patterns for YouTube, Vimeo, Dailymotion, and similar). The type is then recorded as `video`. Non-video URLs are not collected.
:::

:::info `<link>` type-attribute fallback
When `rel` matches no known token, a `type` attribute containing `css` routes the element to `css` (gated by `IncludeCSS`), and one containing `javascript` routes it to `js` (gated by `IncludeJS`); if neither matches, the `<link>` is not collected. Both the `rel` token and the `type` value match case-insensitively.
:::

## Configuration

Link extraction behavior is controlled by the `Config` link filtering fields:

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

With `ResolveRelativeURLs=true` (the default), relative URLs of every type are resolved against `BaseURL`:

- Resolution is handled centrally inside the library (not exported) and treats content links, images, media, source, script, embed, and link tags **identically**
- Protocol-relative URLs (`//host/path`) are kept as-is — not resolved, and not upgraded to the `BaseURL` scheme
- Setting `BaseURL` explicitly skips auto-detection and uses the caller's value
- When `BaseURL` is empty, it is derived from the document (see "BaseURL Auto-Detection")

### Internal vs External Links

Two switches govern internal and external content links (`<a href>`). The decision depends only on the **shape of the raw href**, never on the domain:

| Switch | Scope | Rule |
|--------|-------|------|
| `IncludeContentLinks` | Internal links | The raw href is a relative path (such as `/about` or `page.html`) |
| `IncludeExternalLinks` | External links | The raw href starts with `http://`, `https://` (case-insensitive), or protocol-relative `//` |

If you set `BaseURL` to `https://example.com`, the same-domain absolute link `<a href="https://example.com/about">` is still governed by `IncludeExternalLinks`; write `<a href="/about">` to make it internal.

Both default to `true`, so all content links are extracted. Images, CSS, JS, and other resource types are not split into internal/external; only their own `Include*` switches apply.

### preload / prefetch Handling

`<link rel="preload" as="...">` and `rel="prefetch"` are routed by the `as` attribute:

| `as` value | Routed to type | Control switch |
|------------|----------------|----------------|
| `style` | `css` | `IncludeCSS` |
| `script` | `js` | `IncludeJS` |
| `image` | `image` | `IncludeImages` |
| `video` | `video` | `IncludeVideos` |
| `audio` | `audio` | `IncludeAudios` |

`dns-prefetch` and `preconnect` follow the same routing but usually carry no `as` attribute, so they are not collected.

### BaseURL Auto-Detection

When `ResolveRelativeURLs=true` and `BaseURL` is **empty**, the library derives a BaseURL from the document itself, trying each source in order and returning the first hit:

1. the `<base href>` tag;
2. the `content` of `<meta property="og:url">` or `<meta property="canonical">`;
3. `<link rel="canonical" href>`;
4. the first absolute URL in the document (taking the base from its `href`/`src`).

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
	// Output: 6 links total (one each of link, image, video, css, js, icon);
	//         group order is unspecified (map iteration); every URL resolves
	//         to https://example.com/... — the link group holds
	//         https://example.com/about, and the video Title is the last path
	//         segment, intro.mp4
}
```

## Related Documentation

- [Link Extraction](../../guides/core-features/link-extraction) — Scenario-based link extraction usage
- [Config](../core/config) — Link filtering fields such as `Include*` and `BaseURL`
