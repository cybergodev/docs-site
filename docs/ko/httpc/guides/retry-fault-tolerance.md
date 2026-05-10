---
title: 재시도와 장애 허용 - HTTPC
description: HTTPC 재시도와 장애 허용 가이드, 기본 재시도 전략과 백오프 알고리즘 원리, RetryPolicy 사용자 정의 인터페이스, Retry-After 해석과 모범 사례 예제 상세 설명.
---

# 재시도와 장애 허용

## 기본 재시도

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // 최대 3회
cfg.Retry.Delay = 1 * time.Second  // 초기 지연 1초
cfg.Retry.BackoffFactor = 2.0      // 지수 백오프 2배
cfg.Retry.EnableJitter = true      // 지터 활성화

client, _ := httpc.New(cfg)
```

기본 재시도 지연 시퀀스: `1s → 2s → 4s` (무작위 지터 포함)

### 재시도 조건

기본적으로 다음 오류는 재시도를 트리거합니다:

| 조건 | 재시도 |
|------|------|
| 네트워크 오류 (연결 거부, DNS 실패) | 예 |
| 타임아웃 오류 | 예 |
| 5xx 서버 오류 (500/502/503/504) | 예 |
| 408 Request Timeout / 429 Too Many Requests | 예 |
| 기타 4xx 클라이언트 오류 | 아니요 |
| 컨텍스트 취소 | 아니요 |
| 구성 검증 오류 | 아니요 |

## 사용자 정의 재시도 전략

`RetryPolicy` 인터페이스를 구현하여 재시도 동작을 완전히 제어합니다:

:::warning 주의 내부 유형
`RetryPolicy.ShouldRetry`의 `resp` 매개변수 유형 `ResponseReader`는 내부 인터페이스(`internal/types` 패키지에 정의)이며, 외부 패키지에서 직접 참조할 수 없습니다. 사용자 정의 `RetryPolicy`는 `httpc`와 같은 모듈 내의 패키지에서 구현해야 합니다. 대부분의 시나리오는 `RetryConfig` 필드 구성으로 충분합니다.
:::

```go
// 참고: ResponseReader는 내부 유형(internal/types 패키지)입니다.
// 이 코드는 github.com/cybergodev/httpc 모듈 내부에서만 컴파일할 수 있습니다.
// 대부분의 사용자는 RetryConfig와 WithMaxRetries로 재시도를 구성해야 합니다.

type MyRetryPolicy struct {
    maxAttempts int
}

// 재시도 여부 판단
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // 네트워크 오류 시 재시도
    if err != nil {
        return true
    }
    // 502, 503, 504만 재시도
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// 재시도 지연 시간 반환
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// 최대 재시도 횟수
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// 사용자 정의 전략 적용
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## 요청별 제어

```go
// 단일 요청 5회 재시도
result, err := client.Get(url, httpc.WithMaxRetries(5))

// 재시도 비활성화
result, err := client.Get(url, httpc.WithMaxRetries(0))

// 컨텍스트 타임아웃과 함께 사용
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-After 지원

HTTPC는 서버가 반환한 `Retry-After` 응답 헤더를 자동으로 해석합니다:

```go
// 서버 반환: Retry-After: 120
// HTTPC는 지수 백오프 지연 대신 120초 대기 후 재시도

// 서버 반환: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC는 지정된 시간까지 대기 후 재시도
```

:::tip 사용 팁
`Retry-After`는 재시도 가능한 모든 응답(408, 429, 500, 502, 503, 504)에서 적용되며, 지수 백오프 지연보다 우선순위가 높습니다.
:::

## 백오프 전략

### 지수 백오프

```go
cfg.Retry.BackoffFactor = 2.0
// 지연 시퀀스: delay, delay*2, delay*4, delay*8...
```

### 고정 지연

```go
cfg.Retry.BackoffFactor = 1.0
// 지연 시퀀스: delay, delay, delay...
```

### 선형 증가

```go
// 사용자 정의 RetryPolicy 구현 필요:
// delay * (attempt + 1)
// 고급 예제의 사용자 정의 재시도 전략 참조
```

### 무작위 지터

지터를 활성화하면 "천둥 무리 효과"를 방지합니다:

```go
cfg.Retry.EnableJitter = true
// 기본 지연에 무작위 오프셋을 추가하여 모든 클라이언트가 동시에 재시도하는 것을 방지
```

## 오류 처리와 재시도

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

## 모범 사례

| 시나리오 | 권장 사항 |
|------|------|
| API 호출 | MaxRetries=3, Delay=1s, Backoff=2.0 |
| 마이크로서비스 통신 | MaxRetries=2, Delay=500ms |
| 파일 다운로드 | MaxRetries=5, Delay=2s, Backoff=2.0 |
| 멱등성 작업 | 안심하고 재시도 가능 |
| 비멱등성 작업 (POST) | 네트워크 오류 시에만 재시도 |

:::warning 주의
비멱등성 POST 요청도 기본적으로 재시도됩니다. 정확한 제어가 필요한 경우 사용자 정의 `RetryPolicy`를 구현하십시오.
:::

## 다음 단계

- [오류 처리](../advanced/error-handling) - 완전한 오류 처리 가이드
- [구성 API](../api-reference/config) - 재시도 구성 참조
- [인터페이스 정의](../api-reference/interfaces) - RetryPolicy 인터페이스 참조
