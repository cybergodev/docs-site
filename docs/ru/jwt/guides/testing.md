---
sidebar_label: "Тестирование и внедрение часов"
title: "Тестирование - CyberGo JWT | Фиксированные часы"
description: "Руководство по тестированию CyberGo JWT: внедрение FixedClock через ClockProvider для контроля времени в модульных тестах, проверка срока, обновления и отзыва."
sidebar_position: 60
---

# Тестирование и внедрение часов

Через интерфейс `ClockProvider` можно внедрить пользовательские часы для точного контроля времени в тестах.

## Интерфейс ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

Библиотека предоставляет две реализации:

| Тип | Описание |
|-----|----------|
| `SystemClock` | По умолчанию, использует системное время |
| `FixedClock` | Фиксированное время для тестирования |

## FixedClock

`FixedClock` всегда возвращает время, указанное при конструировании:

```go
fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Clock = jwt.FixedClock{T: fixedTime}
```

## Тестирование истечения токена

```go
func TestTokenExpiry(t *testing.T) {
    // Установка фиксированного времени
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // Выпуск токена в момент now
    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // Проверка в текущий момент → успех
    _, valid, err := processor.Validate(token)
    require.NoError(t, err)
    assert.True(t, valid)

    // Имитация прошествия времени после истечения → используем новый Processor
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, _, err = expiredProcessor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## Тестирование потока обновления

```go
func TestRefreshFlow(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    refreshToken, err := processor.CreateRefresh(claims)
    require.NoError(t, err)

    // Получение нового токена доступа через токен обновления
    newToken, err := processor.Refresh(refreshToken)
    require.NoError(t, err)
    assert.NotEmpty(t, newToken)
}
```

## Тестирование пользовательских Claims

```go
func TestCustomClaims(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "test@example.com",
    }

    token, err := processor.Create(claims)
    require.NoError(t, err)

    result := &MyClaims{}
    parsed, valid, err := processor.ValidateInto(token, result)
    require.NoError(t, err)
    assert.True(t, valid)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## Тестирование обработки ошибок

```go
func TestRevokeToken(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // Отзыв токена
    err = processor.Revoke(token)
    require.NoError(t, err)

    // Проверка должна завершиться ошибкой
    _, _, err = processor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## Лучшие практики

:::tip Рекомендации по тестированию
- Используйте `FixedClock` для обеспечения воспроизводимости тестов
- Создавайте независимый Processor для каждого теста
- Используйте `t.Cleanup()` или `defer` для гарантии вызова `Close()`
- При проверке ошибок используйте `errors.Is()` вместо сопоставления строк
:::

## Дальнейшие шаги

- [Справочник API → ClockProvider](../api-reference/interfaces#clockprovider) — интерфейс часов
- [Справочник API → FixedClock](../api-reference/types#fixedclock) — часы с фиксированным временем
- [Продвинутые примеры](../examples/advanced) — пример внедрения часов
