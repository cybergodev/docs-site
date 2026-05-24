---
title: "Config - Справочник JWT API"
description: "Справочник CyberGo JWT Config API: унифицированные параметры Config (ключи подписи, алгоритмы, TTL, Issuer) и поля BlacklistConfig с описанием, значениями по умолчанию и методами валидации."
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL    time.Duration
    RefreshTokenTTL   time.Duration
    Issuer            string
    ExpectedAudience  string

    Blacklist BlacklistConfig

    EnableRateLimit bool
    RateLimitRate   int
    RateLimitWindow time.Duration
    RateLimiter     RateLimitProvider

    Clock ClockProvider
}
```

Унифицированная конфигурация JWT Processor. Поля с нулевыми значениями автоматически заполняются значениями по умолчанию в `New()` (через `normalizeConfig`).

:::tip Правила автоматического заполнения
- `RateLimitRate` и `RateLimitWindow` заполняются только при `EnableRateLimit = true`
- `EnableAutoCleanup` встроенного хранилища чёрного списка всегда принудительно устанавливается в `true` (предотвращает неограниченный рост)
- `SecretKey`, `SigningKey`, `VerificationKey` не заполняются автоматически и должны быть установлены вручную
:::

<Badge type="info" text="struct" />

### Поля

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `SecretKey` | `string` | — | HMAC-ключ (минимум 32 байта) |
| `SigningKey` | `any` | — | Приватный ключ асимметричного алгоритма (`*rsa.PrivateKey` или `*ecdsa.PrivateKey`) |
| `VerificationKey` | `any` | — | Публичный ключ асимметричного алгоритма (необязательно, по умолчанию используется SigningKey) |
| `SigningMethod` | `SigningMethod` | `HS256` | Алгоритм подписи |
| `AccessTokenTTL` | `time.Duration` | `15m` | Срок действия токена доступа |
| `RefreshTokenTTL` | `time.Duration` | `168h` | Срок действия токена обновления |
| `Issuer` | `string` | `"jwt-service"` | Издатель |
| `ExpectedAudience` | `string` | — | Ожидаемая аудитория (необязательно) |
| `Blacklist` | `BlacklistConfig` | — | Конфигурация чёрного списка |
| `EnableRateLimit` | `bool` | `false` | Включить ограничение скорости |
| `RateLimitRate` | `int` | `100` | Максимальное количество запросов в окне |
| `RateLimitWindow` | `time.Duration` | `1m` | Окно ограничения скорости |
| `RateLimiter` | `RateLimitProvider` | — | Пользовательский ограничитель (необязательно) |
| `Clock` | `ClockProvider` | `SystemClock{}` | Провайдер часов |

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Validate` | `func (c *Config) Validate() error` | Проверяет корректность конфигурации |

Проверки `Validate()`:

| Проверка | Описание |
|----------|----------|
| Ключ подписи | HMAC требует SecretKey ≥32 байта и не слабый ключ; RSA/ECDSA требует корректный тип SigningKey; ECDSA требует совпадение кривой; VerificationKey должен соответствовать типу публичного ключа алгоритма |
| Валидность TTL | `AccessTokenTTL` и `RefreshTokenTTL` должны быть положительными |
| Порядок TTL | `AccessTokenTTL` должен быть меньше `RefreshTokenTTL` |
| Алгоритм подписи | Должен быть одним из 12 встроенных алгоритмов |
| Чёрный список | При использовании встроенного хранилища MaxSize и CleanupInterval должны быть положительными |

---

## BlacklistConfig

```go
type BlacklistConfig struct {
    CleanupInterval   time.Duration
    MaxSize           int
    EnableAutoCleanup bool
    Store             BlacklistStore
}
```

Конфигурация чёрного списка.

<Badge type="info" text="struct" />

### Поля

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `CleanupInterval` | `time.Duration` | `5m` | Интервал очистки просроченных записей (только для встроенного хранилища) |
| `MaxSize` | `int` | `100000` | Максимальное количество записей в памяти (только для встроенного хранилища) |
| `EnableAutoCleanup` | `bool` | `true` | Автоматическая очистка просроченных записей (только для встроенного хранилища) |
| `Store` | `BlacklistStore` | — | Пользовательский бэкенд хранилища (при установке остальные поля игнорируются) |
