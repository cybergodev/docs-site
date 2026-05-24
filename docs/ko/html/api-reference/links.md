---
title: "링크 추출 - HTML"
description: "CyberGo HTML 라이브러리 독립 링크 추출 API 레퍼런스, ExtractAllLinks 시리즈 함수와 GroupLinksByType 그룹화 도구를 포함하며, HTML에서 모든 링크 리소스(CSS, JS, 이미지, 비디오, 오디오)를 추출하고 유형별로 그룹화하는 것을 지원합니다."
---

# 링크 추출

독립적인 링크 추출 API로, HTML에서 모든 링크 리소스를 추출하고 유형별로 그룹화할 수 있습니다.

## 패키지 함수

```go
func ExtractAllLinks(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFile(filePath string, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)
```

## Processor 메서드

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## 그룹화 도구

### GroupLinksByType

링크 유형별로 그룹화합니다.

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, _ := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)

for typ, items := range groups {
    fmt.Printf("유형 %s: %d개\n", typ, len(items))
}
```

## LinkResource

```go
type LinkResource struct {
    URL   string // 링크 주소
    Title string // 링크 제목
    Type  string // 링크 유형 (link, image, video, audio, media, css, js, icon)
}
```

## 설정

링크 추출 동작은 `Config`의 링크 필터링 필드로 제어할 수 있습니다:

```go
cfg := html.DefaultConfig()
cfg.IncludeImages = true
cfg.IncludeCSS = true
cfg.IncludeJS = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"
```
