---
sidebar_label: "Processor"
title: "Processor - CyberGo JWT | Операции с токенами"
description: "Processor — основной тип CyberGo JWT: методы Create, Validate, Refresh, Revoke, IsRevoked, ParseUnverified и Close с сигнатурами, параметрами и примерами."
sidebar_position: 20
---

# Processor

Processor — основной тип для операций JWT, реализующий интерфейс [`TokenManager`](./interfaces#tokenmanager). Все методы безопасны для конкурентного использования.

Экземпляр создаётся через [`jwt.New(cfg)`](./functions#new).

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

Создаёт новый JWT-токен доступа. Принимает любой тип, реализующий интерфейс `CustomClaims`.



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `claims` | `CustomClaims` | Утверждения токена |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `token` | `string` | Подписанная JWT-строка |
| `err` | `error` | Ошибка при неудачной валидации или подписи |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrInvalidClaims` | Валидация Claims не удалась |
| `ErrRateLimitExceeded` | Превышен порог ограничения скорости |

### Пример

```go
// Встроенные Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// Пользовательские Claims
myClaims := &MyClaims{UserID: "123"}
token, err := processor.Create(myClaims)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

Проверяет JWT-токен доступа и возвращает разобранные Claims.



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `tokenString` | `string` | JWT-строка |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `claims` | `Claims` | Разобранные утверждения (копия значения) |
| `valid` | `bool` | Действителен ли токен |
| `err` | `error` | Ошибка при неудачной проверке |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrInvalidToken` | Подпись недействительна |
| `ErrAlgorithmMismatch` | Алгоритм токена не совпадает с конфигурацией |
| `ErrExpirationRequired` | `RequireExpiration` включён, но в токене отсутствует утверждение `exp` |
| `ErrTokenExpired` | Токен истёк |
| `ErrTokenNotValidYet` | Токен ещё не действителен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenRevoked` | Токен отозван |
| `ErrInvalidClaims` | Валидация Claims не удалась |

### Пример

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    // Обработка ошибки
    return
}
if valid {
    fmt.Println(claims.UserID)
}
```

---

## CreateRefresh

```go
func (p *Processor) CreateRefresh(claims CustomClaims) (string, error)
```

Создаёт токен обновления с использованием `RefreshTokenTTL` вместо `AccessTokenTTL`.



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `claims` | `CustomClaims` | Утверждения токена |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `token` | `string` | Подписанный токен обновления |
| `err` | `error` | Ошибка при неудачной валидации или подписи |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrInvalidClaims` | Валидация Claims не удалась |
| `ErrRateLimitExceeded` | Превышен порог ограничения скорости |

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

Обновляет существующий токен обновления и возвращает новый токен доступа. Токен обновления полностью проверяется (подпись, срок действия, чёрный список) перед выдачей нового токена доступа; поля `IssuedAt`, `ExpiresAt` и `ID` исходного токена сбрасываются и генерируются заново.

:::info Тип токена и ротация
- **Проверка типа токена**: Токены с `token_type=access` отклоняются (возвращается [`ErrTokenTypeMismatch`](./errors#сигнальные-ошибки)), чтобы предотвратить использование токенов доступа для получения новых токенов; старые токены без `token_type` по-прежнему принимаются для обратной совместимости.
- **Не отзывает исходный токен автоматически**: `Refresh` не отзывает переданный токен обновления. Исходный токен остаётся действительным до истечения срока или явного отзыва через [`Revoke()`](#revoke). Для семантики одноразового использования вызовите `Revoke(refreshTokenString)` после успешного `Refresh`.
:::

:::warning Замечание по безопасности
При обновлении проверяются только стандартные JWT-поля (exp, nbf, iss, aud, чёрный список) и базовая структурная валидность (наличие UserID или Username). Глубокие ограничения полей (лимит длины, инъекционные паттерны) не перепроверяются, так как они уже были проверены при создании.
:::



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `refreshTokenString` | `string` | Токен обновления |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `token` | `string` | Новый токен доступа |
| `err` | `error` | Ошибка при неудачной проверке |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrInvalidToken` | Подпись недействительна |
| `ErrAlgorithmMismatch` | Алгоритм токена не совпадает с конфигурацией |
| `ErrExpirationRequired` | `RequireExpiration` включён, но в токене отсутствует утверждение `exp` |
| `ErrTokenExpired` | Токен истёк |
| `ErrTokenNotValidYet` | Токен ещё не действителен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenRevoked` | Токен отозван |
| `ErrInvalidClaims` | Валидация Claims не удалась |
| `ErrTokenTypeMismatch` | Обновление токеном доступа (`token_type=access`) |
| `ErrRateLimitExceeded` | Превышен порог ограничения скорости |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

Проверяет токен и заполняет пользовательскую структуру Claims. Возвращает тот же указатель, что и переданный `claims`.



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `tokenString` | `string` | JWT-строка |
| `claims` | `CustomClaims` | Целевой указатель Claims |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `claims` | `CustomClaims` | Заполненные Claims |
| `valid` | `bool` | Действителен ли токен |
| `err` | `error` | Ошибка при неудачной проверке |

### Пример

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}
```

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrInvalidToken` | Подпись недействительна |
| `ErrAlgorithmMismatch` | Алгоритм токена не совпадает с конфигурацией |
| `ErrExpirationRequired` | `RequireExpiration` включён, но в токене отсутствует утверждение `exp` |
| `ErrTokenExpired` | Токен истёк |
| `ErrTokenNotValidYet` | Токен ещё не действителен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenRevoked` | Токен отозван |
| `ErrInvalidClaims` | Валидация Claims не удалась |

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

Обновляет токен с использованием пользовательских Claims. Временные поля объекта Claims (`IssuedAt`, `ExpiresAt`, `ID`) автоматически восстанавливаются после операции, даже в случае ошибки или panic.

:::info Проверка типа токена
Токены с `token_type=access` отклоняются (возвращается [`ErrTokenTypeMismatch`](./errors#сигнальные-ошибки)), чтобы предотвратить использование токенов доступа для получения новых токенов; старые токены без `token_type` по-прежнему принимаются для обратной совместимости.
:::

:::warning Замечание по безопасности
При обновлении проверяются только стандартные JWT-поля (exp, nbf, iss, aud, чёрный список) и базовая структурная валидность. Глубокие ограничения полей (лимит длины, инъекционные паттерны) не перепроверяются, так как они уже были проверены при создании.
:::



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `refreshTokenString` | `string` | Токен обновления |
| `claims` | `CustomClaims` | Целевой указатель Claims |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `token` | `string` | Новый токен доступа |
| `err` | `error` | Ошибка при неудачной проверке |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrInvalidToken` | Подпись недействительна |
| `ErrAlgorithmMismatch` | Алгоритм токена не совпадает с конфигурацией |
| `ErrExpirationRequired` | `RequireExpiration` включён, но в токене отсутствует утверждение `exp` |
| `ErrTokenExpired` | Токен истёк |
| `ErrTokenNotValidYet` | Токен ещё не действителен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenRevoked` | Токен отозван |
| `ErrInvalidClaims` | Валидация Claims не удалась |
| `ErrTokenTypeMismatch` | Обновление токеном доступа (`token_type=access`) |
| `ErrRateLimitExceeded` | Превышен порог ограничения скорости |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

Добавляет токен в чёрный список, проверяя подпись и извлекая ID токена (jti). Только токены с действительной подписью могут быть отозваны, что предотвращает добавление злоумышленниками произвольных ID токенов в чёрный список.

:::info Поведение TTL
- Утверждение `exp` токена определяет TTL записи в чёрном списке
- Токены без `exp` по умолчанию получают TTL 7 дней
- TTL ограничен 30 днями, чтобы предотвратить блокировку памяти подделанными чрезмерно большими значениями `exp` (защита от DoS)
- Истёкшие токены также могут быть отозваны; запись автоматически очищается чёрным списком
:::



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `tokenString` | `string` | Токен для отзыва |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `err` | `error` | Ошибка при неудачном отзыве |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrBlacklistNotConfigured` | Чёрный список не настроен |
| `ErrInvalidToken` | Недействительная подпись или некорректный токен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenMissingID` | В токене отсутствует утверждение `jti` |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

Проверяет, был ли токен отозван. После проверки подписи выполняется поиск статуса jti токена в чёрном списке. Если чёрный список не настроен, возвращает `false` и ошибку `nil`.



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `tokenString` | `string` | JWT-строка |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `revoked` | `bool` | Отозван ли токен |
| `err` | `error` | Ошибка при неудачном запросе |

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| `ErrInvalidToken` | Недействительная подпись или некорректный токен |
| `ErrTokenInvalidIssuer` | Издатель не совпадает |
| `ErrTokenInvalidAudience` | Аудитория не совпадает |
| `ErrTokenMissingID` | В токене отсутствует утверждение `jti` |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

Разбирает токен без проверки подписи. Подходит для извлечения информации из Claims, когда доверие к токену не требуется.

:::danger Предупреждение
Возвращаемые Claims не проверены и **не могут быть доверенными**. Используйте только для отладки или логирования.
:::



### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `tokenString` | `string` | JWT-строка |
| `claims` | `any` | Целевой указатель Claims |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `err` | `error` | Ошибка при неудачном разборе |

### Ошибки

| Ошибка | Условие |
|--------|---------|
| `ErrProcessorClosed` | Processor закрыт |
| `ErrEmptyToken` | Токен пуст |
| Обёрнутая ошибка | Возвращает обёрнутую ошибку разбора для некорректных токенов (не является сигнальной ошибкой; не может быть сопоставлена через `errors.Is`) |

---

## Close

```go
func (p *Processor) Close() error
```

Освобождает ресурсы и безопасно очищает ключи. Может вызываться многократно, последующие вызовы возвращают `ErrProcessorClosed`.



### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `err` | `error` | Ошибка при неудачном закрытии |

---

## IsClosed

```go
func (p *Processor) IsClosed() bool
```

Проверяет, закрыт ли Processor.



### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `closed` | `bool` | Закрыт ли Processor |
