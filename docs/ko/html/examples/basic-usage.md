---
title: "기본 예제 - HTML"
description: "CyberGo HTML 라이브러리 기본 사용법 예제 모음, 기본 콘텐츠 추출, 파일에서 추출, 순수 텍스트 추출, Markdown 형식 출력, 링크 추출과 그룹화, Processor 인스턴스 재사용, 타임아웃 제어가 포함된 컨텍스트 추출, 동시성 배치 처리와 JSON 직렬화 출력 등 다양한 일반적인 개발 시나리오를 보여줍니다."
---

# 기본 예제

## 기본 추출

HTML 바이트에서 제목, 본문 및 미디어 정보를 추출합니다:

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
                <p>Go는 Google이 개발한 오픈소스 프로그래밍 언어입니다.</p>
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
    fmt.Println("본문:", result.Text)
    fmt.Println("단어 수:", result.WordCount)
    fmt.Println("읽기 시간:", result.ReadingTime)
    // 출력:
    // 제목: Go 언어 튜토리얼
    // 본문: Go 입문 가이드
    //
    //       Go는 Google이 개발한 오픈소스 프로그래밍 언어입니다.
    //
    //       Go 공식 웹사이트
    // 단어 수: 8
    // 읽기 시간: 2.4s
}
```

## 파일에서 추출

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title)
```

## 텍스트만 추출

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

## Markdown 출력

```go
md, err := html.ExtractToMarkdown(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## 링크 추출

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}

// 유형별 그룹화
groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("%s: %d개\n", typ, len(items))
}
```

## Processor 사용

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// Processor 재사용으로 여러 페이지 처리
for _, page := range pages {
    result, err := p.Extract(page)
    if err != nil {
        log.Printf("처리 실패: %v", err)
        continue
    }
    fmt.Println(result.Title)
}

// 통계 확인
stats := p.GetStatistics()
fmt.Printf("처리됨: %d, 캐시 적중: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

## 타임아웃 제어

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    log.Fatal(err)
}
```

## 배치 처리

```go
pages := [][]byte{page1, page2, page3}

p, _ := html.New(html.DefaultConfig())
defer p.Close()

batch := p.ExtractBatch(pages)
fmt.Printf("성공: %d, 실패: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    if result != nil {
        fmt.Printf("페이지 %d: %s\n", i, result.Title)
    }
}
```

## JSON 출력

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```
