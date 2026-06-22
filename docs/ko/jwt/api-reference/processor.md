---
title: "Processor - CyberGo JWT | 핵심 토큰 조작 타입"
description: "Processor는 CyberGo JWT 핵심 타입으로 Create·Validate·Refresh·Revoke·IsRevoked·ParseUnverified·Close 등 토큰 조작 메서드의 시그니처·매개변수·반환값·오류와 예시를 제공합니다."
---

# Processor

Processor는 JWT 작업의 핵심 타입으로, [`TokenManager`](./interfaces#tokenmanager) 인터페이스를 구현합니다. 모든 메서드는 동시성에 안전합니다.

[`jwt.New(cfg)`](./functions#new)로 인스턴스를 생성합니다.

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

새로운 JWT 액세스 토큰을 생성합니다. `CustomClaims` 인터페이스를 구현하는 모든 타입을 허용합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `claims` | `CustomClaims` | 토큰 선언 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `token` | `string` | 서명된 JWT 문자열 |
| `err` | `error` | 검증 또는 서명 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |
| `ErrRateLimitExceeded` | 속도 제한 임계값 초과 |

### 예제

```go
// 내장 Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// 커스텀 Claims
myClaims := &MyClaims{UserID: "123"}
token, err := processor.Create(myClaims)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

JWT 액세스 토큰을 검증하고 파싱된 Claims를 반환합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `tokenString` | `string` | JWT 문자열 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `claims` | `Claims` | 파싱된 선언 (값 복사) |
| `valid` | `bool` | 유효 여부 |
| `err` | `error` | 검증 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrInvalidToken` | 서명이 무효함 |
| `ErrAlgorithmMismatch` | 토큰 알고리즘이 설정과 불일치 |
| `ErrExpirationRequired` | `RequireExpiration`이 활성화되었으나 토큰에 `exp` 클레임이 없음 |
| `ErrTokenExpired` | 토큰이 만료됨 |
| `ErrTokenNotValidYet` | 토큰이 아직 활성화되지 않음 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenRevoked` | 토큰이 취소됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |

### 예제

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    // 오류 처리
    return
}
if valid {
    fmt.Println(claims.UserID)
}
```

---

## CreateRefresh

```go
func (p *Processor) CreateRefresh(claims CustomClaims) (string, error)
```

리프레시 토큰을 생성합니다. `AccessTokenTTL` 대신 `RefreshTokenTTL`을 사용합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `claims` | `CustomClaims` | 토큰 선언 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `token` | `string` | 서명된 리프레시 토큰 |
| `err` | `error` | 검증 또는 서명 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |
| `ErrRateLimitExceeded` | 속도 제한 임계값 초과 |

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

기존 리프레시 토큰을 갱신하여 새로운 액세스 토큰을 반환합니다. 새로운 액세스 토큰을 발급하기 전에 리프레시 토큰의 서명, 만료, 블랙리스트를 모두 검증하며, 원본 토큰의 `IssuedAt`, `ExpiresAt`, `ID`는 재설정 및 재생성됩니다.

:::info 토큰 타입 및 로테이션
- **토큰 타입 검사**: `token_type=access`인 토큰은 거부됩니다 ([`ErrTokenTypeMismatch`](./errors#센티넬-오류) 반환). 액세스 토큰이 새 토큰을 얻는 데 사용되는 것을 방지; 하위 호환성을 위해 `token_type`이 없는 구형 토큰은 여전히 허용됩니다.
- **원본 토큰을 자동으로 취소하지 않음**: `Refresh`는 전달된 리프레시 토큰을 취소하지 않습니다. 원본 토큰은 만료되거나 명시적으로 [`Revoke()`](#revoke)될 때까지 유효합니다. 일회용 의미를 위해 `Refresh` 성공 후 `Revoke(refreshTokenString)`를 호출하세요.
:::

:::warning 보안 안내
갱신 시 표준 JWT 필드(exp, nbf, iss, aud, 블랙리스트)와 기본 구조 유효성(UserID 또는 Username 필수)만 검증합니다. 심층 필드 제약(길이 제한, 인젝션 패턴)은 생성 시 이미 검증되었으므로 재검사하지 않습니다.
:::

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `refreshTokenString` | `string` | 리프레시 토큰 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `token` | `string` | 새로운 액세스 토큰 |
| `err` | `error` | 검증 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrInvalidToken` | 서명이 무효함 |
| `ErrAlgorithmMismatch` | 토큰 알고리즘이 설정과 불일치 |
| `ErrExpirationRequired` | `RequireExpiration`이 활성화되었으나 토큰에 `exp` 클레임이 없음 |
| `ErrTokenExpired` | 토큰이 만료됨 |
| `ErrTokenNotValidYet` | 토큰이 아직 활성화되지 않음 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenRevoked` | 토큰이 취소됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |
| `ErrTokenTypeMismatch` | 액세스 토큰(`token_type=access`)으로 갱신 시도 |
| `ErrRateLimitExceeded` | 속도 제한 임계값 초과 |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

토큰을 검증하고 커스텀 Claims 구조체에 채웁니다. 전달된 `claims`와 동일한 포인터를 반환합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `tokenString` | `string` | JWT 문자열 |
| `claims` | `CustomClaims` | 대상 Claims 포인터 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `claims` | `CustomClaims` | 채워진 Claims |
| `valid` | `bool` | 유효 여부 |
| `err` | `error` | 검증 실패 시 오류 반환 |

### 예제

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}
```

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrInvalidToken` | 서명이 무효함 |
| `ErrAlgorithmMismatch` | 토큰 알고리즘이 설정과 불일치 |
| `ErrExpirationRequired` | `RequireExpiration`이 활성화되었으나 토큰에 `exp` 클레임이 없음 |
| `ErrTokenExpired` | 토큰이 만료됨 |
| `ErrTokenNotValidYet` | 토큰이 아직 활성화되지 않음 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenRevoked` | 토큰이 취소됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

커스텀 Claims로 토큰을 갱신합니다. Claims 객체의 시간 필드(`IssuedAt`, `ExpiresAt`, `ID`)는 작업 후 자동으로 복원되며, 오류나 panic이 발생해도 복원이 보장됩니다.

:::info 토큰 타입 검사
`token_type=access`인 토큰은 거부됩니다 ([`ErrTokenTypeMismatch`](./errors#센티넬-오류) 반환). 액세스 토큰이 새 토큰을 얻는 데 사용되는 것을 방지; 하위 호환성을 위해 `token_type`이 없는 구형 토큰은 여전히 허용됩니다.
:::

:::warning 보안 안내
갱신 시 표준 JWT 필드와 기본 구조 유효성만 검증합니다. 심층 필드 제약은 생성 시 이미 검증되었으므로 재검사하지 않습니다.
:::

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `refreshTokenString` | `string` | 리프레시 토큰 |
| `claims` | `CustomClaims` | 대상 Claims 포인터 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `token` | `string` | 새로운 액세스 토큰 |
| `err` | `error` | 검증 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrInvalidToken` | 서명이 무효함 |
| `ErrAlgorithmMismatch` | 토큰 알고리즘이 설정과 불일치 |
| `ErrExpirationRequired` | `RequireExpiration`이 활성화되었으나 토큰에 `exp` 클레임이 없음 |
| `ErrTokenExpired` | 토큰이 만료됨 |
| `ErrTokenNotValidYet` | 토큰이 아직 활성화되지 않음 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenRevoked` | 토큰이 취소됨 |
| `ErrInvalidClaims` | Claims 검증 실패 |
| `ErrTokenTypeMismatch` | 액세스 토큰(`token_type=access`)으로 갱신 시도 |
| `ErrRateLimitExceeded` | 속도 제한 임계값 초과 |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

토큰을 블랙리스트에 추가합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `tokenString` | `string` | 취소할 토큰 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `err` | `error` | 취소 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrBlacklistNotConfigured` | 블랙리스트가 설정되지 않음 |
| `ErrInvalidToken` | 서명이 무효하거나 토큰이 잘못됨 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenMissingID` | 토큰에 `jti` 클레임이 없음 |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

토큰이 취소되었는지 확인합니다.

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `tokenString` | `string` | JWT 문자열 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `revoked` | `bool` | 취소 여부 |
| `err` | `error` | 조회 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| `ErrInvalidToken` | 서명이 무효하거나 토큰이 잘못됨 |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 |
| `ErrTokenMissingID` | 토큰에 `jti` 클레임이 없음 |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

서명을 검증하지 않고 토큰을 파싱합니다. Claims 정보를 추출하지만 신뢰할 필요가 없는 시나리오에 적합합니다.

:::danger 경고
반환된 Claims는 검증되지 않았으므로 **신뢰할 수 없습니다**. 디버깅이나 로깅 시나리오에만 사용하세요.
:::

<Badge type="tip" text="v1.0.0+" />

### 매개변수

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `tokenString` | `string` | JWT 문자열 |
| `claims` | `any` | 대상 Claims 포인터 |

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `err` | `error` | 파싱 실패 시 오류 반환 |

### 오류

| 오류 | 발생 조건 |
|------|----------|
| `ErrProcessorClosed` | Processor가 종료됨 |
| `ErrEmptyToken` | 토큰이 비어있음 |
| 래핑된 오류 | 잘못된 형식의 토큰에 대해 래핑된 파싱 오류 반환 (센티넬 오류가 아님; `errors.Is`로 매치할 수 없음) |

---

## Close

```go
func (p *Processor) Close() error
```

리소스를 해제하고 키를 안전하게 삭제합니다. 여러 번 호출할 수 있으며, 이후 호출은 `ErrProcessorClosed`를 반환합니다.

<Badge type="tip" text="v1.0.0+" />

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `err` | `error` | 종료 실패 시 오류 반환 |

---

## IsClosed

```go
func (p *Processor) IsClosed() bool
```

Processor가 종료되었는지 확인합니다.

<Badge type="tip" text="v1.0.0+" />

### 반환값

| 반환 | 타입 | 설명 |
|------|------|------|
| `closed` | `bool` | 종료 여부 |
