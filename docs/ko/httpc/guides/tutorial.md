---
title: "실전 튜토리얼 - CyberGo HTTPC | GitHub API 실전"
description: "HTTPC 실전 튜토리얼: httpc.Get에서 단계적으로 완전한 GitHub REST API 클라이언트를 구축하며, JSON 파싱, 도메인 클라이언트, 미들웨어 체인 조합, ClientError 오류 처리와 파일 다운로드를 다룹니다."
---

# 실전 튜토리얼: GitHub API 클라이언트 구축

GitHub API 클라이언트를 구축하면서 HTTPC의 핵심 개념을 연결해 봅니다. 약 30분이 소요됩니다.

**배울 내용:**

- 클라이언트 생성과 설정 프리셋
- GET/POST 요청 전송과 JSON 응답 처리
- 도메인 클라이언트로 API 기본 URL 관리
- 미들웨어로 로깅과 메트릭 추가
- 오류 처리와 재시도
- Result 응답 객체와 자동 관리

## 1단계: 기본 요청

의존성을 설치하고 `main.go`를 생성합니다:

```bash
go get github.com/cybergodev/httpc
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://api.github.com/repos/golang/go")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON 응답
}
```

핵심 포인트:
- 패키지 함수 `httpc.Get`은 클라이언트 생성 없이 사용 가능, 빠른 검증에 적합
- Result는 매 요청마다 새로 생성, GC가 자동 회수, 수동 해제 불필요

## 2단계: JSON 응답 파싱

```go
type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

result, err := httpc.Get("https://api.github.com/repos/golang/go")
if err != nil {
    log.Fatal(err)
}

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("언어: %s\n", repo.Language)
fmt.Printf("설명: %s\n", repo.Description)
```

핵심 포인트:
- `result.Unmarshal(&v)`로 JSON 응답을 구조체에 직접 파싱
- API 응답에 대응하는 Go 구조체를 정의

## 3단계: 도메인 클라이언트 생성

GitHub API의 모든 엔드포인트는 `https://api.github.com`에 있으므로, 도메인 클라이언트를 사용하여 URL 반복 작성을 피합니다:

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// 요청 경로는 baseURL 기준 상대 경로
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
```

핵심 포인트:
- `NewDomain`은 스코프 클라이언트를 생성, 경로는 baseURL 기준
- `SetHeader`는 지속 요청 헤더 설정, 매 요청마다 자동 포함
- `WithHeader`는 요청 옵션으로 전달, 현재 요청에만 적용
- 도메인 클라이언트는 Cookie를 자동 관리

## 4단계: 데이터 전송 (Issue 생성)

```go
type CreateIssueRequest struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}

newIssue := CreateIssueRequest{
    Title: "Bug report",
    Body:  "Found a bug in the API response",
}

result, err := client.Post("/repos/owner/repo/issues",
    httpc.WithJSON(newIssue),
)
if err != nil {
    log.Fatal(err)
}

if !result.IsSuccess() {
    log.Fatalf("생성 실패: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d 생성됨: %s\n", created.Number, created.URL)
```

핵심 포인트:
- `WithJSON(data)`는 자동 직렬화 및 Content-Type 설정
- `result.IsSuccess()`로 2xx 상태 코드 확인

## 5단계: 미들웨어 추가

클라이언트에 로깅과 요청 ID를 추가합니다:

```go
// 미들웨어 설정
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// 설정을 NewDomain에 전달하여 미들웨어가 포함된 도메인 클라이언트 생성
client, err := httpc.NewDomain("https://api.github.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

핵심 포인트:
- 미들웨어는 `Config.Middleware.Middlewares`에서 설정
- `LoggingMiddleware`는 요청 로그 기록
- `RecoveryMiddleware`는 panic으로 인한 크래시 방지
- `RequestIDMiddleware`는 각 요청에 고유 ID 생성

## 6단계: 오류 처리와 재시도

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("요청 타임아웃, 나중에 재시도")
        case httpc.ErrorTypeNetwork:
            log.Println("네트워크 오류")
        case httpc.ErrorTypeTLS:
            log.Println("TLS 오류")
        default:
            log.Printf("HTTP 오류: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("이 오류는 자동 재시도 가능")
        }
    }
    return
}

// HTTP 상태 코드 처리
switch {
case result.IsSuccess():
    // 2xx 성공
case result.StatusCode() == 401:
    log.Println("Token 만료 또는 무효")
case result.IsClientError():
    log.Printf("클라이언트 오류: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("서버 오류: %d (자동 재시도 %d회)",
        result.StatusCode(), result.Meta.Attempts)
}
```

재시도 전략 설정:

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

핵심 포인트:
- HTTPC은 네트워크 오류와 HTTP 상태 코드를 분리하여 처리
- `ClientError`는 오류 분류와 재시도 가능 여부 판단 제공
- 기본적으로 408, 429, 500, 502, 503, 504에 대해 자동 재시도

## 7단계: 파일 다운로드 (릴리스 패키지 다운로드)

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r다운로드 진행률: %.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(
    context.Background(),
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n다운로드 완료: %s (%d bytes)\n",
    result.FilePath,
    result.BytesWritten,
)
```

## 8단계: 동시 요청

여러 리포지토리 정보를 동시에 가져옵니다:

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, _ := httpc.New(httpc.PerformanceConfig())
    defer client.Close()

    results := make([]*httpc.Result, len(repos))
    errs := make([]error, len(repos))

    var wg sync.WaitGroup
    for i, name := range repos {
        wg.Add(1)
        go func(idx int, repo string) {
            defer wg.Done()
            r, err := client.Request(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s", repo))
            results[idx] = r
            errs[idx] = err
        }(i, name)
    }
    wg.Wait()

    for i, err := range errs {
        if err != nil {
            return err
        }

        var repo Repo
        results[i].Unmarshal(&repo)
        fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
    }
    return nil
}
```

:::tip
`PerformanceConfig()`은 대형 연결 풀 설정을 제공하여 고동시성 시나리오에 적합합니다. Result는 매 요청마다 새로 생성되며, GC가 자동 회수합니다.
:::

## 완전한 예제

위 단계들을 통합한 완전한 코드:

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/httpc"
)

type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

func main() {
    token := os.Getenv("GITHUB_TOKEN")

    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        httpc.RecoveryMiddleware(),
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // 리포지토리 정보 가져오기
    result, err := client.Get("https://api.github.com/repos/golang/go",
        httpc.WithHeader("Authorization", "Bearer "+token),
    )
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && clientErr.IsRetryable() {
            log.Fatal("요청 실패 (재시도 완료):", err)
        }
        log.Fatal(err)
    }

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | 언어: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   소요 시간: %s (재시도 %d회)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## 다음 단계

- [요청과 응답](./request-response) -- 완전한 요청 옵션 참조
- [미들웨어 체인](./middleware-chain) -- 커스텀 미들웨어 개발
- [재시도와 장애 허용](./retry-fault-tolerance) -- 고급 재시도 전략
- [성능 최적화](../advanced/performance) -- 프로덕션 환경 튜닝
- [프로덕션 체크리스트](../security/production-checklist) -- 보안 모범 사례
