---
title: "链接提取 - CyberGo HTML | 资源链接 API"
description: "CyberGo HTML 链接提取 API：ExtractAllLinks 系列与 GroupLinksByType，提取各类资源链接并按类型分组，可通过 Config 控制过滤。"
---

# 链接提取

独立的链接提取 API，可从 HTML 中提取所有链接资源并按类型分组。

:::tip 与 Extract 的关键区别
`ExtractAllLinks` **不会应用 HTML 清洗**（`EnableSanitization` 在此无效），因此位于 `<script src>`、`<iframe>`、`<link>`、`<embed>` 等标签中的资源链接也会被完整提取。这是为了让这些资源链接能够被枚举出来——它们在 `Extract` 路径中通常会被清洗过程移除。
:::

:::info 结果排序与去重
`ExtractAllLinks` 返回的结果**按 URL 升序排列**，并按 URL 去重。因此对相同输入多次调用会得到完全一致的输出（自 v1.4.2 起），便于结果比较、缓存复用与可重现的下游处理。同一 URL 出现在多个标签中时仅保留一条记录。
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
