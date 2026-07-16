---
sidebar_label: "Обработка ошибок"
title: "Обработка ошибок - CyberGo HTTPC | Типы и сигналы"
description: "Руководство по обработке ошибок HTTPC: классы ErrorType, ClientError и IsRetryable, сопоставление сигналов errors.Is/As, исчерпание повторов и таймауты."
sidebar_position: 2
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
            log.Printf("Повторные попытки исчерпаны: %v", err)
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
    log.Println("Повторяемая ошибка, попробуйте позже")
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

if errors.Is(err, httpc.ErrInvalidHeader) {
    // Некорректный заголовок запроса
}
```

## Повторные попытки и ошибки

Подробная конфигурация повторов описана в [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance), здесь рассматривается обработка ошибок после исчерпания повторных попыток:

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Ошибка после %d повторных попыток", clientErr.Attempts)
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

### 1. Разделяйте ошибки клиента и сервера

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

// Принудительный таймаут промежуточного ПО
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// Переопределение для отдельного запроса
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// Таймаут контекста (наиболее точный)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## Что дальше

- [Типы ошибок API](../api-reference/types/errors) - справочник типов и переменных ошибок
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - конфигурация стратегии повторов
- [Цепочки промежуточного ПО](../guides/middleware-chain) - единая обработка ошибок через промежуточное ПО
