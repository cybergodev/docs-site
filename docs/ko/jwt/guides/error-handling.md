---
title: "오류 처리 - JWT"
description: "CyberGo JWT 오류 처리 가이드: 17개 센티넬 오류 분류, errors.Is() 매칭 패턴, ValidationError 타입 및 웹 서비스 오류 처리 모범 사례."
---

# 오류 처리

CyberGo JWT는 센티넬 오류(sentinel errors) 패턴을 사용하며, 모든 오류는 `errors.Is()`로 판별합니다.

## 기본 패턴

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 토큰 만료
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 토큰이 취소됨
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // 발급자 불일치
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // 수신자 불일치
    case errors.Is(err, jwt.ErrInvalidToken):
        // 서명 무효 또는 형식 오류
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor가 종료됨
    default:
        // 기타 오류
    }
}
```

:::tip errors.Is() 사용
`err == jwt.ErrTokenExpired` 또는 문자열 매칭을 사용하지 마세요. `errors.Is()`는 래핑된 오류를 올바르게 처리합니다.
:::

## 오류 분류

### 설정 단계

`jwt.New()`는 다음 오류를 반환할 수 있습니다:

| 오류 | 원인 | 해결 방법 |
|------|------|----------|
| `ErrInvalidConfig` | 여러 설정 항목이 올바르지 않음 | Config 각 필드 확인 |
| `ErrInvalidSecretKey` | HMAC 키가 32바이트 미만이거나 약한 키 | 더 강한 키 사용 |
| `ErrInvalidSigningMethod` | 지원하지 않는 서명 알고리즘 | 내장 12개 알고리즘 중 하나 사용 |

### 토큰 작업

| 오류 | 메서드 | 처리 제안 |
|------|------|----------|
| `ErrEmptyToken` | 모든 토큰 작업 메서드 | 요청 헤더 확인 |
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto | 서명 불일치, 접근 거부 |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | 토큰 알고리즘이 설정과 불일치, 접근 거부 |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | 사용자에게 토큰 갱신 안내 |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | 시계 동기화 확인 |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto | 발급자 불일치 |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto | 수신자 불일치 |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | 토큰이 취소됨, 접근 거부 |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | 비즈니스 검증 실패 |
| `ErrTokenMissingID` | IsRevoked | 토큰에 jti가 없음 |

### 속도 제한 및 블랙리스트

| 오류 | 메서드 | 처리 제안 |
|------|------|----------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | 429 반환 |
| `ErrBlacklistNotConfigured` | Revoke | 블랙리스트 설정 |

### 라이프사이클

| 오류 | 메서드 | 처리 제안 |
|------|------|----------|
| `ErrProcessorClosed` | 모든 메서드 | Processor 재생성 |
| `ErrStoreClosed` | Revoke 등 | 저장소가 종료됨 |

## 오류 타입

### ValidationError

필드 수준 검증 실패 시 반환되며, 구체적인 필드와 오류 정보를 포함합니다:

```go
type ValidationError struct {
    Field   string  // 오류가 발생한 필드명
    Message string  // 오류 설명
    Err     error   // 내부 오류
}
```

## 웹 서비스에서의 오류 처리

```go
func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, valid, err := processor.Validate(tokenString)
    if err != nil {
        switch {
        case errors.Is(err, jwt.ErrTokenExpired):
            http.Error(w, "token expired", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrTokenRevoked):
            http.Error(w, "token revoked", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrInvalidToken):
            http.Error(w, "invalid token", http.StatusUnauthorized)
        default:
            http.Error(w, "auth failed", http.StatusUnauthorized)
        }
        return
    }
    if !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }
    // 요청 처리
}
```

## 다음 단계

- [API 레퍼런스 → 오류](../api-reference/errors) — 전체 오류 목록
- [API 레퍼런스 → 타입](../api-reference/types#validationerror) — 오류 타입 정의
