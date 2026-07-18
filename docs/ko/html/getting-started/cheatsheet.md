---
sidebar_label: "치트시트"
title: "치트시트 - CyberGo html | API 한눈에 보기"
description: "CyberGo html 주요 API 치트시트: 패키지 함수, Processor 메서드, Config 프리셋, 주요 설정 항목, 오류 판별, 감사 설정을 한 페이지에 함수 시그니처와 함께 정리합니다."
sidebar_position: 3
---

# 치트시트

## 패키지 함수

### 콘텐츠 추출

```go
// 바이트에서 전체 결과 추출
result, err := html.Extract(data)

// 파일에서 추출
result, err := html.ExtractFromFile("page.html")

// 텍스트만 추출
text, err := html.ExtractText(data)
text, err := html.ExtractTextFromFile("page.html")
```

### 출력 형식

```go
md, err := html.ExtractToMarkdown(data)
jsonBytes, err := html.ExtractToJSON(data)
```

### 링크 추출

```go
links, err := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)
```

### 배치 처리

```go
batch := html.ExtractBatch(pages)
// 또는
batch := html.ExtractBatchFiles(paths)
```

### 컨텍스트 버전

모든 함수에는 `ExtractWithContext` 변형이 있습니다:

```go
result, err := html.ExtractWithContext(ctx, data)
result, err = html.ExtractFromFileWithContext(ctx, path)
text, err := html.ExtractTextWithContext(ctx, data)
md, err := html.ExtractToMarkdownWithContext(ctx, data)
links, err := html.ExtractAllLinksWithContext(ctx, data)
batch := html.ExtractBatchWithContext(ctx, pages)
```

## Processor

```go
// 생성
p, err := html.New(html.DefaultConfig())
defer p.Close()

// 추출
result, err := p.Extract(data)
result, err = p.ExtractFromFile(path)
text, err := p.ExtractText(data)

// 출력
md, err := p.ExtractToMarkdown(data)
jsonBytes, err := p.ExtractToJSON(data)

// 링크
links, err := p.ExtractAllLinks(data)

// 배치
batch := p.ExtractBatch(pages)

// 통계
stats := p.GetStatistics()
p.ClearCache()
p.ResetStatistics()

// 감사
entries := p.GetAuditLog()
p.ClearAuditLog()
```

## 설정 프리셋

```go
html.DefaultConfig()       // 기본 설정
html.TextOnlyConfig()      // 텍스트 전용
html.MarkdownConfig()      // Markdown 출력
html.HighSecurityConfig()  // 고보안
```

## 자주 사용하는 설정 항목

```go
cfg := html.DefaultConfig()

// 리소스 제한
cfg.MaxInputSize = 10 * 1024 * 1024  // 최대 입력 10MB
cfg.ProcessingTimeout = time.Minute   // 처리 타임아웃
cfg.MaxDepth = 200                    // 최대 DOM 깊이

// 콘텐츠 제어
cfg.ExtractArticle = true             // 스마트 문서 인식
cfg.PreserveImages = true             // 이미지 보존
cfg.PreserveLinks = true              // 링크 보존
cfg.PreserveVideos = false            // 비디오 미보존
cfg.PreserveAudios = false            // 오디오 미보존

// 출력 형식
cfg.InlineImageFormat = "markdown"    // none/markdown/html/placeholder
cfg.InlineLinkFormat = "markdown"     // none/markdown/html
cfg.TableFormat = "markdown"          // markdown/html

// 링크 필터링
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// 캐시
cfg.MaxCacheEntries = 1000
cfg.CacheTTL = 30 * time.Minute
```

## 오류 처리

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 입력이 너무 큼
    case errors.Is(err, html.ErrInvalidHTML):
        // 유효하지 않은 HTML
    case errors.Is(err, html.ErrProcessingTimeout):
        // 처리 타임아웃
    case errors.Is(err, html.ErrFileNotFound):
        // 파일을 찾을 수 없음
    case errors.Is(err, html.ErrInvalidConfig):
        // 설정이 유효하지 않음
    case errors.Is(err, html.ErrProcessorClosed):
        // 프로세서가 닫힘
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // DOM 깊이 초과
    case errors.Is(err, html.ErrInvalidFilePath):
        // 파일 경로가 유효하지 않음
    default:
        // 기타 오류
    }
}
```

## 감사 시스템

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// 커스텀 Sink 사용
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// 처리 후 감사 로그 가져오기
entries := p.GetAuditLog()
```
