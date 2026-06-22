---
title: "오류 처리 - CyberGo HTTPC | 분류와 센티널"
description: "HTTPC 오류 처리 가이드: ErrorType 12가지 오류 분류, ClientError 필드와 IsRetryable, errors.Is/As 센티넬 매칭, 재시도 소진, 컨텍스트 타임아웃과 미들웨어 통합 처리 모범 사례를 다룹니다."
---

# 오류 처리

## 오류 분류

HTTPC은 `ClientError`로 오류를 분류하며, `errors.As`와 `errors.Is`를 지원합니다.

### 오류 타입 판단

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("요청 타임아웃: %v", err)
        case httpc.ErrorTypeNetwork:
            log.Printf("네트워크 오류: %v", err)
        case httpc.ErrorTypeDNS:
            log.Printf("DNS 해석 실패: %v", err)
        case httpc.ErrorTypeTLS:
            log.Printf("TLS 오류: %v", err)
        case httpc.ErrorTypeCertificate:
            log.Printf("인증서 검증 실패: %v", err)
        case httpc.ErrorTypeRetryExhausted:
            log.Printf("재시도 소진: %v", err)
        case httpc.ErrorTypeValidation:
            log.Printf("요청 검증 실패: %v", err)
        case httpc.ErrorTypeContextCanceled:
            log.Printf("요청 취소됨: %v", err)
        }
    }
}
```

### 재시도 가능 여부 판단

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // 오류 재시도 가능
    log.Println("재시도 가능한 오류, 나중에 재시도")
}
```

## 센티넬 오류

### 오류 변수 매칭

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // 클라이언트가 닫힘
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // 응답 본문이 비어 있음
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // 요청 헤더가 무효
}
```

## 재시도와 오류

재시도 설정은 [재시도와 장애 허용](../guides/retry-fault-tolerance)을 참조하고, 여기서는 재시도 소진 후의 오류 처리에 집중합니다:

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("%d회 재시도 후에도 실패", clientErr.Attempts)
        }
    }
    return err
}
```

## 컨텍스트 취소

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.Request(ctx, "GET", url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeContextCanceled {
            log.Println("요청이 취소됨 (타임아웃 또는 수동 취소)")
        }
    }
}
```

## 오류 처리 모범 사례

### 1. 클라이언트 오류와 서버 오류 구분

```go
result, err := client.Get(url)
if err != nil {
    // 네트워크 계층 오류
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - 클라이언트 요청 오류
    log.Printf("클라이언트 오류: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - 서버 장애
    log.Printf("서버 오류: %d", result.StatusCode())
}
```

### 2. 미들웨어로 통합 처리

```go
recoveryMiddleware := httpc.RecoveryMiddleware()
loggingMiddleware := httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
metricsMiddleware := httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    if err != nil {
        metrics.Increment("http.errors")
    } else {
        metrics.RecordDuration("http.duration", duration)
    }
})
```

### 3. 타임아웃 계층화

```go
// 클라이언트 기본 타임아웃
cfg.Timeouts.Request = 30 * time.Second

// 미들웨어 강제 타임아웃
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// 개별 요청 덮어쓰기
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// 컨텍스트 타임아웃 (가장 정밀)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## 다음 단계

- [오류 타입 API](../api-reference/errors) - 오류 타입과 변수 참조
- [재시도와 장애 허용](../guides/retry-fault-tolerance) - 재시도 전략 설정
- [미들웨어 체인](../guides/middleware-chain) - 미들웨어로 오류 통합 처리
