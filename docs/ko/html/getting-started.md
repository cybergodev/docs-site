---
title: "빠른 시작 - CyberGo HTML | 5분 가이드"
description: "CyberGo HTML 빠른 시작: 설치, 기본 추출, 4종 Config 프리셋, 텍스트·Markdown·JSON 출력, 컨텍스트 타임아웃과 동시성 안전 패턴으로 5분 만에 입문합니다."
---

# 빠른 시작

## 설치

```bash
go get github.com/cybergodev/html
```

Go 1.25+ 필요.

## 기본 추출

HTML 바이트에서 콘텐츠 추출:

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
                <p>Go는 정적 타입의 컴파일 언어입니다.</p>
                <img src="gopher.png" alt="Gopher" />
                <a href="https://go.dev">Go 공식 웹사이트</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("제목:", result.Title)
    fmt.Println("본문:", result.Text)
    fmt.Println("이미지 수:", len(result.Images))
    fmt.Println("링크 수:", len(result.Links))
    fmt.Println("단어 수:", result.WordCount)
}
```

출력:

```text
제목: Go 언어 튜토리얼
본문: Go 입문 가이드

Go는 정적 타입의 컴파일 언어입니다.

Go 공식 웹사이트
이미지 수: 1
링크 수: 1
단어 수: 6
```

## 파일에서 추출

```go
result, err := html.ExtractFromFile("page.html")
if err != nil {
    log.Fatal(err)
}
```

## 설정 사용

`Config`를 통해 추출 동작 커스터마이징:

```go
cfg := html.MarkdownConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

result, err := p.Extract(data)
```

### 프리셋 설정

| 프리셋 | 함수 | 설명 |
|------|------|------|
| 기본 | `DefaultConfig()` | 균형 잡힌 설정, 범용 시나리오에 적합 |
| 텍스트 | `TextOnlyConfig()` | 순수 텍스트만 추출, 미디어 비활성화 |
| Markdown | `MarkdownConfig()` | Markdown 출력에 최적화 |
| 고보안 | `HighSecurityConfig()` | 엄격한 제한, 전체 감사 |

## 출력 형식

```go
// 순수 텍스트
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

## 컨텍스트 지원

모든 함수에는 `WithContext` 버전이 있어 취소 및 타임아웃을 지원합니다:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## 핵심 설명

### 동시성 안전

`Processor` 인스턴스는 동시성 안전하므로 여러 goroutine에서 공유하여 사용할 수 있습니다:

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// 여러 goroutine에서 안전하게 호출
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        result, err := p.Extract(fetchHTML(u))
        // ...
    }(url)
}
wg.Wait()
```

패키지 함수 역시 동시성 안전합니다(내부적으로 Processor 풀 사용).

### 인코딩 감지

라이브러리가 HTML 인코딩을 자동으로 감지하므로 수동 처리가 필요 없습니다:

```go
// GBK 인코딩된 HTML, 자동 감지 및 올바른 추출
result, err := html.Extract(gbkData)

// Config.Encoding으로 수동 지정도 가능
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

UTF-8, GBK, GB18030, Shift_JIS, EUC-JP, Windows-1252 등 15+ 인코딩을 지원합니다.

## 다음 단계

- [콘텐츠 추출 실전](./guides/content-extraction) - 추출 프로세스와 문서 인식 심층 이해
- [출력 형식 선택](./guides/output-formats) - 시나리오에 맞는 출력 형식 선택
- [Processor 재사용과 캐시](./guides/processor-cache) - 고빈도 호출의 성능 최적화
- [치트시트](./cheatsheet) - 자주 사용하는 API 빠른 참조
