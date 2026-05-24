---
title: "Типы и константы - Справочник JWT API"
description: "Справочник типов и констант CyberGo JWT: NumericDate, StringOrSlice, SigningMethod, ValidationError, RateLimiter, SystemClock, FixedClock и 12 констант алгоритмов подписи."
---

# Типы и константы

## NumericDate

```go
type NumericDate struct {
    time.Time
}
```

Числовое значение даты JWT (Unix-временная метка). Допустимый диапазон от 0 до 253402300799 (9999-12-31 23:59:59 UTC).

<Badge type="info" text="struct" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `MarshalJSON` | `func (date *NumericDate) MarshalJSON() ([]byte, error)` | Сериализует в JSON-число Unix-временной метки; для нулевого времени или при выходе за допустимый диапазон возвращает `null` |
| `UnmarshalJSON` | `func (date *NumericDate) UnmarshalJSON(b []byte) error` | Парсит Unix-временную метку из JSON-числа или строки; отклоняет отрицательные значения и значения вне допустимого диапазона |

---

## StringOrSlice

```go
type StringOrSlice []string
```

Тип, десериализуемый из JSON-строки или массива строк, соответствует RFC 7519 §4.1.3.

<Badge type="info" text="type" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `UnmarshalJSON` | `func (s *StringOrSlice) UnmarshalJSON(b []byte) error` | Парсит из строки или массива |

---

## SigningMethod

```go
type SigningMethod string
```

Тип алгоритма подписи.

<Badge type="info" text="type" />

---

## ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

Ошибка неудачной валидации на уровне поля.

<Badge type="info" text="struct" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *ValidationError) Error() string` | Сообщение об ошибке |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | Распаковывает внутреннюю ошибку |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

Ограничитель скорости на основе алгоритма корзины токенов, реализует интерфейс [`RateLimitProvider`](./interfaces#ratelimitprovider).

<Badge type="info" text="struct" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Allow` | `func (rl *RateLimiter) Allow(key string) bool` | Проверяет один запрос |
| `AllowN` | `func (rl *RateLimiter) AllowN(key string, n int) bool` | Проверяет n запросов |
| `Reset` | `func (rl *RateLimiter) Reset(key string)` | Сбрасывает указанный key |
| `Close` | `func (rl *RateLimiter) Close()` | Освобождает ресурсы |

---

## SystemClock

```go
type SystemClock struct{}
```

Системные часы, реализация [`ClockProvider`](./interfaces#clockprovider) по умолчанию.

<Badge type="info" text="struct" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Now` | `func (SystemClock) Now() time.Time` | Возвращает текущее системное время |

---

## FixedClock

```go
type FixedClock struct {
    T time.Time
}
```

Часы с фиксированным временем для тестирования.

<Badge type="info" text="struct" />

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `T` | `time.Time` | Фиксированное значение времени |

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Now` | `func (c FixedClock) Now() time.Time` | Возвращает фиксированное время |

---

## Константы алгоритмов подписи

```go
const (
    SigningMethodHS256 SigningMethod = "HS256"
    SigningMethodHS384 SigningMethod = "HS384"
    SigningMethodHS512 SigningMethod = "HS512"

    SigningMethodRS256 SigningMethod = "RS256"
    SigningMethodRS384 SigningMethod = "RS384"
    SigningMethodRS512 SigningMethod = "RS512"

    SigningMethodPS256 SigningMethod = "PS256"
    SigningMethodPS384 SigningMethod = "PS384"
    SigningMethodPS512 SigningMethod = "PS512"

    SigningMethodES256 SigningMethod = "ES256"
    SigningMethodES384 SigningMethod = "ES384"
    SigningMethodES512 SigningMethod = "ES512"
)
```

| Константа | Значение | Алгоритм | Тип |
|-----------|----------|----------|-----|
| `SigningMethodHS256` | `"HS256"` | HMAC-SHA256 | Симметричный |
| `SigningMethodHS384` | `"HS384"` | HMAC-SHA384 | Симметричный |
| `SigningMethodHS512` | `"HS512"` | HMAC-SHA512 | Симметричный |
| `SigningMethodRS256` | `"RS256"` | RSA-SHA256 | Асимметричный |
| `SigningMethodRS384` | `"RS384"` | RSA-SHA384 | Асимметричный |
| `SigningMethodRS512` | `"RS512"` | RSA-SHA512 | Асимметричный |
| `SigningMethodPS256` | `"PS256"` | RSA-PSS-SHA256 | Асимметричный |
| `SigningMethodPS384` | `"PS384"` | RSA-PSS-SHA384 | Асимметричный |
| `SigningMethodPS512` | `"PS512"` | RSA-PSS-SHA512 | Асимметричный |
| `SigningMethodES256` | `"ES256"` | ECDSA-SHA256 | Асимметричный |
| `SigningMethodES384` | `"ES384"` | ECDSA-SHA384 | Асимметричный |
| `SigningMethodES512` | `"ES512"` | ECDSA-SHA512 | Асимметричный |
