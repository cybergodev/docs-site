---
title: "패키지 함수 - CyberGo JWT | 팩토리 함수와 기본값"
description: "패키지 함수 레퍼런스: New로 Processor를 생성·검증, DefaultConfig와 DefaultBlacklistConfig로 기본 설정 반환, NewNumericDate로 타임스탬프 생성, NewRateLimiter로 토큰 버킷을 만듭니다."
---

# 패키지 함수

## New

```go
func New(cfg Config) (*Processor, error)
```

새로운 JWT Processor를 생성합니다. `DefaultConfig()`로 기본 설정을 가져와 필요한 필드를 수정한 후 전달합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `cfg` | `Config` | 설정 항목 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `processor` | `*Processor` | JWT 프로세서 |
| `err` | `error` | 설정 검증 실패 시 오류 반환 |

### 예제

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    fmt.Println("Processor created successfully")
}
```

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrInvalidConfig` | 설정 항목이 올바르지 않음 |
| `ErrInvalidSecretKey` | 키 누락, 32바이트 미만, 약한 키, 타입 오류 또는 ECDSA 곡선 불일치 |
| `ErrInvalidSigningMethod` | 지원하지 않는 서명 알고리즘 |

---

## DefaultConfig

```go
func DefaultConfig() Config
```

합리적인 기본값이 설정된 설정을 반환합니다.

<Badge type="tip" text="v1.0.0+" />

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `config` | `Config` | 기본 설정 |

### 기본값

| 필드 | 기본값 |
|------|--------|
| `AccessTokenTTL` | `15 * time.Minute` |
| `RefreshTokenTTL` | `7 * 24 * time.Hour` |
| `Issuer` | `"jwt-service"` |
| `SigningMethod` | `SigningMethodHS256` |
| `RateLimitRate` | `100` |
| `RateLimitWindow` | `time.Minute` |
| `Blacklist` | `DefaultBlacklistConfig()` |

### 예제

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 필요에 따라 다른 필드 수정
```

---

## DefaultBlacklistConfig

```go
func DefaultBlacklistConfig() BlacklistConfig
```

합리적인 기본값이 설정된 블랙리스트 설정을 반환합니다.

<Badge type="tip" text="v1.0.0+" />

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `config` | `BlacklistConfig` | 기본 블랙리스트 설정 |

### 기본값

| 필드 | 기본값 |
|------|--------|
| `CleanupInterval` | `5 * time.Minute` |
| `MaxSize` | `100000` |
| `EnableAutoCleanup` | `true` |

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

`time.Time`에서 `NumericDate`를 생성합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `t` | `time.Time` | 시간 값 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `date` | `NumericDate` | JWT 숫자 날짜 |

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

토큰 버킷 속도 제한기를 생성합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `maxRate` | `int` | 윈도우당 최대 요청 수 (≤0이면 기본값 100) |
| `window` | `time.Duration` | 시간 윈도우 (≤0이면 기본값 1분) |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `limiter` | `*RateLimiter` | 속도 제한기 인스턴스 |
