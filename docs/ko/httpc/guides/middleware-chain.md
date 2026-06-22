---
title: "미들웨어 체인 - CyberGo HTTPC | 양파 모델 체인"
description: "HTTPC 미들웨어 체인 가이드: 양파 모델 실행 원리와 요청/응답 양방향 처리, 여덟 개 내장 미들웨어 설정, Chain 수동 조합, 커스텀 MiddlewareFunc 작성법과 서킷 브레이커 단락 예제를 다룹니다."
---

# 미들웨어 체인

## 양파 모델

HTTPC 미들웨어는 양파 모델을 채택하여, 요청은 외부에서 내부로, 응답은 내부에서 외부로 흐릅니다:

```text
요청 →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
응답 ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // 가장 바깥: panic 복구
    httpc.LoggingMiddleware(log.Printf), // 두 번째: 로그 기록
    httpc.RequestIDMiddleware("X-Request-ID", nil), // 가장 안쪽: 요청 ID
}

client, _ := httpc.New(cfg)
```

## 내장 미들웨어

### RecoveryMiddleware

panic 복구, 프로세스 크래시 방지:

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

요청/응답 로그, URL 자동 마스킹:

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// 출력: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

각 요청에 고유 ID 추가, `crypto/rand`로 생성:

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // 기본 32자 hex

// 커스텀 생성기
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

미들웨어 계층 타임아웃, 클라이언트 타임아웃 전에 강제 실행:

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

모든 요청에 정적 헤더 추가:

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

요청 메트릭 수집:

```go
httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
})
```

### AuditMiddleware

보안 감사, 금융, 의료 등 컴플라이언스 시나리오에 적합:

```go
httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})
```

### AuditMiddlewareWithConfig

설정 가능한 감사 미들웨어:

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

감사 이벤트는 컨텍스트에서 SourceIP와 UserID 추출을 지원합니다:

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## 수동 체인 조합

`Chain` 함수로 미들웨어를 조합합니다:

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

## 커스텀 미들웨어

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // 요청 단계: 요청 수정
            req.SetHeader("Origin", origin)

            // 다음 핸들러 호출
            resp, err := next(ctx, req)

            // 응답 단계: 기록 또는 응답 수정
            if resp != nil {
                log.Printf("응답 상태: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

### 단락 미들웨어

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

## 미들웨어 설정

```go
cfg := httpc.DefaultConfig()
cfg.Middleware = &httpc.MiddlewareConfig{
    Middlewares: []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
    },
    UserAgent:       "my-app/1.0",
    Headers:         map[string]string{"X-App": "my-app"},
    FollowRedirects: true,
    MaxRedirects:    10,
}

client, _ := httpc.New(cfg)
```

## 다음 단계

- [미들웨어 API](../api-reference/middleware) - 완전한 미들웨어 참조
- [재시도와 장애 허용](./retry-fault-tolerance) - 재시도 전략 가이드
- [보안 개요](../security/) - 감사 미들웨어 보안 실천
