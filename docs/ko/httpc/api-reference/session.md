---
title: "세션 관리 - HTTPC"
description: "HTTPC SessionManager 세션 관리 API 레퍼런스: NewSessionManager 생성, SessionConfig 구성, SetHeader/SetHeaders 세션 헤더 CRUD, SetCookie/SetCookies Cookie 메서드, SetCookieSecurity 보안 검증과 UpdateFromResult 응답 동기화."
---

# 세션 관리

SessionManager는 스레드 안전한 Cookie와 요청 헤더 저장소를 제공하며, DomainClient가 내부적으로 사용합니다.

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

세션 관리자를 생성합니다.

```go
sm, err := httpc.NewSessionManager()

// 구성 포함
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
sm, err := httpc.NewSessionManager(cfg)
```

## SessionConfig

```go
type SessionConfig struct {
    CookieSecurity *CookieSecurityConfig
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie 보안 검증 구성, nil이면 검증하지 않음 |

```go
func DefaultSessionConfig() *SessionConfig
```

기본 구성을 반환합니다 (Cookie 보안 검증 수행 안함).

## 헤더 관리

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

세션 헤더를 설정합니다. 모든 후속 요청에 자동으로 포함됩니다. 헤더의 키와 값 유효성을 검증합니다.

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

세션 헤더를 일괄 설정합니다.

```go
err := sm.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
})
```

### DeleteHeader

```go
func (s *SessionManager) DeleteHeader(key string)
```

지정된 세션 헤더를 삭제합니다.

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

모든 세션 헤더를 비웁니다.

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

모든 세션 헤더의 사본을 반환합니다.

## Cookie 관리

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

세션 Cookie를 설정합니다. Cookie 유효성을 검증하며, CookieSecurity가 구성된 경우 보안 속성도 검증합니다.

```go
err := sm.SetCookie(&http.Cookie{
    Name:     "session",
    Value:    "abc123",
    Secure:   true,
    HttpOnly: true,
})
```

### SetCookies

```go
func (s *SessionManager) SetCookies(cookies []*http.Cookie) error
```

Cookie를 일괄 설정합니다.

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

이름으로 Cookie를 삭제합니다.

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

모든 Cookie를 비웁니다.

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

모든 Cookie의 사본을 반환합니다.

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

이름으로 Cookie 사본을 가져오며, 존재하지 않으면 nil을 반환합니다.

## Cookie 보안

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Cookie 보안 검증 구성을 업데이트합니다. 이후 모든 SetCookie 호출에 영향을 미칩니다.

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

요청 결과에서 세션 Cookie를 업데이트합니다. 안전하지 않은 Cookie는 조용히 건너뜁니다.

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

Cookie 슬라이스에서 세션 Cookie를 업데이트합니다.

## 참고

- [도메인 클라이언트](./domain-client) - DomainClient 참조
- [도메인 클라이언트와 세션](../guides/domain-session) - 사용 가이드
- [인터페이스 정의](./interfaces) - DomainClienter 인터페이스 참조
