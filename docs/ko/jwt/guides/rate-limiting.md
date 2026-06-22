---
title: "속도 제한 - CyberGo JWT | 토큰 버킷 속도 제한"
description: "속도 제한 가이드: 토큰 버킷으로 발급 인터페이스의 윈도우당 최대 요청 수를 설정하고, Subject·UserID·RateLimitKeyer 우선순위 조회, 내장과 커스텀 분산 속도 제한 구현을 지원합니다."
---

# 속도 제한

속도 제한은 토큰 발급 인터페이스의 악용(예: 무차별 대입 공격)을 방지하는 데 사용됩니다.

## 작동 방식

토큰 버킷 알고리즘을 사용하여 지정된 시간 윈도우 내에서 각 키당 최대 요청 수를 제한합니다.

```text
Create(claims) → 속도 제한 키 추출 → RateLimitProvider 확인 → 허용/거부
```

## 설정

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100              // 윈도우당 최대 요청 수
cfg.RateLimitWindow = time.Minute    // 시간 윈도우
```

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `EnableRateLimit` | `false` | 속도 제한 활성화 여부 |
| `RateLimitRate` | `100` | 윈도우당 최대 요청 수 |
| `RateLimitWindow` | `1m` | 시간 윈도우 |

:::tip 참고
속도 제한은 모든 토큰 발급 메서드에 적용됩니다: `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()`. `Validate()`와 `ValidateInto()`에는 영향을 주지 않습니다.
:::

## 속도 제한 키

속도 제한은 키 기반으로 격리되며, 키의 조회 우선순위는 다음과 같습니다:

1. `RegisteredClaims.Subject` — 비어있지 않은 경우
2. `*Claims.UserID` — 내장 Claims에만 해당
3. `RateLimitKey()` — `RateLimitKeyer` 인터페이스를 구현한 경우
4. 빈 문자열 — 속도 제한 검사 건너뜀

### 커스텀 속도 제한 키

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// RateLimitKeyer 인터페이스 구현
func (c *MyClaims) RateLimitKey() string {
    return c.Email
}
```

## 내장 RateLimiter

`NewRateLimiter`를 사용하여 독립적인 속도 제한기를 생성:

```go
limiter := jwt.NewRateLimiter(100, time.Minute)

if limiter.Allow("user:123") {
    // 허용
} else {
    // 거부
}

limiter.Reset("user:123") // 카운터 초기화
defer limiter.Close()
```

## 커스텀 속도 제한기

[`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) 인터페이스를 구현:

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

:::tip AllowN에 대하여
인터페이스 자체는 단일 판단 `Allow`만 정의합니다. 배치 판단 메서드 `AllowN(key string, n int) bool`는 구체 타입 [`*RateLimiter`](../api-reference/types#ratelimiter)의 확장 메서드로, 이 인터페이스에 속하지 않습니다.
:::

예를 들어 Redis를 연동하여 분산 속도 제한을 구현:

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

## 속도 제한 초과

요청이 속도 제한 임계값을 초과하면, 토큰 발급 메서드(`Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()`)가 `ErrRateLimitExceeded`를 반환합니다:

```go
token, err := processor.Create(claims)
if errors.Is(err, jwt.ErrRateLimitExceeded) {
    // 속도 제한 처리: 429 Too Many Requests 반환
}
```

## 다음 단계

- [API 레퍼런스 → RateLimitProvider](../api-reference/interfaces#ratelimitprovider) — 인터페이스 정의
- [API 레퍼런스 → RateLimiter](../api-reference/types#ratelimiter) — 내장 구현
- [기본 예제](../examples/basic) — 속도 제한 예제
