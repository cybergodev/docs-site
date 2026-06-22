---
title: "Промежуточное ПО - CyberGo HTTPC | Встроенное ПО"
description: "Справочник API middleware HTTPC: композиция Chain по луковой модели и восемь встроенных middleware (Recovery, Logging, Timeout, Metrics, Audit)."
---

# Промежуточное ПО

HTTPC использует архитектуру промежуточного ПО по модели лука, оборачивая логику обработки запросов через `MiddlewareFunc`.

```go
type MiddlewareFunc func(Handler) Handler
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Промежуточное ПО настраивается в `Config.Middleware.Middlewares`, выполняется в порядке добавления:

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
            httpc.LoggingMiddleware(log.Printf),
            httpc.RequestIDMiddleware("X-Request-ID", nil),
        },
    },
})
```

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

Объединяет несколько промежуточных ПО в одно. Выполняются в порядке передачи, после обработки последним вызывается финальный Handler.

```go
combined := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
)
```

## Встроенное промежуточное ПО

### RecoveryMiddleware

```go
func RecoveryMiddleware() MiddlewareFunc
```

Промежуточное ПО восстановления после panic. Перехватывает panic в цепочке обработки, преобразуя его в error с информацией о стеке вызовов.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.RecoveryMiddleware(),
        },
    },
})
```

### LoggingMiddleware

```go
func LoggingMiddleware(log func(format string, args ...any)) MiddlewareFunc
```

Промежуточное ПО логирования запросов. Записывает метод, URL, код состояния и время выполнения. URL автоматически маскируется (удаляется информация об учётных данных).

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.LoggingMiddleware(log.Printf),
        },
    },
})
// Пример вывода: GET https://api.example.com/data -> 200 (125ms)
```

### RequestIDMiddleware

```go
func RequestIDMiddleware(headerName string, generator func() string) MiddlewareFunc
```

Добавляет уникальный ID каждому запросу. По умолчанию использует `crypto/rand` для генерации 32-символьного шестнадцатеричного ID.

| Параметр | Описание |
|----------|----------|
| `headerName` | Имя заголовка, например `"X-Request-ID"` |
| `generator` | Пользовательская функция генерации ID, передайте `nil` для использования генератора по умолчанию |

```go
// С генератором по умолчанию
middleware := httpc.RequestIDMiddleware("X-Request-ID", nil)

// С пользовательским генератором
middleware := httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

:::tip
Генератор по умолчанию использует `crypto/rand`, генерируемые ID непредсказуемы, подходят для сценариев с повышенными требованиями к безопасности.
:::

### TimeoutMiddleware

```go
func TimeoutMiddleware(timeout time.Duration) MiddlewareFunc
```

Управление таймаутом на уровне промежуточного ПО. Срабатывает до встроенного таймаута клиента, при истечении отменяет контекст и возвращает ошибку.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.TimeoutMiddleware(10 * time.Second),
        },
    },
})
```

### HeaderMiddleware

```go
func HeaderMiddleware(headers map[string]string) MiddlewareFunc
```

Добавляет статические заголовки каждому запросу. Безопасность заголовков проверяется при создании (защита от CRLF-инъекций).

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.HeaderMiddleware(map[string]string{
                "X-API-Version": "v2",
                "X-Client":      "myapp/1.0",
            }),
        },
    },
})
```

### MetricsMiddleware

```go
func MetricsMiddleware(onMetrics func(method, url string, statusCode int, duration time.Duration, err error)) MiddlewareFunc
```

Промежуточное ПО сбора метрик. Вызывает обратный вызов после каждого запроса, передавая метод, URL, код состояния, время выполнения и информацию об ошибке.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.MetricsMiddleware(func(method, url string, status int, d time.Duration, err error) {
                metrics.Record(method, status, d, err)
            }),
        },
    },
})
```

### AuditMiddleware

```go
func AuditMiddleware(onAudit func(event AuditEvent)) MiddlewareFunc
```

Промежуточное ПО безопасности для аудита, подходит для финансовых, медицинских, государственных и других сценариях с требованиями соответствия. Записывает полную информацию о запросе/ответе, URL автоматически маскируется.

```go
client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddleware(func(event httpc.AuditEvent) {
                log.Printf("[AUDIT] %s %s -> %d (%v) user=%s ip=%s",
                    event.Method, event.URL, event.StatusCode,
                    event.Duration, event.UserID, event.SourceIP)
            }),
        },
    },
})
```

### AuditMiddlewareWithConfig

```go
func AuditMiddlewareWithConfig(onAudit func(event AuditEvent), config *AuditMiddlewareConfig) MiddlewareFunc
```

Промежуточное ПО безопасности для аудита с конфигурацией.

```go
config := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

client, _ := httpc.New(&httpc.Config{
    Middleware: &httpc.MiddlewareConfig{
        Middlewares: []httpc.MiddlewareFunc{
            httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
                data, _ := json.Marshal(event)
                auditLog.Write(data)
            }, config),
        },
    },
})
```

## Типы аудита

### AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`              // Маскировано (учётные данные удалены)
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

Событие безопасности аудита.

#### MarshalJSON

```go
func (e AuditEvent) MarshalJSON() ([]byte, error)
```

Пользовательская сериализация JSON, обрабатывает два специальных поля:

| Поле | Правило преобразования |
|------|------------------------|
| `Duration` | Добавляется `durationMs` (целое число миллисекунд), сохраняется исходное поле `duration` (наносекунды) |
| `Error` | Преобразуется в `error` (строка сообщения об ошибке), при nil опускается |

```go
event := httpc.AuditEvent{
    Method:    "GET",
    URL:       "https://api.example.com/data",
    Duration:  150 * time.Millisecond,
    StatusCode: 200,
}
data, _ := json.Marshal(event)
// {"timestamp":"...","method":"GET","url":"...","statusCode":200,"duration":150000000,"durationMs":150,"attempts":0}
```

### AuditMiddlewareConfig

```go
type AuditMiddlewareConfig struct {
    Format         string   // "text" (по умолчанию) или "json"
    IncludeHeaders bool     // Включать ли заголовки запроса/ответа
    MaskHeaders    []string // Имена заголовков для маскировки
    SanitizeError  bool     // Маскировать ли информацию об ошибках
}
```

| Поле | Значение по умолчанию | Описание |
|------|----------------------|----------|
| Format | `"text"` | Формат вывода |
| IncludeHeaders | `false` | Записывать ли заголовки |
| MaskHeaders | `["Authorization", "Cookie", ...]` | Стандартный список конфиденциальных заголовков |
| SanitizeError | `true` | Информация об ошибках заменяется на `[sanitized]` |

### DefaultAuditMiddlewareConfig

```go
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig
```

Возвращает конфигурацию аудита по умолчанию.

### Ключи контекста аудита

Передача информации аудита через контекст запроса:

```go
// Установка исходного IP
ctx = context.WithValue(ctx, httpc.SourceIPKey, "192.168.1.1")

// Установка идентификатора пользователя
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")

result, err := client.Request(ctx, "GET", url)
```

| Константа | Тип | Описание |
|-----------|-----|----------|
| `SourceIPKey` | `auditContextKey` | Ключ контекста исходного IP |
| `UserIDKey` | `auditContextKey` | Ключ контекста идентификатора пользователя |

## См. также

- [Интерфейсы](./interfaces) - определения типов MiddlewareFunc, Handler
- [Цепочки промежуточного ПО](../guides/middleware-chain) - руководство по использованию промежуточного ПО
- [Константы и типы](./constants) - типы AuditEvent, AuditMiddlewareConfig
