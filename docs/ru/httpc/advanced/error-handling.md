---
title: Обработка ошибок - HTTPC
description: "Полное руководство по обработке ошибок HTTPC. Подробное описание системы классификации ошибок с двенадцатью типами ErrorType, все поля и применение структуры ClientError, сопоставление сигнальных ошибок через errors.Is и лучшие практики обработки сетевых таймаутов, сертификатов TLS и ошибок разрешения DNS"
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
            log.Printf("Ошибка разрешения DNS: %v", err)
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

### Проверка возможности повторной попытки

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // Ошибку можно повторить
    log.Println("Ошибка с возможностью повторной попытки, повторяем позже")
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
    // Неверный формат URL
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // Неверный заголовок запроса
}
```

## Повторные попытки и ошибки

Подробнее о конфигурации повторных попыток см. в [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance). Здесь рассматривается обработка ошибок после исчерпания повторных попыток:

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Ошибка после %d попыток", clientErr.Attempts)
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

### 1. Различайте клиентские и серверные ошибки

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка на сетевом уровне
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - Ошибка в запросе клиента
    log.Printf("Клиентская ошибка: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - Сбой на стороне сервера
    log.Printf("Серверная ошибка: %d", result.StatusCode())
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

### 3. Многоуровневые таймауты

```go
// Таймаут клиента по умолчанию
cfg.Timeouts.Request = 30 * time.Second

// Принудительный таймаут через промежуточное ПО
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// Переопределение для отдельного запроса
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// Таймаут контекста (наиболее точный)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## Что дальше

- [Типы ошибок API](../api-reference/errors) - справочник типов ошибок и переменных
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - конфигурация стратегий повторных попыток
- [Цепочка промежуточного ПО](../guides/middleware-chain) - использование промежуточного ПО для унифицированной обработки ошибок
