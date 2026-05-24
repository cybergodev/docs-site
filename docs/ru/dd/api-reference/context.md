---
title: "Интеграция с контекстом - CyberGo DD | Интеграция Context"
description: "Полная документация API интеграции с контекстом CyberGo DD, поддерживает автоматическое распространение и извлечение TraceID, SpanID, RequestID, предоставляет пользовательскую реализацию интерфейса ContextExtractor, параметры конфигурации распространения Context и метод привязки WithContext, реализует бесшовную интеграцию с системами распределённой трассировки, такими как OpenTelemetry."
---

# Интеграция с контекстом

DD поддерживает интеграцию со стандартной библиотекой Go `context.Context`, может автоматически распространять информацию трассировки и извлекать поля контекста.

## Встроенные ключи контекста

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | Добавить TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | Добавить SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | Добавить RequestID |
| `GetTraceID` | `(ctx context.Context) string` | Получить TraceID |
| `GetSpanID` | `(ctx context.Context) string` | Получить SpanID |
| `GetRequestID` | `(ctx context.Context) string` | Получить RequestID |

### Пример использования

```go
func handleRequest(ctx context.Context) {
    // Инъекция информации трассировки
    ctx = dd.WithTraceID(ctx, "trace-abc123")
    ctx = dd.WithSpanID(ctx, "span-def456")
    ctx = dd.WithRequestID(ctx, "req-789")

    // Ручное извлечение полей контекста в лог
    logger.InfoWith("Обработка запроса",
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("span_id", dd.GetSpanID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
}
```

:::tip Массовое извлечение
Через `ContextExtractor` в сочетании с `Config.ContextExtractors` можно реализовать автоматическое извлечение, экстрактор выполняется при каждом вызове логирования. Подробнее в разделе [ContextExtractor](#contextextractor) ниже.
:::

## ContextExtractor

Экстрактор контекста используется для автоматического извлечения полей из `context.Context`.

```go
type ContextExtractor func(ctx context.Context) []Field
```

### Регистрация экстрактора

```go
// Через метод Logger
logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// Массовая замена
logger.SetContextExtractors(extractor1, extractor2)

// Получение текущих экстракторов
extractors := logger.GetContextExtractors()
```

## Константы ключей контекста

| Константа | Тип | Значение |
|-----------|-----|----------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Полный пример

### HTTP-посредник

```go
func tracingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        traceID := r.Header.Get("X-Trace-ID")
        if traceID == "" {
            traceID = generateTraceID()
        }
        ctx := dd.WithTraceID(r.Context(), traceID)
        ctx = dd.WithRequestID(ctx, generateRequestID())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### gRPC-перехватчик

```go
func loggingInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, _ := metadata.FromIncomingContext(ctx)
    ctx = dd.WithTraceID(ctx, md.Get("trace-id")[0])
    ctx = dd.WithRequestID(ctx, md.Get("request-id")[0])

    dd.InfoWith("gRPC запрос",
        dd.String("method", info.FullMethod),
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    )
    return handler(ctx, req)
}
```

## Следующие шаги

- [Logger](./logger) -- метод AddContextExtractor
- [Определения интерфейсов](./interfaces) -- определение типа ContextExtractor
- [Структурированные поля](./fields) -- конструкторы Field
