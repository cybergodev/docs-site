---
sidebar_label: "Интеграция с распределённой трассировкой"
title: "Распределённая трассировка - CyberGo DD | Контекст"
description: "Руководство по интеграции распределённой трассировки CyberGo DD: распространение контекста TraceID/SpanID/RequestID, пользовательский экстрактор ContextExtractor, интеграция с HTTP-посредником, логирование области видимости запроса и интеграция с системой распределённой трассировки OpenTelemetry."
sidebar_position: 7
---

# Интеграция распределённой трассировки

DD предоставляет служебные функции для идентификаторов трассировки на основе `context.Context` (`WithTraceID`/`GetTraceID` и т.д.), упрощающие сопоставление логов в микросервисных архитектурах. Важное замечание: **методы логирования DD не принимают параметр `context.Context`**, поэтому автоматически извлечь TraceID из контекста области видимости запроса невозможно — необходимо вручную добавлять идентификаторы трассировки как поля через `WithFields()` (подробности см. в [Интеграции с HTTP-посредником](#интеграция-с-http-посредником)).

## Ключи контекста

DD предопределяет три ключа контекста:

| Ключ | Описание | Назначение |
|-----|----------|-----------|
| `ContextKeyTraceID` | ID трассировки | Межсервисная трассировка, связывает полную цепочку запросов |
| `ContextKeySpanID` | Span ID | Трассировка операций внутри сервиса |
| `ContextKeyRequestID` | ID запроса | Уникальный идентификатор одного запроса |

## Базовое использование

### Установка и получение

```go
ctx := context.Background()

// Установка идентификаторов трассировки
ctx = dd.WithTraceID(ctx, "trace-abc123")
ctx = dd.WithSpanID(ctx, "span-def456")
ctx = dd.WithRequestID(ctx, "req-789")

// Получение идентификаторов трассировки
traceID := dd.GetTraceID(ctx)    // "trace-abc123"
spanID := dd.GetSpanID(ctx)      // "span-def456"
requestID := dd.GetRequestID(ctx) // "req-789"
```

### Почему невозможно «автоматически извлечь» в логи

:::warning Текущее ограничение
Методы логирования DD (`Info`, `InfoWith` и т.д.) не принимают параметр `context.Context` напрямую. Экстракторы контекста используют `context.Background()` при внутреннем вызове (`logger.go:1414`), поэтому невозможно напрямую получить TraceID и другие значения из контекста области видимости запроса. Рекомендуется вручную передавать поля (см. ниже интеграцию с HTTP-посредником).
:::

```go
// Экстракторы контекста используются для предустановленных статических полей контекста в конфигурации
// Примечание: поскольку методы логирования не принимают context, функции GetTraceID и др. в экстракторе
// не могут получить значения из контекста области видимости запроса

// Рекомендуемый способ: ручная передача полей трассировки через WithFields
reqLog := logger.WithFields(
    dd.String("trace_id", traceID),
    dd.String("request_id", requestID),
)
reqLog.Info("Обработка запроса")
```

## Интеграция с HTTP-посредником

### Базовый посредник трассировки

```go
func TracingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Извлечение или генерация идентификаторов трассировки из заголовков запроса
            traceID := r.Header.Get("X-Trace-ID")
            if traceID == "" {
                traceID = uuid.New().String()
            }

            requestID := r.Header.Get("X-Request-ID")
            if requestID == "" {
                requestID = uuid.New().String()
            }

            // Инъекция в контекст
            ctx := r.Context()
            ctx = dd.WithTraceID(ctx, traceID)
            ctx = dd.WithRequestID(ctx, requestID)

            // Создание лога Entry с областью видимости запроса
            reqLog := logger.WithFields(
                dd.String("trace_id", traceID),
                dd.String("request_id", requestID),
            )

            // Передача Logger в обработчик (используем пользовательский тип ключа для избежания конфликтов)
            type ctxKey struct{}
            ctx = context.WithValue(ctx, ctxKey{}, reqLog)
            next.ServeHTTP(w, r.WithContext(ctx))

            reqLog.InfoWith("Запрос завершён",
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
            )
        })
    }
}
```

### Полный пример трассировки запросов

<!-- check-code: skip -->
```go
package main

import (
    "net/http"

    "github.com/cybergodev/dd"
)

type Handler struct {
    log *dd.LoggerEntry
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Получение информации трассировки из контекста
    traceID := dd.GetTraceID(ctx)
    reqID := dd.GetRequestID(ctx)

    h.log.InfoWith("Запрос пользователя",
        dd.String("trace_id", traceID),
        dd.String("request_id", reqID),
        dd.String("user_id", r.PathValue("id")),
    )

    // Бизнес-логика...

    h.log.InfoWith("Запрос выполнен",
        dd.String("trace_id", traceID),
        dd.Int("status", 200),
    )
}
```

## ContextExtractor — пользовательский экстрактор

`ContextExtractor` может использоваться для извлечения полей из контекста. Обратите внимание: поскольку методы логирования не принимают параметр context, экстрактор вызывается внутренне с `context.Background()`, подходит для следующих сценариев:

- Извлечение статических полей из глобального контекста или goroutine-local хранилища
- Комбинирование с HTTP-посредником для ручной передачи полей трассировки в `WithFields`

### Пример пользовательского экстрактора

```go
// Пользовательский экстрактор: добавляет статические/глобальные метаданные к каждой записи лога
func tenantExtractor(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("service", "order-service"),
        dd.String("env", os.Getenv("APP_ENV")),
    }
}

// Регистрация экстрактора
logger.AddContextExtractor(tenantExtractor)
```

:::warning Ограничение контекста
Функции `ContextExtractor` получают `context.Background()`, а не контекст области видимости запроса. Для добавления идентификаторов трассировки на каждый запрос используйте показанный выше паттерн `WithFields()` для создания `LoggerEntry` с областью видимости запроса.
:::

### Комбинирование нескольких экстракторов

```go
// Регистрация нескольких экстракторов для сбора различных глобальных метаданных
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("hostname", getHostname()),
        dd.String("version", buildVersion),
    }
})

logger.AddContextExtractor(tenantExtractor)
```

## Межсервисное распространение

В микросервисных вызовах идентификаторы трассировки распространяются через HTTP-заголовки:

```go
// Отправляющая сторона: инъекция идентификаторов трассировки в заголовки запроса
func callUpstream(ctx context.Context, url string) (*http.Response, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    // Распространение идентификаторов трассировки
    if traceID := dd.GetTraceID(ctx); traceID != "" {
        req.Header.Set("X-Trace-ID", traceID)
    }
    if reqID := dd.GetRequestID(ctx); reqID != "" {
        req.Header.Set("X-Request-ID", reqID)
    }

    return http.DefaultClient.Do(req)
}
```

## Паттерн логирования области видимости запроса

```go
type RequestLogger struct {
    log    *dd.LoggerEntry
    ctx    context.Context
    start  time.Time
}

func NewRequestLogger(logger *dd.Logger, r *http.Request) *RequestLogger {
    ctx := r.Context()
    ctx = dd.WithTraceID(ctx, r.Header.Get("X-Trace-ID"))
    ctx = dd.WithRequestID(ctx, r.Header.Get("X-Request-ID"))

    return &RequestLogger{
        log: logger.WithFields(
            dd.String("trace_id", dd.GetTraceID(ctx)),
            dd.String("request_id", dd.GetRequestID(ctx)),
            dd.String("method", r.Method),
            dd.String("path", r.URL.Path),
        ),
        ctx:   ctx,
        start: time.Now(),
    }
}

func (rl *RequestLogger) Info(msg string, fields ...dd.Field) {
    rl.log.InfoWith(msg, fields...)
}

func (rl *RequestLogger) Finish(status int) {
    rl.log.InfoWith("Запрос завершён",
        dd.Int("status", status),
        dd.Duration("elapsed", time.Since(rl.start)),
    )
}
```

## Следующие шаги

- [Система хуков](./hooks) -- расширение через хуки жизненного цикла
- [Аудитные логи](./audit-logging) -- аудит безопасности
- [Справочник API - Context](../api-reference/output-integration/context) -- полный API Context
- [Пример Web-сервиса](../examples/web-service) -- полный пример Web-сервиса
