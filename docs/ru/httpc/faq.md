---
title: "Часто задаваемые вопросы - CyberGo HTTPC | Вопросы и ответы"
description: "FAQ по HTTPC: функции пакета против клиента, сравнение пресетов, прокси и DoH, сессии Cookie, настройка повторов и шаблоны сопоставления ошибок errors.Is/As."
---

# Часто задаваемые вопросы

## Когда использовать функции пакета, а когда создавать клиент?

**Функции пакета** подходят для простых сценариев: одноразовые запросы, скрипты, утилиты.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Создание клиента** подходит, когда нужна пользовательская конфигурация, переиспользование пула соединений или использование промежуточного ПО.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## Как выбрать предустановку конфигурации?

| Предустановка | Сценарий применения |
|---------------|---------------------|
| `DefaultConfig()` | Общие сценарии, безопасные значения по умолчанию |
| `SecureConfig()` | Обработка URL от пользователей, финансовые/медицинские сценарии |
| `PerformanceConfig()` | Внутренняя коммуникация микросервисов, высоконагруженные API |
| `TestingConfig()` | Модульное тестирование, локальная разработка |
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

// Использовать системный прокси
cfg.Connection.EnableSystemProxy = true
```

## Как обрабатывать HTTP-коды ошибок?

HTTPC не рассматривает 4xx/5xx как error, необходимо проверять вручную:

```go
result, err := client.Get(url)
if err != nil {
    // Ошибка сетевого уровня
    return err
}

switch {
case result.IsSuccess():
    // 2xx успешно
case result.IsClientError():
    // 4xx ошибка клиента
    log.Printf("Ошибка в параметрах запроса: %d", result.StatusCode())
case result.IsServerError():
    // 5xx ошибка сервера
    log.Printf("Сбой сервера: %d", result.StatusCode())
}
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

// 3. Принудительный таймаут промежуточного ПО
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

## Почему TestingConfig выводит предупреждения?

`TestingConfig` отключает функции безопасности (проверка TLS, защита SSRF), что создаёт риски при использовании вне тестовой среды. Предупреждение выводится при обнаружении не тестовой среды.

Используйте только в файлах `*_test.go` или для локальной разработки.

## Как включить DNS-over-HTTPS?

DoH снижает задержку разрешения DNS и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

По умолчанию используются три провайдера: Cloudflare, Google, AliDNS (с переключением по приоритету). Если все провайдеры DoH недоступны, автоматически выполняется откат к системному DNS.

:::tip
DoH рекомендуется для сценариев, где важна безопасность разрешения DNS. Для обычных API-вызовов включение не требуется, системного DNS достаточно.
:::

## Дополнительные ресурсы

- [Быстрый старт](./getting-started) - начните за 5 минут
- [Практическое руководство](./guides/tutorial) - пошаговый полный пример
- [Конфигурация API](./api-reference/config) - полный справочник конфигурации
- [Обработка ошибок](./advanced/error-handling) - руководство по обработке ошибок
