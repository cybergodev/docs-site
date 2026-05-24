---
title: "링크 추출과 그룹화 - HTML"
description: "CyberGo HTML 링크 추출과 그룹화 실전 가이드, ExtractAllLinks를 사용하여 페이지의 모든 리소스 링크(CSS, JS, 이미지, 비디오, 오디오 등)를 추출하고 유형별로 그룹화하는 방법, Include 필터링 규칙 설정, 상대 URL 자동 해석, 크롤러 시나리오에서 리소스 수집 모범 사례를 상세히 설명합니다."
---

# 링크 추출과 그룹화

콘텐츠 추출과 독립적으로, 라이브러리는 전용 링크 추출 API를 제공하여 크롤러와 리소스 수집 시나리오에 적합합니다.

## 기본 사용법

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}
```

출력 예시:

```text
[link] Go 공식 웹사이트 - https://go.dev
[image] Gopher 마스코트 - gopher.png
[css] style - https://example.com/style.css
[js] app - https://example.com/app.js
```

## 링크 유형

`LinkResource`의 `Type` 필드는 리소스 유형을 식별합니다:

| 유형 | 출처 요소 | 설명 |
|------|----------|------|
| `link` | `<a>` | 페이지 링크 |
| `image` | `<img>` | 이미지 리소스 |
| `video` | `<video>`, `<iframe>`, `<embed>`, `<object>` | 비디오 리소스 |
| `audio` | `<audio>` | 오디오 리소스 |
| `css` | `<link rel="stylesheet">` | 스타일시트 |
| `media` | `<source>` | 범용 미디어 리소스(비디오/오디오 구분 불가 시) |
| `js` | `<script>` | 스크립트 파일 |
| `icon` | `<link rel="icon">` | 웹사이트 아이콘 |

## 유형별 그룹화

`GroupLinksByType`은 링크를 `Type` 필드 기준으로 그룹화합니다:

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

출력 예시:

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

## 필터링 규칙 설정

`Config` 필드를 통해 추출할 링크 유형을 제어합니다:

```go
cfg := html.DefaultConfig()

// 이미지와 CSS만 추출
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

### 필터링 옵션

| 설정 필드 | 기본값 | 제어 범위 |
|----------|--------|----------|
| `IncludeImages` | `true` | `<img>` 태그 |
| `IncludeVideos` | `true` | `<video>`, `<iframe>`, `<embed>`, `<object>` |
| `IncludeAudios` | `true` | `<audio>` 태그 |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | `<script>` 태그 |
| `IncludeContentLinks` | `true` | `<a>` 사이트 내 링크 |
| `IncludeExternalLinks` | `true` | `<a>` 사이트 외 링크 |
| `IncludeIcons` | `true` | `<link rel="icon">` |

## URL 해석

### 상대 URL 해석

`ResolveRelativeURLs`를 활성화하면 상대 경로가 자동으로 절대 경로로 변환됩니다:

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

### Base URL 자동 감지

`ResolveRelativeURLs = true`를 설정했지만 `BaseURL`을 설정하지 않은 경우, 라이브러리는 HTML에서 자동으로 감지합니다:

1. `<base href="...">` 태그
2. `<meta property="og:url">` 또는 `canonical`
3. `<link rel="canonical">`
4. 페이지 내 첫 번째 절대 URL의 도메인

## 크롤러 시나리오 실전

### 페이지의 모든 리소스 수집

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// 그룹별 처리
groups := html.GroupLinksByType(links)

// 모든 이미지 다운로드
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// 하위 페이지 링크를 수집하여 계속 크롤링
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

### 페이지 내비게이션 링크만 추출

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

## 파일에서 추출

```go
// 패키지 함수
links, err := html.ExtractAllLinksFromFile("page.html")

// Processor 인스턴스
p, _ := html.New()
defer p.Close()
links, err := p.ExtractAllLinksFromFile("page.html")
```

## 컨텍스트 버전

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## 다음 단계

- [API 레퍼런스: 링크 추출](../api-reference/links) - 전체 API 시그니처
- [배치 처리](../api-reference/batch) - 배치 링크 추출
- [설정 상세](../api-reference/config) - 링크 필터링 설정
