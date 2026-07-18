---
sidebar_label: "Пользовательские Claims"
title: "Custom Claims - CyberGo JWT | Бизнес-утверждения"
description: "Custom Claims в CyberGo JWT: реализация интерфейса CustomClaims для бизнес-полей, сравнение валидации и разбор ValidateInto и RefreshInto с примерами."
sidebar_position: 20
---

# Пользовательские Claims

Встроенная структура [`Claims`](../api-reference/claims#claims) покрывает типичные сценарии, но бизнес-системам часто требуются дополнительные поля. Через реализацию интерфейса `CustomClaims` можно определить собственную структуру Claims.

## Интерфейс CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

Необходимо реализовать только два метода:

| Метод | Описание |
|-------|----------|
| `GetRegisteredClaims()` | Возвращает стандартные JWT-поля (iss, sub, aud и т.д.) |
| `Validate()` | Пользовательская логика валидации |

## Определение пользовательских Claims

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
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
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}
```

:::tip Ключевые моменты
- Необходимо встроить `jwt.RegisteredClaims`
- `GetRegisteredClaims()` должен возвращать указатель на встроенное поле
- `Validate()` вызывается как при создании, так и при проверке токена
:::

## Использование пользовательских Claims

### Создание токена

```go
claims := &MyClaims{
    UserID: "user123",
    Email:  "alice@example.com",
    Role:   "admin",
}
token, err := processor.Create(claims)
```

### Проверка в пользовательскую структуру

Используйте `ValidateInto` для разбора токена в пользовательскую структуру:

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(token, myClaims)
if err != nil {
    panic(err)
}
if valid {
    parsed := result.(*MyClaims)
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Email:", parsed.Email)
}
```

### Обновление в пользовательскую структуру

Используйте `RefreshInto` для обновления токена с сохранением пользовательских полей:

```go
newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
if err != nil {
    panic(err)
}
```

:::warning Защита временных полей
`RefreshInto` автоматически восстанавливает временные поля Claims (`IssuedAt`, `ExpiresAt`, `ID`), даже в случае неудачной операции.
:::

## Различия в валидации

Встроенные `*Claims` и пользовательские типы проходят разные пути валидации:

| Проверка | `*Claims` | Пользовательский тип |
|----------|-----------|---------------------|
| Метод `Validate()` | ✅ | ✅ |
| Ограничение длины строк (256 символов) | ✅ | ❌ |
| Ограничение размера массивов (100 элементов) | ✅ | ❌ |
| Обнаружение инъекционных паттернов | ✅ | ❌ |
| Фильтрация управляющих символов | ✅ | ❌ |
| Ограничения полей `Extra` | ✅ | Неприменимо |
| Очистка строк зарегистрированных утверждений | ✅ | ✅ |

:::warning Важно
Бизнес-поля пользовательских Claims **не** проходят глубокую валидацию. Пожалуйста, реализуйте все необходимые проверки в методе `Validate()`.
:::

## Дополнительный интерфейс: RateLimitKeyer

Пользовательские Claims могут реализовать интерфейс `RateLimitKeyer` для предоставления ключа ограничения скорости:

```go
func (c *MyClaims) RateLimitKey() string {
    return c.Email // Использование Email в качестве ключа ограничения
}
```

Приоритет поиска ключа ограничения: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

## Дальнейшие шаги

- [Справочник API → Определения интерфейсов](../api-reference/interfaces#customclaims) — полное определение CustomClaims
- [Справочник API → Processor](../api-reference/processor#validateinto) — методы ValidateInto / RefreshInto
- [Продвинутые примеры](../examples/advanced) — полный пример пользовательских Claims
