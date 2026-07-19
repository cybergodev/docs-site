---
sidebar_label: "링크 추출"
title: "링크 추출 - CyberGo html | 리소스 링크 추출 API"
description: "CyberGo html 링크 추출 API: ExtractAllLinks 계열과 GroupLinksByType으로 리소스 링크를 추출해 유형별로 그룹화하며 필터 설정이 가능합니다."
sidebar_position: 2
---

# 링크 추출

독립적인 링크 추출 API로, HTML에서 모든 링크 리소스를 추출하고 유형별로 그룹화할 수 있습니다.

:::tip Extract와의 주요 차이
`ExtractAllLinks`는 **HTML 정제(sanitization)를 적용하지 않습니다**(`EnableSanitization`이 여기서는 무효임). 따라서 `<script src>`, `<iframe>`, `<link>`, `<embed>` 같은 태그 안의 리소스 링크도 모두 추출됩니다. 이 리소스 링크를 열거할 수 있도록 하기 위함이며, `Extract` 경로에서는 보통 정제 과정에서 제거됩니다.
:::

:::info 결과 정렬과 중복 제거
`ExtractAllLinks`는 결과를 **URL 오름차순으로 정렬**하고 URL로 중복을 제거합니다. 따라서 동일한 입력에 대해 여러 번 호출해도 완전히 동일한 결과가 나옵니다(v1.4.2부터). 결과 비교, 캐시 재사용, 재현 가능한 다운스트림 처리에 유리합니다. 동일한 URL이 여러 태그에 나타나면 한 건만 유지됩니다.
:::

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

:::tip 팁
`ResolveRelativeURLs=true`이고 `BaseURL`이 **비어 있을 때**, 라이브러리는 HTML 문서 자체에서 BaseURL을 자동으로 유추합니다. 다음 **우선순위** 순서대로 시도하여, 일치하는 항목이 있으면 그 즉시 반환합니다:

1. `<base href>` 태그;
2. `<meta property="og:url">` 또는 `<meta property="canonical">`의 `content`;
3. `<link rel="canonical" href>`;
4. 문서에서 처음으로 등장하는 절대 URL(`href`/`src`에서 base 추출).

`BaseURL`을 명시적으로 설정하면 **자동 감지를 건너뛰고** 호출자가 제공한 값을 우선 사용합니다.
:::
