---
title: Result - HTTPC
description: Справочник API типа ответа Result HTTPC, предоставляющий доступ к телу ответа, получение кода состояния, определение статуса, операции с Cookie, разбор JSON и методы сохранения в файл.
---

# Result

Result инкапсулирует HTTP-ответ и метаданные запроса, предоставляя удобные методы доступа. Получается через `Client.Request()` или функции уровня пакета.

```go
type Result struct {
    Request  *RequestInfo
    Response *ResponseInfo
    Meta     *RequestMeta
}
```

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::warning Предупреждение
После использования необходимо вызвать `ReleaseResult(result)` для возврата в пул объектов. После вызова нельзя обращаться к Result.
:::

## Базовые методы

### StatusCode

```go
func (r *Result) StatusCode() int
```

Возвращает HTTP-код состояния. Безопасен для nil, возвращает 0.

### Body

```go
func (r *Result) Body() string
```

Возвращает тело ответа в виде строки. Безопасен для nil, возвращает пустую строку.

### RawBody

```go
func (r *Result) RawBody() []byte
```

Возвращает тело ответа в виде байтов. Безопасен для nil, возвращает nil.

### Proto

```go
func (r *Result) Proto() string
```

Возвращает версию HTTP-протокола, например `"HTTP/1.1"`, `"HTTP/2.0"`.

## Определение статуса

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

Возвращает true для кодов состояния 2xx.

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

Возвращает true для кодов состояния 3xx.

### IsClientError

```go
func (r *Result) IsClientError() bool
```

Возвращает true для кодов состояния 4xx.

### IsServerError

```go
func (r *Result) IsServerError() bool
```

Возвращает true для кодов состояния 5xx.

```go
result, _ := client.Get(url)
switch {
case result.IsSuccess():
    handleSuccess(result)
case result.IsClientError():
    handleClientError(result)
case result.IsServerError():
    handleServerError(result)
}
```

## Методы Cookie

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

Возвращает все Cookie из ответа.

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

Получает Cookie из ответа по имени, возвращает nil, если не найден.

```go
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}
```

### HasCookie

```go
func (r *Result) HasCookie(name string) bool
```

Проверяет наличие Cookie с указанным именем в ответе.

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

Возвращает все Cookie, отправленные в запросе.

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

Получает Cookie запроса по имени.

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

Проверяет наличие Cookie с указанным именем в запросе.

## Разбор JSON

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

Разбирает тело JSON-ответа в целевую переменную. Следует соглашениям `json.Unmarshal`.

| Ошибка | Условие возникновения |
|--------|---------------------|
| `ErrResponseBodyEmpty` | Тело ответа пустое |
| `ErrResponseBodyTooLarge` | Тело ответа превышает лимит разбора JSON в 50 МБ |

```go
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}
fmt.Println(user.Name)
```

## Сохранение в файл

### SaveToFile

```go
func (r *Result) SaveToFile(filePath string) error
```

Сохраняет тело ответа в файл. Путь к файлу проходит проверку безопасности (защита от обхода пути, проверка символических ссылок, защита системных путей).

| Ошибка | Условие возникновения |
|--------|---------------------|
| `ErrResponseBodyEmpty` | Тело ответа пустое |

```go
result, _ := client.Get("https://example.com/data.csv")
defer httpc.ReleaseResult(result)

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## Строковое представление

### String

```go
func (r *Result) String() string
```

Возвращает читаемое строковое представление. Конфиденциальные заголовки автоматически маскируются, тело ответа обрезается до 200 символов.

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
```

## Подтипы

### RequestInfo

```go
type RequestInfo struct {
    URL     string
    Method  string
    Headers http.Header
    Cookies []*http.Cookie
}
```

Детали запроса. Доступ через `result.Request`.

### ResponseInfo

```go
type ResponseInfo struct {
    StatusCode    int
    Status        string
    Proto         string
    Headers       http.Header
    Body          string
    RawBody       []byte
    ContentLength int64
    Cookies       []*http.Cookie
}
```

Данные ответа. Доступ через `result.Response`.

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

Метаданные выполнения запроса. Доступ через `result.Meta`.

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2 (1 повторная попытка)
fmt.Println(result.Meta.RedirectCount)  // 1 (1 перенаправление)
```

## ReleaseResult

```go
func ReleaseResult(r *Result)
```

Возвращает Result в пул объектов. Первые 64 КБ тела ответа безопасно очищаются, все внутренние данные обнуляются. После вызова нельзя обращаться к полям или методам Result.

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
// используйте result...
```

## См. также

- [Функции пакета](./functions) - методы запросов для получения Result
- [Параметры запросов](./options) - конфигурация поведения запросов
- [Загрузка файлов](./download) - тип результата загрузки DownloadResult
