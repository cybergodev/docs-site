---
title: Типы ошибок - HTTPC
description: "Полный справочник API типов ошибок HTTPC, подробное описание всех полей и методов структуры классифицированных ошибок ClientError, определения двенадцати констант перечисления ErrorType, списка сторожевых ошибок и примеров кода с использованием шаблонов сопоставления errors.Is и errors.As"
---

# Типы ошибок

## ClientError

```go
type ClientError = engine.ClientError
```

Классифицированная ошибка HTTP-клиента, извлекаемая через `errors.As`.

### Поля структуры

```go
type ClientError struct {
    Type       ErrorType  // Классификация ошибки
    Message    string     // Описание ошибки
    Cause      error      // Базовая ошибка
    URL        string     // URL запроса (маскированный)
    Method     string     // HTTP метод
    Attempts   int        // Количество попыток
    StatusCode int        // HTTP код состояния (если применимо)
    Host       string     // Имя хоста (для автоматического выключателя)
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `Type` | `ErrorType` | Классификация ошибки, используется для switch |
| `Message` | `string` | Описание ошибки |
| `Cause` | `error` | Базовая ошибка, доступна через `Unwrap()` |
| `URL` | `string` | URL запроса (учётные данные маскированы) |
| `Method` | `string` | HTTP метод (GET, POST и т.д.) |
| `Attempts` | `int` | Количество повторных попыток |
| `StatusCode` | `int` | HTTP код состояния (0 для не-HTTP ошибок) |
| `Host` | `string` | Имя хоста запроса |

### Методы

| Метод | Возвращаемое значение | Описание |
|-------|----------------------|----------|
| `Error()` | `string` | Форматируется как `METHOD URL: Message: Cause (attempt N)` |
| `Code()` | `string` | Читаемый код ошибки, например `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable()` | `bool` | Можно ли повторить попытку |
| `Unwrap()` | `error` | Распаковка базовой ошибки |
| `WithType(t ErrorType)` | `*ClientError` | Возвращает копию с установленным типом ошибки (не изменяет оригинал) |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("Тип ошибки:", clientErr.Code())
    fmt.Println("URL запроса:", clientErr.URL)
    fmt.Println("Количество попыток:", clientErr.Attempts)
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
|-----------|----------|-------------------|
| `ErrorTypeUnknown` | Неизвестная/неклассифицированная ошибка | Нет |
| `ErrorTypeNetwork` | Сетевая ошибка (отказ соединения, сбой DNS и т.д.) | По обстоятельствам |
| `ErrorTypeTimeout` | Тайм-аут запроса | Да |
| `ErrorTypeContextCanceled` | Отмена контекста | Нет |
| `ErrorTypeResponseRead` | Ошибка чтения тела ответа | По обстоятельствам |
| `ErrorTypeTransport` | Ошибка транспортного уровня | Да |
| `ErrorTypeRetryExhausted` | Исчерпание повторных попыток | Нет |
| `ErrorTypeTLS` | Ошибка TLS | Нет |
| `ErrorTypeCertificate` | Ошибка проверки сертификата | Нет |
| `ErrorTypeDNS` | Ошибка разрешения DNS | По обстоятельствам |
| `ErrorTypeValidation` | Ошибка проверки запроса | Нет |
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
            log.Println("Исчерпание повторных попыток")
        case httpc.ErrorTypeContextCanceled:
            log.Println("Запрос отменён")
        case httpc.ErrorTypeValidation:
            log.Println("Ошибка проверки запроса")
        }
    }
}
```

## Переменные ошибок

### Ошибки конфигурации

| Переменная | Описание |
|------------|----------|
| `ErrNilConfig` | Конфигурация равна nil |
| `ErrInvalidTimeout` | Недопустимое значение тайм-аута |
| `ErrInvalidRetry` | Недопустимая конфигурация повторных попыток |
| `ErrInvalidConnection` | Недопустимая конфигурация соединения |
| `ErrInvalidSecurity` | Недопустимая конфигурация безопасности |
| `ErrInvalidMiddleware` | Недопустимая конфигурация промежуточного ПО |

### Ошибки запроса

| Переменная | Описание |
|------------|----------|
| `ErrInvalidURL` | Ошибка проверки URL |
| `ErrInvalidHeader` | Ошибка проверки заголовка запроса |

### Ошибки ответа

| Переменная | Описание |
|------------|----------|
| `ErrResponseBodyEmpty` | Тело ответа пустое |
| `ErrResponseBodyTooLarge` | Тело ответа превышает ограничение размера |

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

## Смотрите также

- [Обработка ошибок](../advanced/error-handling) - Полное руководство по обработке ошибок
- [Константы и перечисления](./constants) - Справочник констант BodyKind и других
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - Руководство по стратегии повторных попыток
