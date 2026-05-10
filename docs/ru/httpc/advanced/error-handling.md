---
title: Обработка ошибок - HTTPC
description: Руководство по обработке ошибок HTTPC, подробно описывающее двенадцать типов ErrorType, поля структуры ClientError, сопоставление предопределённых ошибок и лучшие практики для различных сетевых ошибок.
---

# Обработка ошибок

## Классификация ошибок

HTTPC использует `ClientError` для классификации ошибок, поддерживает `errors.As` и `errors.Is`.

### Определение типа ошибки

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("Тайм-аут запроса: %v", err)
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

### Определение возможности повторной попытки

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // Ошибку можно повторить
    log.Println("Ошибка доступна для повторной попытки")
}
```

## Предопределённые ошибки

### Сопоставление переменных ошибок

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Клиент закрыт
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Тело ответа пустое
}

if errors.Is(err, httpc.ErrInvalidURL) {
    // Неверный формат URL
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // Неверный заголовок запроса
}
```

## Повторные попытки и ошибки

Подробнее о конфигурации повторных попыток в [Повторных попытках и отказоустойчивости](../guides/retry-fault-tolerance). Здесь рассматривается обработка ошибок после исчерпания повторных попыток:

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
            log.Println("Запрос отменён (тайм-аут или ручная отмена)")
        }
    }
}
```

## Лучшие практики обработки ошибок

### 1. Разделяйте ошибки клиента и ошибки сервера

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка на сетевом уровне
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - ошибка в запросе клиента
    log.Printf("Ошибка клиента: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - сбой сервера
    log.Printf("Ошибка сервера: %d", result.StatusCode())
}
```

### 2. Используйте промежуточное ПО для унифицированной обработки

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

### 3. Многоуровневые тайм-ауты

```go
// Тайм-аут клиента по умолчанию
cfg.Timeouts.Request = 30 * time.Second

// Принудительный тайм-аут через промежуточное ПО
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// Переопределение для отдельного запроса
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// Тайм-аут контекста (наиболее точный)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## Что дальше

- [Типы ошибок API](../api-reference/errors) - справочник типов и переменных ошибок
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - конфигурация стратегии повторных попыток
- [Цепочка промежуточного ПО](../guides/middleware-chain) - унифицированная обработка ошибок через промежуточное ПО
