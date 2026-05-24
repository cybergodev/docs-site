---
title: "Обработка ошибок - JWT"
description: "Руководство CyberGo JWT по обработке ошибок: классификация 17 сигнальных ошибок, шаблон сопоставления errors.Is(), тип ValidationError и лучшие практики обработки ошибок в веб-сервисах."
---

# Обработка ошибок

CyberGo JWT использует паттерн сигнальных ошибок (sentinel errors). Все ошибки проверяются через `errors.Is()`.

## Базовый шаблон

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Токен истёк
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Токен отозван
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // Издатель не совпадает
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // Аудитория не совпадает
    case errors.Is(err, jwt.ErrInvalidToken):
        // Подпись недействительна или формат ошибочен
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor закрыт
    default:
        // Другие ошибки
    }
}
```

:::tip Используйте errors.Is()
Не используйте `err == jwt.ErrTokenExpired` или сопоставление строк. `errors.Is()` корректно обрабатывает обёрнутые ошибки.
:::

## Классификация ошибок

### Этап конфигурации

`jwt.New()` может возвращать следующие ошибки:

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `ErrInvalidConfig` | Несколько недопустимых параметров | Проверьте все поля Config |
| `ErrInvalidSecretKey` | HMAC-ключ менее 32 байт или слабый ключ | Используйте более надёжный ключ |
| `ErrInvalidSigningMethod` | Неподдерживаемый алгоритм подписи | Используйте один из 12 встроенных алгоритмов |

### Операции с токенами

| Ошибка | Методы | Рекомендации по обработке |
|--------|--------|--------------------------|
| `ErrEmptyToken` | Все методы операций с токенами | Проверьте заголовок запроса |
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto | Подпись не совпадает, отказать в доступе |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | Алгоритм токена не совпадает с конфигурацией, отказать в доступе |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | Направить пользователя на обновление токена |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | Проверьте синхронизацию часов |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto | Аудитория не совпадает |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | Токен отозван, отказать в доступе |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | Бизнес-валидация не удалась |
| `ErrTokenMissingID` | IsRevoked | В токене отсутствует jti |

### Ограничение скорости и чёрный список

| Ошибка | Методы | Рекомендации по обработке |
|--------|--------|--------------------------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | Вернуть 429 |
| `ErrBlacklistNotConfigured` | Revoke | Настройте чёрный список |

### Жизненный цикл

| Ошибка | Методы | Рекомендации по обработке |
|--------|--------|--------------------------|
| `ErrProcessorClosed` | Все методы | Создайте Processor заново |
| `ErrStoreClosed` | Revoke и другие | Хранилище закрыто |

## Тип ошибки

### ValidationError

Возвращается при неудачной валидации на уровне поля, содержит конкретное поле и информацию об ошибке:

```go
type ValidationError struct {
    Field   string  // Имя поля с ошибкой
    Message string  // Описание ошибки
    Err     error   // Внутренняя ошибка
}
```

## Обработка ошибок в веб-сервисе

```go
func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, valid, err := processor.Validate(tokenString)
    if err != nil {
        switch {
        case errors.Is(err, jwt.ErrTokenExpired):
            http.Error(w, "token expired", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrTokenRevoked):
            http.Error(w, "token revoked", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrInvalidToken):
            http.Error(w, "invalid token", http.StatusUnauthorized)
        default:
            http.Error(w, "auth failed", http.StatusUnauthorized)
        }
        return
    }
    if !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }
    // Обработка запроса
}
```

## Дальнейшие шаги

- [Справочник API → Ошибки](../api-reference/errors) — полный список ошибок
- [Справочник API → Типы](../api-reference/types#validationerror) — определение типа ошибки
