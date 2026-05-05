---
title: Константы и типы - HTTPC
description: "Полный справочник API констант и вспомогательных типов HTTPC, включая перечисление BodyKind с шестью типами тела запроса и правилами автоматического определения, вспомогательные типы FormData и FileData для многочастной загрузки форм, структуру события аудита AuditEvent и определения ключей контекста SourceIPKey и UserIDKey"
---

# Константы и типы

## BodyKind

```go
type BodyKind int
```

Тип тела запроса, используется в `WithBody` для указания формата тела запроса.

| Константа | Значение | Описание | Content-Type |
|-----------|----------|----------|-------------|
| `BodyAuto` | 0 | Автоматическое определение | Определяется по типу |
| `BodyJSON` | 1 | Принудительный JSON | application/json |
| `BodyXML` | 2 | Принудительный XML | application/xml |
| `BodyForm` | 3 | Форма | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | Бинарные данные | application/octet-stream |
| `BodyMultipart` | 5 | Многочастные данные | multipart/form-data |

### Правила определения BodyAuto

| Тип входных данных | Content-Type |
|--------------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | Не устанавливается |
| `map[string]string` | application/x-www-form-urlencoded |
| Другие типы | application/json |

```go
// Автоматическое определение (по умолчанию)
result, _ := client.Post(url, httpc.WithBody(data))

// Принудительный JSON
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Принудительный XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

## FormData / FileData

### FormData

```go
type FormData struct {
    Fields map[string]string
    Files  map[string]*FileData
}
```

### FileData

```go
type FileData struct {
    Filename    string
    Content     []byte
    ContentType string  // MIME-тип, например "image/png", "application/pdf"
}
```

```go
form := &httpc.FormData{
    Fields: map[string]string{"key": "value"},
    Files: map[string]*httpc.FileData{
        "file": {Filename: "test.txt", Content: []byte("hello"), ContentType: "text/plain"},
    },
}
result, err := client.Post(url, httpc.WithFormData(form))
```

## Событие аудита

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // Маскировано (учётные данные удалены)
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text" или "json"
    IncludeHeaders bool     // Включать заголовки запроса/ответа
    MaskHeaders    []string // Имена заголовков для маскирования
    SanitizeError  bool     // Маскировать информацию об ошибках
}
```

## Ключи контекста

| Константа | Тип | Описание |
|-----------|-----|----------|
| `SourceIPKey` | `auditContextKey` | Исходный IP в событии аудита |
| `UserIDKey` | `auditContextKey` | ID пользователя в событии аудита |

```go
// Передача информации аудита через context
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

// Настройка промежуточного ПО аудита в Config
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        fmt.Println(event.SourceIP) // 192.168.1.1
        fmt.Println(event.UserID)   // user-123
    }),
}
client, _ := httpc.New(cfg)

// Значения из context будут прочитаны промежуточным ПО при отправке запроса
result, err := client.Request(ctx, "GET", url)
```

## Смотрите также

- [Типы ошибок](./errors) - Полный справочник ClientError, ErrorType и переменных ошибок
- [Параметры запроса](./options) - Использование BodyKind в WithBody
- [Промежуточное ПО](./middleware) - AuditMiddleware и конфигурация аудита
