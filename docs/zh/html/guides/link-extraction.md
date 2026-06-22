---
title: "链接提取与分组 - CyberGo HTML | 资源收集指南"
description: "CyberGo HTML 链接提取与分组：ExtractAllLinks 提取各类资源链接、按类型分组、Include 过滤、相对 URL 解析与爬虫场景最佳实践。"
---

# 链接提取与分组

独立于内容提取，库提供了专门的链接提取 API，适合爬虫和资源收集场景。

## 基本用法

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}
```

输出示例：

```text
[link] Go 官网 - https://go.dev
[image] Gopher 吉祥物 - gopher.png
[css] style - https://example.com/style.css
[js] app - https://example.com/app.js
```

## 链接类型

`LinkResource` 的 `Type` 字段标识资源类型：

| 类型 | 来源元素 | 说明 |
|------|----------|------|
| `link` | `<a>` | 页面链接 |
| `image` | `<img>` | 图片资源 |
| `video` | `<video>`, `<iframe>`, `<embed>`, `<object>` | 视频资源 |
| `audio` | `<audio>` | 音频资源 |
| `css` | `<link rel="stylesheet">` | 样式表 |
| `media` | `<source>` | 通用媒体资源（无法确定视频/音频时） |
| `js` | `<script>` | 脚本文件 |
| `icon` | `<link rel="icon">` | 网站图标 |

## 按类型分组

`GroupLinksByType` 将链接按 `Type` 字段分组：

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

输出示例：

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

## 配置过滤规则

通过 `Config` 字段控制提取哪些类型的链接：

```go
cfg := html.DefaultConfig()

// 只提取图片和 CSS
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

### 过滤选项

| 配置字段 | 默认值 | 控制范围 |
|----------|--------|----------|
| `IncludeImages` | `true` | `<img>` 标签 |
| `IncludeVideos` | `true` | `<video>`、`<iframe>`、`<embed>`、`<object>` |
| `IncludeAudios` | `true` | `<audio>` 标签 |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | `<script>` 标签 |
| `IncludeContentLinks` | `true` | `<a>` 站内链接 |
| `IncludeExternalLinks` | `true` | `<a>` 站外链接 |
| `IncludeIcons` | `true` | `<link rel="icon">` |

## URL 解析

### 相对 URL 解析

启用 `ResolveRelativeURLs` 后，相对路径会自动转换为绝对路径：

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

### 自动检测 Base URL

如果设置了 `ResolveRelativeURLs = true` 但未设置 `BaseURL`，库会自动从 HTML 中检测：

1. `<base href="...">` 标签
2. `<meta property="og:url">` 或 `canonical`
3. `<link rel="canonical">`
4. 页面中第一个绝对 URL 的域名

## 爬虫场景实战

### 收集页面所有资源

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// 分组处理
groups := html.GroupLinksByType(links)

// 下载所有图片
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// 收集子页面链接继续爬取
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

### 仅提取页面导航链接

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

## 从文件提取

```go
// 包级函数
links, err := html.ExtractAllLinksFromFile("page.html")

// Processor 实例
p, _ := html.New()
defer p.Close()
links, err := p.ExtractAllLinksFromFile("page.html")
```

## 带上下文版本

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## 下一步

- [API 参考：链接提取](../api-reference/links) - 完整 API 签名
- [批量处理](../api-reference/batch) - 批量提取链接
- [配置详解](../api-reference/config) - 链接过滤配置
