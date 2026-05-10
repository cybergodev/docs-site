---
title: Типы ошибок - HTTPC
description: Справочник API типов ошибок HTTPC, подробно описывающий поля и методы структуры ClientError, перечисление из двенадцати ErrorType, предопределённые переменные ошибок и примеры сопоставления errors.Is/As.
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
| `Type` | `ErrorType` | Классификация ошибки для switch |
| `Message` | `string` | Описание ошибки |
| `Cause` | `error` | Базовая ошибка, доступна через `Unwrap()` |
| `URL` | `string` | URL запроса (учётные данные маскированы) |
| `Method` | `string` | HTTP-метод (GET, POST и др.) |
| `Attempts` | `int` | Количество повторных попыток |
| `StatusCode` | `int` | HTTP-код состояния (0 для не-HTTP ошибок) |
| `Host` | `string` | Имя хоста запроса |

### Методы

| Метод | Возвращаемое значение | Описание |
|-------|---------------------|----------|
| `Error()` | `string` | Форматированная строка `METHOD URL: Message: Cause (attempt N)` |
| `Code()` | `string` | Читаемый код ошибки, например `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable()` | `bool` | Можно ли повторить попытку |
| `Unwrap()` | `error` | Распаковка базовой ошибки |
| `WithType(t ErrorType)` | `*ClientError` | Возвращает копию с установленным типом ошибки (не изменяет оригинал) |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("Тип ошибки:", clientErr.Code())
    fmt.Println("URL запроса:", clientErr.URL)
    fmt.Println("Количество повторных попыток:", clientErr.Attempts)
    fmt.Println("Можно повторить:", clientErr.IsRetryable())
    fmt.Println("Базовая ошибка:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

Перечисление классификации ошибок.

| Константа | Описание | Повторная попытка |
|-----------|----------|-----------------|
| `ErrorTypeUnknown` | Неизвестная/неклассифицированная ошибка | Нет |
| `ErrorTypeNetwork` | Сетевая ошибка (отказ соединения, сбой DNS и др.) | По обстоятельствам |
| `ErrorTypeTimeout` | Тайм-аут запроса | Да |
| `ErrorTypeContextCanceled` | Отмена контекста | Нет |
| `ErrorTypeResponseRead` | Ошибка чтения тела ответа | По обстоятельствам |
| `ErrorTypeTransport` | Ошибка транспортного уровня | Да |
| `ErrorTypeRetryExhausted` | Исчерпаны повторные попытки | Нет |
| `ErrorTypeTLS` | Ошибка TLS | Нет |
| `ErrorTypeCertificate` | Ошибка проверки сертификата | Нет |
| `ErrorTypeDNS` | Ошибка разрешения DNS | По обстоятельствам |
| `ErrorTypeValidation` | Ошибка валидации запроса | Нет |
| `ErrorTypeHTTP` | Ошибка на уровне HTTP | По обстоятельствам |

### Определение типа

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("Тайм-аут запроса")
        case httpc.ErrorTypeNetwork:
            log.Println("Сетевая ошибка")
        case httpc.ErrorTypeTLS:
            log.Println("Ошибка TLS")
        case httpc.ErrorTypeCertificate:
            log.Println("Ошибка проверки сертификата")
        case httpc.ErrorTypeDNS:
            log.Println("Сбой разрешения DNS")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("Исчерпаны повторные попытки")
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
| `ErrInvalidTimeout` | Неверное значение тайм-аута |
| `ErrInvalidRetry` | Неверная конфигурация повторных попыток |
| `ErrInvalidConnection` | Неверная конфигурация соединений |
| `ErrInvalidSecurity` | Неверная конфигурация безопасности |
| `ErrInvalidMiddleware` | Неверная конфигурация промежуточного ПО |

### Ошибки запроса

| Переменная | Описание |
|------------|----------|
| `ErrInvalidURL` | Ошибка валидации URL |
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

- [Обработка ошибок](../advanced/error-handling) - полное руководство по обработке ошибок
- [Константы и перечисления](./constants) - справочник констант BodyKind и др.
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - руководство по стратегии повторных попыток
