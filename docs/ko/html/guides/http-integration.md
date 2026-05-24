---
title: "HTTP 통합 - HTML"
description: "CyberGo HTML 라이브러리와 HTTP 클라이언트 통합 실전 가이드, 표준 라이브러리 net/http를 사용한 단일 페이지 스크래핑 추출과 오류 처리, 동시성 배치 처리 최적화와 리소스 관리, 컨텍스트 타임아웃 제어, 웹 서비스 통합 패턴, Processor 싱글톤 재사용 모드와 프로덕션 환경 배포 모범 사례를 다룹니다."
---

# HTTP 통합

HTML 라이브러리는 HTTP 클라이언트를 내장하지 않고, 표준 라이브러리 `net/http`와 원활하게 연동됩니다. 이 글에서는 일반적인 통합 패턴을 보여줍니다.

## 기본 스크래핑과 추출

가장 간단한 패턴: 페이지를 가져와서 콘텐츠를 추출합니다.

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"

    "github.com/cybergodev/html"
)

func main() {
    resp, err := http.Get("https://example.com/article")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        log.Fatalf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatal(err)
    }

    result, err := html.Extract(body)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("제목:", result.Title)
    fmt.Println("단어 수:", result.WordCount)
}
```

:::tip 최적화 제안
입력 크기에 제한을 설정하여 메모리 오버플로우를 방지하세요:

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB
```
:::

## HTTP 클라이언트 설정

프로덕션 환경에서는 적절한 타임아웃과 연결 풀 매개변수를 설정해야 합니다:

```go
client := &http.Client{
    Timeout: 15 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

| 매개변수 | 추천값 | 설명 |
|------|--------|------|
| `Timeout` | 10-30s | 연결+TLS+읽기/쓰기 전체 프로세스 포함 |
| `MaxIdleConns` | 10-50 | 전역 최대 유휴 연결 수 |
| `MaxIdleConnsPerHost` | 5-10 | 단일 호스트 최대 유휴 연결 수 |
| `IdleConnTimeout` | 90s | 유휴 연결 유지 시간 |

## Processor 싱글톤 + HTTP 서비스

웹 서비스에서 단일 Processor 인스턴스를 재사용하여 모든 요청을 처리합니다:

```go
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

    body, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
    if err != nil {
        http.Error(w, "읽기 실패", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning 입력 검증
웹 서비스에서는 반드시 요청 본문 크기를 제한하여 악의적인 대용량 파일 공격을 방지하세요. `io.LimitReader` 또는 `http.MaxBytesReader`를 사용하세요.
:::

## 여러 URL 동시 스크래핑

Processor의 동시성 안전성을 활용하여 여러 페이지를 효율적으로 처리합니다:

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := http.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, _ := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            result, err := processor.Extract(body)
            results[idx] = URLResult{URL: u, Result: result, Error: err}
        }(i, url)
    }

    wg.Wait()
    return results
}
```

사용 예시:

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(p, urls) {
    if r.Error != nil {
        log.Printf("%s: 오류 - %v", r.URL, r.Error)
        continue
    }
    fmt.Printf("%s: %s (%d단어)\n", r.URL, r.Result.Title, r.Result.WordCount)
}
```

## 재시도가 포함된 스크래핑

네트워크 불안정 시나리오 처리:

```go
func fetchWithRetry(client *http.Client, url string, maxRetries int) ([]byte, error) {
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            lastErr = err
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("서버 오류: HTTP %d", resp.StatusCode)
            resp.Body.Close()
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
        }

        body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
        resp.Body.Close()
        if err != nil {
            return nil, err
        }
        return body, nil
    }

    return nil, fmt.Errorf("%d회 재시도 후에도 실패: %w", maxRetries, lastErr)
}
```

:::tip 재시도 전략
- 4xx 오류는 재시도하지 마세요(클라이언트 문제)
- 5xx와 네트워크 오류는 재시도할 수 있습니다
- 지수 백오프 사용: 1초, 2초, 4초
- 최대 재시도 횟수 설정(보통 3회)
:::

## 배치 + 컨텍스트 취소

대량의 URL에 대해 컨텍스트가 포함된 배치 처리를 사용하며, 타임아웃 취소를 지원합니다:

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
    // 전체 타임아웃 설정
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    // 모든 페이지 스크래핑
    pages := make([][]byte, len(urls))
    for i, u := range urls {
        select {
        case <-ctx.Done():
            fmt.Println("스크래핑 타임아웃, 취소됨")
            return
        default:
            body, err := fetchWithRetry(http.DefaultClient, u, 2)
            if err != nil {
                log.Printf("%s 건너뜀: %v", u, err)
                continue
            }
            pages[i] = body
        }
    }

    // 배치 추출
    batch := processor.ExtractBatchWithContext(ctx, pages)
    fmt.Printf("성공: %d, 실패: %d, 취소: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)
}
```

## 인코딩 처리

HTTP 응답은 비 UTF-8 인코딩을 사용할 수 있으며, HTML 라이브러리가 자동으로 감지하고 처리합니다:

```go
// 응답이 GBK 인코딩이어도 올바르게 추출
resp, _ := http.Get("https://example.cn/page")
body, _ := io.ReadAll(resp.Body)
result, _ := html.Extract(body) // 자동 인코딩 감지
```

`Content-Type` 헤더에서 인코딩 정보를 가져와 수동으로 지정할 수도 있습니다:

```go
charset := "utf-8" // Content-Type에서 파싱
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if idx := strings.Index(ct, "charset="); idx != -1 {
        charset = ct[idx+8:]
    }
}

cfg := html.DefaultConfig()
cfg.Encoding = charset
result, _ := html.Extract(body, cfg)
```

## 모범 사례

| 시나리오 | 추천 방식 |
|------|------|
| 단일 페이지 추출 | `http.Get()` + `html.Extract()` |
| 웹 서비스 | Processor 싱글톤 + `ExtractWithContext()` |
| 배치 스크래핑 | `processURLs()` + Processor 재사용 |
| 신뢰할 수 없는 출처 | `HighSecurityConfig()` + `io.LimitReader()` |
| 인코딩 불확실 | 자동 감지에 의존, 또는 Content-Type 헤더에서 지정 |

## 다음 단계

- [캐시와 재사용](../guides/processor-cache) - Processor 라이프사이클 관리
- [감사 시스템 실전](../guides/audit-pipeline) - 프로덕션 환경 보안 모니터링
- [API 레퍼런스: 배치 처리](../api-reference/batch) - 전체 배치 API
- [성능 최적화](../advanced/performance) - 성능 튜닝 팁
