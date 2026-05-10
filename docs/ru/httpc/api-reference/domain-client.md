---
title: Доменный клиент - HTTPC
description: Справочник API доменного клиента HTTPC, включая создание NewDomain, семь HTTP-методов, четыре метода загрузки, автоматическую сборку URL, управление заголовками сессии и Cookie.
---

# Доменный клиент

Доменный клиент обеспечивает управление запросами для определённого домена, автоматически поддерживая Cookie и заголовки запросов.

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Создаёт клиент с областью видимости домена. Cookie автоматически включены.

```go
// С конфигурацией по умолчанию
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// С пользовательской конфигурацией
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**Описание параметров:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `baseURL` | `string` | Базовый URL (должен содержать scheme и host) |
| `config` | `...*Config` | Необязательная конфигурация, без передачи используется DefaultConfig() |

**Возвращает:** интерфейс `DomainClienter` (не конкретный тип `*DomainClient`).

## HTTP-методы

Все методы принимают относительные пути или абсолютные URL:

```go
// Относительный путь: автоматическая сборка с baseURL
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// Абсолютный URL: используется напрямую
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

Универсальный метод запроса с контекстом, поддерживает управление тайм-аутом и отменой.

## Методы загрузки

```go
// Базовая загрузка
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")

// Загрузка с конфигурацией
result, err := dc.DownloadWithOptions("/files/report.pdf", downloadOpts)

// С контекстом
result, err := dc.DownloadFileWithContext(ctx, "/files/report.pdf", "/tmp/report.pdf")
result, err := dc.DownloadWithOptionsWithContext(ctx, "/files/report.pdf", downloadOpts)
```

Cookie ответа при загрузке автоматически сохраняются в сессию.

## Методы доступа

```go
dc.URL()      // string - базовый URL
dc.Domain()   // string - домен (без порта)
dc.Session()  // *SessionManager - базовый менеджер сессий
dc.Close()    // error - закрытие клиента и освобождение ресурсов
```

## Правила сборки URL

| Входной путь | Результат сборки (baseURL = `https://api.example.com/v1`) |
|-------------|-----------------------------------------------------------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api` (абсолютный URL) |

:::warning Предупреждение
Допускаются только абсолютные URL с протоколами `http://` и `https://`, другие протоколы отклоняются (защита от SSRF).
:::

## Интерфейс DomainClienter

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

Рекомендуется использовать тип интерфейса, а не конкретный тип, для удобства тестирования и замены реализации.

## См. также

- [Управление сессиями](./session) - подробный справочник SessionManager
- [Доменный клиент и сессии](../guides/domain-session) - руководство по использованию
- [Определения интерфейсов](./interfaces) - справочник интерфейсов Client, Doer
