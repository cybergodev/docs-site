---
title: "Определения интерфейсов - Справочник JWT API"
description: "Справочник интерфейсов CyberGo JWT: TokenManager, CustomClaims, BlacklistStore, RateLimitProvider, ClockProvider и RateLimitKeyer."
---

# Определения интерфейсов

## TokenManager

```go
type TokenManager interface {
    Create(claims CustomClaims) (string, error)
    Validate(tokenString string) (Claims, bool, error)
    CreateRefresh(claims CustomClaims) (string, error)
    Refresh(refreshTokenString string) (string, error)
    ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
    RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
    Revoke(tokenString string) error
    IsRevoked(tokenString string) (bool, error)
    ParseUnverified(tokenString string, claims any) error
    Close() error
    IsClosed() bool
}
```

Основной интерфейс операций с JWT-токенами. Все реализации должны быть безопасны для конкурентного использования. Реализация по умолчанию — [`*Processor`](./processor).

Методы разделены на три группы по ответственности:
- **Создание токенов**: `Create`, `CreateRefresh`
- **Проверка и обновление**: `Validate`, `ValidateInto`, `Refresh`, `RefreshInto`
- **Общие операции**: `Revoke`, `IsRevoked`, `ParseUnverified`, `Close`, `IsClosed`

<Badge type="info" text="interface" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Create` | `Create(claims CustomClaims) (string, error)` | Создаёт токен доступа |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | Проверяет токен |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | Создаёт токен обновления |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | Обновляет токен |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | Проверяет в пользовательские Claims |
| `RefreshInto` | `RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)` | Обновляет в пользовательские Claims |
| `Revoke` | `Revoke(tokenString string) error` | Отзывает токен |
| `IsRevoked` | `IsRevoked(tokenString string) (bool, error)` | Проверяет, отозван ли токен |
| `ParseUnverified` | `ParseUnverified(tokenString string, claims any) error` | Парсит без проверки |
| `Close` | `Close() error` | Освобождает ресурсы |
| `IsClosed` | `IsClosed() bool` | Проверяет, закрыт ли Processor |

### Типы реализации

| Тип | Описание |
|-----|----------|
| `*Processor` | Реализация по умолчанию |

---

## CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

Интерфейс пользовательских Claims. Используется в методах [`Create`](./processor#create), [`ValidateInto`](./processor#validateinto), [`RefreshInto`](./processor#refreshinto) и других.

<Badge type="info" text="interface" />

### Контракт валидации

Processor выполняет разные пути валидации для `*Claims` и других типов:

| Тип | Поведение при валидации |
|-----|------------------------|
| `*Claims` | Глубокая валидация: все поля (ограничение длины, инъекционные паттерны, управляющие символы) |
| Другие типы | Вызывается `Validate()` + очистка строк зарегистрированных утверждений (Issuer, Subject, ID, Audience) |

:::warning Внимание
Для типов, отличных от `*Claims`, поля пользовательской структуры **не** проходят глубокую валидацию. Разработчики должны самостоятельно проверять все бизнес-поля в методе `Validate()`.
:::

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `GetRegisteredClaims` | `GetRegisteredClaims() *RegisteredClaims` | Возвращает стандартные JWT-поля |
| `Validate` | `Validate() error` | Пользовательская логика валидации |

### Типы реализации

| Тип | Описание |
|-----|----------|
| `*Claims` | Встроенная реализация Claims |

---

## BlacklistStore

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

Интерфейс бэкенда хранилища чёрного списка.

<Badge type="info" text="interface" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Add` | `Add(tokenID string, expiresAt time.Time) error` | Добавляет в чёрный список |
| `Contains` | `Contains(tokenID string) (bool, error)` | Проверяет наличие в чёрном списке |
| `Close` | `Close() error` | Освобождает ресурсы |

---

## RateLimitProvider

```go
type RateLimitProvider interface {
    Allow(key string) bool
    AllowN(key string, n int) bool
    Reset(key string)
    Close()
}
```

Интерфейс ограничения скорости.

<Badge type="info" text="interface" />

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Allow` | `Allow(key string) bool` | Проверяет, разрешён ли один запрос |
| `AllowN` | `AllowN(key string, n int) bool` | Проверяет, разрешены ли n запросов |
| `Reset` | `Reset(key string)` | Сбрасывает состояние ограничения для указанного key |
| `Close` | `Close()` | Освобождает ресурсы |

### Типы реализации

| Тип | Описание |
|-----|----------|
| `*RateLimiter` | Встроенная реализация на основе корзины токенов |

---

## ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

Интерфейс часов для внедрения времени (сценарии тестирования).

<Badge type="info" text="interface" />

### Типы реализации

| Тип | Описание |
|-----|----------|
| `SystemClock` | Системные часы |
| `FixedClock` | Часы с фиксированным временем |

---

## RateLimitKeyer

```go
type RateLimitKeyer interface {
    RateLimitKey() string
}
```

Необязательный интерфейс. Пользовательские Claims могут реализовать его для предоставления ключа ограничения скорости. Приоритет поиска ключа ограничения: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

<Badge type="info" text="interface" />
