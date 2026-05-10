---
title: Запросы и ответы - HTTPC
description: Руководство по обработке запросов и ответов HTTPC, включая установку заголовков, различные форматы тела запроса, параметры запроса, методы аутентификации, управление Cookie и потоковые ответы.
---

# Запросы и ответы

## Отправка запросов

### Функции уровня пакета

Отправляйте запросы напрямую без создания клиента:

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

Поддерживаемые HTTP-методы: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

### Экземпляр клиента

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

### Универсальный метод запроса

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## Параметры запросов

### Заголовки запроса

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer token"),
    httpc.WithHeader("X-Custom", "value"),
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "123",
    }),
    httpc.WithUserAgent("my-app/1.0"),
)
```

### Тело запроса

```go
// JSON
result, err := client.Post(url, httpc.WithJSON(map[string]any{
    "name": "test",
}))

// XML
result, err := client.Post(url, httpc.WithXML(data))

// Форма
result, err := client.Post(url, httpc.WithForm(map[string]string{
    "username": "admin",
    "password": "secret",
}))

// Бинарные данные (по умолчанию application/octet-stream)
result, err := client.Post(url, httpc.WithBinary(data))
// С указанием типа
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// Автоопределение типа
result, err := client.Post(url, httpc.WithBody(data))
// string → text/plain; charset=utf-8, []byte → application/octet-stream,
// map[string]string → application/x-www-form-urlencoded,
// *FormData → multipart/form-data, io.Reader → passed through,
// другие → application/json
// Явное указание: httpc.WithBody(data, httpc.BodyJSON)
```

### Параметры запроса

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)

// Или используя Map
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
    }),
)
```

### Аутентификация

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

### Cookie

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
)
```

### Управление запросом

```go
// Тайм-аут
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// Повторные попытки
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Перенаправления
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // запретить перенаправления
    httpc.WithMaxRedirects(3),           // максимум 3 перенаправления
)
```

### Обратные вызовы

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("Отправка запроса: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("Получен ответ: %d", resp.StatusCode())
        return nil
    }),
)
```

## Обработка ответов

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// Проверка статуса
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// Чтение ответа
result.Body()           // строка
result.RawBody()        // []byte
result.Proto()          // "HTTP/1.1"

// Разбор JSON
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}

// Cookie
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}

// Метаданные запроса
fmt.Println(result.Meta.Duration)       // время выполнения запроса
fmt.Println(result.Meta.Attempts)       // количество повторных попыток
fmt.Println(result.Meta.RedirectCount)  // количество перенаправлений
```

## Управление контекстом

```go
// Управление тайм-аутом
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// Управление отменой
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // отмена через 5 секунд
}()
result, err := httpc.Request(ctx, "GET", url)
```

## Потоковые ответы

`WithStreamBody(true)` — это внутренний механизм, используемый при загрузке файлов для предотвращения кэширования полного тела ответа в памяти. При включении тело ответа не считывается в `Result` (`Body()` и `RawBody()` возвращают пустые значения).

:::warning Предупреждение
`WithStreamBody(true)` используется внутри API загрузки файлов (`DownloadFile`, `DownloadWithOptions`). Для потокового получения содержимого ответа используйте [API загрузки файлов](./file-transfer).
:::

Для загрузки больших файлов используйте API загрузки:

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.DownloadWithOptions(url, cfg)
```

## Распаковка ответов

HTTPC автоматически обрабатывает распаковку содержимого с кодировкой gzip, deflate и другими. Можно ограничить размер распакованного содержимого через настройки безопасности для предотвращения атак с помощью распакованных бомб:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // максимальный размер сжатого тела 10 МБ
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // максимальный размер распакованного тела 100 МБ
```

| Параметр | Значение по умолчанию | Описание |
|----------|---------------------|----------|
| `MaxResponseBodySize` | 10 МБ | Максимальный размер исходного тела ответа |
| `MaxDecompressedBodySize` | 100 МБ | Максимальный размер распакованного тела ответа |

При превышении лимита возвращается ошибка с сообщением `"exceeds limit"`, которую можно обработать через тип `ClientError`. `ErrResponseBodyTooLarge` возвращается при разборе `Result.Unmarshal()` тел ответов, превышающих лимит в 50 МБ для JSON (независимо от `MaxResponseBodySize`).

## Что дальше

- [Загрузка и выгрузка файлов](./file-transfer) - руководство по передаче файлов
- [Доменный клиент и сессии](./domain-session) - управление сессиями
- [Параметры запросов API](../api-reference/options) - полный справочник параметров
- [Result API](../api-reference/result) - справочник по обработке ответов
