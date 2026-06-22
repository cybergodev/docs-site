---
title: "Функции пакета - CyberGo JWT | Фабрики и умолчания"
description: "Справочник функций пакета CyberGo JWT: New создаёт и валидирует Processor, DefaultConfig и DefaultBlacklistConfig, NewNumericDate, NewRateLimiter с умолчаниями."
---

# Функции пакета

## New

```go
func New(cfg Config) (*Processor, error)
```

Создаёт новый JWT Processor. Используйте `DefaultConfig()` для получения конфигурации по умолчанию, измените необходимые поля и передайте в функцию.

<Badge type="tip" text="v1.0.0+" />

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `cfg` | `Config` | Конфигурация |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `processor` | `*Processor` | JWT-обработчик |
| `err` | `error` | Ошибка при неудачной валидации конфигурации |

### Пример

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    fmt.Println("Processor created successfully")
}
```

### Ошибки

| Ошибка | Условие возникновения |
|--------|----------------------|
| `ErrInvalidConfig` | Недопустимая конфигурация |
| `ErrInvalidSecretKey` | Ключ отсутствует, менее 32 байт, слабый ключ, неверный тип или несоответствие кривой ECDSA |
| `ErrInvalidSigningMethod` | Неподдерживаемый алгоритм подписи |

---

## DefaultConfig

```go
func DefaultConfig() Config
```

Возвращает конфигурацию с разумными значениями по умолчанию.

<Badge type="tip" text="v1.0.0+" />

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `config` | `Config` | Конфигурация по умолчанию |

### Значения по умолчанию

| Поле | Значение по умолчанию |
|------|----------------------|
| `AccessTokenTTL` | `15 * time.Minute` |
| `RefreshTokenTTL` | `7 * 24 * time.Hour` |
| `Issuer` | `"jwt-service"` |
| `SigningMethod` | `SigningMethodHS256` |
| `RateLimitRate` | `100` |
| `RateLimitWindow` | `time.Minute` |
| `Blacklist` | `DefaultBlacklistConfig()` |

### Пример

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Измените остальные поля при необходимости
```

---

## DefaultBlacklistConfig

```go
func DefaultBlacklistConfig() BlacklistConfig
```

Возвращает конфигурацию чёрного списка с разумными значениями по умолчанию.

<Badge type="tip" text="v1.0.0+" />

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `config` | `BlacklistConfig` | Конфигурация чёрного списка по умолчанию |

### Значения по умолчанию

| Поле | Значение по умолчанию |
|------|----------------------|
| `CleanupInterval` | `5 * time.Minute` |
| `MaxSize` | `100000` |
| `EnableAutoCleanup` | `true` |

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

Создаёт `NumericDate` из `time.Time`.

<Badge type="tip" text="v1.0.0+" />

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `t` | `time.Time` | Значение времени |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `date` | `NumericDate` | Числовая дата JWT |

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

Создаёт ограничитель скорости на основе алгоритма корзины токенов.

<Badge type="tip" text="v1.0.0+" />

### Параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `maxRate` | `int` | Максимальное количество запросов в окне (при ≤0 по умолчанию 100) |
| `window` | `time.Duration` | Временное окно (при ≤0 по умолчанию 1 минута) |

### Возвращаемые значения

| Возврат | Тип | Описание |
|---------|-----|----------|
| `limiter` | `*RateLimiter` | Экземпляр ограничителя |
