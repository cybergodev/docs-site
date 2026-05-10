---
title: Повторные попытки и отказоустойчивость - HTTPC
description: Руководство по повторным попыткам и отказоустойчивости HTTPC, подробно описывающее стратегию повторных попыток по умолчанию, алгоритмы отката, интерфейс RetryPolicy, разбор Retry-After и примеры лучших практик.
---

# Повторные попытки и отказоустойчивость

## Повторные попытки по умолчанию

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // максимум 3 попытки
cfg.Retry.Delay = 1 * time.Second  // начальная задержка 1с
cfg.Retry.BackoffFactor = 2.0      // экспоненциальный откат 2x
cfg.Retry.EnableJitter = true      // включить джиттер

client, _ := httpc.New(cfg)
```

Последовательность задержек по умолчанию: `1с → 2с → 4с` (со случайным джиттером)

### Условия повторных попыток

По умолчанию следующие ошибки вызывают повторную попытку:

| Условие | Повторная попытка |
|---------|-----------------|
| Сетевая ошибка (отказ соединения, сбой DNS) | Да |
| Ошибка тайм-аута | Да |
| Ошибка сервера 5xx (500/502/503/504) | Да |
| 408 Request Timeout / 429 Too Many Requests | Да |
| Другие ошибки клиента 4xx | Нет |
| Отмена контекста | Нет |
| Ошибка валидации конфигурации | Нет |

## Пользовательская стратегия повторных попыток

Реализуйте интерфейс `RetryPolicy` для полного контроля поведения повторных попыток:

:::warning Внутренний тип
Параметр `resp` типа `ResponseReader` в `RetryPolicy.ShouldRetry` является внутренним интерфейсом (определён в пакете `internal/types`), на который нельзя ссылаться из внешних пакетов. Пользовательский `RetryPolicy` должен быть реализован в том же модуле, что и `httpc`. Большинство сценариев можно удовлетворить через поля `RetryConfig`.
:::

```go
// Примечание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код компилируется только внутри модуля github.com/cybergodev/httpc.
// Большинство пользователей должны настраивать повторные попытки через RetryConfig и WithMaxRetries.

type MyRetryPolicy struct {
    maxAttempts int
}

// Определяет, следует ли повторить попытку
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // Повторная попытка при сетевой ошибке
    if err != nil {
        return true
    }
    // Повторная попытка только при 502, 503, 504
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

## Управление для отдельных запросов

```go
// 5 повторных попыток для одного запроса
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Отключить повторные попытки
result, err := client.Get(url, httpc.WithMaxRetries(0))

// С тайм-аутом контекста
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Поддержка Retry-After

HTTPC автоматически разбирает заголовок ответа `Retry-After`, возвращаемый сервером:

```go
// Сервер возвращает: Retry-After: 120
// HTTPC подождёт 120 секунд перед повторной попыткой вместо использования экспоненциальной задержки

// Сервер возвращает: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC подождёт до указанного времени перед повторной попыткой
```

:::tip Совет
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

### Линейный рост

```go
// Требуется реализация пользовательского RetryPolicy:
// delay * (attempt + 1)
// См. пример пользовательской стратегии в продвинутых примерах
```

### Случайный джиттер

Включение джиттера предотвращает «эффект стада»:

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
|----------|-------------|
| API-вызовы | MaxRetries=3, Delay=1с, Backoff=2.0 |
| Микросервисная коммуникация | MaxRetries=2, Delay=500мс |
| Загрузка файлов | MaxRetries=5, Delay=2с, Backoff=2.0 |
| Идемпотентные операции | Можно смело повторять |
| Неидемпотентные операции (POST) | Повторять только при сетевых ошибках |

:::warning Предупреждение
Неидемпотентные POST-запросы по умолчанию также повторяются. Для точного контроля реализуйте пользовательский `RetryPolicy`.
:::

## Что дальше

- [Обработка ошибок](../advanced/error-handling) - полное руководство по обработке ошибок
- [Конфигурация API](../api-reference/config) - справочник конфигурации повторных попыток
- [Определения интерфейсов](../api-reference/interfaces) - справочник интерфейса RetryPolicy
