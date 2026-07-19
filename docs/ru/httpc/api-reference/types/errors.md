---
sidebar_label: "Типы ошибок"
title: "Типы ошибок - CyberGo HTTPC | Детали ClientError"
description: "Справочник API типов ошибок HTTPC: поля и методы ClientError, двенадцать категорий ErrorType, переменные-сигналы и примеры сопоставления errors.Is/As."
sidebar_position: 3
---

# Типы ошибок

## ClientError

```go
type ClientError = engine.ClientError
```

Классифицированная ошибка HTTP-клиента, извлекается через `errors.As`.

### Поля структуры

```go
type ClientError struct {
    Type       ErrorType  // Классификация ошибки
    Message    string     // Описание ошибки
    Cause      error      // Базовая ошибка
    URL        string     // URL запроса (маскировано)
    Method     string     // HTTP-метод
    Attempts   int        // Количество попыток
    StatusCode int        // HTTP-код состояния (если применимо)
    Host       string     // Имя хоста (для размыкателя цепи)
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| Type | `ErrorType` | Классификация ошибки для switch |
| Message | `string` | Описание ошибки |
| Cause | `error` | Базовая ошибка, доступна через `Unwrap()` |
| `URL` | `string` | URL запроса (учётные данные маскированы) |
| `Method` | `string` | HTTP-метод (GET, POST и др.) |
| `Attempts` | `int` | Количество попыток (включая первый запрос) |
| `StatusCode` | `int` | HTTP-код состояния (0 для не-HTTP ошибок) |
| Host | `string` | Имя хоста запроса |

### Методы

| Метод | Возвращаемое значение | Описание |
|-------|----------------------|----------|
| `Error()` | `string` | Формат `METHOD URL: Message: Cause (attempt N)` |
| `Code()` | `string` | Читаемый код ошибки, например `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable()` | `bool` | Можно ли повторить |
| `Unwrap()` | `error` | Распаковка базовой ошибки |
| `WithType(t ErrorType)` | `*ClientError` | Возвращает копию с установленным типом ошибки (без изменения оригинала) |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("Тип ошибки:", clientErr.Code())
    fmt.Println("URL запроса:", clientErr.URL)
    fmt.Println("Количество повторных попыток:", clientErr.Attempts)
    fmt.Println("Повторяемая:", clientErr.IsRetryable())
    fmt.Println("Базовая ошибка:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

Перечисление классификации ошибок.

| Константа | Описание | Повторяемая |
|-----------|----------|-------------|
| `ErrorTypeUnknown` | Неизвестная/неклассифицированная ошибка | Нет |
| `ErrorTypeNetwork` | Сетевая ошибка (отказ соединения, сброс соединения и др.) | По обстоятельствам |
| `ErrorTypeTimeout` | Таймаут запроса | По обстоятельствам¹ |
| `ErrorTypeContextCanceled` | Отмена контекста | Нет |
| `ErrorTypeResponseRead` | Ошибка чтения тела ответа | По обстоятельствам |
| `ErrorTypeTransport` | Ошибка транспортного уровня | Да |
| `ErrorTypeRetryExhausted` | Повторные попытки исчерпаны | Нет |
| `ErrorTypeTLS` | Ошибка TLS | Нет |
| `ErrorTypeCertificate` | Ошибка проверки сертификата | Нет |
| `ErrorTypeDNS` | Ошибка разрешения DNS | По обстоятельствам |
| `ErrorTypeValidation` | Ошибка валидации запроса | Нет |
| `ErrorTypeHTTP` | Ошибка на уровне HTTP | По обстоятельствам |

> ¹ Таймауты, вызванные дедлайном контекста (`WithTimeout`, `TimeoutConfig.Request`), **не** повторяются; повторяются только таймауты транспортного уровня (например, таймаут `net.OpError`).

### Определение типа

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("Таймаут запроса")
        case httpc.ErrorTypeNetwork:
            log.Println("Сетевая ошибка")
        case httpc.ErrorTypeTLS:
            log.Println("Ошибка TLS")
        case httpc.ErrorTypeCertificate:
            log.Println("Ошибка проверки сертификата")
        case httpc.ErrorTypeDNS:
            log.Println("Сбой разрешения DNS")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("Повторные попытки исчерпаны")
        case httpc.ErrorTypeContextCanceled:
            log.Println("Запрос отменён")
        case httpc.ErrorTypeValidation:
            log.Println("Ошибка валидации запроса")
        }
    }
}
```

## Переменные ошибок

### Ошибки конфигурации

| Переменная | Описание |
|------------|----------|
| `ErrNilConfig` | Конфигурация равна nil |
| `ErrInvalidTimeout` | Некорректное значение таймаута |
| `ErrInvalidRetry` | Некорректная конфигурация повторов |
| `ErrInvalidConnection` | Некорректная конфигурация соединений |
| `ErrInvalidSecurity` | Некорректная конфигурация безопасности |
| `ErrInvalidMiddleware` | Некорректная конфигурация промежуточного ПО |

### Ошибки запроса

| Переменная | Описание |
|------------|----------|
| `ErrInvalidHeader` | Ошибка валидации заголовков запроса |

### Ошибки ответа

| Переменная | Описание |
|------------|----------|
| `ErrResponseBodyEmpty` | Тело ответа пустое |
| `ErrResponseBodyTooLarge` | Тело ответа превышает лимит размера |

### Ошибки файлов

| Переменная | Описание |
|------------|----------|
| `ErrEmptyFilePath` | Путь к файлу пустой |
| `ErrFileExists` | Файл уже существует |

### Ошибки клиента

| Переменная | Описание |
|------------|----------|
| `ErrClientClosed` | Клиент закрыт |

### Сопоставление переменных

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Клиент закрыт
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Тело ответа пустое
}
```

## См. также

- [Обработка ошибок](../../advanced/error-handling) - полное руководство по обработке ошибок
- [Константы и перечисления](./constants) - справочник констант BodyKind и др.
- [Повторные попытки и отказоустойчивость](../../guides/retry-fault-tolerance) - руководство по стратегии повторов
