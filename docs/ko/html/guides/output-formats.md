---
title: "출력 형식 선택 - HTML"
description: "CyberGo HTML 출력 형식 선택 가이드, 순수 텍스트, Markdown, JSON 세 가지 출력 형식의 특징과 적용 시나리오를 상세히 비교하고, 형식 옵션 설정(InlineImageFormat, InlineLinkFormat), 컨텍스트 지원과 파일 읽기를 포함합니다."
---

# 출력 형식 선택

이 가이드는 순수 텍스트, Markdown, JSON 세 가지 출력 형식 중 올바른 것을 선택하는 데 도움을 줍니다.

## 형식 비교

| 특징 | 순수 텍스트 | Markdown | JSON |
|------|--------|----------|------|
| 가독성 | 높음 | 높음 | 낮음(기계 친화적) |
| 구조 보존 | 없음 | 제목/목록/링크/이미지 | 전체 메타데이터 |
| 이미지 처리 | 제거 | `![alt](url)` | ImageInfo 목록 |
| 링크 처리 | 텍스트만 보존 | `[text](url)` | LinkInfo 목록 |
| 테이블 지원 | 없음 | Markdown 테이블 | 원시 데이터 |
| 적용 시나리오 | 검색 인덱스/텍스트 분석 | 블로그/문서/리더 | API 전송/데이터 저장 |

## 순수 텍스트

가장 가벼운 출력 방식으로, 텍스트 콘텐츠만 보존하고 모든 HTML 태그와 형식을 제거합니다.

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### 적용 시나리오

- 검색 인덱스 구축
- 텍스트 분석 및 NLP 처리
- 요약 및 미리보기 생성
- 단어 수 및 읽기 시간 통계

### 특징

- 이미지와 링크의 텍스트가 제거됨
- 제목, 단락 사이에 줄바꿈 유지
- 목록 콘텐츠는 순수 텍스트 형태로 표시

## Markdown

문서 구조를 보존하면서 가독성이 뛰어나, 콘텐츠 마이그레이션과 읽기 시나리오에 적합합니다.

```go
// 방법 1: 패키지 함수
md, err := html.ExtractToMarkdown(data)

// 방법 2: Processor 사용
p, _ := html.New()
defer p.Close()
md2, err := p.ExtractToMarkdown(data)
```

### 출력 예시

입력 HTML:

```html
<article>
    <h1>Go 입문 가이드</h1>
    <p>Go는 컴파일 언어입니다.</p>
    <img src="gopher.png" alt="Gopher" />
    <a href="https://go.dev">Go 공식 웹사이트</a>
</article>
```

출력 Markdown:

```markdown
Go 입문 가이드

Go는 컴파일 언어입니다.

![Gopher](gopher.png)
[Go 공식 웹사이트](https://go.dev)
```

### 형식 옵션

Markdown 형식은 두 가지 설정 필드로 제어합니다:

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| 형식 값 | 이미지 출력(InlineImageFormat) | 링크 출력(InlineLinkFormat) |
|--------|----------|----------|
| `none` | 제거 | 텍스트만 보존 |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | -(지원 안 함) |

:::tip MarkdownConfig() 사용
`MarkdownConfig()` 프리셋은 이미지와 링크 형식을 이미 `markdown`으로 설정했으므로 직접 사용하면 되며, 수동 설정이 필요 없습니다.
:::

:::info placeholder 형식
`placeholder`는 `InlineImageFormat`에만 적용되며, 텍스트에 `[IMAGE:N]` 자리 표시자를 유지합니다. `InlineLinkFormat`은 이 값을 지원하지 않으며, `none`, `markdown`, `html`만 지원합니다.
:::

### 적용 시나리오

- Markdown 블로그/정적 사이트로 콘텐츠 마이그레이션
- 이메일 본문 생성
- 문서 형식 변환
- RSS / 뉴스레터 콘텐츠 생성

## JSON

구조화된 출력으로, 전체 메타데이터를 보존하여 프로그램 간 전송과 영구 저장에 적합합니다.

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### 출력 구조

```json
{
  "text": "Go 입문 가이드\n\nGo는 컴파일 언어입니다.\n\nGo 공식 웹사이트",
  "title": "Go 입문 가이드",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Go 공식 웹사이트", "title": "", "is_external": true, "is_no_follow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 6,
  "reading_time_ms": 1800
}
```

:::tip 시간 필드
JSON 출력에서 `ProcessingTime`과 `ReadingTime`은 밀리초(`processing_time_ms`, `reading_time_ms`)로 자동 변환되어 프론트엔드와 API 소비에 편리합니다.
:::

### 적용 시나리오

- API 응답 데이터
- 데이터베이스 저장
- 마이크로서비스 간 전송
- 프론트엔드 애플리케이션과 통합

## 파일에서 각 형식 추출

모든 형식은 파일에서 읽기를 지원합니다:

```go
// 순수 텍스트
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## 컨텍스트 버전

모든 형식 함수에는 `WithContext` 변형이 있어 타임아웃과 취소를 지원합니다:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## 선택 결정 가이드

```text
프로그램에서 소비해야 하나요? ── 예 ──→ JSON
        │
        아니요
        │
형식을 보존해야 하나요? ── 예 ──→ Markdown
        │
        아니요
        │
        └──→ 순수 텍스트
```

## 다음 단계

- [API 레퍼런스: 출력 형식](../api-reference/output) - 전체 API 시그니처
- [링크 추출과 그룹화](../guides/link-extraction) - 페이지 리소스 링크 추출
- [설정 상세](../api-reference/config) - 모든 설정 옵션
