---
title: Часто задаваемые вопросы - HTTPC
description: Часто задаваемые вопросы HTTPC, охватывающие выбор функций уровня пакета, сравнение предустановок конфигурации, настройку прокси, сопоставление ошибок, управление пулом объектов и настройку тайм-аутов.
---

# Часто задаваемые вопросы

## Когда использовать функции уровня пакета, а когда создавать клиент?

**Функции уровня пакета** подходят для простых сценариев: одноразовые запросы, скрипты, утилиты.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Создание клиента** подходит, когда нужна пользовательская конфигурация, повторное использование пула соединений или использование промежуточного ПО.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## Как выбрать предустановку конфигурации?

| Предустановка | Сценарий использования |
|---------------|----------------------|
| `DefaultConfig()` | Общие сценарии, безопасные значения по умолчанию |
| `SecureConfig()` | Обработка пользовательских URL, финансовые/медицинские сценарии |
| `PerformanceConfig()` | Внутренняя микросервисная коммуникация, высоконагруженные API |
| `TestingConfig()` | Модульные тесты, локальная разработка |
| `MinimalConfig()` | Одноразовые скрипты, простые HTTP-вызовы |

## Как получить доступ к внутренним сервисам?

По умолчанию защита от SSRF блокирует подключения к приватным IP. Для доступа к внутренним сервисам:

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // разрешить все приватные IP

// Или точечное исключение
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## Как настроить прокси?

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// Использование системного прокси
cfg.Connection.EnableSystemProxy = true
```

## Как обрабатывать HTTP-коды ошибок?

HTTPC не считает 4xx/5xx ошибкой `error`, необходимо проверять вручную:

```go
result, err := client.Get(url)
if err != nil {
    // ошибка на сетевом уровне
    return err
}

switch {
case result.IsSuccess():
    // 2xx успех
case result.IsClientError():
    // 4xx ошибка клиента
    log.Printf("ошибка в параметрах запроса: %d", result.StatusCode())
case result.IsServerError():
    // 5xx ошибка сервера
    log.Printf("сбой сервера: %d", result.StatusCode())
}
```

## Зачем нужно вызывать ReleaseResult?

`ReleaseResult` возвращает Result в пул объектов, снижая нагрузку на GC. При возврате очищаются конфиденциальные данные в теле ответа (первые 64 КБ), предотвращая утечку информации через пул объектов. В высоконагруженных сценариях это значительно повышает производительность.

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// после этого не обращайтесь к result
```

## Как отключить повторные попытки?

```go
// Глобальное отключение
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// Или используйте MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// Отключение для отдельного запроса
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## Как установить тайм-аут запроса?

Четыре способа, от высшего приоритета к низшему:

```go
// 1. Тайм-аут контекста (рекомендуется)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. Параметр запроса
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. Принудительный тайм-аут через middleware
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. Тайм-аут клиента по умолчанию
cfg.Timeouts.Request = 30 * time.Second
```

## Как логировать запросы?

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## Почему TestingConfig выводит предупреждения?

`TestingConfig` отключает функции безопасности (проверку TLS, защиту от SSRF), что представляет риск безопасности при использовании вне тестовой среды. При обнаружении не-тестовой среды выводится предупреждение.

Используйте только в файлах `*_test.go` или для локальной разработки.

## Как включить DNS-over-HTTPS?

DoH может снизить задержку разрешения DNS и предотвратить перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

По умолчанию используются три провайдера: Cloudflare, Google и AliDNS (с откатом по приоритету). Если все провайдеры DoH недоступны, автоматически выполняется откат к системному DNS.

:::tip Совет
DoH подходит для сценариев, требующих безопасности разрешения DNS. Для обычных API-вызовов включать не обязательно — стандартного DNS достаточно.
:::

## Дополнительные ресурсы

- [Быстрый старт](./getting-started) - быстрое начало за 5 минут
- [Практическое руководство](./guides/tutorial) - пошаговый полный пример
- [Конфигурация API](./api-reference/config) - полный справочник конфигурации
- [Обработка ошибок](./advanced/error-handling) - руководство по обработке ошибок
