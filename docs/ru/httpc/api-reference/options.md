---
title: "Параметры запроса - CyberGo HTTPC | Опции WithXxx"
description: "Справочник API параметров запроса HTTPC: заголовки WithHeader, аутентификация WithBearerToken, тело WithJSON/WithForm, параметры WithQuery и колбэки."
---

# Параметры запроса

Параметры запроса — это функциональные элементы конфигурации, передаваемые в методы запроса через тип `RequestOption` для детального управления запросом.

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

Все параметры свободно комбинируются и применяются в порядке передачи.

## Заголовки запроса

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

Устанавливает один заголовок запроса. Ключ и значение проходят проверку безопасности (защита от CRLF-инъекций).

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

Устанавливает заголовок User-Agent. Является удобной обёрткой `WithHeader("User-Agent", ...)`.

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

Устанавливает тело запроса в формате JSON, автоматически добавляя `Content-Type: application/json`.

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

Устанавливает тело запроса в формате XML, автоматически добавляя `Content-Type: application/xml`.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

Устанавливает тело запроса в виде URL-кодированной формы, автоматически добавляя `Content-Type: application/x-www-form-urlencoded`.

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

Устанавливает тело запроса `multipart/form-data`, поддерживает одновременную загрузку файлов и полей.

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

Удобная загрузка файла. Автоматически создаёт multipart-тело запроса, имя файла проходит обработку защиты от обхода пути.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

Устанавливает бинарное тело запроса. По умолчанию Content-Type `application/octet-stream`, можно указать свой.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

Универсальная установка тела запроса с автоопределением и явным указанием типа.

**Правила автоопределения** (по умолчанию `BodyAuto`):

| Тип входных данных | Content-Type |
|--------------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | не устанавливается (обрабатывается вызывающим) |
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
|-----------|----------|
| `BodyAuto` | Автоопределение (по умолчанию) |
| `BodyJSON` | Принудительный JSON |
| `BodyXML` | Принудительный XML |
| `BodyForm` | Принудительная форма |
| `BodyBinary` | Принудительный бинарный |
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

Массовое добавление Cookie, более эффективно чем многократные вызовы `WithCookie` — предварительное выделение ёмкости и проверка всех Cookie за один проход.

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

Устанавливает контекст запроса для поддержки таймаута и отмены. Контекст не может быть nil.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

Устанавливает таймаут отдельного запроса, переопределяя таймаут клиента по умолчанию. Диапазон: от 0 до 30 минут.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

Устанавливает максимальное число повторных попыток для отдельного запроса, переопределяя конфигурацию клиента. Диапазон: 0-10.

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

Устанавливает максимальное число перенаправлений для отдельного запроса. Диапазон: 0-50.

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

Переопределяет SSRF-политику клиента для отдельного запроса. Если `allow` равно `true`, запрос может обращаться к localhost и частным/зарезервированным диапазонам IP (127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 169.254.0.0/16 и др.) и следовать перенаправлениям на такие адреса; если `false`, то даже при настроенном в клиенте `Security.AllowPrivateIPs=true` для данного запроса защита SSRF включается принудительно.

:::warning Замечание о безопасности
Это **построчный (per-request) аварийный люк** политики SSRF, предназначенный для безопасных по умолчанию клиентов (`AllowPrivateIPs=false`), которым изредка требуется обращаться к внутренним службам, адресам loopback или локальным dev-серверам.

Включайте только если URL запроса надёжен и **не** поступает от недоверенного пользовательского ввода. Если весь клиент должен обращаться к внутренним службам, задайте `Security.AllowPrivateIPs=true` непосредственно в `Config`.
:::

```go
// Клиент по умолчанию блокирует частные IP; этот вызов освобождает их по запросу
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

Включает потоковый режим — тело ответа не кэшируется в памяти. Используется внутри для загрузки файлов, чтобы избежать расходования памяти на большие файлы.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## Обратные вызовы

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

Регистрирует обратный вызов перед отправкой запроса. Можно регистрировать несколько, выполняются в порядке добавления. Возврат ошибки прерывает запрос.

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
- [Интерфейсы](./interfaces) - интерфейсы RequestMutator, ResponseMutator
- [Запросы и ответы](../guides/request-response) - руководство по использованию параметров запроса
