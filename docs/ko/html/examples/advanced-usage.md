---
title: "고급 예제 - HTML"
description: "CyberGo HTML 라이브러리 고급 예제 모음, 커스텀 Scorer 스코어러 구현, 다중 Sink 감사 파이프라인 구축, 배치 파일 처리와 동시성 제어, Processor 풀링 모드와 ChannelAuditSink 실시간 모니터링 등 고급 사용법과 완전한 실행 가능한 코드 예제를 보여줍니다."
---

# 고급 예제

## 커스텀 Scorer

특정 웹사이트 구조에 맞게 콘텐츠 식별 로직을 커스터마이즈합니다. 전체 구현은 [테스트와 커스텀 확장](../guides/testing-custom)을 참조하고, 아래는 핵심 사용법을 보여줍니다:

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// 커스텀 Scorer 구현(전체 예시는 guides/testing-custom 참조)
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }
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
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = myScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">홈</a></nav>
        <article class="post-content">
            <h1>Go 동시성 이해하기</h1>
            <p>고루틴은 Go의 경량 스레드입니다.</p>
        </article>
        <aside class="sidebar">추천 읽기</aside>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("본문:", result.Text)
    // 본문: Go 동시성 이해하기
    //
    // 고루틴은 Go의 경량 스레드입니다.
}
```

## 다중 Sink 감사 파이프라인

계층별 감사 파이프라인 구축: critical 이벤트는 별도 파일에 기록하고, 모든 이벤트는 로그에도 출력합니다.

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/html"
)

func main() {
    // 출력 대상 생성
    allFile, _ := os.Create("audit-all.jsonl")
    criticalFile, _ := os.Create("audit-critical.jsonl")
    defer allFile.Close()
    defer criticalFile.Close()

    // 다층 파이프라인 구축
    allSink := html.NewWriterAuditSink(allFile)
    criticalSink := html.NewFilteredSink(
        html.NewWriterAuditSink(criticalFile),
        func(e html.AuditEntry) bool {
            return e.Level == html.AuditLevelCritical
        },
    )
    loggerSink := html.NewLoggerAuditSink()

    pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

    // 설정
    cfg := html.HighSecurityConfig()
    cfg.Audit = html.HighSecurityAuditConfig()
    cfg.Audit.Sink = pipeline

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    // 콘텐츠 처리
    data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>안전한 콘텐츠</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("본문:", result.Text)
    // 감사 로그가 파일과 stderr에 자동으로 기록됨
}
```

## 배치 파일 처리

디렉토리 내의 HTML 파일을 배치로 처리하고 결과와 오류를 수집합니다:

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/cybergodev/html"
)

func main() {
    // 파일 경로 수집
    var files []string
    filepath.Walk("./pages", func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        if filepath.Ext(path) == ".html" || filepath.Ext(path) == ".htm" {
            files = append(files, path)
        }
        return nil
    })

    fmt.Printf("%d개 파일 발견\n", len(files))

    // 배치 처리
    p, _ := html.New(html.TextOnlyConfig())
    defer p.Close()

    // 한 배치당 최대 10000개 파일
    batch := p.ExtractBatchFiles(files)

    fmt.Printf("성공: %d, 실패: %d, 취소: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)

    // 결과 처리
    for i, result := range batch.Results {
        if result != nil {
            fmt.Printf("[%d] %s (단어 수: %d)\n", i, result.Title, result.WordCount)
        }
    }

    // 오류 확인
    for i, err := range batch.Errors {
        if err != nil {
            fmt.Printf("[%d] 오류: %v\n", i, err)
        }
    }
}
```

## 타임아웃이 포함된 Processor 재사용

웹 서비스 시나리오에서의 Processor 싱글톤 모드:

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    data := []byte(r.FormValue("html"))
    if len(data) == 0 {
        http.Error(w, "html field required", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, data)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
    stats := processor.GetStatistics()
    fmt.Fprintf(w, "처리됨: %d\n캐시 적중: %d\n오류: %d\n",
        stats.TotalProcessed, stats.CacheHits, stats.ErrorCount)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    http.HandleFunc("/stats", statsHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## 추출 및 Markdown 파일 생성

HTML 페이지에서 콘텐츠를 추출하여 Markdown 파일로 저장합니다:

```go
package main

import (
    "fmt"
    "log"
    "os"
    "strings"

    "github.com/cybergodev/html"
)

func main() {
    p, err := html.New(html.MarkdownConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    urls := []string{
        "downloaded/page1.html",
        "downloaded/page2.html",
        "downloaded/page3.html",
    }

    for _, path := range urls {
        md, err := p.ExtractToMarkdownFromFile(path)
        if err != nil {
            log.Printf("처리 실패 %s: %v", path, err)
            continue
        }

        // 출력 파일명 생성
        outPath := strings.Replace(path, ".html", ".md", 1)
        if err := os.WriteFile(outPath, []byte(md), 0644); err != nil {
            log.Printf("쓰기 실패 %s: %v", outPath, err)
            continue
        }
        fmt.Printf("%s -> %s 완료\n", path, outPath)
    }
}
```
