---
title: "Цепочка промежуточного ПО — HTTPC"
description: "Руководство по цепочке промежуточного ПО HTTPC: принцип выполнения луковой модели с двунаправленной обработкой запросов/ответов, конфигурация восьми встроенных промежуточных ПО Recovery/Logging/RequestID/Timeout/Header/Metrics/Audit, паттерн композиции Chain и методы написания пользовательского MiddlewareFunc, включая пример промежуточного ПО с размыкателем цепи."
---

# Цепочка промежуточного ПО

## Луковая модель

Промежуточное ПО HTTPC использует луковую модель: запросы идут снаружи внутрь, ответы — изнутри наружу:

```text
Запрос →  Recovery  →  Logging  →  RequestID  → Handler
                                                        ↓
Ответ  ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),    // Внешний слой: восстановление после panic
    httpc.LoggingMiddleware(log.Printf), // Второй слой: логирование
    httpc.RequestIDMiddleware("X-Request-ID", nil), // Внутренний слой: ID запроса
}

client, _ := httpc.New(cfg)
```

## Встроенное промежуточное ПО

### RecoveryMiddleware

Восстановление после panic, предотвращает падение процесса:

```go
httpc.RecoveryMiddleware()
```

### LoggingMiddleware

Логирование запросов/ответов, URL автоматически маскируется:

```go
httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
// Вывод: [HTTP] GET https://api.example.com/data -> 200 (150ms)
```

### RequestIDMiddleware

Добавляет уникальный ID к каждому запросу, генерируется через `crypto/rand`:

```go
httpc.RequestIDMiddleware("X-Request-ID", nil) // По умолчанию 32 символа hex

// Пользовательский генератор
httpc.RequestIDMiddleware("X-Request-ID", func() string {
    return uuid.New().String()
})
```

### TimeoutMiddleware

Таймаут на уровне промежуточного ПО, принудительно срабатывает до таймаута клиента:

```go
httpc.TimeoutMiddleware(30 * time.Second)
```

### HeaderMiddleware

Добавляет статические заголовки ко всем запросам:

```go
httpc.HeaderMiddleware(map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
})
```

### MetricsMiddleware

Сбор метрик запросов:

```go
httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
})
```

### AuditMiddleware

Аудит безопасности для финансовых, медицинских и других сценариев соответствия:

```go
httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})
```

### AuditMiddlewareWithConfig

Настраиваемое промежуточное ПО аудита:

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}

httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

События аудита поддерживают извлечение SourceIP и UserID из контекста:

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## Ручная цепочечная композиция

Используйте функцию `Chain` для объединения промежуточного ПО:

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

## Пользовательское промежуточное ПО

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // Фаза запроса: модификация запроса
            req.SetHeader("Origin", origin)

            // Вызов следующего обработчика
            resp, err := next(ctx, req)

            // Фаза ответа: логирование или модификация ответа
            if resp != nil {
                log.Printf("Статус ответа: %d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

### Промежуточное ПО с размыкателем цепи

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

## Конфигурация промежуточного ПО

```go
cfg := httpc.DefaultConfig()
cfg.Middleware = httpc.MiddlewareConfig{
    Middlewares: []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
    },
    UserAgent:       "my-app/1.0",
    Headers:         map[string]string{"X-App": "my-app"},
    FollowRedirects: true,
    MaxRedirects:    10,
}

client, _ := httpc.New(cfg)
```

## Что дальше

- [Промежуточное ПО API](../api-reference/middleware) — полный справочник промежуточного ПО
- [Повторные попытки и отказоустойчивость](./retry-fault-tolerance) — руководство по настройке повторных попыток
- [Обзор безопасности](../security/) — практики безопасности с промежуточным ПО аудита
