---
title: "Claims - JWT API 레퍼런스"
description: "CyberGo JWT Claims API 레퍼런스: Claims 내장 비즈니스 선언(UserID, Username, Role 등), RegisteredClaims RFC 7519 표준 선언 및 심층 검증 제약사항."
---

# Claims

## Claims

```go
type Claims struct {
    UserID      string         `json:"user_id,omitempty"`
    Username    string         `json:"username,omitempty"`
    Role        string         `json:"role,omitempty"`
    Permissions []string       `json:"permissions,omitempty"`
    Scopes      []string       `json:"scopes,omitempty"`
    Extra       map[string]any `json:"extra,omitempty"`
    SessionID   string         `json:"session_id,omitempty"`
    ClientID    string         `json:"client_id,omitempty"`
    RegisteredClaims
}
```

내장 Claims 구조체, 일반적인 비즈니스 필드와 표준 JWT 필드를 포함합니다.

<Badge type="info" text="struct" />

### 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `UserID` | `string` | 사용자 ID |
| `Username` | `string` | 사용자 이름 |
| `Role` | `string` | 역할 |
| `Permissions` | `[]string` | 권한 목록 |
| `Scopes` | `[]string` | 스코프 목록 |
| `Extra` | `map[string]any` | 커스텀 확장 필드 |
| `SessionID` | `string` | 세션 ID |
| `ClientID` | `string` | 클라이언트 ID |
| `RegisteredClaims` | `RegisteredClaims` | 표준 JWT 필드 |

### 검증 규칙

`Validate()` 메서드는 `UserID` 또는 `Username` 중 최소 하나가 비어있지 않은지 확인합니다.

Processor는 토큰 생성 및 검증 시 추가 심층 검증을 수행합니다 (내부 `validateClaims` 함수를 통해):

| 규칙 | 제한 |
|------|------|
| 문자열 필드 길이 | 최대 256자 |
| 배열 필드 크기 | 최대 100개 항목 |
| `Extra` 필드 수 | 최대 50개 키 |
| `Extra` 값 타입 | `string`, `[]string`만 허용, 중첩 map 및 기타 타입은 거부 |
| 제어 문자 | 탭, 줄바꿈, 캐리지 리턴을 제외한 제어 문자 거부 |
| 인젝션 패턴 감지 | HTML/SQL/경로 순회 등 위험 패턴 포함 시 거부 |

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | 임베드된 표준 필드 반환 |
| `Validate` | `func (c *Claims) Validate() error` | UserID 또는 Username 중 최소 하나가 비어있지 않은지 확인 |

---

## RegisteredClaims

```go
type RegisteredClaims struct {
    Issuer    string        `json:"iss,omitempty"`
    Subject   string        `json:"sub,omitempty"`
    Audience  StringOrSlice `json:"aud,omitempty"`
    ExpiresAt NumericDate   `json:"exp"`
    NotBefore NumericDate   `json:"nbf"`
    IssuedAt  NumericDate   `json:"iat"`
    ID        string        `json:"jti,omitempty"`
}
```

표준 JWT 등록 선언 (RFC 7519).

<Badge type="info" text="struct" />

### 필드

| 필드 | 타입 | JSON 태그 | 설명 |
|------|------|----------|------|
| `Issuer` | `string` | `iss` | 발급자 |
| `Subject` | `string` | `sub` | 제목 |
| `Audience` | `StringOrSlice` | `aud` | 수신자 |
| `ExpiresAt` | `NumericDate` | `exp` | 만료 시간 |
| `NotBefore` | `NumericDate` | `nbf` | 활성화 시간 |
| `IssuedAt` | `NumericDate` | `iat` | 발급 시간 |
| `ID` | `string` | `jti` | 토큰 ID |
