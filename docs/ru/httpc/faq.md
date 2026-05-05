---
title: Часто задаваемые вопросы - HTTPC
description: "Сборник ответов на часто задаваемые вопросы HTTPC, охватывающий рекомендации по выбору между функциями пакета и клиентом, сравнение пяти предустановок конфигурации, настройку HTTP и SOCKS5 прокси, классификацию и сопоставление ошибок ClientError, управление ресурсами через пул объектов, настройку таймаутов и оптимизацию пула соединений"
---

# Часто задаваемые вопросы

## Когда использовать функции пакета, а когда создавать клиент?

**Функции пакета** подходят для простых сценариев: одноразовые запросы, скрипты, утилиты.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Создание клиента** подходит для сценариев, где нужна пользовательская конфигурация, переиспользование пула соединений или использование промежуточного ПО.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## Как выбрать предустановку конфигурации?

| Предустановка | Сценарий использования |
|---------------|------------------------|
| `DefaultConfig()` | Общие сценарии, безопасные значения по умолчанию |
| `SecureConfig()` | Обработка URL-адресов от пользователей, финансовые/медицинские сценарии |
| `PerformanceConfig()` | Внутренняя микросервисная коммуникация, высокопараллельные API |
| `TestingConfig()` | Модульные тесты, локальная разработка |
| `MinimalConfig()` | Одноразовые скрипты, простые HTTP-вызовы |

## Как получить доступ к внутренним сервисам?

По умолчанию защита SSRF блокирует подключения к приватным IP. Для доступа к внутренним сервисам:

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

HTTPC не рассматривает 4xx/5xx как `error` — проверка выполняется вручную:

```go
result, err := client.Get(url)
if err != nil {
    // Сетевая ошибка
    return err
}

switch {
case result.IsSuccess():
    // 2xx — успех
case result.IsClientError():
    // 4xx — ошибка клиента
    log.Printf("Ошибка в параметрах запроса: %d", result.StatusCode())
case result.IsServerError():
    // 5xx — ошибка сервера
    log.Printf("Сбой сервера: %d", result.StatusCode())
}
```

## Зачем нужно вызывать ReleaseResult?

`ReleaseResult` возвращает Result в пул объектов, снижая нагрузку на GC. При возврате очищаются конфиденциальные данные из тела ответа (первые 64КБ), предотвращая утечку информации через пул объектов. В высокопараллельных сценариях значительное повышение производительности.

```go
result, _ := client.Get(url)
defer httpc.ReleaseResult(result)
// После этого не обращайтесь к result
```

## Как отключить повторные попытки?

```go
// Глобальное отключение
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// Или используйте MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// Отключение для одного запроса
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

// 3. Принудительный таймаут через промежуточное ПО
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. Таймаут клиента по умолчанию
cfg.Timeouts.Request = 30 * time.Second
```

## Как записывать логи запросов?

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

`TestingConfig` отключает функции безопасности (проверка TLS, защита SSRF), что создаёт риски при использовании вне тестовой среды. При обнаружении не-тестовой среды выводится предупреждение.

Используйте только в файлах `*_test.go` или для локальной разработки.

## Как включить DNS-over-HTTPS?

DoH может снизить задержку разрешения DNS и предотвратить перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

По умолчанию используются три провайдера: Cloudflare, Google, AliDNS (с откатом по приоритету). Если все провайдеры DoH недоступны, автоматически используется системный DNS.

:::tip
DoH подходит для сценариев, где требуется безопасность разрешения DNS. Для обычных API-вызовов включать не обязательно — стандартного DNS достаточно.
:::

## Дополнительные ресурсы

- [Быстрый старт](./getting-started) — начало работы за 5 минут
- [Практическое руководство](./guides/tutorial) — пошаговый полный пример
- [API конфигурации](./api-reference/config) — полный справочник конфигурации
- [Обработка ошибок](./advanced/error-handling) — руководство по обработке ошибок
