---
title: "인터페이스 정의 - JWT API 레퍼런스"
description: "CyberGo JWT 인터페이스 정의 레퍼런스: TokenManager, CustomClaims, BlacklistStore, RateLimitProvider, ClockProvider 및 RateLimitKeyer 인터페이스."
---

# 인터페이스 정의

## TokenManager

```go
type TokenManager interface {
    Create(claims CustomClaims) (string, error)
    Validate(tokenString string) (Claims, bool, error)
    CreateRefresh(claims CustomClaims) (string, error)
    Refresh(refreshTokenString string) (string, error)
    ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
    RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
    Revoke(tokenString string) error
    IsRevoked(tokenString string) (bool, error)
    ParseUnverified(tokenString string, claims any) error
    Close() error
    IsClosed() bool
}
```

JWT 토큰 작업 핵심 인터페이스. 모든 구현은 동시성에 안전해야 합니다. 기본 구현은 [`*Processor`](./processor)입니다.

메서드는 세 그룹으로 나뉩니다:
- **토큰 생성**: `Create`, `CreateRefresh`
- **검증 및 갱신**: `Validate`, `ValidateInto`, `Refresh`, `RefreshInto`
- **일반 작업**: `Revoke`, `IsRevoked`, `ParseUnverified`, `Close`, `IsClosed`

<Badge type="info" text="interface" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Create` | `Create(claims CustomClaims) (string, error)` | 액세스 토큰 생성 |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | 토큰 검증 |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | 리프레시 토큰 생성 |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | 토큰 갱신 |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | 커스텀 Claims로 검증 |
| `RefreshInto` | `RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)` | 커스텀 Claims로 갱신 |
| `Revoke` | `Revoke(tokenString string) error` | 토큰 취소 |
| `IsRevoked` | `IsRevoked(tokenString string) (bool, error)` | 취소 여부 확인 |
| `ParseUnverified` | `ParseUnverified(tokenString string, claims any) error` | 검증 없이 파싱 |
| `Close` | `Close() error` | 리소스 해제 |
| `IsClosed` | `IsClosed() bool` | 종료 여부 확인 |

### 구현 타입

| 타입 | 설명 |
|------|------|
| `*Processor` | 기본 구현 |

---

## CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

커스텀 Claims 인터페이스. [`Create`](./processor#create), [`ValidateInto`](./processor#validateinto), [`RefreshInto`](./processor#refreshinto) 등의 메서드에서 사용됩니다.

<Badge type="info" text="interface" />

### 검증 계약

Processor는 `*Claims`와 다른 타입에 대해 다른 검증 경로를 실행합니다:

| 타입 | 검증 동작 |
|------|----------|
| `*Claims` | 심층 검증: 모든 필드 (길이 제한, 인젝션 패턴, 제어 문자) |
| 기타 타입 | `Validate()` 호출 + 등록 선언 문자열 정제 (Issuer, Subject, ID, Audience) |

:::warning 주의
`*Claims`가 아닌 타입의 경우, 커스텀 구조체 필드는 심층 검증되지 **않습니다**. 구현자는 `Validate()` 메서드에서 모든 비즈니스 필드를 직접 검증해야 합니다.
:::

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `GetRegisteredClaims` | `GetRegisteredClaims() *RegisteredClaims` | 표준 JWT 필드 반환 |
| `Validate` | `Validate() error` | 커스텀 검증 로직 |

### 구현 타입

| 타입 | 설명 |
|------|------|
| `*Claims` | 내장 Claims 구현 |

---

## BlacklistStore

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

블랙리스트 저장소 백엔드 인터페이스.

<Badge type="info" text="interface" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Add` | `Add(tokenID string, expiresAt time.Time) error` | 블랙리스트에 추가 |
| `Contains` | `Contains(tokenID string) (bool, error)` | 블랙리스트 포함 여부 확인 |
| `Close` | `Close() error` | 리소스 해제 |

---

## RateLimitProvider

```go
type RateLimitProvider interface {
    Allow(key string) bool
    AllowN(key string, n int) bool
    Reset(key string)
    Close()
}
```

속도 제한 인터페이스.

<Badge type="info" text="interface" />

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Allow` | `Allow(key string) bool` | 단일 요청 허용 여부 확인 |
| `AllowN` | `AllowN(key string, n int) bool` | n회 요청 허용 여부 확인 |
| `Reset` | `Reset(key string)` | 지정된 키의 속도 제한 상태 초기화 |
| `Close` | `Close()` | 리소스 해제 |

### 구현 타입

| 타입 | 설명 |
|------|------|
| `*RateLimiter` | 내장 토큰 버킷 구현 |

---

## ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

클럭 인터페이스, 시간 주입용 (테스트 시나리오).

<Badge type="info" text="interface" />

### 구현 타입

| 타입 | 설명 |
|------|------|
| `SystemClock` | 시스템 클럭 |
| `FixedClock` | 고정 시간 클럭 |

---

## RateLimitKeyer

```go
type RateLimitKeyer interface {
    RateLimitKey() string
}
```

선택적 인터페이스, 커스텀 Claims가 이 인터페이스를 구현하여 속도 제한 키를 제공할 수 있습니다. 속도 제한 키 조회 우선순위: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

<Badge type="info" text="interface" />
