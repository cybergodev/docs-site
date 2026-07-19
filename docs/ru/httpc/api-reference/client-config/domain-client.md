---
sidebar_label: "Доменный клиент"
title: "Доменный клиент - CyberGo HTTPC | NewDomain и сессии"
description: "Справочник API доменного клиента HTTPC: NewDomain, семь HTTP-методов, метод Request, авто-сборка URL и управление сессиями SetHeader/SetCookie."
sidebar_position: 2
---

# Доменный клиент

Доменный клиент обеспечивает управление запросами для определённого домена, автоматически поддерживая Cookie и заголовки.

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Создаёт клиент с областью действия домена. Cookie автоматически включены.

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
// Относительный путь: автоматически объединяется с baseURL
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

Универсальный метод запроса с контекстом, поддерживающий управление таймаутом и отменой.

:::warning Опции запроса применяются дважды
Доменный клиент **применяет опции запроса дважды** внутри — один раз для захвата состояния сессии (Cookie, заголовки), второй раз для самого запроса. Избегайте опций с побочными эффектами (например, счётчиков, nonce); при необходимости таких опций используйте базовый `Client`.
:::

## Методы загрузки

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загружает файл в `cfg.FilePath`, при этом `path` присоединяется к `baseURL`. Сигнатура совпадает с пакетной `Download` и `Client.Download` — `Download` является единым каноническим входом для загрузки во всех трёх случаях. `cfg` не может быть nil, `cfg.FilePath` должен быть задан (иначе возвращается `ErrEmptyFilePath`).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
```

Cookie ответа при загрузке автоматически фиксируются в сессии.

## Методы доступа

```go
dc.URL()      // string - базовый URL
dc.Domain()   // string - домен (без порта)
dc.Session()  // *SessionManager - базовый менеджер сессий
dc.Close()    // error - закрытие клиента и освобождение ресурсов
```

## Правила объединения URL

| Входной путь | Результат объединения (baseURL = `https://api.example.com/v1`) |
|--------------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api` (абсолютный URL) |

:::warning
Только пути с префиксами `http://` и `https://` распознаются как абсолютные URL; другие протоколы (например, `ftp://`) не распознаются как абсолютные и присоединяются как относительные пути, что обычно приводит к ошибке запроса.
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

Рекомендуется использовать интерфейс, а не конкретный тип, для удобства тестирования и замены реализации.

## См. также

- [Управление сессиями](./session) - подробный справочник по SessionManager
- [Доменный клиент и сессии](../../guides/domain-session) - руководство по использованию
- [Интерфейсы](../types/interfaces) - справочник по интерфейсам Client, Doer
