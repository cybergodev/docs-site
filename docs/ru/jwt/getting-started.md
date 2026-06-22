---
title: "Быстрый старт - CyberGo JWT | Введение за 5 минут"
description: "Руководство по быстрому старту CyberGo JWT: установка, создание Processor, выпуск и проверка токенов, обновление и отзыв, Claims, алгоритмы и чёрный список."
---

# Быстрый старт

## Установка

```bash
go get github.com/cybergodev/jwt
```

Требуется Go 1.25+.

## Базовое использование

### 1. Создание Processor

```go
package main

import (
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!" // HMAC минимум 32 байта
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close() // Безопасная очистка ключей
}
```

### 2. Выпуск токена

```go
claims := &jwt.Claims{
    UserID:   "user123",
    Username: "alice",
    Role:     "admin",
    Permissions: []string{"read", "write"},
}

// Токен доступа (краткосрочный)
accessToken, err := processor.Create(claims)
if err != nil {
    panic(err)
}

// Токен обновления (долгосрочный)
refreshToken, err := processor.CreateRefresh(claims)
if err != nil {
    panic(err)
}
```

### 3. Проверка токена

```go
parsed, valid, err := processor.Validate(accessToken)
if err != nil {
    // Обработка ошибок: истёк срок, недействительная подпись и т.д.
    panic(err)
}
if valid {
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Role:", parsed.Role)
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
}
```

### 4. Обновление токена

```go
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. Отзыв токена

```go
// Добавление токена в чёрный список
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// Проверка отзыва
revoked, err := processor.IsRevoked(accessToken)
if err != nil {
    panic(err)
}
fmt.Println("Revoked:", revoked) // true
```

## Алгоритмы подписи

### HMAC (симметричный ключ)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // По умолчанию
```

| Метод | Алгоритм |
|-------|----------|
| `SigningMethodHS256` | HMAC-SHA256 |
| `SigningMethodHS384` | HMAC-SHA384 |
| `SigningMethodHS512` | HMAC-SHA512 |

### RSA (асимметричный ключ)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (необязательно, по умолчанию используется SigningKey)
```

| Метод | Алгоритм |
|-------|----------|
| `SigningMethodRS256` | RSA-SHA256 |
| `SigningMethodRS384` | RSA-SHA384 |
| `SigningMethodRS512` | RSA-SHA512 |

### RSA-PSS (асимметричный ключ, рекомендуется)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (необязательно)
```

| Метод | Алгоритм |
|-------|----------|
| `SigningMethodPS256` | RSA-PSS-SHA256 |
| `SigningMethodPS384` | RSA-PSS-SHA384 |
| `SigningMethodPS512` | RSA-PSS-SHA512 |

### ECDSA (асимметричный ключ)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey (необязательно)
```

| Метод | Алгоритм |
|-------|----------|
| `SigningMethodES256` | ECDSA-SHA256 |
| `SigningMethodES384` | ECDSA-SHA384 |
| `SigningMethodES512` | ECDSA-SHA512 |

## Пользовательские Claims

Реализуйте интерфейс `CustomClaims` для определения собственной структуры Claims:

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

Использование пользовательских Claims:

```go
claims := &MyClaims{UserID: "123", Role: "admin"}

// Создание токена
token, err := processor.Create(claims)

// Проверка в пользовательскую структуру
result := &MyClaims{}
parsed, valid, err := processor.ValidateInto(token, result)

// Обновление в пользовательскую структуру
newToken, err := processor.RefreshInto(refreshToken, claims)
```

## Настройка чёрного списка

### Использование встроенного хранилища в памяти (по умолчанию)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Встроенный чёрный список уже автоматически включён
```

### Пользовательский бэкенд хранилища

Реализуйте интерфейс `BlacklistStore` (например, Redis):

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", time.Until(expiresAt)).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}

// Использование
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

## Настройка ограничения скорости

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100          // Максимальное количество запросов в окне
cfg.RateLimitWindow = time.Minute // Временное окно
```

## Обработка ошибок

```go
import "errors"

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

## Дальнейшие шаги

- [Алгоритмы подписи](./guides/signing-algorithms) — выбор алгоритма и настройка ключей
- [Пользовательские Claims](./guides/custom-claims) — определение бизнес-полей
- [Чёрный список токенов](./guides/blacklist) — отзыв и пользовательское хранилище
- [Ограничение скорости](./guides/rate-limiting) — настройка ограничения
- [Обработка ошибок](./guides/error-handling) — классификация ошибок и шаблоны обработки
- [Справочник API](./api-reference/) — полная документация API
