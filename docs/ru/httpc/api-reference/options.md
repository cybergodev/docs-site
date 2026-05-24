---
title: "Параметры запросов — HTTPC"
description: "Справочник API 27 функций параметров запросов HTTPC: WithHeader для заголовков, WithBearerToken для аутентификации, WithJSON/WithXML/WithForm/WithBinary для тела запроса, WithQuery для параметров запроса, пять функций Cookie и обратные вызовы WithOnRequest/WithOnResponse."
---

# Параметры запросов

Параметры запросов — это функциональные конфигурации, передаваемые в методы запросов через тип `RequestOption` для точного управления запросами.

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

Устанавливает тело запроса в формате URL-encoded формы, автоматически добавляет `Content-Type: application/x-www-form-urlencoded`.

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

Устанавливает тело запроса в формате `multipart/form-data`, поддерживает одновременную загрузку файлов и полей.

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

Удобная загрузка файла. Автоматически создаёт multipart-тело запроса, имя файла проходит обработку для защиты от обхода пути.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Устанавливает бинарное тело запроса. По умолчанию Content-Type: `application/octet-stream`, можно указать другой.

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
|--------------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | Не устанавливается (обрабатывается вызывающей стороной) |
| Другие типы | application/json |

**Явное указание типа:**

```go
// Автоопределение (по умолчанию)
result, _ := client.Post(url, httpc.WithBody(data))

// Принудительный JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Принудительный XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| Константа | Значение |
|-----------|----------|
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

Добавляет один Cookie с проверкой безопасности.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Массовое добавление Cookie. Эффективнее нескольких вызовов `WithCookie` — предварительно выделяет ёмкость и проверяет все Cookie за один проход.

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
        "lang":       "ru",
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

## Управление запросами

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

Устанавливает контекст запроса, поддерживает таймауты и отмену. Контекст не может быть nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Устанавливает таймаут для отдельного запроса, переопределяя таймаут клиента по умолчанию. Диапазон: от 0 до 30 минут.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Устанавливает максимальное количество повторных попыток для отдельного запроса, переопределяя конфигурацию клиента. Диапазон: 0–10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

Управляет следованием перенаправлениям.

```go
// Запретить перенаправления
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

Устанавливает максимальное количество перенаправлений для отдельного запроса. Диапазон: 0–50.

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Включает потоковый режим, тело ответа не кэшируется в памяти. Используется внутри для загрузки файлов, предотвращая загрузку больших файлов в память.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Обратные вызовы

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Регистрирует обратный вызов перед отправкой запроса. Можно зарегистрировать несколько, выполняются в порядке добавления. Возврат ошибки прерывает запрос.

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("отправка %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

Регистрирует обратный вызов после получения ответа. Можно зарегистрировать несколько, выполняются в порядке добавления.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("получен ответ: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## См. также

- [Константы и типы](./constants) — константы BodyKind и псевдонимы типов
- [Определения интерфейсов](./interfaces) — интерфейсы RequestMutator, ResponseMutator
- [Запросы и ответы](../guides/request-response) — руководство по использованию параметров запросов
