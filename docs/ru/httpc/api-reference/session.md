---
title: "Управление сессиями — HTTPC"
description: "Справочник API управления сессиями SessionManager HTTPC: создание NewSessionManager, конфигурация SessionConfig, CRUD заголовков сессии SetHeader/SetHeaders, методы Cookie SetCookie/SetCookies, проверка безопасности SetCookieSecurity и синхронизация ответов UpdateFromResult."
---

# Управление сессиями

SessionManager обеспечивает потокобезопасное хранение Cookie и заголовков запросов, используется внутри DomainClient.

## NewSessionManager

```go
func NewSessionManager(config ...*SessionConfig) (*SessionManager, error)
```

Создаёт менеджер сессий.

```go
sm, err := httpc.NewSessionManager()

// С конфигурацией
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

| Поле | Тип | Описание |
|------|-----|----------|
| `CookieSecurity` | `*CookieSecurityConfig` | Конфигурация проверки безопасности Cookie, nil означает без проверки |

```go
func DefaultSessionConfig() *SessionConfig
```

Возвращает конфигурацию по умолчанию (без проверки безопасности Cookie).

## Управление заголовками

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

Устанавливает заголовок сессии. Все последующие запросы автоматически включают его. Проверяет корректность ключа и значения заголовка.

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

Массовая установка заголовков сессии.

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

Удаляет указанный заголовок сессии.

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

Очищает все заголовки сессии.

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

Возвращает копию всех заголовков сессии.

## Управление Cookie

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

Устанавливает Cookie сессии. Проверяет корректность Cookie, а при настроенной CookieSecurity также проверяет атрибуты безопасности.

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

Массовая установка Cookie.

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

Удаляет Cookie по имени.

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

Очищает все Cookie.

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

Возвращает копию всех Cookie.

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

Получает копию Cookie по имени, возвращает nil если не существует.

## Безопасность Cookie

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

Обновляет конфигурацию проверки безопасности Cookie. Влияет на все последующие вызовы SetCookie.

```go
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

Обновляет Cookie сессии из результата запроса. Небезопасные Cookie незаметно пропускаются.

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

Обновляет Cookie сессии из среза Cookie.

## См. также

- [Доменный клиент](./domain-client) — справочник DomainClient
- [Доменный клиент и сессии](../guides/domain-session) — руководство по использованию
- [Определения интерфейсов](./interfaces) — справочник интерфейса DomainClienter
