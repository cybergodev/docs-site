---
title: "콘텐츠 추출 실전 - CyberGo HTML | 핵심 활용 가이드"
description: "CyberGo HTML 콘텐츠 추출 실전: 추출 프로세스, 문서 인식 원리, 기본·파일 추출, Result 필드 해석, 커스텀 Scorer, 비 UTF-8 인코딩 감지 처리를 설명합니다."
---

# 콘텐츠 추출 실전

이 가이드는 실제 시나리오를 통해 HTML 콘텐츠 추출의 작동 원리와 모범 사례를 이해하는 데 도움을 줍니다.

## 추출 프로세스 개요

`Extract`를 호출하면 라이브러리는 다음 단계를 실행합니다:

```text
HTML 입력 → 입력 검증 → 인코딩 감지(자동 UTF-8 변환) → DOM 파싱 → 깊이 검증
    → 안전한 정제(선택) → 기사 감지(선택) → 콘텐츠 추출 → 포맷팅 → Result 반환
```

깊이 검증은 정제 **이전에** 실행됩니다. 먼저 DOM 깊이를 반복적으로(iterative) 검증해(재귀 순회로 인한 스택 오버플로 회피), 그 다음 파싱된 DOM 트리에 대해 안전한 정제를 수행합니다. 둘 모두 파싱된 노드 트리를 대상으로 하므로 DOM 파싱이 항상 그 둘보다 먼저 일어납니다.

각 단계는 [설정](../api-reference/config)을 통해 커스터마이즈할 수 있습니다.

## 기본 텍스트 추출

가장 간단한 사용법은 HTML 바이트에서 콘텐츠를 추출하는 것입니다:

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html>
        <head><title>Go 언어 튜토리얼</title></head>
        <body>
            <article>
                <h1>Go 입문 가이드</h1>
                <p>Go는 정적 타입의 컴파일 언어로, 동시성을 내장 지원합니다.</p>
                <p>컴파일 속도가 빠르고 배포가 간단하여 고성능 서비스 구축에 적합합니다.</p>
                <img src="gopher.png" alt="Gopher 마스코트" />
                <a href="https://go.dev">Go 공식 웹사이트</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("제목:", result.Title)
    // 제목: Go 언어 튜토리얼

    fmt.Println("본문:", result.Text)
    // 본문: Go 입문 가이드
    //       Go는 정적 타입의 컴파일 언어로, 동시성을 내장 지원합니다.
    //       컴파일 속도가 빠르고 배포가 간단하여 고성능 서비스 구축에 적합합니다.
    //       Go 공식 웹사이트

    fmt.Println("단어 수:", result.WordCount)
    // 단어 수: 7

    fmt.Println("읽기 시간:", result.ReadingTime)
    // 읽기 시간: 2.1s(200단어/분 기준)

    fmt.Println("이미지:", len(result.Images))
    // 이미지: 1

    fmt.Println("링크:", len(result.Links))
    // 링크: 1
}
```

## 추출 결과 이해하기

`Result`는 다음 필드를 포함합니다:

| 필드 | 타입 | 설명 |
|------|------|------|
| `Title` | `string` | 페이지 제목, `<title>`을 우선, 그 다음 `<h1>`, `<h2>` |
| `Text` | `string` | 본문 콘텐츠(정제됨, 태그와 불필요한 공백 제거) |
| `Images` | `[]ImageInfo` | 추출된 이미지 목록 |
| `Links` | `[]LinkInfo` | 추출된 링크 목록 |
| `Videos` | `[]VideoInfo` | 추출된 비디오 목록 |
| `Audios` | `[]AudioInfo` | 추출된 오디오 목록 |
| `WordCount` | `int` | 본문 단어 수 |
| `ReadingTime` | `time.Duration` | 예상 읽기 시간(200단어/분) |
| `ProcessingTime` | `time.Duration` | 처리 소요 시간 |

## 파일에서 추출

로컬 HTML 파일을 처리할 때는 `ExtractFromFile`을 사용합니다:

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println("제목:", result.Title)
```

파일 작업에는 다음과 같은 보안 검사가 내장되어 있습니다:
- 경로 순회 공격 자동 감지(예: `../../../etc/passwd`)
- 파일 크기는 `MaxInputSize`로 제한
- 오류 메시지에서 `SafePath()`로 전체 경로 숨김

## 문서 인식 알고리즘

`ExtractArticle`이 `true`(기본값)인 경우, 라이브러리는 페이지의 "주요 콘텐츠 영역"을 자동으로 식별합니다.

### 작동 원리

1. **후보 노드 평가**: DOM 트리를 순회하며 각 요소 노드에 대해 콘텐츠 관련성 점수를 매깁니다
2. **최적 후보 선택**: 가장 높은 점수의 노드를 콘텐츠 컨테이너로 선택합니다
3. **폴백 메커니즘**: 적합한 후보를 찾지 못하면 `<body>` 노드로 폴백합니다

:::tip 적용 시나리오
문서 인식은 뉴스, 블로그, 문서 등 명확한 "본문 영역"이 있는 페이지에 가장 적합합니다. 내비게이션 페이지, 목록 페이지에서는 본문을 정확하게 찾지 못할 수 있습니다.
:::

### 커스텀 평가

`Scorer` 인터페이스를 구현하여 평가 로직을 커스터마이즈합니다:

```go
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    // 노드 특성에 따라 점수 반환
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    // true를 반환하면 해당 노드를 제거
    return node.Data() == "nav" || node.Data() == "footer"
}
```

:::tip 참고
이 예시의 `strings.Contains`는 표준 라이브러리 `strings` 패키지에서 가져옵니다. 완전한 실행 가능한 예시는 [테스트와 커스텀 확장](./testing-custom)을 참조하세요.
:::

## 텍스트만 추출

이미지, 링크 등 메타데이터 없이 순수 텍스트만 필요한 경우:

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

텍스트 분석, 검색 인덱스 구축 등의 시나리오에서 매우 실용적입니다.

## 비 UTF-8 인코딩 처리

라이브러리는 15+ 문자 인코딩(UTF-8, GBK, Shift_JIS, Windows-1252 등 포함)을 자동으로 감지하고 UTF-8로 자동 변환합니다.

```go
// 자동 인코딩 감지
result, err := html.Extract(gbkEncodedData)

// 수동으로 인코딩 지정
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
result, err = html.Extract(gbkEncodedData, cfg)
```

## 컨텍스트와 타임아웃

대용량 파일이나 신뢰할 수 없는 출처의 HTML의 경우, 컨텍스트가 포함된 버전을 사용하는 것이 좋습니다:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if errors.Is(err, html.ErrProcessingTimeout) {
    log.Println("처리 타임아웃")
}
```

## 다음 단계

- [출력 형식 선택](../guides/output-formats) - 시나리오에 맞는 출력 형식 선택
- [Processor 재사용과 캐시](../guides/processor-cache) - 고빈도 호출의 성능 최적화
- [API 레퍼런스: 패키지 함수](../api-reference/functions) - 전체 함수 시그니처
