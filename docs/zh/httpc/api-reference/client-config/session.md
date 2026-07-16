---
sidebar_label: "会话管理"
title: "会话管理 - CyberGo HTTPC | SessionManager"
description: "HTTPC SessionManager API 参考：NewSessionManager 创建、SessionConfig 配置、SetHeader 头管理、SetCookie 方法与 SetCookieSecurity 验证的完整用法。"
sidebar_position: 3
---

# 会话管理

SessionManager 提供线程安全的 Cookie 和请求头存储，由 DomainClient 内部使用。

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

创建会话管理器。

```go
sm, err := httpc.NewSessionManager()

// 带配置
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

| 字段 | 类型 | 说明 |
|------|------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie 安全验证配置，nil 表示不验证 |

```go
func DefaultSessionConfig() *SessionConfig
```

返回默认配置（不进行 Cookie 安全验证）。

## 头管理

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

设置会话头。所有后续请求自动携带。验证头的键值有效性。

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

批量设置会话头。

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

删除指定会话头。

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

清空所有会话头。

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

返回所有会话头的副本。

## Cookie 管理

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

设置会话 Cookie。验证 Cookie 有效性，如配置了 CookieSecurity 则同时验证安全属性。

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

批量设置 Cookie。

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

按名称删除 Cookie。

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

清空所有 Cookie。

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

返回所有 Cookie 的副本。

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

按名称获取 Cookie 副本，不存在返回 nil。

## Cookie 安全

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

更新 Cookie 安全验证配置。影响后续所有 SetCookie 调用。

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

从请求结果中更新会话 Cookie。不安全的 Cookie 会被静默跳过。

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

从 Cookie 切片中更新会话 Cookie。

## 另见

- [域名客户端](./domain-client) - DomainClient 参考
- [域名客户端与会话](../../guides/domain-session) - 使用指南
- [接口定义](../types/interfaces) - DomainClienter 接口参考
