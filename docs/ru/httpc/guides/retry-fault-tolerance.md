---
title: "Повторы и отказоустойчивость - CyberGo HTTPC | RetryPolicy"
description: "Руководство по повторам HTTPC: экспоненциальный откат и RetryConfig, авто-повтор 408/429/5xx, пользовательский RetryPolicy и контроль повторов по запросу."
---

# Повторные попытки и отказоустойчивость

## Повторные попытки по умолчанию

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // Максимум 3 раза
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
| Ошибка таймаута | Да |
| 5xx ошибка сервера (500/502/503/504) | Да |
| 408 Request Timeout / 429 Too Many Requests | Да |
| Другие 4xx ошибки клиента | Нет |
| Отмена контекста | Нет |
| Ошибка валидации конфигурации | Нет |

## Пользовательская стратегия повторов

Реализуйте интерфейс `RetryPolicy` для полного контроля поведения повторов:

:::warning Внутренние типы
Параметр `resp` метода `RetryPolicy.ShouldRetry` имеет тип `ResponseReader` — внутренний интерфейс (определён в пакете `internal/types`), который невозможно импортировать из внешних пакетов. Пользовательский `RetryPolicy` должен быть реализован в том же модуле, что и `httpc`. Большинство сценариев покрываются конфигурацией полей `RetryConfig`.
:::

```go
// Внимание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код можно скомпилировать только внутри модуля github.com/cybergodev/httpc.
// Большинство пользователей должны настраивать повторы через RetryConfig и WithMaxRetries.

type MyRetryPolicy struct {
    maxAttempts int
}

// Определяет, следует ли повторить
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // Повторять при сетевых ошибках
    if err != nil {
        return true
    }
    // Повторять только при 502, 503, 504
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// Возвращает задержку перед повтором
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// Максимальное число повторных попыток
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// Применение пользовательской стратегии
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## Управление повторами по запросу

```go
// 5 повторных попыток для одного запроса
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Отключить повторные попытки
result, err := client.Get(url, httpc.WithMaxRetries(0))

// Совместно с таймаутом контекста
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Поддержка Retry-After

HTTPC автоматически разбирает заголовок `Retry-After`, возвращённый сервером:

```go
// Сервер возвращает: Retry-After: 120
// HTTPC будет ждать 120 секунд перед повтором вместо экспоненциальной задержки

// Сервер возвращает: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC будет ждать до указанного времени перед повтором
```

:::tip
`Retry-After` действует для всех повторяемых ответов (408, 429, 500, 502, 503, 504) и имеет приоритет над экспоненциальной задержкой.
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

### Линейное возрастание

```go
// Требуется пользовательская реализация RetryPolicy:
// delay * (attempt + 1)
// См. пример пользовательской стратегии повторов в продвинутых примерах
```

### Случайный джиттер

Включение джиттера предотвращает "эффект стада":

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
            log.Printf("Ошибка после %d повторных попыток", clientErr.Attempts)
        }
    }
    return err
}
```

## Лучшие практики

| Сценарий | Рекомендация |
|----------|-------------|
| API-вызовы | MaxRetries=3, Delay=1s, Backoff=2.0 |
| Микросервисная коммуникация | MaxRetries=2, Delay=500ms |
| Загрузка файлов | MaxRetries=5, Delay=2s, Backoff=2.0 |
| Идемпотентные операции | Можно смело повторять |
| Неидемпотентные операции (POST) | Повторять только при сетевых ошибках |

:::warning
Неидемпотентные POST-запросы по умолчанию также повторяются. Для точного управления реализуйте пользовательский `RetryPolicy`.
:::

## Что дальше

- [Обработка ошибок](../advanced/error-handling) - полное руководство по обработке ошибок
- [Конфигурация API](../api-reference/config) - справочник конфигурации повторов
- [Интерфейсы](../api-reference/interfaces) - справочник интерфейса RetryPolicy
