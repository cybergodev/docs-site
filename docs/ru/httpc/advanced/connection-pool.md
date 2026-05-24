---
title: "Пул соединений и прокси — HTTPC"
description: "Руководство по настройке пула соединений и прокси HTTPC: оптимизация параметров MaxIdleConns и рекомендации по сценариям, ручная настройка ProxyURL и обнаружение системного прокси, прокси SOCKS5, откат между тремя провайдерами DoH, настройка HTTP/2, повторное использование пула объектов ReleaseResult и паттерны параллельных запросов."
---

# Пул соединений и прокси

## Настройка пула соединений

Пул соединений — ключевой фактор производительности HTTP-клиента. HTTPC использует `ConnectionConfig` для управления пулом соединений.

```go
cfg := httpc.DefaultConfig()

// Параметры пула соединений
cfg.Connection.MaxIdleConns = 100         // Глобальный максимум простаивающих соединений
cfg.Connection.MaxConnsPerHost = 20       // Максимум соединений на хост
cfg.Timeouts.IdleConn = 120 * time.Second // Время удержания простаивающих соединений
```

### Описание параметров

| Параметр | Значение по умолчанию | Описание |
|----------|----------------------|----------|
| `MaxIdleConns` | 50 | Глобальный максимум простаивающих соединений |
| `MaxConnsPerHost` | 10 | Максимум соединений на хост (активных + простаивающих) |
| `IdleConn` | 90s | Таймаут простаивающего соединения, закрывается по истечении |
| `Dial` | 10s | Таймаут установления соединения |
| `TLSHandshake` | 10s | Таймаут TLS-рукопожатия |
| `ResponseHeader` | 0 | Отключено (используется таймаут Request) |

### Рекомендации по сценариям

| Сценарий | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| Высоконагруженные API | 100 | 20 | 120s |
| Обычные сервисы | 50 | 10 | 90s |
| Редкие запросы | 10 | 2 | 30s |
| Внутренние микросервисы | 50 | 10 | 60s |

:::tip Совет
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

:::tip Совет
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
// - Windows: Реестр Internet Settings
// - macOS: Системные настройки сети, прокси
// - Linux: Переменные окружения HTTP_PROXY / HTTPS_PROXY
```

Приоритет прокси:

1. `ProxyURL` (ручное указание, высший приоритет)
2. `EnableSystemProxy` (обнаружение системного прокси)
3. Прямое соединение (без прокси)

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
| Google | `8.8.8.8/resolve` | Глобальное покрытие |
| AliDNS | `223.5.5.5/resolve` | Оптимизация для Китая |

:::tip Совет
После включения DoH результаты разрешения DNS кэшируются на время `DoHCacheTTL`. Если все провайдеры DoH недоступны, выполняется откат к системному DNS.
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

В высоконагруженных сценариях `ReleaseResult` значительно снижает нагрузку на GC.

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
| Большое количество TIME_WAIT | Слишком короткий таймаут простаивающих соединений | Увеличьте таймаут `IdleConn` |
| Отказ в соединении | Недостаточно соединений на хост | Увеличьте `MaxConnsPerHost` |
| Очередь запросов | Слишком малый пул соединений | Увеличьте `MaxIdleConns` |

Полный список антипаттернов производительности и рекомендации по оптимизации см. в [Оптимизации производительности](./performance).

## Что дальше

- [Оптимизация производительности](./performance) — руководство по настройке производительности
- [Конфигурация API](../api-reference/config) — справочник настройки соединений
- [Обзор безопасности](../security/) — безопасность SSRF и TLS
