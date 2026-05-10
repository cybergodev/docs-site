---
title: 고급 예제 - HTTPC
description: HTTPC 고급 사용법 예제 모음, 사용자 정의 재시도 전략, 미들웨어 체인 구성, RESTful API 래핑, 동시성 다운로드와 HMAC 서명 인증 고급 예제 포함.
---

# 고급 예제

## 사용자 정의 재시도 전략

502/503/504에만 재시도하고 고정 지연 사용:

:::warning 주의 내부 유형
`RetryPolicy.ShouldRetry`의 `resp` 매개변수 유형 `ResponseReader`는 내부 인터페이스(`internal/types` 패키지에 정의)이며, 외부 패키지에서 직접 참조할 수 없습니다. 사용자 정의 `RetryPolicy`는 `httpc`와 같은 모듈 내의 패키지에서 구현해야 합니다. 대부분의 시나리오는 `RetryConfig` 구성으로 충분합니다. 아래 예제는 구현 패턴을 보여주며, 실제 코드는 `httpc` 모듈 내부에서 컴파일해야 합니다.
:::

```go
// 참고: ResponseReader는 내부 유형(internal/types 패키지)입니다.
// 이 코드는 github.com/cybergodev/httpc 모듈 내부에서만 컴파일할 수 있습니다.
// 대부분의 사용자는 RetryConfig와 WithMaxRetries로 재시도를 구성해야 합니다.

type selectiveRetry struct {
    maxAttempts int
    baseDelay   time.Duration
}

// 재시도 여부 판단
func (p *selectiveRetry) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    if err != nil {
        return true // 네트워크 오류 시 재시도
    }
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

func (p *selectiveRetry) GetDelay(attempt int) time.Duration {
    return p.baseDelay * time.Duration(attempt+1)
}

func (p *selectiveRetry) MaxRetries() int {
    return p.maxAttempts
}

// 사용자 정의 전략 적용
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &selectiveRetry{maxAttempts: 5, baseDelay: time.Second}
```

외부 프로젝트의 대안 -- `RetryConfig` 구성 사용:

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 5
    cfg.Retry.Delay = 500 * time.Millisecond
    cfg.Retry.BackoffFactor = 1.5
    cfg.Retry.EnableJitter = true

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://api.example.com/unstable")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode())
}
```

## 완전한 미들웨어 체인

```go
package main

import (
    "encoding/json"
    "log"
    "sync/atomic"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // 요청 카운터
    var requestCount int64

    // 메트릭 수집
    metricsMiddleware := httpc.MetricsMiddleware(
        func(method, url string, statusCode int, duration time.Duration, err error) {
            atomic.AddInt64(&requestCount, 1)
            log.Printf("[METRICS] %s %s -> %d (%v)", method, url, statusCode, duration)
        },
    )

    // 감사 로그 (JSON 형식)
    auditCfg := &httpc.AuditMiddlewareConfig{
        Format:         "json",
        IncludeHeaders: true,
        MaskHeaders:    []string{"Authorization", "Cookie"},
        SanitizeError:  true,
    }
    auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
        data, _ := json.Marshal(event)
        log.Printf("[AUDIT] %s", data)
    }, auditCfg)

    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),                              // panic 복구
        httpc.TimeoutMiddleware(30 * time.Second),              // 강제 타임아웃
        httpc.RequestIDMiddleware("X-Request-ID", nil),         // 요청 ID
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        metricsMiddleware,
        auditMiddleware,
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Printf("총 요청 수: %d", atomic.LoadInt64(&requestCount))
}
```

## REST API 클라이언트 래핑

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

type APIClient struct {
    dc httpc.DomainClienter
}

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

func NewAPIClient(baseURL, token string) (*APIClient, error) {
    dc, err := httpc.NewDomain(baseURL)
    if err != nil {
        return nil, err
    }
    if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
        dc.Close()
        return nil, err
    }
    if err := dc.SetHeader("Accept", "application/json"); err != nil {
        dc.Close()
        return nil, err
    }

    return &APIClient{dc: dc}, nil
}

func (c *APIClient) GetUser(ctx context.Context, id int) (*User, error) {
    result, err := c.dc.Request(ctx, "GET", fmt.Sprintf("/users/%d", id))
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        return nil, fmt.Errorf("API error: %d", result.StatusCode())
    }

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) CreateUser(ctx context.Context, name string) (*User, error) {
    result, err := c.dc.Request(ctx, "POST", "/users",
        httpc.WithJSON(map[string]string{"name": name}),
    )
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) Close() error {
    return c.dc.Close()
}

func main() {
    api, err := NewAPIClient("https://api.example.com", "my-token")
    if err != nil {
        log.Fatal(err)
    }
    defer api.Close()

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // 사용자 생성
    user, err := api.CreateUser(ctx, "Alice")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("생성: %+v\n", user)

    // 사용자 조회
    user, err = api.GetUser(ctx, user.ID)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("조회: %+v\n", user)
}
```

## 동시성 다운로드

```go
package main

import (
    "fmt"
    "log"
    "sync"
    "sync/atomic"

    "github.com/cybergodev/httpc"
)

func main() {
    urls := map[string]string{
        "file1.zip": "https://example.com/files/file1.zip",
        "file2.zip": "https://example.com/files/file2.zip",
        "file3.zip": "https://example.com/files/file3.zip",
    }

    client, _ := httpc.New()
    defer client.Close()

    var successCount int64
    var totalBytes int64
    var wg sync.WaitGroup

    for filename, url := range urls {
        wg.Add(1)
        go func(name, u string) {
            defer wg.Done()

            cfg := httpc.DefaultDownloadConfig()
            cfg.FilePath = "/tmp/" + name
            cfg.Overwrite = true
            cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
                fmt.Printf("\r%s: %.1f%% (%s/s)", name,
                    float64(downloaded)/float64(total)*100,
                    httpc.FormatSpeed(speed))
            }

            result, err := client.DownloadWithOptions(u, cfg)
            if err != nil {
                log.Printf("%s 다운로드 실패: %v", name, err)
                return
            }

            atomic.AddInt64(&successCount, 1)
            atomic.AddInt64(&totalBytes, result.BytesWritten)
            fmt.Printf("\n%s 완료: %s\n", name, httpc.FormatBytes(result.BytesWritten))
        }(filename, url)
    }

    wg.Wait()
    fmt.Printf("\n다운로드 완료: %d/%d, 총 %s\n",
        successCount, len(urls), httpc.FormatBytes(totalBytes))
}
```

## 사용자 정의 미들웨어: 요청 서명

```go
package main

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func SigningMiddleware(secret string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            timestamp := time.Now().Unix()
            message := fmt.Sprintf("%s%s%d", req.Method(), req.URL(), timestamp)

            mac := hmac.New(sha256.New, []byte(secret))
            mac.Write([]byte(message))
            signature := hex.EncodeToString(mac.Sum(nil))

            req.SetHeader("X-Timestamp", fmt.Sprintf("%d", timestamp))
            req.SetHeader("X-Signature", signature)

            return next(ctx, req)
        }
    }
}

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        SigningMiddleware("my-secret-key"),
    }

    client, _ := httpc.New(cfg)
    defer client.Close()

    result, err := client.Get("https://api.example.com/protected")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Println(result.StatusCode())
}
```

## 다음 단계

- [미들웨어 체인](../guides/middleware-chain) - 미들웨어 아키텍처 상세 설명
- [재시도와 장애 허용](../guides/retry-fault-tolerance) - 사용자 정의 재시도 전략
- [성능 최적화](../advanced/performance) - 성능 튜닝 제안
