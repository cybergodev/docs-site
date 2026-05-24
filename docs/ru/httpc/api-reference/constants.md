---
title: "Константы и типы — HTTPC"
description: "Справочник API констант и вспомогательных типов HTTPC: перечисление BodyKind с шестью типами тела запроса и правилами автоопределения, типы загрузки файлов FormData/FileData, структура события аудита AuditEvent, конфигурация аудита AuditMiddlewareConfig и ключи контекста SourceIPKey/UserIDKey."
---

# Константы и типы

## BodyKind

```go
type BodyKind int
```

Тип тела запроса, используется с `WithBody` для указания формата тела.

| Константа | Значение | Описание | Content-Type |
|-----------|----------|----------|-------------|
| `BodyAuto` | 0 | Автоопределение | Определяется по типу |
| `BodyJSON` | 1 | Принудительный JSON | application/json |
| `BodyXML` | 2 | Принудительный XML | application/xml |
| `BodyForm` | 3 | Форма | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | Бинарные данные | application/octet-stream |
| `BodyMultipart` | 5 | Multipart | multipart/form-data |

### Правила автоопределения BodyAuto

| Тип входных данных | Content-Type |
|--------------------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `*FormData` | multipart/form-data |
| `io.Reader` | Не устанавливается |
| `map[string]string` | application/x-www-form-urlencoded |
| Другие типы | application/json |

```go
// Автоопределение (по умолчанию)
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

## События аудита

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // Маскированный (учётные данные удалены)
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
    MaskHeaders    []string // Имена заголовков для маскировки
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

// Значения из контекста будут прочитаны промежуточным ПО при отправке запроса
result, err := client.Request(ctx, "GET", url)
```

## См. также

- [Типы ошибок](./errors) — полный справочник ClientError, ErrorType и переменных ошибок
- [Параметры запросов](./options) — использование BodyKind в WithBody
- [Промежуточное ПО](./middleware) — AuditMiddleware и конфигурация аудита
