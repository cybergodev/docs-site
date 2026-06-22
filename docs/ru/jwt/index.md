---
title: "Аутентификация - CyberGo JWT | Токены для продакшена"
description: "CyberGo JWT — Go-библиотека JWT продакшен-уровня: 12 алгоритмов HMAC, RSA, RSA-PSS и ECDSA, выпуск, проверка, обновление и отзыв токенов, чёрный список и лимит."
---

# JWT - Библиотека аутентификации производственного уровня

CyberGo JWT — это высокопроизводительная библиотека аутентификации JWT для языка Go, предоставляющая полное решение для создания, проверки, обновления и отзыва токенов.

## Возможности

- **Поддержка нескольких алгоритмов** — HMAC (HS256/384/512), RSA (RS256/384/512), RSA-PSS (PS256/384/512), ECDSA (ES256/384/512)
- **Жизненный цикл токена** — создание, проверка, обновление, отзыв в одном месте
- **Пользовательские Claims** — поддержка произвольных бизнес-полей через интерфейс `CustomClaims`
- **Управление чёрным списком** — встроенное хранилище в памяти, поддержка пользовательских бэкендов, таких как Redis
- **Ограничение скорости** — алгоритм корзины токенов для защиты от перебора
- **Валидация входных данных** — ограничение длины полей, обнаружение инъекционных паттернов, фильтрация управляющих символов
- **Внедрение часов** — интерфейс `ClockProvider` для сценариев тестирования
- **Безопасность при конкурентном доступе** — все экспортируемые методы безопасны для конкурентного вызова
- **Отсутствие утечки конфиденциальных данных** — `Close()` безопасно очищает ключи

## Установка

```bash
go get github.com/cybergodev/jwt
```

## Быстрый старт

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    // 1. Создание конфигурации
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    // 2. Создание Processor
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 3. Выпуск токена
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 4. Проверка токена
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## Обзор архитектуры

```text
┌────────────────────────────────────────────────┐
│                  Processor                      │
│  (implements TokenManager interface)            │
├────────────────────────────────────────────────┤
│  Create / Validate / Refresh / Revoke          │
│  CreateRefresh / ValidateInto / RefreshInto    │
│  ParseUnverified / IsRevoked / IsClosed / Close│
├──────────────────┬─────────────────────────────┤
│  BlacklistManager│     RateLimiter              │
│  (optional)      │     (optional)               │
├──────────────────┴─────────────────────────────┤
│                Config                           │
│  SigningMethod / TTL / Blacklist / Limit       │
└────────────────────────────────────────────────┘
```

## Дальнейшие шаги

- [Быстрый старт](./getting-started) — подробное руководство по установке и настройке
- [Алгоритмы подписи](./guides/signing-algorithms) — руководство по выбору HMAC, RSA, ECDSA
- [Пользовательские Claims](./guides/custom-claims) — определение бизнес-полей
- [Справочник API](./api-reference/) — полная документация API
- [Базовые примеры](./examples/basic) — примеры HMAC, пар токенов, проверки
