---
title: Определения интерфейсов - HTTPC
description: "Полный справочник API основных интерфейсов HTTPC, включая все сигнатуры методов полнофункционального клиентского интерфейса Client, базового интерфейса выполнения Doer, интерфейса клиента домена DomainClienter, интерфейса стратегии повторных попыток RetryPolicy и определения типа функции промежуточного ПО MiddlewareFunc"
---

# Определения интерфейсов

## Client

```go
type Client interface {
    Doer

    // HTTP методы
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // Загрузка файлов
    DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
    DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // Жизненный цикл
    Close() error
}
```

Основной клиентский интерфейс, создаётся через `New()`. Подробнее см. [Функции пакета](./functions).

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

Минимальный интерфейс, содержащий только основной метод `Request`. Подходит для пользовательских реализаций.

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // Пользовательская реализация
    return nil, nil
}
```

## DomainClienter

```go
type DomainClienter interface {
    Client

    // Доступ к URL
    URL() string
    Domain() string

    // Управление заголовками сессии
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // Управление Cookie сессии
    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    // Доступ к сессии
    Session() *SessionManager
}
```

Клиент с областью действия домена, автоматически управляющий Cookie и заголовками запросов. Подробнее см. [Клиент домена](./domain-client) и [Управление сессиями](./session).

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

Интерфейс пользовательской стратегии повторных попыток.

| Метод | Описание |
|-------|----------|
| `ShouldRetry(resp, err, attempt)` | Определяет, следует ли повторить попытку, `attempt` начинается с 0 |
| `GetDelay(attempt)` | Возвращает время ожидания перед следующей попыткой |
| `MaxRetries()` | Возвращает максимальное количество повторных попыток |

:::warning Предупреждение
Параметр `resp` типа `ResponseReader` в `ShouldRetry` является внутренним интерфейсом (расположен в пакете `internal/types`), внешний код не может напрямую ссылаться на него, поэтому `RetryPolicy` можно реализовать только в пределах того же модуля. В большинстве сценариев достаточно конфигурации `RetryConfig` и опции `WithMaxRetries`. Если требуется пользовательская стратегия, реализуйте интерфейс `RetryPolicy` во внутреннем пакете вашего проекта.
:::

Следующий пример демонстрирует шаблон реализации `RetryPolicy`. Обратите внимание, что `ResponseReader` является внутренним типом -- этот код может компилироваться только внутри модуля `httpc`:

```go
// Примечание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код не может быть скомпилирован за пределами модуля httpc.
// Большинство пользователей должны настраивать повторные попытки через RetryConfig и WithMaxRetries.

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxRetries {
        return false
    }
    if err != nil {
        return true
    }
    return resp.StatusCode() >= 500
}

func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(1<<attempt)
}

func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxRetries
}
```

## Основные типы

### RequestMutator

```go
type RequestMutator interface {
    // Методы чтения
    Method() string
    URL() string
    Headers() map[string]string
    QueryParams() map[string]any
    Body() any
    Timeout() time.Duration
    MaxRetries() int
    Context() context.Context
    Cookies() []http.Cookie
    FollowRedirects() *bool
    MaxRedirects() *int
    StreamBody() bool

    // Методы записи
    SetMethod(string)
    SetURL(string)
    SetHeaders(map[string]string)
    SetHeader(key, value string)
    SetQueryParams(map[string]any)
    SetBody(any)
    SetTimeout(time.Duration)
    SetMaxRetries(int)
    SetContext(context.Context)
    SetCookies([]http.Cookie)
    SetFollowRedirects(*bool)
    SetMaxRedirects(*int)
    SetStreamBody(bool)
}
```

Используется в промежуточном ПО, предоставляет доступ для чтения и записи к запросу. Составлен из внутренних интерфейсов `RequestReader` и `RequestWriter`.

### ResponseMutator

```go
type ResponseMutator interface {
    // Методы чтения
    StatusCode() int
    Status() string
    Proto() string
    Headers() http.Header
    Body() string
    RawBody() []byte
    ContentLength() int64
    Duration() time.Duration
    Attempts() int
    Cookies() []*http.Cookie
    RedirectChain() []string
    RedirectCount() int
    RequestHeaders() http.Header
    RequestURL() string
    RequestMethod() string

    // Методы записи
    SetStatusCode(int)
    SetStatus(string)
    SetProto(string)
    SetHeaders(http.Header)
    SetBody(string)
    SetRawBody([]byte)
    SetContentLength(int64)
    SetDuration(time.Duration)
    SetAttempts(int)
    SetCookies([]*http.Cookie)
    SetRedirectChain([]string)
    SetRedirectCount(int)
    SetRequestHeaders(http.Header)
    SetRequestURL(string)
    SetRequestMethod(string)
    SetHeader(key string, values ...string)
}
```

Используется в промежуточном ПО, предоставляет доступ для чтения и записи к ответу. Составлен из внутренних интерфейсов `ResponseReader` и `ResponseWriter`.

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Сигнатура функции обработки запроса.

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

Сигнатура функции промежуточного ПО, принимает следующий Handler и возвращает обёрнутый Handler.

## Связанные страницы

| Тип | Подробный справочник |
|-----|---------------------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](./result) |
| Методы `SessionManager` | [Управление сессиями](./session) |
| Реализация `DomainClient` | [Клиент домена](./domain-client) |
| `DownloadConfig` / `DownloadResult` | [Загрузка файлов](./download) |
| `ClientError` / `ErrorType` / переменные ошибок | [Типы ошибок](./errors) |
| `FormData` / `FileData` / `BodyKind` | [Константы и типы](./constants) |
