---
title: "Часто задаваемые вопросы — HTTPC"
description: "Часто задаваемые вопросы HTTPC: выбор между функциями уровня пакета и экземпляром клиента, сравнение пяти предустановленных конфигураций, настройка HTTP/SOCKS5 прокси и DoH, сопоставление ошибок через errors.Is/As, управление пулом объектов ReleaseResult и настройка четырёхуровневых таймаутов."
---

# Часто задаваемые вопросы

## Когда использовать функции уровня пакета, а когда создавать клиент?

**Функции уровня пакета** подходят для простых сценариев: одноразовые запросы, скрипты, утилиты.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Создание клиента** подходит, когда нужна пользовательская конфигурация, повторное использование пула соединений или промежуточное ПО.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## Как выбрать предустановку конфигурации?

| Предустановка | Сценарий применения |
|---------------|---------------------|
| `DefaultConfig()` | Общие сценарии, безопасные значения по умолчанию |
| `SecureConfig()` | Обработка пользовательских URL, финансовые/медицинские сценарии |
| `PerformanceConfig()` | Внутренняя коммуникация микросервисов, высоконагруженные API |
| `TestingConfig()` | Модульные тесты, локальная разработка |
| `MinimalConfig()` | Одноразовые скрипты, простые HTTP-вызовы |

## Как получить доступ к внутренним сервисам?

По умолчанию защита от SSRF блокирует соединения с приватными IP. Для доступа к внутренним сервисам:

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

// Использовать системный прокси
cfg.Connection.EnableSystemProxy = true
```

## Как обрабатывать HTTP-коды ошибок?

HTTPC не рассматривает 4xx/5xx как error, необходима ручная проверка:

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка сетевого уровня
    return err
}

switch {
case result.IsSuccess():
    // 2xx — успех
case result.IsClientError():
    // 4xx — ошибка клиента
    log.Printf("ошибка в параметрах запроса: %d", result.StatusCode())
case result.IsServerError():
    // 5xx — ошибка сервера
    log.Printf("сбой сервера: %d", result.StatusCode())
}
```

## Зачем нужно вызывать ReleaseResult?

`ReleaseResult` возвращает Result в пул объектов, снижая нагрузку на GC. При возврате тело ответа полностью обнуляется для предотвращения утечки конфиденциальных данных через пул объектов. В высоконагруженных сценариях это значительно повышает производительность.

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

// Или используйте MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// Отключение для отдельного запроса
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## Как установить таймаут запроса?

Четыре способа, от высшего приоритета к низшему:

```go
// 1. Таймаут контекста (рекомендуется)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. Параметр запроса
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. Принудительный таймаут через промежуточное ПО
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

`TestingConfig` отключает функции безопасности (проверка TLS, защита от SSRF), что создаёт риски при использовании вне тестовой среды. При обнаружении не-тестовой среды выводится предупреждение.

Используйте только в файлах `*_test.go` или для локальной разработки.

## Как включить DNS-over-HTTPS?

DoH снижает задержку разрешения DNS и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

По умолчанию используются три провайдера (с откатом по приоритету): Cloudflare, Google, AliDNS. Если все провайдеры DoH недоступны, автоматически выполняется откат к системному DNS.

:::tip Совет
DoH подходит для сценариев, требующих безопасности разрешения DNS. Для обычных API-вызовов включать DoH не обязательно — системный DNS по умолчанию достаточен.
:::

## Дополнительные ресурсы

- [Быстрый старт](./getting-started) — начало работы за 5 минут
- [Практическое руководство](./guides/tutorial) — пошаговый полный пример
- [Конфигурация API](./api-reference/config) — полный справочник конфигурации
- [Обработка ошибок](./advanced/error-handling) — руководство по обработке ошибок
