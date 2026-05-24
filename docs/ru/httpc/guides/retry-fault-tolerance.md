---
title: "Повторные попытки и отказоустойчивость — HTTPC"
description: "Руководство по повторным попыткам и отказоустойчивости HTTPC: стратегия повторных попыток по умолчанию с экспоненциальной задержкой, конфигурация RetryConfig, условия автоматического повтора для 408/429/5xx, пользовательский интерфейс RetryPolicy (с ограничениями внутренних типов), автоматический разбор заголовка Retry-After, выбор стратегии отката и управление через WithMaxRetries."
---

# Повторные попытки и отказоустойчивость

## Повторные попытки по умолчанию

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // Максимум 3 попытки
cfg.Retry.Delay = 1 * time.Second  // Начальная задержка 1s
cfg.Retry.BackoffFactor = 2.0      // Экспоненциальный откат 2x
cfg.Retry.EnableJitter = true      // Включить джиттер

client, _ := httpc.New(cfg)
```

Последовательность задержек по умолчанию: `1s → 2s → 4s` (со случайным джиттером)

### Условия повторных попыток

По умолчанию следующие ошибки вызывают повторную попытку:

| Условие | Повтор |
|---------|--------|
| Сетевая ошибка (отказ соединения, сбой DNS) | Да |
| Таймаут запроса | Да |
| Серверная ошибка 5xx (500/502/503/504) | Да |
| 408 Request Timeout / 429 Too Many Requests | Да |
| Другие клиентские ошибки 4xx | Нет |
| Отмена контекста | Нет |
| Ошибка валидации конфигурации | Нет |

## Пользовательская стратегия повторных попыток

Реализуйте интерфейс `RetryPolicy` для полного контроля поведения повторных попыток:

:::warning Предупреждение Внутренние типы
Тип параметра `resp` метода `RetryPolicy.ShouldRetry` — `ResponseReader`, который является внутренним интерфейсом (определён в пакете `internal/types`), недоступным для прямого импорта внешними пакетами. Пользовательский `RetryPolicy` должен быть реализован в пакете того же модуля, что и `httpc`. Для большинства сценариев достаточно настройки через поля `RetryConfig`.
:::

```go
// Внимание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код компилируется только внутри модуля github.com/cybergodev/httpc.
// Большинству пользователей следует настраивать повторные попытки через RetryConfig и WithMaxRetries.

type MyRetryPolicy struct {
    maxAttempts int
}

// Определяет, следует ли повторить попытку
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // Повтор при сетевой ошибке
    if err != nil {
        return true
    }
    // Повтор только для 502, 503, 504
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// Возвращает задержку перед повторной попыткой
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// Максимальное количество повторных попыток
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// Применение пользовательской стратегии
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## Управление на уровне запроса

```go
// 5 повторных попыток для одного запроса
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Отключить повторные попытки
result, err := client.Get(url, httpc.WithMaxRetries(0))

// С таймаутом контекста
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Поддержка Retry-After

HTTPC автоматически разбирает заголовок ответа `Retry-After` от сервера:

```go
// Сервер возвращает: Retry-After: 120
// HTTPC будет ждать 120 секунд перед повторной попыткой вместо задержки с экспоненциальным откатом

// Сервер возвращает: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC будет ждать до указанного времени перед повторной попыткой
```

:::tip Совет
`Retry-After` действует для всех повторяемых ответов (408, 429, 500, 502, 503, 504) и имеет приоритет над задержкой экспоненциального отката.
:::

## Стратегии отката

### Экспоненциальный откат

```go
cfg.Retry.BackoffFactor = 2.0
// Последовательность задержек: delay, delay*2, delay*4, delay*8...
```

### Фиксированная задержка

```go
cfg.Retry.BackoffFactor = 1.0
// Последовательность задержек: delay, delay, delay...
```

### Линейный рост

```go
// Требуется реализация пользовательского RetryPolicy:
// delay * (attempt + 1)
// См. пример пользовательской стратегии в продвинутых примерах
```

### Случайный джиттер

Включение джиттера предотвращает «эффект стадона»:

```go
cfg.Retry.EnableJitter = true
// Добавляет случайное смещение к базовой задержке, предотвращая одновременные повторные попытки всех клиентов
```

## Обработка ошибок и повторные попытки

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Не удалось после %d повторных попыток", clientErr.Attempts)
        }
    }
    return err
}
```

## Лучшие практики

| Сценарий | Рекомендация |
|----------|--------------|
| API-вызовы | MaxRetries=3, Delay=1s, Backoff=2.0 |
| Коммуникация микросервисов | MaxRetries=2, Delay=500ms |
| Загрузка файлов | MaxRetries=5, Delay=2s, Backoff=2.0 |
| Идемпотентные операции | Можно смело повторять |
| Неидемпотентные операции (POST) | Повторять только при сетевых ошибках |

:::warning Предупреждение
Неидемпотентные POST-запросы также повторяются по умолчанию. Для точного управления реализуйте пользовательский `RetryPolicy`.
:::

## Что дальше

- [Обработка ошибок](../advanced/error-handling) — полное руководство по обработке ошибок
- [Конфигурация API](../api-reference/config) — справочник настройки повторных попыток
- [Определения интерфейсов](../api-reference/interfaces) — справочник интерфейса RetryPolicy
