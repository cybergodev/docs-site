---
title: "Ошибки - Справочник JWT API"
description: "Справочник ошибок CyberGo JWT: 17 сигнальных ошибок (ErrTokenExpired, ErrTokenRevoked и другие), тип ValidationError и шаблон сопоставления ошибок errors.Is()."
---

# Ошибки

## Сигнальные ошибки

Все ошибки проверяются с помощью `errors.Is()`:

```go
var (
    ErrInvalidConfig        = errors.New("invalid configuration")
    ErrInvalidSecretKey     = errors.New("invalid secret key")
    ErrInvalidSigningMethod = errors.New("invalid signing method")

    ErrInvalidToken          = errors.New("invalid token")
    ErrEmptyToken            = errors.New("empty token")
    ErrAlgorithmMismatch     = errors.New("token algorithm does not match configured signing method")
    ErrTokenRevoked          = errors.New("token revoked")
    ErrTokenMissingID        = errors.New("token missing ID")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("store closed")
)
```

### Обзор ошибок

| Ошибка | Описание | Проверка через `errors.Is()` |
|--------|----------|------------------------------|
| `ErrInvalidConfig` | Недопустимая конфигурация | `Config.Validate()` |
| `ErrInvalidSecretKey` | Недействительный ключ | `New()` |
| `ErrInvalidSigningMethod` | Недействительный метод подписи | `New()` |
| `ErrInvalidToken` | Недействительный токен (ошибка подписи и т.д.) | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrEmptyToken` | Пустой токен | Все методы операций с токенами |
| `ErrAlgorithmMismatch` | Алгоритм токена не совпадает с конфигурацией | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenRevoked` | Токен отозван | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenMissingID` | В токене отсутствует ID | `IsRevoked()` |
| `ErrTokenExpired` | Токен истёк | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenNotValidYet` | Токен ещё не действителен | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenInvalidIssuer` | Издатель не совпадает | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenInvalidAudience` | Аудитория не совпадает | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrInvalidClaims` | Валидация Claims не удалась | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrRateLimitExceeded` | Превышено ограничение скорости | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` |
| `ErrBlacklistNotConfigured` | Чёрный список не настроен | `Revoke()` |
| `ErrProcessorClosed` | Processor закрыт | Все методы |
| `ErrStoreClosed` | Хранилище закрыто | `Revoke()` и другие |

### Классификация по сценариям

#### Этап конфигурации

| Ошибка | Вызывающий метод | Типичная причина |
|--------|-----------------|------------------|
| `ErrInvalidConfig` | `New()` | Несколько недопустимых параметров конфигурации |
| `ErrInvalidSecretKey` | `New()` | HMAC-ключ менее 32 байт или слабый ключ |
| `ErrInvalidSigningMethod` | `New()` | Не входит в число 12 встроенных алгоритмов |

#### Проверка токенов

| Ошибка | Вызывающий метод | Типичная причина |
|--------|-----------------|------------------|
| `ErrEmptyToken` | Все методы операций с токенами | Передана пустая строка |
| `ErrInvalidToken` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Подпись не совпадает или формат ошибочен |
| `ErrAlgorithmMismatch` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Алгоритм в заголовке токена не совпадает с конфигурацией |
| `ErrTokenExpired` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Превышено время `exp` |
| `ErrTokenNotValidYet` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Ещё не наступило время `nbf` |
| `ErrTokenInvalidIssuer` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `iss` не совпадает с `Config.Issuer` |
| `ErrTokenInvalidAudience` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `aud` не совпадает с `Config.ExpectedAudience` |
| `ErrTokenRevoked` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Токен находится в чёрном списке |
| `ErrInvalidClaims` | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Бизнес-валидация не удалась |
| `ErrTokenMissingID` | `IsRevoked()` | В токене отсутствует поле `jti` |

#### Ограничение скорости и чёрный список

| Ошибка | Вызывающий метод | Типичная причина |
|--------|-----------------|------------------|
| `ErrRateLimitExceeded` | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` | Превышен лимит запросов в окне |
| `ErrBlacklistNotConfigured` | `Revoke()` | Хранилище чёрного списка не настроено |
| `ErrTokenMissingID` | `IsRevoked()` | В токене отсутствует поле `jti` |

#### Жизненный цикл

| Ошибка | Вызывающий метод | Типичная причина |
|--------|-----------------|------------------|
| `ErrProcessorClosed` | Все методы | Продолжение работы после вызова `Close()` |
| `ErrStoreClosed` | `Revoke()` и другие | Хранилище чёрного списка закрыто |

---

## Шаблон обработки ошибок

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Токен истёк — направить пользователя на обновление
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Токен отозван — отказать в доступе
    case errors.Is(err, jwt.ErrInvalidToken):
        // Подпись недействительна — отказать в доступе
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Системная ошибка — Processor закрыт
    default:
        // Неизвестная ошибка
    }
}
```

---

## Тип ошибки

### ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

Ошибка неудачной валидации на уровне поля. Подробности в разделе [Типы и константы → ValidationError](./types#validationerror).
