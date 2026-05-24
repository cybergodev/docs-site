---
title: "Claims - Справочник JWT API"
description: "Справочник CyberGo JWT Claims API: встроенные бизнес-утверждения Claims (UserID, Username, Role и другие), стандартные утверждения RegisteredClaims RFC 7519 и ограничения глубокой валидации."
---

# Claims

## Claims

```go
type Claims struct {
    UserID      string         `json:"user_id,omitempty"`
    Username    string         `json:"username,omitempty"`
    Role        string         `json:"role,omitempty"`
    Permissions []string       `json:"permissions,omitempty"`
    Scopes      []string       `json:"scopes,omitempty"`
    Extra       map[string]any `json:"extra,omitempty"`
    SessionID   string         `json:"session_id,omitempty"`
    ClientID    string         `json:"client_id,omitempty"`
    RegisteredClaims
}
```

Встроенная структура Claims с распространёнными бизнес-полями и стандартными JWT-полями.

<Badge type="info" text="struct" />

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `UserID` | `string` | ID пользователя |
| `Username` | `string` | Имя пользователя |
| `Role` | `string` | Роль |
| `Permissions` | `[]string` | Список разрешений |
| `Scopes` | `[]string` | Список областей действия |
| `Extra` | `map[string]any` | Пользовательские расширенные поля |
| `SessionID` | `string` | ID сессии |
| `ClientID` | `string` | ID клиента |
| `RegisteredClaims` | `RegisteredClaims` | Стандартные JWT-поля |

### Правила валидации

Метод `Validate()` проверяет, что хотя бы одно из полей `UserID` или `Username` не пустое.

Processor выполняет дополнительную глубокую валидацию при создании и проверке токена (через внутреннюю функцию `validateClaims`):

| Правило | Ограничение |
|---------|-------------|
| Длина строковых полей | Максимум 256 символов |
| Размер массивов | Максимум 100 элементов |
| Количество полей `Extra` | Максимум 50 ключей |
| Тип значений `Extra` | Допускаются только `string` и `[]string`, вложенные map и другие типы отклоняются |
| Управляющие символы | Отклоняются все, кроме tab, перевода строки и возврата каретки |
| Обнаружение инъекционных паттернов | Отклоняются паттерны HTML/SQL/обхода пути |

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `GetRegisteredClaims` | `func (c *Claims) GetRegisteredClaims() *RegisteredClaims` | Возвращает встроенные стандартные поля |
| `Validate` | `func (c *Claims) Validate() error` | Проверяет, что хотя бы одно из полей UserID или Username не пустое |

---

## RegisteredClaims

```go
type RegisteredClaims struct {
    Issuer    string        `json:"iss,omitempty"`
    Subject   string        `json:"sub,omitempty"`
    Audience  StringOrSlice `json:"aud,omitempty"`
    ExpiresAt NumericDate   `json:"exp"`
    NotBefore NumericDate   `json:"nbf"`
    IssuedAt  NumericDate   `json:"iat"`
    ID        string        `json:"jti,omitempty"`
}
```

Стандартные зарегистрированные утверждения JWT (RFC 7519).

<Badge type="info" text="struct" />

### Поля

| Поле | Тип | JSON-тег | Описание |
|------|-----|----------|----------|
| `Issuer` | `string` | `iss` | Издатель |
| `Subject` | `string` | `sub` | Тема |
| `Audience` | `StringOrSlice` | `aud` | Аудитория |
| `ExpiresAt` | `NumericDate` | `exp` | Время истечения |
| `NotBefore` | `NumericDate` | `nbf` | Время начала действия |
| `IssuedAt` | `NumericDate` | `iat` | Время выдачи |
| `ID` | `string` | `jti` | ID токена |
