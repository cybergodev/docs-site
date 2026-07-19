---
sidebar_label: "Интерфейсы"
title: "Интерфейсы - CyberGo HTTPC | Основные интерфейсы"
description: "Справочник API интерфейсов HTTPC: полнофункциональный Client, интерфейс выполнения Doer, DomainClienter, стратегия RetryPolicy и интерфейсы middleware."
sidebar_position: 1
---

# Интерфейсы

## Client

```go
type Client interface {
    Doer

    // HTTP-методы
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // Загрузка файлов
    Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // Жизненный цикл
    Close() error
}
```

Основной интерфейс клиента, создаётся через `New()`. Подробнее см. [Функции пакета и методы клиента](../core/functions).

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

Клиент с областью действия домена, автоматически управляющий Cookie и заголовками запросов. Подробнее см. [Доменный клиент](../client-config/domain-client) и [Управление сессиями](../client-config/session).

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
| `ShouldRetry(resp, err, attempt)` | Определяет, следует ли повторить, `attempt` начинается с 0 |
| `GetDelay(attempt)` | Возвращает время ожидания перед следующей попыткой |
| `MaxRetries()` | Возвращает максимальное число повторных попыток |

:::warning Ограничение внутренних типов
Параметр `resp` метода ShouldRetry имеет тип ResponseReader — внутренний интерфейс (расположен в пакете `internal/types`), который не может быть напрямую импортирован из внешнего кода, поэтому `RetryPolicy` можно реализовать только в том же модуле. Большинство сценариев покрываются конфигурацией `RetryConfig` и опцией `WithMaxRetries`. Если нужна пользовательская стратегия, реализуйте интерфейс `RetryPolicy` во внутреннем пакете вашего проекта.
:::

Следующий пример демонстрирует шаблон реализации `RetryPolicy`. Обратите внимание, что ResponseReader — внутренний тип; этот код можно скомпилировать только внутри модуля `httpc`:

```go
// Внимание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код не компилируется за пределами модуля httpc.
// Большинство пользователей должны настраивать повторы через RetryConfig и WithMaxRetries.

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

Используется в промежуточном ПО, предоставляет доступ для чтения и записи запроса. Комбинируется из внутренних интерфейсов RequestReader и RequestWriter. Полный контракт методов и пример чтения/записи см. в [Мутаторы запросов и ответов](../handler/mutators).

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

Используется в промежуточном ПО, предоставляет доступ для чтения и записи ответа. Комбинируется из внутренних интерфейсов ResponseReader и ResponseWriter. Полный контракт методов см. в [Мутаторы запросов и ответов](../handler/mutators).

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

## Пиннинг сертификатов

Пиннинг сертификатов (Certificate Pinning) на этапе TLS-рукопожатия проверяет, соответствует ли серверный сертификат заранее закреплённому публичному ключу/сертификату. Даже при компрометации доверенного УЦ рукопожатие будет отклонено, что защищает от атак типа «человек посередине».

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

Интерфейс пиннера сертификатов. После создания через приведённые ниже конструкторы присваивается полю `SecurityConfig.CertificatePinner` (доступ через `Config.Security`):

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // Текущий ключ
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // Резервный ключ (ротация)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
Реализация Pinner безопасна для конкурентного доступа и может разделяться несколькими клиентами, созданными из одной `Config` (при глубоком копировании передаётся по ссылке, не дублируется). Продвинутые пользователи могут напрямую реализовать этот интерфейс для поддержки собственных стратегий закрепления (например, фиксация полного сертификата, а не публичного ключа).
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

Создаёт пиннер сертификатов из одного или нескольких base64-кодированных SHA-256-хэшей (для DER-кодированного SubjectPublicKeyInfo/SPKI). Это наиболее распространённый формат закрепления (используется в HPKP) и рекомендуемый вариант.

Передача нескольких хэшей поддерживает ротацию ключей — рукопожатие успешно, если публичный ключ сервера соответствует **любому** из закреплённых хэшей.

Сгенерируйте хэш из сертификата следующей командой:

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

Возвращает ошибку, если не предоставлено ни одного допустимого хэша или хэш не является корректным base64.

### NewPublicKeyPinner

```go
func NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)
```

Создаёт пиннер сертификатов из одного или нескольких DER-кодированных публичных ключей PKIX (возвращаемых `x509.MarshalPKIXPublicKey`). Внутренне для каждого публичного ключа вычисляется SHA-256-хэш; если у вас уже есть исходные байты публичного ключа, это более удобный вариант, чем `NewSPKIHashPinner`.

Возвращает ошибку, если не предоставлено ни одного допустимого публичного ключа.

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

Объединяет несколько пиннеров в один. Сертификат принимается, если его принимает **любой** из обёрнутых пиннеров. Используется для одновременной поддержки нескольких стратегий закрепления или для комбинирования ротационных ключей, построенных разными конструкторами.

:::warning Поведение без аргументов: пропускает все сертификаты
Без аргументов возвращается пустая цепочка, которая **не проверяет сертификаты вовсе** (логика проверки напрямую возвращает `nil`) — то есть **пропускаются все сертификаты, что равнозначно отключённому пиннингу (fail-open)** (исходный код `internal/security/certpin.go`: «No pinners means no pinning»). Это противоречит интуиции «нет пиннера — нет допуска», поэтому всегда передавайте хотя бы один действительный pinner и не полагайтесь на поведение без аргументов.
:::

:::tip Подробнее
Полное руководство по пиннингу сертификатов (генерация хэшей, стратегии ротации ключей, развёртывание в продакшене) см. в [TLS и пиннинг сертификатов](../../security/tls-certpin).
:::

## Связанные страницы

| Тип | Подробный справочник |
|------|---------------------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](../core/result) |
| Методы `SessionManager` | [Управление сессиями](../client-config/session) |
| Реализация `DomainClient` | [Доменный клиент](../client-config/domain-client) |
| `DownloadConfig` / `DownloadResult` | [Загрузка файлов](../client-config/download) |
| `ClientError` / `ErrorType` / переменные ошибок | [Типы ошибок](./errors) |
| `FormData` / `FileData` / `BodyKind` | [Константы и типы](./constants) |
