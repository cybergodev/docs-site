---
title: Пул соединений и прокси - HTTPC
description: Руководство по пулу соединений и прокси HTTPC — детальная настройка параметров пула соединений, HTTP и SOCKS5 прокси, пользовательские DoH-резолверы и управление простаивающими соединениями.
---

# Пул соединений и прокси

## Настройка пула соединений

Пул соединений — ключевой фактор производительности HTTP-клиента. HTTPC использует `ConnectionConfig` для управления пулом соединений.

```go
cfg := httpc.DefaultConfig()

// Параметры пула соединений
cfg.Connection.MaxIdleConns = 100         // Максимальное количество простаивающих соединений глобально
cfg.Connection.MaxConnsPerHost = 20       // Максимальное количество соединений на хост
cfg.Timeouts.IdleConn = 120 * time.Second // Время жизни простаивающего соединения
```

### Описание параметров

| Параметр | По умолчанию | Описание |
|------|------|------|
| `MaxIdleConns` | 50 | Максимальное количество простаивающих соединений глобально |
| `MaxConnsPerHost` | 10 | Максимальное количество соединений на хост (активные + простаивающие) |
| `IdleConn` | 90s | Таймаут простаивающего соединения, по истечении которого оно закрывается |
| `Dial` | 10s | Таймаут установки соединения |
| `TLSHandshake` | 10s | Таймаут TLS-рукопожатия |
| `ResponseHeader` | 0 | Отключено (используется таймаут Request) |

### Рекомендации по сценариям

| Сценарий | MaxIdleConns | MaxConnsPerHost | IdleConn |
|------|-------------|-----------------|----------|
| Высоконагруженный API | 100 | 20 | 120s |
| Обычный сервис | 50 | 10 | 90s |
| Редкие запросы | 10 | 2 | 30s |
| Внутренние микросервисы | 50 | 10 | 60s |

:::tip Совет
`MaxConnsPerHost` включает активные и простаивающие соединения. Новые запросы, превышающие этот лимит, будут ожидать освобождения соединения.
:::

## Настройка прокси

### Ручная настройка прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy.example.com:8080"

client, _ := httpc.New(cfg)
```

### Прокси с аутентификацией

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip Совет
Метод `Config.String()` автоматически маскирует имя пользователя и пароль в URL прокси.
:::

### SOCKS5 прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### Автоматическое определение системного прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// Автоматическое определение:
// - Windows: реестр Internet Settings
// - macOS: системные настройки сети, прокси
// - Linux: переменные окружения HTTP_PROXY / HTTPS_PROXY
```

Приоритет прокси:

1. `ProxyURL` (ручное указание, наивысший приоритет)
2. `EnableSystemProxy` (определение системного прокси)
3. Прямое подключение (без прокси)

## DNS-over-HTTPS

Включение DoH снижает задержку DNS-резолвинга и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (в порядке приоритета):

| Провайдер | Адрес | Описание |
|--------|------|------|
| Cloudflare | `1.1.1.1/dns-query` | Самый быстрый, приоритет конфиденциальности |
| Google | `8.8.8.8/resolve` | Глобальное покрытие |
| AliDNS | `223.5.5.5/resolve` | Оптимизация для региона Китая |

:::tip Совет
При включённом DoH результаты DNS-резолвинга кэшируются на время `DoHCacheTTL`. Если все провайдеры DoH недоступны, происходит возврат к системному DNS.
:::

## HTTP/2

HTTP/2 включён по умолчанию (требуется TLS):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Отключить HTTP/2
```

Возможности HTTP/2:
- Мультиплексирование: одно соединение обрабатывает несколько параллельных запросов
- Сжатие заголовков: уменьшение передачи повторяющихся заголовков
- Серверный пуш

## Повторное использование пула объектов

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // Возврат в пул объектов
```

В сценариях с высокой параллельной нагрузкой `ReleaseResult` значительно снижает нагрузку на GC.

## Шаблон параллельных запросов

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## Частые проблемы с пулом соединений

| Проблема | Причина | Решение |
|------|------|----------|
| Большое количество TIME_WAIT | Слишком короткий таймаут простаивающих соединений | Увеличить таймаут `IdleConn` |
| Отказ в соединении | Недостаточно соединений на хост | Увеличить `MaxConnsPerHost` |
| Запросы ожидают в очереди | Пул соединений слишком мал | Увеличить `MaxIdleConns` |

Полный список антипаттернов производительности и рекомендации по оптимизации см. в [Оптимизация производительности](./performance).

## Далее

- [Оптимизация производительности](./performance) - Руководство по настройке производительности
- [API конфигурации](../api-reference/config) - Справочник по настройке соединений
- [Обзор безопасности](../security/) - SSRF и безопасность TLS
