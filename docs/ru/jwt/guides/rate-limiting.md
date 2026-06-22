---
title: "Лимит запросов - CyberGo JWT | Корзина токенов"
description: "Лимиты запросов CyberGo JWT: настройка корзины токенов для ограничения запросов, приоритет ключей Subject, UserID и RateLimitKeyer, свой RateLimitProvider."
---

# Ограничение скорости

Ограничение скорости используется для предотвращения злоупотребления интерфейсом выпуска токенов (например, перебора).

## Принцип работы

Используется алгоритм корзины токенов, ограничивающий максимальное количество запросов для каждого ключа в указанном временном окне.

```text
Create(claims) → извлечение ключа ограничения → проверка RateLimitProvider → разрешить/отклонить
```

## Конфигурация

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100              // Максимальное количество запросов в окне
cfg.RateLimitWindow = time.Minute    // Временное окно
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `EnableRateLimit` | `false` | Включить ограничение скорости |
| `RateLimitRate` | `100` | Максимальное количество запросов в окне |
| `RateLimitWindow` | `1m` | Временное окно |

:::tip Примечание
Ограничение скорости действует на все методы выпуска токенов: `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()`. Не влияет на `Validate()` и `ValidateInto()`.
:::

## Ключ ограничения

Ограничение скорости изолировано по ключам. Приоритет поиска ключа:

1. `RegisteredClaims.Subject` — если не пустой
2. `*Claims.UserID` — только для встроенных Claims
3. `RateLimitKey()` — если реализован интерфейс `RateLimitKeyer`
4. Пустая строка — проверка ограничения пропускается

### Пользовательский ключ ограничения

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// Реализация интерфейса RateLimitKeyer
func (c *MyClaims) RateLimitKey() string {
    return c.Email
}
```

## Встроенный RateLimiter

Используйте `NewRateLimiter` для создания независимого ограничителя:

```go
limiter := jwt.NewRateLimiter(100, time.Minute)

if limiter.Allow("user:123") {
    // Разрешено
} else {
    // Отклонено
}

limiter.Reset("user:123") // Сброс счётчика
defer limiter.Close()
```

## Пользовательский ограничитель

Реализуйте интерфейс [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider):

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

:::tip Об AllowN
Сам интерфейс определяет только единичную проверку `Allow`. Метод пакетной проверки `AllowN(key string, n int) bool` — метод расширения конкретного типа [`*RateLimiter`](../api-reference/types#ratelimiter), не входящий в этот интерфейс.
:::

Например, подключение к Redis для распределённого ограничения:

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

## Превышение ограничения

При превышении порога ограничения методы выпуска токенов (`Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()`) возвращают `ErrRateLimitExceeded`:

```go
token, err := processor.Create(claims)
if errors.Is(err, jwt.ErrRateLimitExceeded) {
    // Обработка ограничения: возврат 429 Too Many Requests
}
```

## Дальнейшие шаги

- [Справочник API → RateLimitProvider](../api-reference/interfaces#ratelimitprovider) — определение интерфейса
- [Справочник API → RateLimiter](../api-reference/types#ratelimiter) — встроенная реализация
- [Базовые примеры](../examples/basic) — пример ограничения скорости
