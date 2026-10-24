---
sidebar_label: "链接提取实战"
title: "链接提取实战 - CyberGo html | 资源收集指南"
description: "CyberGo html 链接提取实战：用 ExtractAllLinks 枚举页面引用的八类资源链接（不经过 HTML 清洗），GroupLinksByType 按类型分组，Include 字段过滤，说明内外链判定规则、相对 URL 解析与 BaseURL 自动检测。"
sidebar_position: 40
---

# 链接提取实战

`ExtractAllLinks` 枚举页面引用的全部资源链接，不经过 HTML 清洗。本页覆盖链接类型、分组、过滤与 URL 解析规则。

## 与内容提取的区别

`Extract` 返回清洗后正文里的 `<a>` 链接（`Result.Links`），每个链接带可见文本、`nofollow` 标记与位置。`ExtractAllLinks` 返回未清洗页面引用的全部资源，包括 `Extract` 会清洗掉的 `<script>`、`<iframe>`，以及样式表、图标等。需要「正文里的链接」用前者，需要「页面引用了什么」用后者。

不经过清洗指不做标签/属性移除，URL 本身仍要过格式校验：`javascript:`、`vbscript:`、`file:` 等危险协议，以及超长的 data URL 会被丢弃，不进入结果。

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
[image] Gopher 吉祥物 - gopher.png
[js] app.js - https://example.com/app.js
[css] style.css - https://example.com/style.css
[link] Go 官网 - https://go.dev
```

结果按 `URL` 升序排列，同一 URL 只出现一次。仅锚点（`#top`）或仅查询串（`?page=2`）的 href 是页内导航，不会产生结果。

## 链接类型

`LinkResource` 的 `Type` 字段标识资源类型：

| 类型 | 来源元素 | 说明 |
|------|----------|------|
| `link` | `<a>` | 页面链接 |
| `image` | `<img>` | 图片资源 |
| `video` | `<video>`，以及 `src` 为视频 URL 的 `<iframe>`/`<embed>`/`<object>` | 视频资源 |
| `audio` | `<audio>` | 音频资源 |
| `css` | `<link rel="stylesheet">` | 样式表 |
| `media` | `<source>` | 通用媒体资源（无法判定视频/音频时） |
| `js` | `<script>` | 脚本文件 |
| `icon` | `<link rel="icon">` | 网站图标 |

## 按类型分组

`GroupLinksByType` 按 `Type` 字段分组：

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
  https://example.com/hero.jpg
  https://example.com/icon.svg
  https://example.com/logo.png

=== css (2) ===
  https://example.com/style.css
  https://example.com/theme.css

=== js (1) ===
  https://example.com/app.js
```

:::tip 组间顺序不固定
`GroupLinksByType` 返回 `map`，组间迭代顺序不确定；每组内部的顺序沿用 `ExtractAllLinks` 的 URL 升序。需要稳定输出时先对键排序。
:::

## 配置过滤规则

用 `Config` 字段控制提取哪些类型：

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
| `IncludeContentLinks` | `true` | 相对 href 的 `<a>` 链接 |
| `IncludeExternalLinks` | `true` | 绝对或协议相对的 `<a>` 链接 |
| `IncludeIcons` | `true` | `<link rel="icon">` |

:::warning 内外链判定只看原始 href
`IncludeContentLinks` 与 `IncludeExternalLinks` 的划分依据是**原始 href 的形态**：以 `http://`、`https://` 或 `//` 开头即为外部，其余为内部。它**不比较域名**——指向同站点的绝对链接同样算外部。`LinkInfo.IsExternal` 使用同一规则。
:::

## URL 解析

### 相对 URL 解析

启用 `ResolveRelativeURLs`（默认）后，相对路径按 `BaseURL` 转为绝对地址：

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

协议相对引用（`//host/path`）原样保留，不继承 `BaseURL` 的协议。

### 自动检测 Base URL

`ResolveRelativeURLs` 为 `true` 而 `BaseURL` 为空时，库按以下顺序推断基准：

1. `<base href="...">`
2. `<meta property="og:url">` 或 `<meta property="canonical">`
3. `<link rel="canonical">`
4. 页面中第一个绝对 `href`/`src` 的 `scheme://host/`

## 爬虫场景

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

`isSameDomain` 需要自行实现：库不比较域名，同域绝对链接也会归入外部。

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
links, err = p.ExtractAllLinksFromFile("page.html")
```

## 带上下文的版本

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## 下一步

- [API 参考：链接提取](../../api-reference/modules/links) - 完整 API 签名
- [批量处理](../../api-reference/modules/batch) - 批量提取
- [配置详解](../../api-reference/core/config) - 链接过滤配置
