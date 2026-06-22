---
title: "오류 레퍼런스 - CyberGo JWT | 센티넬 오류 목록"
description: "오류 레퍼런스: CyberGo JWT는 구성 검증, 토큰 검증, 서명 알고리즘, 만료, 발급자·청중, 블랙리스트, 속도 제한과 수명주기의 19 에러를 정의하며 모두 errors.Is 매칭을 지원합니다."
---

# 오류

## 센티넬 오류

모든 오류는 `errors.Is()`로 판별합니다:

```go
var (
    ErrInvalidConfig        = errors.New("invalid configuration")
    ErrInvalidSecretKey     = errors.New("invalid secret key")
    ErrInvalidSigningMethod = errors.New("invalid signing method")

    ErrInvalidToken          = errors.New("invalid token")
    ErrEmptyToken            = errors.New("empty token")
    ErrAlgorithmMismatch     = errors.New("token algorithm does not match configured signing method")
    ErrTokenRevoked          = errors.New("token revoked")
    ErrTokenMissingID        = errors.New("token missing ID")
    ErrTokenTypeMismatch     = errors.New("token type mismatch")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")
    ErrExpirationRequired    = errors.New("token missing expiration claim")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("blacklist store is closed")
)
```

### 오류 목록

| 오류 | 설명 | `errors.Is()` 확인 |
|------|------|------------------------|
| `ErrInvalidConfig` | 설정이 유효하지 않음 | `New()`, `Config.Validate()` |
| `ErrInvalidSecretKey` | 키가 유효하지 않음 | `New()` |
| `ErrInvalidSigningMethod` | 서명 방식이 유효하지 않음 | `New()` |
| `ErrInvalidToken` | 토큰이 유효하지 않음 (서명 오류 등) | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrEmptyToken` | 토큰이 비어있음 | 모든 토큰 작업 메서드 |
| `ErrAlgorithmMismatch` | 토큰 알고리즘이 설정과 불일치 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenRevoked` | 토큰이 취소됨 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenMissingID` | 토큰에 ID가 없음 | `Revoke()`, `IsRevoked()` |
| `ErrTokenTypeMismatch` | 토큰 타입 불일치 (액세스 토큰으로 갱신 시도) | `Refresh()`, `RefreshInto()` |
| `ErrTokenExpired` | 토큰이 만료됨 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenNotValidYet` | 토큰이 아직 활성화되지 않음 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenInvalidIssuer` | 발급자가 불일치함 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrTokenInvalidAudience` | 수신자가 불일치함 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrExpirationRequired` | `RequireExpiration`이 활성화되었으나 토큰에 `exp`가 없음 | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrInvalidClaims` | Claims 검증 실패 | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrRateLimitExceeded` | 속도 제한 초과 | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` |
| `ErrBlacklistNotConfigured` | 블랙리스트가 설정되지 않음 | `Revoke()` |
| `ErrProcessorClosed` | Processor가 종료됨 | 모든 메서드 |
| `ErrStoreClosed` | 저장소가 종료됨 | `Revoke()` 등 |

### 시나리오별 분류

#### 설정 단계

| 오류 | 발생 메서드 | 일반적인 원인 |
|------|----------|----------|
| `ErrInvalidConfig` | `New()` | 여러 설정 항목이 올바르지 않음 |
| `ErrInvalidSecretKey` | `New()` | HMAC 키가 32바이트 미만이거나 약한 키 |
| `ErrInvalidSigningMethod` | `New()` | 12개 내장 알고리즘에 포함되지 않음 |

#### 토큰 검증

| 오류 | 발생 메서드 | 일반적인 원인 |
|------|----------|----------|
| `ErrEmptyToken` | 모든 토큰 작업 메서드 | 빈 문자열 전달 |
| `ErrInvalidToken` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | 서명 불일치 또는 형식 오류 |
| `ErrAlgorithmMismatch` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | 토큰 헤더의 알고리즘이 설정과 불일치 |
| `ErrExpirationRequired` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `RequireExpiration`이 활성화되었으나 토큰에 `exp` 클레임이 없음 |
| `ErrTokenExpired` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `exp` 시간 초과 |
| `ErrTokenNotValidYet` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | 아직 `nbf` 시간에 도달하지 않음 |
| `ErrTokenInvalidIssuer` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | `iss`가 `Config.Issuer`와 불일치 |
| `ErrTokenInvalidAudience` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | `aud`가 `Config.ExpectedAudience`와 불일치 |
| `ErrTokenRevoked` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | 토큰이 블랙리스트에 있음 |
| `ErrTokenTypeMismatch` | `Refresh()`, `RefreshInto()` | 액세스 토큰(`token_type=access`)으로 갱신 시도 |
| `ErrInvalidClaims` | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | 비즈니스 검증 실패 |
| `ErrTokenMissingID` | `Revoke()`, `IsRevoked()` | 토큰에 `jti` 필드가 없음 |

#### 속도 제한 및 블랙리스트

| 오류 | 발생 메서드 | 일반적인 원인 |
|------|----------|----------|
| `ErrRateLimitExceeded` | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` | 윈도우 내 요청 한도 초과 |
| `ErrBlacklistNotConfigured` | `Revoke()` | 블랙리스트 저장소가 설정되지 않음 |
| `ErrTokenMissingID` | `Revoke()`, `IsRevoked()` | 토큰에 `jti` 필드가 없음 |

#### 라이프사이클

| 오류 | 발생 메서드 | 일반적인 원인 |
|------|----------|----------|
| `ErrProcessorClosed` | 모든 메서드 | `Close()` 호출 후 계속 작업 시도 |
| `ErrStoreClosed` | `Revoke()` 등 | 블랙리스트 저장소가 종료됨 |

---

## 오류 처리 패턴

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 토큰 만료 - 사용자에게 갱신 안내
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 토큰 취소됨 - 접근 거부
    case errors.Is(err, jwt.ErrInvalidToken):
        // 서명 무효 - 접근 거부
    case errors.Is(err, jwt.ErrProcessorClosed):
        // 시스템 오류 - Processor가 종료됨
    default:
        // 알 수 없는 오류
    }
}
```

---

## 오류 타입

### ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

필드 수준 검증 실패 오류. 자세한 내용은 [타입과 상수 → ValidationError](./types#validationerror)를 참조하세요.
