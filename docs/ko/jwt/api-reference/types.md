---
title: "타입과 상수 - CyberGo JWT | 직렬화와 클럭 타입"
description: "타입과 상수 레퍼런스: NumericDate·StringOrSlice 직렬화, SigningMethod 알고리즘, ValidationError 필드 오류, RateLimiter, SystemClock·FixedClock 클럭, 12 알고리즘 상수."
---

# 타입과 상수

## NumericDate

```go
type NumericDate struct {
    time.Time
}
```

JWT 숫자 날짜 값 (Unix 타임스탬프). 유효 범위는 0부터 253402300799 (9999-12-31 23:59:59 UTC)까지.

<Badge type="info" text="struct" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `MarshalJSON` | `func (date *NumericDate) MarshalJSON() ([]byte, error)` | Unix 타임스탬프 JSON 숫자로 직렬화; 제로 시간 또는 유효 범위를 벗어나면 `null` 반환 |
| `UnmarshalJSON` | `func (date *NumericDate) UnmarshalJSON(b []byte) error` | JSON 숫자 또는 문자열에서 Unix 타임스탬프 파싱; 음수 및 유효 범위를 벗어난 값 거부 |

---

## StringOrSlice

```go
type StringOrSlice []string
```

JSON 문자열 또는 JSON 배열에서 역직렬화되는 `[]string`을 보관; 단일 요소 슬라이스는 JSON 문자열로, 다중 요소 슬라이스는 배열로 직렬화, RFC 7519 §4.1.3 준수.

<Badge type="info" text="type" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `MarshalJSON` | `func (s StringOrSlice) MarshalJSON() ([]byte, error)` | 단일 요소 슬라이스는 JSON 문자열로, 다중 요소는 배열로 직렬화 (RFC 7519 §4.1.3) |
| `UnmarshalJSON` | `func (s *StringOrSlice) UnmarshalJSON(b []byte) error` | JSON 문자열 또는 배열에서 파싱 |

---

## SigningMethod

```go
type SigningMethod string
```

서명 알고리즘 타입.

<Badge type="info" text="type" />

---

## ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

필드 수준 검증 실패 오류.

<Badge type="info" text="struct" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Error` | `func (e *ValidationError) Error() string` | 오류 메시지 |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | 내부 오류 언래핑 |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

토큰 버킷 속도 제한기, [`RateLimitProvider`](./interfaces#ratelimitprovider) 인터페이스 구현.

<Badge type="info" text="struct" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Allow` | `func (rl *RateLimiter) Allow(key string) bool` | 단일 요청 확인 |
| `AllowN` | `func (rl *RateLimiter) AllowN(key string, n int) bool` | n회 요청 확인 |
| `Reset` | `func (rl *RateLimiter) Reset(key string)` | 지정된 키 초기화 |
| `Close` | `func (rl *RateLimiter) Close()` | 리소스 해제 |

---

## SystemClock

```go
type SystemClock struct{}
```

시스템 클럭, [`ClockProvider`](./interfaces#clockprovider)의 기본 구현.

<Badge type="info" text="struct" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Now` | `func (SystemClock) Now() time.Time` | 현재 시스템 시간 반환 |

---

## FixedClock

```go
type FixedClock struct {
    T time.Time
}
```

고정 시간 클럭, 테스트용.

<Badge type="info" text="struct" />

### 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `T` | `time.Time` | 고정 시간 값 |

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Now` | `func (c FixedClock) Now() time.Time` | 고정 시간 반환 |

---

## 서명 알고리즘 상수

```go
const (
    SigningMethodHS256 SigningMethod = "HS256"
    SigningMethodHS384 SigningMethod = "HS384"
    SigningMethodHS512 SigningMethod = "HS512"

    SigningMethodRS256 SigningMethod = "RS256"
    SigningMethodRS384 SigningMethod = "RS384"
    SigningMethodRS512 SigningMethod = "RS512"

    SigningMethodPS256 SigningMethod = "PS256"
    SigningMethodPS384 SigningMethod = "PS384"
    SigningMethodPS512 SigningMethod = "PS512"

    SigningMethodES256 SigningMethod = "ES256"
    SigningMethodES384 SigningMethod = "ES384"
    SigningMethodES512 SigningMethod = "ES512"
)
```

| 상수 | 값 | 알고리즘 | 타입 |
|------|-----|------|------|
| `SigningMethodHS256` | `"HS256"` | HMAC-SHA256 | 대칭 |
| `SigningMethodHS384` | `"HS384"` | HMAC-SHA384 | 대칭 |
| `SigningMethodHS512` | `"HS512"` | HMAC-SHA512 | 대칭 |
| `SigningMethodRS256` | `"RS256"` | RSA-SHA256 | 비대칭 |
| `SigningMethodRS384` | `"RS384"` | RSA-SHA384 | 비대칭 |
| `SigningMethodRS512` | `"RS512"` | RSA-SHA512 | 비대칭 |
| `SigningMethodPS256` | `"PS256"` | RSA-PSS-SHA256 | 비대칭 |
| `SigningMethodPS384` | `"PS384"` | RSA-PSS-SHA384 | 비대칭 |
| `SigningMethodPS512` | `"PS512"` | RSA-PSS-SHA512 | 비대칭 |
| `SigningMethodES256` | `"ES256"` | ECDSA-SHA256 | 비대칭 |
| `SigningMethodES384` | `"ES384"` | ECDSA-SHA384 | 비대칭 |
| `SigningMethodES512` | `"ES512"` | ECDSA-SHA512 | 비대칭 |

---

## 토큰 타입 상수

```go
const (
    TokenTypeAccess  = "access"
    TokenTypeRefresh = "refresh"
)
```

[`RegisteredClaims.TokenType`](./claims#registeredclaims) 필드에 기록되는 토큰 타입 상수.

- 액세스 토큰은 [`Processor.Create`](./processor#create)가 생성
- 리프레시 토큰은 [`Processor.CreateRefresh`](./processor#createrefresh)가 생성
- [`Processor.Refresh`](./processor#refresh)와 [`Processor.RefreshInto`](./processor#refreshinto)는 `TokenTypeAccess` 토큰을 거부

| 상수 | 값 | 설명 |
|------|-----|------|
| `TokenTypeAccess` | `"access"` | 액세스 토큰 |
| `TokenTypeRefresh` | `"refresh"` | 리프레시 토큰 |
