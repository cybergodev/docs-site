---
title: "链接提取 - HTML"
description: "CyberGo HTML 库独立链接提取 API 参考，包括 ExtractAllLinks 系列函数和 GroupLinksByType 分组工具，支持从 HTML 提取所有链接资源（CSS、JS、图片、视频、音频）并按类型分组，可通过 Config 控制链接过滤，满足爬虫和资源收集等常见使用场景。"
---

# 链接提取

独立的链接提取 API，可从 HTML 中提取所有链接资源并按类型分组。

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

按链接类型分组。

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
