---
sidebar_label: "链接提取"
title: "链接提取 - CyberGo html | 资源链接提取 API"
description: "CyberGo html 链接提取 API 参考：ExtractAllLinks 系列与 GroupLinksByType 详解，不应用 HTML 清洗、完整提取脚本、样式、图片等八类资源链接并按类型分组，支持 Include 字段配置过滤、相对 URL 解析与 BaseURL 自动检测，结果按 URL 排序去重，适用于爬虫与资源收集场景。"
sidebar_position: 2
---

# 链接提取

独立的链接提取 API，可从 HTML 中提取所有链接资源并按类型分组。

:::tip 与 Extract 的关键区别
`ExtractAllLinks` **不会应用 HTML 清洗**（`EnableSanitization` 在此无效），因此位于 `<script src>`、`<iframe>`、`<link>`、`<embed>` 等标签中的资源链接也会被完整提取。这是为了让这些资源链接能够被枚举出来——它们在 `Extract` 路径中通常会被清洗过程移除。
:::

:::info 结果排序与去重
`ExtractAllLinks` 返回的结果**按 URL 升序排列**，并按 URL 去重。因此对相同输入多次调用会得到完全一致的输出，便于结果比较、缓存复用与可重现的下游处理。同一 URL 出现在多个标签中时仅保留一条记录。
:::

## 包函数

```go
func ExtractAllLinks(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFile(filePath string, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)
```

## Processor 方法

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## 分组工具

### GroupLinksByType

按链接类型分组；`Type` 为空的链接归入 `unknown` 组。

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, _ := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)

for typ, items := range groups {
    fmt.Printf("类型 %s: %d 个\n", typ, len(items))
}
```

## LinkResource

```go
type LinkResource struct {
    URL   string // 链接地址
    Title string // 链接标题
    Type  string // 链接类型（link, image, video, audio, media, css, js, icon）
}
```

## 链接类型详解

每种 `Type` 对应特定的 HTML 标签来源：

| Type 值 | 来源 HTML 标签 | 控制开关 |
|---------|---------------|----------|
| `link` | `<a href>` | `IncludeContentLinks` / `IncludeExternalLinks` |
| `image` | `<img src>` | `IncludeImages` |
| `video` | `<video src>`、`<source type="video/*">`、`<iframe>`/`<embed>`/`<object>`（视频 URL） | `IncludeVideos` |
| `audio` | `<audio src>`、`<source type="audio/*">` | `IncludeAudios` |
| `media` | `<source>` 无法判定 video/audio 时 | `IncludeVideos` / `IncludeAudios` |
| `css` | `<link rel="stylesheet">` | `IncludeCSS` |
| `js` | `<script src>` | `IncludeJS` |
| `icon` | `<link rel="icon">`、`<link rel="apple-touch-icon">` 等 | `IncludeIcons` |

:::info embed 链接的特殊处理
`<iframe>`、`<embed>`、`<object>` 的 `src`/`data` 只有在判定为**视频 URL**（含 YouTube、Vimeo、Dailymotion 等嵌入模式）时才会被提取，类型记为 `video`。非视频 URL 不会被收录。
:::

## 配置

链接提取行为可通过 `Config` 的链接过滤字段控制：

```go
cfg := html.DefaultConfig()
cfg.IncludeImages = true
cfg.IncludeCSS = true
cfg.IncludeJS = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"
```

### 相对 URL 解析

当 `ResolveRelativeURLs=true`（默认）时，所有类型的相对 URL 会基于 `BaseURL` 统一解析为绝对 URL：

- 解析逻辑由库内部统一集中处理（不导出），对内容链接、图片、媒体、source、script、embed、link 标签**一视同仁**
- 显式设置 `BaseURL` 会**跳过自动检测**，直接使用调用方提供的值
- `BaseURL` 为空且 `ResolveRelativeURLs=true` 时，从文档自动推导 BaseURL（见下方提示）

### 内部与外部链接

内容链接（`<a href>`）通过两组开关分别控制内部与外部链接：

| 开关 | 控制范围 | 判定方式 |
|------|----------|----------|
| `IncludeContentLinks` | 内部链接 | URL 本身为相对路径（设置 `BaseURL` 时解析后与之同域） |
| `IncludeExternalLinks` | 外部链接 | URL 本身为绝对外部地址（`http(s)://` 或协议相对 `//`）——无论是否与 `BaseURL` 同域，一律按外部链接处理 |

默认两者均为 `true`（提取全部内容链接）。其余资源类型（图片、CSS、JS 等）不受内/外区分，仅由各自的 `Include*` 开关控制。

### preload / prefetch 处理

`<link rel="preload" as="...">` 与 `rel="prefetch"` 会根据 `as` 属性路由到不同类型：

| `as` 属性值 | 归入类型 | 控制开关 |
|-------------|----------|----------|
| `style` | `css` | `IncludeCSS` |
| `script` | `js` | `IncludeJS` |
| `image` | `image` | `IncludeImages` |
| `video` | `video` | `IncludeVideos` |
| `audio` | `audio` | `IncludeAudios` |

`dns-prefetch`、`preconnect` 同样走此路由，但通常不带 `as` 属性，故不会被收录。

:::tip BaseURL 自动检测
当 `ResolveRelativeURLs=true` 且 `BaseURL` **为空**时，库会从 HTML 文档本身自动推导 BaseURL，按以下**优先级**逐项尝试，命中即返回：

1. `<base href>` 标签；
2. `<meta property="og:url">` 或 `<meta property="canonical">` 的 `content`；
3. `<link rel="canonical" href>`；
4. 文档中出现的首个绝对 URL（从其 `href`/`src` 提取 base）。

显式设置 `BaseURL` 会**跳过自动检测**，优先使用调用方提供的值。
:::

## 示例

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
<a href="/about">关于我们</a>
<img src="/img/logo.png" alt="Logo">
<video src="/media/intro.mp4"></video>
</body></html>`)

	cfg := html.DefaultConfig()
	cfg.BaseURL = "https://example.com"
	links, err := html.ExtractAllLinks(data, cfg)
	if err != nil {
		log.Fatal(err)
	}

	// 按类型分组后遍历输出
	groups := html.GroupLinksByType(links)
	for typ, items := range groups {
		fmt.Printf("%s（%d 个）:\n", typ, len(items))
		for _, l := range items {
			fmt.Printf("  - %s [%s]\n", l.URL, l.Title)
		}
	}
}
```
