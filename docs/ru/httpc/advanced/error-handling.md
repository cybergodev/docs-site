---
title: "Обработка ошибок — HTTPC"
description: "Руководство по обработке ошибок HTTPC: двенадцать типов ErrorType, поля структуры ClientError и определение IsRetryable, сопоставление ошибок-сигналов через errors.Is/As, обработка исчерпания повторных попыток, таймаут и отмена context, единая обработка ошибок в промежуточном ПО и лучшие практики разделения таймаутов."
---

# Обработка ошибок

## Классификация ошибок

HTTPC использует `ClientError` для классификации ошибок, поддерживая `errors.As` и `errors.Is`.

### Определение типа ошибки

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("Таймаут запроса: %v", err)
        case httpc.ErrorTypeNetwork:
            log.Printf("Сетевая ошибка: %v", err)
        case httpc.ErrorTypeDNS:
            log.Printf("Сбой разрешения DNS: %v", err)
        case httpc.ErrorTypeTLS:
            log.Printf("Ошибка TLS: %v", err)
        case httpc.ErrorTypeCertificate:
            log.Printf("Ошибка проверки сертификата: %v", err)
        case httpc.ErrorTypeRetryExhausted:
            log.Printf("Исчерпаны повторные попытки: %v", err)
        case httpc.ErrorTypeValidation:
            log.Printf("Ошибка валидации запроса: %v", err)
        case httpc.ErrorTypeContextCanceled:
            log.Printf("Запрос отменён: %v", err)
        }
    }
}
```

### Определение повторяемости

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // Ошибку можно повторить
    log.Println("Повторяемая ошибка, повторите позже")
}
```

## Ожидаемые ошибки

### Сопоставление переменных ошибок

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Клиент закрыт
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Тело ответа пустое
}

if errors.Is(err, httpc.ErrInvalidURL) {
    // Недопустимый формат URL
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // Недопустимый заголовок запроса
}
```

## Повторные попытки и ошибки

Подробнее о настройке повторных попыток см. в [Повторных попытках и отказоустойчивости](../guides/retry-fault-tolerance). Здесь рассматривается обработка ошибок после исчерпания повторных попыток:

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Не удалось после %d повторных попыток", clientErr.Attempts)
        }
    }
    return err
}
```

## Отмена контекста

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.Request(ctx, "GET", url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeContextCanceled {
            log.Println("Запрос отменён (таймаут или ручная отмена)")
        }
    }
}
```

## Лучшие практики обработки ошибок

### 1. Разделяйте клиентские и серверные ошибки

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка сетевого уровня
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx — ошибка в запросе клиента
    log.Printf("Ошибка клиента: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx — сбой на стороне сервера
    log.Printf("Ошибка сервера: %d", result.StatusCode())
}
```

### 2. Используйте промежуточное ПО для единой обработки

```go
recoveryMiddleware := httpc.RecoveryMiddleware()
loggingMiddleware := httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
metricsMiddleware := httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    if err != nil {
        metrics.Increment("http.errors")
    } else {
        metrics.RecordDuration("http.duration", duration)
    }
})
```

### 3. Разделение таймаутов

```go
// Таймаут клиента по умолчанию
cfg.Timeouts.Request = 30 * time.Second

// Принудительный таймаут через промежуточное ПО
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// Переопределение для отдельного запроса
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// Таймаут контекста (самый точный)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## Что дальше

- [Типы ошибок API](../api-reference/errors) — справочник типов ошибок и переменных
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) — настройка стратегии повторных попыток
- [Цепочка промежуточного ПО](../guides/middleware-chain) — единая обработка ошибок через промежуточное ПО
