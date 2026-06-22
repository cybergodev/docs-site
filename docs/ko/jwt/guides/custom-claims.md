---
title: "커스텀 Claims - CyberGo JWT | 비즈니스 선언 인터페이스"
description: "커스텀 Claims 가이드: CustomClaims 인터페이스로 비즈니스 전용 선언 필드를 정의하고, 내장 Claims와 커스텀 타입의 검증 차이, ValidateInto와 RefreshInto 파싱·갱신 사용법을 안내합니다."
---

# 커스텀 Claims

내장 [`Claims`](../api-reference/claims#claims) 구조체는 일반적인 시나리오를 다루지만, 비즈니스 시스템은 일반적으로 추가 필드가 필요합니다. `CustomClaims` 인터페이스를 구현하여 자체 Claims 구조체를 정의할 수 있습니다.

## CustomClaims 인터페이스

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

두 가지 메서드만 구현하면 됩니다:

| 메서드 | 설명 |
|------|------|
| `GetRegisteredClaims()` | 표준 JWT 필드 반환 (iss, sub, aud 등) |
| `Validate()` | 커스텀 검증 로직 |

## 커스텀 Claims 정의

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}
```

:::tip 핵심 포인트
- `jwt.RegisteredClaims`를 반드시 임베드해야 합니다
- `GetRegisteredClaims()`는 임베드된 필드의 포인터를 반환해야 합니다
- `Validate()`는 토큰 생성과 검증 시 모두 호출됩니다
:::

## 커스텀 Claims 사용

### 토큰 생성

```go
claims := &MyClaims{
    UserID: "user123",
    Email:  "alice@example.com",
    Role:   "admin",
}
token, err := processor.Create(claims)
```

### 커스텀 구조체로 검증

`ValidateInto`를 사용하여 토큰을 커스텀 구조체로 파싱:

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(token, myClaims)
if err != nil {
    panic(err)
}
if valid {
    parsed := result.(*MyClaims)
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Email:", parsed.Email)
}
```

### 커스텀 구조체로 갱신

`RefreshInto`를 사용하여 토큰을 갱신하고 커스텀 필드를 유지:

```go
newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
if err != nil {
    panic(err)
}
```

:::warning 시간 필드 보호
`RefreshInto`는 Claims의 시간 필드(`IssuedAt`, `ExpiresAt`, `ID`)를 자동으로 복원하며, 작업이 실패해도 복원이 보장됩니다.
:::

## 검증 차이

내장 `*Claims`와 커스텀 타입은 서로 다른 검증 경로를 따릅니다:

| 검증 항목 | `*Claims` | 커스텀 타입 |
|--------|-----------|------------|
| `Validate()` 메서드 | ✅ | ✅ |
| 문자열 길이 제한 (256자) | ✅ | ❌ |
| 배열 크기 제한 (100개 항목) | ✅ | ❌ |
| 인젝션 패턴 감지 | ✅ | ❌ |
| 제어 문자 필터링 | ✅ | ❌ |
| `Extra` 필드 제한 | ✅ | 해당 없음 |
| 등록 선언 문자열 정제 | ✅ | ✅ |

:::warning 중요
커스텀 Claims의 비즈니스 필드는 심층 검증되지 **않습니다**. `Validate()` 메서드에서 필요한 모든 검증을 직접 구현하세요.
:::

## 선택적 인터페이스: RateLimitKeyer

커스텀 Claims는 `RateLimitKeyer` 인터페이스를 구현하여 속도 제한 키를 제공할 수 있습니다:

```go
func (c *MyClaims) RateLimitKey() string {
    return c.Email // Email을 속도 제한 키로 사용
}
```

속도 제한 키 조회 우선순위: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

## 다음 단계

- [API 레퍼런스 → 인터페이스 정의](../api-reference/interfaces#customclaims) — CustomClaims 전체 정의
- [API 레퍼런스 → Processor](../api-reference/processor#validateinto) — ValidateInto / RefreshInto 메서드
- [고급 예제](../examples/advanced) — 커스텀 Claims 전체 예제
