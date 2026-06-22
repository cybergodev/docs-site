---
title: "Link Extraction & Grouping - CyberGo HTML | Crawler Tips"
description: "CyberGo HTML link extraction and grouping: ExtractAllLinks for CSS, JS, images, video, audio; Include filters, relative-URL resolution, and crawler practices."
---

# Link Extraction & Grouping

Independent from content extraction, the library provides a dedicated link extraction API for crawlers and resource collection scenarios.

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
[link] Go Official Site - https://go.dev
[image] Gopher mascot - gopher.png
[css] style - https://example.com/style.css
[js] app - https://example.com/app.js
```

## Link Types

The `Type` field of `LinkResource` identifies the resource type:

| Type | Source Element | Description |
|------|---------------|-------------|
| `link` | `<a>` | Page links |
| `image` | `<img>` | Image resources |
| `video` | `<video>`, `<iframe>`, `<embed>`, `<object>` | Video resources |
| `audio` | `<audio>` | Audio resources |
| `css` | `<link rel="stylesheet">` | Stylesheets |
| `media` | `<source>` | Generic media resources (when video/audio is indeterminate) |
| `js` | `<script>` | Script files |
| `icon` | `<link rel="icon">` | Site icons |

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
  https://example.com/logo.png
  https://example.com/hero.jpg
  https://example.com/icon.svg

=== css (2) ===
  https://example.com/style.css
  https://example.com/theme.css

=== js (1) ===
  https://example.com/app.js
```

## Configuring Filter Rules

Control which link types to extract via `Config` fields:

```go
cfg := html.DefaultConfig()

// Only extract images and CSS
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

| Config Field | Default | Controls |
|-------------|---------|----------|
| `IncludeImages` | `true` | `<img>` tags |
| `IncludeVideos` | `true` | `<video>`, `<iframe>`, `<embed>`, `<object>` |
| `IncludeAudios` | `true` | `<audio>` tags |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | `<script>` tags |
| `IncludeContentLinks` | `true` | `<a>` internal links |
| `IncludeExternalLinks` | `true` | `<a>` external links |
| `IncludeIcons` | `true` | `<link rel="icon">` |

## URL Resolution

### Relative URL Resolution

With `ResolveRelativeURLs` enabled, relative paths are automatically converted to absolute URLs:

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

### Auto-Detect Base URL

If `ResolveRelativeURLs = true` is set without `BaseURL`, the library auto-detects from HTML:

1. `<base href="...">` tag
2. `<meta property="og:url">` or `canonical`
3. `<link rel="canonical">`
4. Domain from the first absolute URL in the page

## Crawler Use Cases

### Collect All Page Resources

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// Process by groups
groups := html.GroupLinksByType(links)

// Download all images
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// Collect sub-page links for further crawling
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

### Extract Only Navigation Links

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

## Extract from Files

```go
// Package function
links, err := html.ExtractAllLinksFromFile("page.html")

// Processor instance
p, _ := html.New()
defer p.Close()
links, err := p.ExtractAllLinksFromFile("page.html")
```

## Context Variants

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## Next Steps

- [API Reference: Link Extraction](../api-reference/links) - Complete API signatures
- [Batch Processing](../api-reference/batch) - Batch link extraction
- [Configuration](../api-reference/config) - Link filter configuration
