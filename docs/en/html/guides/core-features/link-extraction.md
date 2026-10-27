---
sidebar_label: "Link Extraction"
title: "Link Extraction - CyberGo html | Resource Collection Guide"
description: "CyberGo html link extraction: ExtractAllLinks enumerates eight resource types, GroupLinksByType groups them, Include filters narrow the set."
sidebar_position: 40
---

# Link Extraction

`ExtractAllLinks` enumerates every resource link a page references, without HTML sanitization. This page covers link types, grouping, filters, and URL resolution.

## How It Differs from Content Extraction

`Extract` returns the `<a>` links inside the cleaned body text (`Result.Links`), each with visible text, a `nofollow` flag, and a position. `ExtractAllLinks` returns every resource the unsanitized page references, including `<script>` and `<iframe>` elements that `Extract` would strip, plus stylesheets and icons. Use the first for "links in the article", the second for "what the page loads".

Skipping sanitization means no tag or attribute removal; URLs are still validated. Dangerous schemes (`javascript:`, `vbscript:`, `file:`) and oversized data URLs are dropped and never reach the result.

## Basic Usage

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}
```

Example output:

```text
[image] Gopher mascot - gopher.png
[js] app.js - https://example.com/app.js
[css] style.css - https://example.com/style.css
[link] Go Official Site - https://go.dev
```

Results are sorted by `URL` in ascending order, and each URL appears once. A fragment-only (`#top`) or query-only (`?page=2`) href is page-internal navigation and produces no result.

## Link Types

The `Type` field of `LinkResource` identifies the resource:

| Type | Source element | Notes |
|------|---------------|-------------|
| `link` | `<a>` | Page links |
| `image` | `<img>` | Image resources |
| `video` | `<video>`, `<source type="video/*">`, and `<iframe>`/`<embed>`/`<object>` whose `src` is a video URL | Video resources |
| `audio` | `<audio>`, `<source type="audio/*">` | Audio resources |
| `css` | `<link rel="stylesheet">` | Stylesheets |
| `media` | `<source>` | Generic media: the `type` is neither `video/*` nor `audio/*`, and the URL extension does not decide video or audio |
| `js` | `<script>` | Script files |
| `icon` | `<link rel="icon">` | Site icons |

:::tip How `<source>` is classified
A `<source>` first consults its `type` attribute: `video/*` becomes `video`, `audio/*` becomes `audio` (case-insensitive). Without a usable `type` the URL extension decides; when neither decides, it becomes `media`. Measured: `<source src="/x.unknownext">` and `<source type="application/vnd.apple.mpegurl">` both produce `media`.
:::

## Group by Type

`GroupLinksByType` groups links by their `Type` field:

```go
links, _ := html.ExtractAllLinks(data)

groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("\n=== %s (%d) ===\n", typ, len(items))
    for _, item := range items {
        fmt.Printf("  %s\n", item.URL)
    }
}
```

Example output:

```text
=== image (3) ===
  https://example.com/hero.jpg
  https://example.com/icon.svg
  https://example.com/logo.png

=== css (2) ===
  https://example.com/style.css
  https://example.com/theme.css

=== js (1) ===
  https://example.com/app.js
```

:::tip Group order is not fixed
`GroupLinksByType` returns a `map`, so iteration order between groups is non-deterministic. Within each group, the URL ascending order from `ExtractAllLinks` is preserved. Sort the keys if you need stable output.
:::

## Configuring Filters

Use `Config` fields to control which types are collected:

```go
cfg := html.DefaultConfig()

// Collect only images and CSS
cfg.IncludeImages = true
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = true
cfg.IncludeJS = false
cfg.IncludeContentLinks = false
cfg.IncludeExternalLinks = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

### Filter Options

| Config field | Default | Controls |
|-------------|---------|----------|
| `IncludeImages` | `true` | `<img>` tags |
| `IncludeVideos` | `true` | `<video>`, `<source>` classified as video, `<iframe>`, `<embed>`, `<object>` |
| `IncludeAudios` | `true` | `<audio>` and `<source>` classified as audio |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | `<script>` tags |
| `IncludeContentLinks` | `true` | `<a>` links with a relative href |
| `IncludeExternalLinks` | `true` | `<a>` links with an absolute or protocol-relative href |
| `IncludeIcons` | `true` | `<link rel="icon">` |

:::warning Internal vs external looks only at the raw href
`IncludeContentLinks` and `IncludeExternalLinks` split on the shape of the **raw href**: a prefix of `http://`, `https://`, or `//` makes it external, anything else internal. The host is **not** compared — an absolute link to the same site is still external. `LinkInfo.IsExternal` follows the same rule.
:::

## URL Resolution

### Relative URLs

With `ResolveRelativeURLs` enabled (the default), relative paths resolve against `BaseURL`:

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

Protocol-relative references (`//host/path`) pass through unchanged and do not inherit the scheme of `BaseURL`.

### Base URL Auto-Detection

When `ResolveRelativeURLs` is `true` and `BaseURL` is empty, the library infers a base in this order:

1. `<base href="...">`
2. `<meta property="og:url">` or `<meta property="canonical">`
3. `<link rel="canonical">`
4. The `scheme://host/` of the first absolute `href`/`src` on the page

A `<base href>` that normalizes to empty (such as `about:blank` or `data:`) counts as unusable, and inference continues with the next step rather than abandoning URL resolution for the whole document.

## Crawler Scenarios

### Collect All Page Resources

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// Process by group
groups := html.GroupLinksByType(links)

// Download every image
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// Queue sub-page links for further crawling
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

The `isSameDomain` domain filter is yours to implement (see the warning above).

### Collect Only Navigation Links

```go
cfg := html.DefaultConfig()
cfg.IncludeContentLinks = true
cfg.IncludeExternalLinks = true
cfg.IncludeImages = false
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = false
cfg.IncludeJS = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

## Extracting from Files

```go
// Package-level function
links, err := html.ExtractAllLinksFromFile("page.html")

// Processor instance
p, _ := html.New()
defer p.Close()
links, err = p.ExtractAllLinksFromFile("page.html")
```

## Context Variants

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## Next Steps

- [API Reference: Link Extraction](../../api-reference/modules/links) - Complete API signatures
- [Batch Processing](../../api-reference/modules/batch) - Batch extraction
- [Configuration](../../api-reference/core/config) - Link filter configuration
