---
sidebar_label: "Session Management"
title: "Session Management - CyberGo HTTPC | SessionManager"
description: "HTTPC SessionManager API reference: NewSessionManager, SessionConfig, SetHeader header management, SetCookie methods, and SetCookieSecurity validation."
sidebar_position: 3
---

# Session Management

SessionManager provides thread-safe cookie and header storage, used internally by DomainClient.

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

Creates a session manager.

```go
sm, err := httpc.NewSessionManager()

// With configuration
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

| Field | Type | Description |
|-------|------|-------------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie security validation config; nil means no validation |

```go
func DefaultSessionConfig() *SessionConfig
```

Returns default configuration (no cookie security validation).

## Header Management

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

Sets a session header. All subsequent requests will include it automatically. Validates header key-value validity.

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

Sets multiple session headers at once.

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

Removes a specific session header.

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

Clears all session headers.

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

Returns a copy of all session headers.

## Cookie Management

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

Sets a session cookie. Validates cookie validity and security attributes if CookieSecurity is configured.

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

Sets multiple cookies at once.

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

Removes a cookie by name.

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

Clears all cookies.

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

Returns a copy of all cookies.

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

Gets a copy of a cookie by name, returns nil if it does not exist.

## Cookie Security

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Updates the cookie security validation configuration. Affects all subsequent SetCookie calls.

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

Updates session cookies from a request result. Insecure cookies are silently skipped.

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

Updates session cookies from a cookie slice.

## See Also

- [Domain Client](./domain-client) - DomainClient reference
- [Domain Client and Sessions](../../guides/domain-session) - Usage guide
- [Interface Definitions](../types/interfaces) - DomainClienter interface reference
