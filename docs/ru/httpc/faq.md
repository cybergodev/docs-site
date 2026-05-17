---
title: Часто задаваемые вопросы - HTTPC
description: Часто задаваемые вопросы HTTPC — выбор функций на уровне пакета, сравнение предустановленных конфигураций, настройка прокси, сопоставление ошибок, управление пулом объектов и настройка таймаутов.
---

# Часто задаваемые вопросы

## Когда использовать функции на уровне пакета, а когда создавать клиент?

**Функции на уровне пакета** подходят для простых сценариев: одноразовые запросы, скрипты, утилиты.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Создание клиента** подходит для сценариев, требующих пользовательской конфигурации, повторного использования пула соединений и использования middleware.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## Как выбрать предустановку конфигурации?

| Предустановка | Сценарий использования |
|------|----------|
| `DefaultConfig()` | Универсальные сценарии, безопасные значения по умолчанию |
| `SecureConfig()` | Обработка URL от пользователей, финансовые/медицинские сценарии |
| `PerformanceConfig()` | Внутренняя коммуникация микросервисов, высоконагруженные API |
| `TestingConfig()` | Модульное тестирование, локальная разработка |
| `MinimalConfig()` | Одноразовые скрипты, простые HTTP-вызовы |

## Как получить доступ к внутренним сервисам?

По умолчанию защита от SSRF блокирует подключения к приватным IP. Для доступа к внутренним сервисам:

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // Разрешить все приватные IP

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

HTTPC не считает 4xx/5xx ошибками, проверку нужно выполнять вручную:

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка на сетевом уровне
    return err
}

switch {
case result.IsSuccess():
    // 2xx успешно
case result.IsClientError():
    // 4xx ошибка клиента
    log.Printf("Ошибка параметров запроса: %d", result.StatusCode())
case result.IsServerError():
    // 5xx ошибка сервера
    log.Printf("Сбой сервера: %d", result.StatusCode())
}
```

## Зачем нужно вызывать ReleaseResult?

`ReleaseResult` возвращает Result в пул объектов, снижая нагрузку на GC. При возврате тело ответа полностью обнуляется для предотвращения утечки конфиденциальных данных в пуле объектов. В сценариях с высокой параллельной нагрузкой наблюдается значительное улучшение производительности.

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// После этого больше не обращайтесь к result
```

## Как отключить повторные попытки?

```go
// Глобальное отключение
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// Или использование MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// Отключение для отдельного запроса
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## Как установить таймаут запроса?

Четыре способа, в порядке убывания приоритета:

```go
// 1. Таймаут контекста (рекомендуется)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. Параметр запроса
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. Принудительный таймаут через middleware
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. Таймаут клиента по умолчанию
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

## Почему TestingConfig выводит предупреждение?

`TestingConfig` отключает функции безопасности (проверка TLS, защита от SSRF). Использование в не-тестовой среде представляет риск безопасности. При обнаружении не-тестовой среды выводится предупреждение.

Используйте только в файлах `*_test.go` или для локальной разработки.

## Как включить DNS-over-HTTPS?

DoH может снизить задержку DNS-резолвинга и предотвратить перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

По умолчанию используются три провайдера: Cloudflare, Google и AliDNS (с переключением по приоритету). Если все провайдеры DoH недоступны, происходит автоматический возврат к системному DNS.

:::tip Совет
DoH подходит для сценариев, где требуется повышенная безопасность DNS-резолвинга. Для обычных API-вызовов включать не обязательно — стандартного DNS достаточно.
:::

## Дополнительные ресурсы

- [Быстрый старт](./getting-started) - Быстрое начало за 5 минут
- [Практическое руководство](./guides/tutorial) - Полный пошаговый пример
- [API конфигурации](./api-reference/config) - Полный справочник конфигурации
- [Обработка ошибок](./advanced/error-handling) - Руководство по обработке ошибок
