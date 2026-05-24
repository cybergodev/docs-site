---
title: "기본 사용법 - HTTPC"
description: "HTTPC 기본 사용법 예제 모음: 쿼리 매개변수와 인증 포함 GET 요청, JSON/폼/파일 업로드 POST 요청, FormData 다중 필드 폼, DefaultConfig 사용자 정의 설정, ProxyURL 프록시, Recovery/Logging 미들웨어, RequestID/Metrics 메트릭 수집과 진행률 콜백 파일 다운로드 완전한 코드."
---

# 기본 사용법

## GET 요청

### 기본 GET

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())
}
```

### 쿼리 매개변수 포함

```go
result, err := httpc.Get("https://httpbin.org/get",
    httpc.WithQuery("name", "test"),
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{
        "limit": 10,
        "sort":  "desc",
    }),
)
```

### 인증 포함

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

## POST 요청

### JSON 요청 본문

```go
data := map[string]any{
    "name":  "John",
    "email": "john@example.com",
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithJSON(data),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// JSON 응답 파싱
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### 폼 제출

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### 파일 업로드

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### 다중 필드 폼

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

## 클라이언트 생성

### 사용자 정의 구성

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

### 프록시 구성

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## 미들웨어

### 로깅 + 복구

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
}
cfg.Middleware.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### 요청 ID + 메트릭

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
}

client, _ := httpc.New(cfg)
```

## 파일 다운로드

```go
client, _ := httpc.New()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r다운로드 중: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n다운로드 완료: %s, 소요 시간 %v, 평균 속도 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## 도메인 클라이언트

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 세션 정보 설정
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 요청은 자동으로 세션 헤더와 Cookie를 포함
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## 다음 단계

- [고급 예제](./advanced-usage) - 사용자 정의 재시도, 미들웨어 체인, 동시성 다운로드
- [요청과 응답](../guides/request-response) - 요청 옵션 상세 설명
- [도메인 클라이언트와 세션](../guides/domain-session) - 세션 관리
