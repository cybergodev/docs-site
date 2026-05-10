---
title: Параметры запросов - HTTPC
description: "Справочник API двадцати семи функций параметров запросов HTTPC, сгруппированных по категориям: заголовки запросов, аутентификация, различные форматы тела запроса, параметры запроса, управление Cookie и функции обратного вызова."
---

# Параметры запросов

Параметры запросов — это функциональные элементы конфигурации, передаваемые методам запросов через тип `RequestOption` для точного управления запросами.

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

Все параметры можно свободно комбинировать, они применяются последовательно в порядке передачи.

## Заголовки запроса

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

Устанавливает один заголовок запроса. Ключ и значение проходят проверку безопасности (защита от инъекции CRLF).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

Массовая установка заголовков запроса.

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

Устанавливает заголовок User-Agent. Является удобной обёрткой для `WithHeader("User-Agent", ...)`.

## Аутентификация

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

Устанавливает HTTP Basic аутентификацию. Имя пользователя не может быть пустым, длина учётных данных ограничена.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

Устанавливает заголовок `Authorization: Bearer <token>`. Token не может быть пустым.

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

Устанавливает тело запроса в формате JSON, автоматически добавляет `Content-Type: application/json`.

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

Устанавливает тело запроса в формате XML, автоматически добавляет `Content-Type: application/xml`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Устанавливает тело запроса в формате URL-кодированной формы, автоматически добавляет `Content-Type: application/x-www-form-urlencoded`.

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

Устанавливает тело запроса в формате `multipart/form-data`, поддерживает смешанную загрузку файлов и полей.

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

Удобная загрузка файла. Автоматически создаёт тело запроса multipart, имя файла обрабатывается для защиты от обхода пути.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Устанавливает бинарное тело запроса. По умолчанию Content-Type: `application/octet-stream`, можно настроить.

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
|-------------------|-------------|
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

// Принудительный JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Принудительный XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| Константа | Значение |
|-----------|---------|
| `BodyAuto` | Автоопределение (по умолчанию) |
| `BodyJSON` | Принудительный JSON |
| `BodyXML` | Принудительный XML |
| `BodyForm` | Принудительная форма |
| `BodyBinary` | Принудительные бинарные данные |
| `BodyMultipart` | Принудительный multipart (требуется `*FormData`) |

## Параметры запроса

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

Устанавливает один параметр запроса.

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

Массовая установка параметров запроса.

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

Добавляет один Cookie, проходит проверку безопасности.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Массовое добавление Cookie, эффективнее нескольких вызовов `WithCookie` — предварительно выделяет ёмкость и проверяет все Cookie за один проход.

```go
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err := client.Get("https://api.example.com",
    httpc.WithCookies(cookies),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

Массовое добавление простых Cookie. Подходит для сценариев, где нужны только name-value.

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "zh",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

Добавляет Cookie из исходной строки заголовка Cookie.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=zh"),
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

Устанавливает контекст запроса, поддерживает тайм-аут и отмену. Контекст не может быть nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Устанавливает тайм-аут для одного запроса, переопределяет тайм-аут клиента по умолчанию. Диапазон: от 0 до 30 минут.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Устанавливает максимальное количество повторных попыток для одного запроса, переопределяет конфигурацию клиента. Диапазон: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

Управляет следованием перенаправлениям.

```go
// Запретить следование перенаправлениям
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Устанавливает максимальное количество перенаправлений для одного запроса. Диапазон: 0-50.

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Включает потоковый режим, тело ответа не кэшируется в памяти. Используется внутри для загрузки файлов, предотвращает потребление памяти большими файлами.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Обратные вызовы

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Регистрирует обратный вызов перед отправкой запроса. Можно регистрировать несколько, выполняются в порядке добавления. Возврат ошибки из обратного вызова прерывает запрос.

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

Регистрирует обратный вызов после получения ответа. Можно регистрировать несколько, выполняются в порядке добавления.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Получен ответ: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## См. также

- [Константы и типы](./constants) - константы BodyKind и псевдонимы типов
- [Определения интерфейсов](./interfaces) - интерфейсы RequestMutator, ResponseMutator
- [Запросы и ответы](../guides/request-response) - руководство по использованию параметров запросов
