---
sidebar_label: "Интеграция с контекстом"
title: "Интеграция с контекстом - CyberGo DD | Интеграция Context"
description: "API интеграции с контекстом CyberGo DD: инъекция идентификаторов трассировки через WithTraceID/WithSpanID/WithRequestID, типобезопасный ключ ContextKey и тип функции ContextExtractor для автоматического извлечения полей, поддержка интеграции с распределёнными системами трассировки вроде OpenTelemetry."
sidebar_position: 2
---

# Интеграция с контекстом

DD поддерживает интеграцию со стандартной библиотекой Go `context.Context`, может автоматически распространять информацию трассировки и извлекать поля контекста.

## Тип ContextKey

`ContextKey` — пользовательский тип ключа на основе `string`, исключающий конфликты с ключами контекста других пакетов.

```go
type ContextKey string
```

Предопределены три константы ключей — для TraceID / SpanID / RequestID соответственно:

| Константа | Тип | Значение |
|-----------|-----|----------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Инъекция и чтение

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `WithTraceID` | `(ctx context.Context, traceID string) context.Context` | Инъекция TraceID |
| `WithSpanID` | `(ctx context.Context, spanID string) context.Context` | Инъекция SpanID |
| `WithRequestID` | `(ctx context.Context, requestID string) context.Context` | Инъекция RequestID |
| `GetTraceID` | `(ctx context.Context) string` | Чтение TraceID (при отсутствии возвращает `""`) |
| `GetSpanID` | `(ctx context.Context) string` | Чтение SpanID (при отсутствии возвращает `""`) |
| `GetRequestID` | `(ctx context.Context) string` | Чтение RequestID (при отсутствии возвращает `""`) |

Функции `With*` порождают новый ctx на основе `context.WithValue` (ключом служит соответствующая константа `ContextKey`), а функции `Get*` извлекают из ctx строковое значение; если ключ отсутствует или значение не является строкой, единообразно возвращается пустая строка.

### Пример использования

<!-- check-code: skip -->
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
Ручной `Get*` подходит для разовых сценариев. Чтобы автоматически добавлять **глобальные/статические** поля (например, имя службы или хоста) в каждую запись, зарегистрируйте `ContextExtractor` в Logger; экстрактор выполняется при каждом вызове `*With`. Примечание: экстрактор получает `context.Background()`, поэтому **не может** автоматически получать request-scoped TraceID (см. ограничение ниже).
:::

## ContextExtractor

`ContextExtractor` — тип функции для автоматического извлечения полей из `context.Context`, удобный для интеграции с такими системами трассировки, как OpenTelemetry, Jaeger и др.

```go
type ContextExtractor func(ctx context.Context) []Field
```

Экстракторы удерживаются внутри Logger потокобезопасным реестром (`contextExtractorRegistry`, **приватный, не экспонируется**): выполняются в порядке добавления, чтение идёт по неблокирующему быстрому пути через `atomic.Pointer`; паника в любом экстракторе перехватывается recover и фиксируется в stderr, не обрушивая приложение.

### Регистрация экстрактора

Сам экстрактор в этом файле определяется только как тип; API для регистрации/управления находятся на Logger (область core):

<!-- check-code: skip -->
```go
// Добавление одного экстрактора (возвращает error, nil-экстрактор будет отклонён)
err := logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
        dd.String("request_id", dd.GetRequestID(ctx)),
    }
})

// Массовая замена всех экстракторов
_ = logger.SetContextExtractors(extractor1, extractor2)

// Получение снимка текущих зарегистрированных экстракторов
extractors := logger.GetContextExtractors()
```

:::warning Ограничение контекста (важно)
Методы логирования (`Info`/`InfoWith` и т. д.) не принимают `context.Context`, а `ContextExtractor` вызывается внутренне с `context.Background()`, поэтому **не может автоматически извлекать** TraceID/SpanID из контекста запроса. Приведённый ниже пример OTel выдаёт поля только при активном глобальном span; для добавления TraceID на каждый запрос передавайте их вручную через `WithFields()` (см. [Интеграция распределённой трассировки](../../guides/context-tracing)).
:::

### Пример с OpenTelemetry

<!-- check-code: skip -->
```go
// Инъекция trace_id / span_id из span OTel в каждую запись лога
otelExtractor := dd.ContextExtractor(func(ctx context.Context) []dd.Field {
    span := trace.SpanFromContext(ctx)
    if !span.SpanContext().IsValid() {
        return nil
    }
    return []dd.Field{
        dd.String("trace_id", span.SpanContext().TraceID().String()),
        dd.String("span_id", span.SpanContext().SpanID().String()),
    }
})
_ = logger.AddContextExtractor(otelExtractor)
```

## Полный пример

### HTTP-посредник

<!-- check-code: skip -->
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

<!-- check-code: skip -->
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

- [Logger](../core/logger) -- `AddContextExtractor` / `SetContextExtractors` / `GetContextExtractors`
- [Структурированные поля](./fields) -- конструкторы `Field` и валидация полей
- [Конфигурация](../core/config) -- `Config.ContextExtractors`
