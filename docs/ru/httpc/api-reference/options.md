---
title: Параметры запроса - HTTPC
description: "Полный справочник API двадцати шести функций параметров запроса HTTPC, сгруппированных по категориям: настройка заголовков, аутентификация Bearer и Basic, форматы тела запроса (JSON, форма и др.), формирование параметров URL-запроса, управление Cookie и обратные вызовы OnRequest и OnResponse"
---

# Параметры запроса

Параметры запроса — это функциональные элементы конфигурации, передаваемые в методы запроса через тип `RequestOption` для точного управления запросами.

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

Все параметры можно свободно комбинировать, они применяются в порядке передачи.

## Заголовки запроса

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

Установка одного заголовка запроса. Ключ и значение проходят проверку безопасности (защита от CRLF-инъекции).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

Пакетная установка заголовков запроса.

```go
result, err := client.Get(url,
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "abc123",
    }),
)
```

### WithUserAgent

```go
func WithUserAgent(userAgent string) RequestOption
```

Установка заголовка User-Agent. Удобная обёртка для `WithHeader("User-Agent", ...)`.

## Аутентификация

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

Установка HTTP Basic аутентификации. Имя пользователя не может быть пустым, длина учётных данных ограничена.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Установка заголовка `Authorization: Bearer <token>`. Token не может быть пустым.

```go
result, err := client.Get(url,
    httpc.WithBearerToken("eyJhbGciOiJIUzI1NiIs..."),
)
```

## Тело запроса

### WithJSON

```go
func WithJSON(data any) RequestOption
```

Установка JSON-тела запроса, автоматически добавляет `Content-Type: application/json`.

```go
result, err := client.Post(url,
    httpc.WithJSON(map[string]any{
        "name":  "test",
        "email": "test@example.com",
    }),
)
```

### WithXML

```go
func WithXML(data any) RequestOption
```

Установка XML-тела запроса, автоматически добавляет `Content-Type: application/xml`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Установка URL-кодированного тела формы, автоматически добавляет `Content-Type: application/x-www-form-urlencoded`.

```go
result, err := client.Post(url,
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### WithFormData

```go
func WithFormData(data *FormData) RequestOption
```

Установка тела запроса `multipart/form-data`, поддерживает одновременную загрузку файлов и полей.

```go
result, err := client.Post(url,
    httpc.WithFormData(&httpc.FormData{
        Fields: map[string]string{"description": "upload"},
        Files: map[string]*httpc.FileData{
            "file": {Filename: "doc.pdf", Content: fileBytes},
        },
    }),
)
```

### WithFile

```go
func WithFile(fieldName, filename string, content []byte) RequestOption
```

Удобная загрузка файла. Автоматически создаёт multipart-тело запроса, имя файла проходит проверку защиты от обхода каталогов.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Установка бинарного тела запроса. По умолчанию Content-Type `application/octet-stream`, можно настроить.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Универсальная установка тела запроса, поддерживает автоопределение и явное указание типа.

**Правила автоопределения** (по умолчанию `BodyAuto`):

| Тип входных данных | Content-Type |
|--------------------|--------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | не устанавливается (обрабатывается вызывающей стороной) |
| Другие типы | application/json |

**Явное указание типа**:

```go
// Автоопределение (по умолчанию)
result, _ := client.Post(url, httpc.WithBody(data))

// Принудительно JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Принудительно XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| Константа | Значение |
|-----------|----------|
| `BodyAuto` | Автоопределение (по умолчанию) |
| `BodyJSON` | Принудительно JSON |
| `BodyXML` | Принудительно XML |
| `BodyForm` | Принудительно форма |
| `BodyBinary` | Принудительно бинарные данные |
| `BodyMultipart` | Принудительно multipart (требуется `*FormData`) |

## Параметры запроса

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

Установка одного параметра запроса.

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)
```

### WithQueryMap

```go
func WithQueryMap(params map[string]any) RequestOption
```

Пакетная установка параметров запроса.

```go
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
        "sort":  "created_at",
    }),
)
```

## Cookie

### WithCookie

```go
func WithCookie(cookie http.Cookie) RequestOption
```

Добавление одного Cookie с проверкой безопасности.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

Пакетное добавление простых Cookie. Подходит для сценариев, где нужны только name-value.

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "ru",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

Добавление Cookie из исходной строки заголовка Cookie.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=ru"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

Принудительная проверка атрибутов безопасности Cookie запроса (Secure, HttpOnly, SameSite).

```go
result, err := client.Get(url,
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## Управление запросом

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

Установка контекста запроса, поддерживающего таймаут и отмену. Контекст не может быть nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Установка таймаута для одного запроса, переопределяет таймаут клиента по умолчанию. Диапазон: от 0 до 30 минут.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Установка максимального количества повторных попыток для одного запроса, переопределяет конфигурацию клиента. Диапазон: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

Управление следованием редиректам.

```go
// Запретить следование редиректам
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Установка максимального количества редиректов для одного запроса. Диапазон: 0-50.

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Включение потокового режима — тело ответа не кэшируется в памяти. Используется внутри для скачивания файлов, чтобы избежать потребления памяти большими файлами.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Обратные вызовы

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Регистрация обратного вызова перед отправкой запроса. Можно зарегистрировать несколько цепочкой, выполняются в порядке добавления. Возврат ошибки прерывает запрос.

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("Отправка %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

Регистрация обратного вызова после получения ответа. Можно зарегистрировать несколько цепочкой, выполняются в порядке добавления.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Получен ответ: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## Смотрите также

- [Константы и типы](./constants) — константы BodyKind и псевдонимы типов
- [Определения интерфейсов](./interfaces) — интерфейсы RequestMutator, ResponseMutator
- [Запросы и ответы](../guides/request-response) — руководство по использованию параметров запроса
