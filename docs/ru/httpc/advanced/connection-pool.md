---
title: "Пул соединений и прокси - CyberGo HTTPC | Пул и прокси"
description: "Руководство по пулу и прокси HTTPC: тюнинг MaxIdleConns, ручной и системный прокси ProxyURL, SOCKS5/HTTP-прокси, откат DoH и настройка HTTP/2."
---

# Пул соединений и прокси

## Конфигурация пула соединений

Пул соединений — ключевой фактор производительности HTTP-клиента. HTTPC управляет пулом через `ConnectionConfig`.

```go
cfg := httpc.DefaultConfig()

// Параметры пула соединений
cfg.Connection.MaxIdleConns = 100         // Глобальное максимальное число простаивающих соединений
cfg.Connection.MaxConnsPerHost = 20       // Максимальное число соединений на хост
cfg.Timeouts.IdleConn = 120 * time.Second // Время удержания простаивающих соединений
```

### Описание параметров

| Параметр | По умолчанию | Описание |
|----------|-------------|----------|
| `MaxIdleConns` | 50 | Глобальное максимальное число простаивающих соединений |
| `MaxConnsPerHost` | 10 | Максимальное число соединений на хост (активных + простаивающих) |
| `IdleConn` | 90s | Таймаут простаивающего соединения, после истечения закрывается |
| `Dial` | 10s | Таймаут установки соединения |
| `TLSHandshake` | 10s | Таймаут TLS-рукопожатия |
| `ResponseHeader` | 0 | Отключено (используется таймаут Request) |

### Рекомендации по сценариям

| Сценарий | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| Высоконагруженные API | 100 | 20 | 120s |
| Обычные сервисы | 50 | 10 | 90s |
| Редкие запросы | 10 | 2 | 30s |
| Внутренние микросервисы | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` включает активные и простаивающие соединения. Новые запросы сверх этого лимита будут ожидать освобождения соединения.
:::

## Настройка прокси

### Ручной прокси

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

:::tip
Метод `Config.String()` автоматически маскирует имя пользователя и пароль в URL прокси.
:::

### SOCKS5-прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### Автообнаружение системного прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// Автоматическое обнаружение:
// - Windows: реестр Internet Settings
// - macOS: системные настройки сетевого прокси
// - Linux: переменные окружения HTTP_PROXY / HTTPS_PROXY
```

Приоритет прокси:

1. `ProxyURL` (ручное указание, высший приоритет)
2. `EnableSystemProxy` (обнаружение системного прокси)
3. Прямое подключение (без прокси)

## DNS-over-HTTPS

Включение DoH снижает задержку разрешения DNS и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (по приоритету):

| Провайдер | Адрес | Описание |
|-----------|-------|----------|
| Cloudflare | `1.1.1.1/dns-query` | Самый быстрый, приоритет конфиденциальности |
| Google | `dns.google/resolve` | Глобальное покрытие |
| AliDNS | `dns.alidns.com/resolve` | Оптимизация для Китая |

:::tip
При включении DoH результаты разрешения DNS кэшируются на время `DoHCacheTTL`. Если все провайдеры DoH недоступны, выполняется откат к системному DNS.
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

Внутри HTTPC переиспользует объекты ответов движка и построители строк через sync.Pool, снижая нагрузку на GC; Result создаётся заново для каждого запроса и утилизируется GC.

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result создаётся заново для каждого запроса, утилизируется GC, ручное освобождение не требуется
```

В высоконагруженных сценариях переиспользование внутреннего пула объектов значительно снижает нагрузку на GC.

## Паттерны параллельных запросов

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
|----------|---------|---------|
| Много TIME_WAIT | Таймаут простаивающих соединений слишком короткий | Увеличьте таймаут `IdleConn` |
| Отказ в соединении | Недостаточно соединений на хост | Увеличьте `MaxConnsPerHost` |
| Запросы ожидают в очереди | Пул соединений слишком мал | Увеличьте `MaxIdleConns` |

Полный анализ антипаттернов производительности и рекомендации по оптимизации см. в [Оптимизация производительности](./performance).

## Что дальше

- [Оптимизация производительности](./performance) - руководство по настройке производительности
- [Конфигурация API](../api-reference/config) - справочник конфигурации соединений
- [Обзор безопасности](../security/) - безопасность SSRF и TLS
