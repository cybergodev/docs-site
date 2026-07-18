---
sidebar_label: "Чёрный список токенов"
title: "Чёрный список - CyberGo JWT | Отзыв и хранилище"
description: "Руководство по чёрному списку CyberGo JWT: настройка хранилища в памяти и очистка, отзыв токенов через Revoke и IsRevoked, реализация BlacklistStore для Redis."
sidebar_position: 30
---

# Чёрный список токенов

Чёрный список используется для принудительной аннулиации токенов до истечения их срока действия. Применяется при выходе пользователя из системы, смене пароля, изменении прав доступа и других сценариях.

## Принцип работы

```text
Revoke(token) → извлечение jti + exp → запись в BlacklistStore
Validate(token) → проверка подписи → проверка чёрного списка → возврат результата
```

## Встроенное хранилище в памяти

По умолчанию используется хранилище в памяти, готовое к работе без настройки:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Чёрный список уже автоматически включён, используется DefaultBlacklistConfig()
```

### Параметры конфигурации

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // Интервал очистки
cfg.Blacklist.MaxSize = 100000                     // Максимальное количество записей
cfg.Blacklist.EnableAutoCleanup = true             // Автоматическая очистка
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `CleanupInterval` | `5m` | Интервал очистки просроченных записей |
| `MaxSize` | `100000` | Максимальное количество записей |
| `EnableAutoCleanup` | `true` | Автоматическая очистка (принудительно `true`) |

:::tip Автоматическая очистка
`EnableAutoCleanup` встроенного хранилища всегда принудительно установлено в `true` для предотвращения неограниченного роста памяти.
:::

## Отзыв токена

```go
// Отзыв
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// Проверка
revoked, err := processor.IsRevoked(accessToken)
fmt.Println("Revoked:", revoked) // true

// Проверка отозванного токена завершится ошибкой
_, _, err = processor.Validate(accessToken)
// err → jwt.ErrTokenRevoked
```

## Пользовательский бэкенд хранилища

Реализуйте интерфейс [`BlacklistStore`](../api-reference/interfaces#blackliststore) для подключения к внешнему хранилищу (Redis, база данных и т.д.):

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

### Пример с Redis

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // Просроченный токен не нужно хранить
    }
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", ttl).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}
```

Использование пользовательского хранилища:

```go
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

:::tip Оптимизация TTL
Используйте `time.Until(expiresAt)` в качестве Redis TTL. Токен автоматически удалится из чёрного списка после истечения срока действия без дополнительной очистки.
:::

## Рекомендации для производственной среды

:::warning Важные замечания
- Встроенное хранилище в памяти не разделяется между процессами; при развёртывании нескольких экземпляров используйте внешнее хранилище
- При достижении лимита `MaxSize` новые отзываемые токены вытесняют самые старые записи
- Реализация пользовательского хранилища должна обрабатывать сетевые тайм-ауты и повторные попытки
:::

## Дальнейшие шаги

- [Справочник API → BlacklistStore](../api-reference/interfaces#blackliststore) — определение интерфейса
- [Справочник API → BlacklistConfig](../api-reference/config#blacklistconfig) — поля конфигурации
- [Справочник API → Revoke](../api-reference/processor#revoke) — метод отзыва
- [Продвинутые примеры](../examples/advanced) — пример чёрного списка с Redis
