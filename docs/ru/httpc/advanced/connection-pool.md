---
title: Пул соединений и прокси - HTTPC
description: Руководство по настройке пула соединений и прокси HTTPC, подробно описывающее настройку параметров пула, прокси HTTP и SOCKS5, пользовательский резолвер DoH и стратегии управления простаивающими соединениями.
---

# Пул соединений и прокси

## Конфигурация пула соединений

Пул соединений — ключевой фактор производительности HTTP-клиента. HTTPC управляет пулом соединений через `ConnectionConfig`.

```go
cfg := httpc.DefaultConfig()

// Параметры пула соединений
cfg.Connection.MaxIdleConns = 100         // Глобальное макс. простаивающих соединений
cfg.Connection.MaxConnsPerHost = 20       // Макс. соединений на хост
cfg.Timeouts.IdleConn = 120 * time.Second // Время удержания простаивающих соединений
```

### Описание параметров

| Параметр | По умолчанию | Описание |
|----------|-------------|----------|
| `MaxIdleConns` | 50 | Глобальное максимальное количество простаивающих соединений |
| `MaxConnsPerHost` | 10 | Максимальное количество соединений на хост (активных + простаивающих) |
| `IdleConn` | 90с | Тайм-аут простаивающих соединений, закрываются по истечении |
| `Dial` | 10с | Тайм-аут установления соединения |
| `TLSHandshake` | 10с | Тайм-аут TLS-рукопожатия |
| `ResponseHeader` | 30с | Тайм-аут ожидания заголовков ответа |

### Рекомендации по сценариям

| Сценарий | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| Высоконагруженный API | 100 | 20 | 120с |
| Обычный сервис | 50 | 10 | 90с |
| Редкие запросы | 10 | 2 | 30с |
| Внутренние микросервисы | 50 | 10 | 60с |

:::tip Совет
`MaxConnsPerHost` включает активные и простаивающие соединения. Новые запросы сверх лимита будут ожидать освобождения соединения.
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

### SOCKS5 прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### Автоопределение системного прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// Автоматическое обнаружение:
// - Windows: Реестр Internet Settings
// - macOS: Системные настройки сети прокси
// - Linux: Переменные окружения HTTP_PROXY / HTTPS_PROXY
```

Приоритет прокси:

1. `ProxyURL` (ручное указание, высший приоритет)
2. `EnableSystemProxy` (обнаружение системного прокси)
3. Прямое подключение (без прокси)

## DNS-over-HTTPS

Включите DoH для снижения задержки разрешения DNS и предотвращения перехвата DNS:

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
| AliDNS | `223.5.5.5/resolve` | Оптимизация для региона Китая |

:::tip Совет
При включении DoH результаты разрешения DNS кэшируются на время `DoHCacheTTL`. Если все провайдеры DoH недоступны, выполняется откат к системному DNS.
:::

## HTTP/2

HTTP/2 включён по умолчанию (требует TLS):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Отключить HTTP/2
```

Возможности HTTP/2:
- Мультиплексирование: одно соединение обрабатывает несколько параллельных запросов
- Сжатие заголовков: уменьшает передачу повторяющихся заголовков
- Серверный push

## Повторное использование пула объектов

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // Возврат в пул объектов
```

В высоконагруженных сценариях `ReleaseResult` может значительно снизить нагрузку на GC.

## Паттерн параллельных запросов

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
| Много TIME_WAIT | Слишком короткий тайм-аут простаивающих соединений | Увеличьте тайм-аут `IdleConn` |
| Отказ соединения | Недостаточно соединений на хост | Увеличьте `MaxConnsPerHost` |
| Запросы в очереди | Слишком малый пул соединений | Увеличьте `MaxIdleConns` |

Полный список антипаттернов производительности и рекомендации по оптимизации см. в [Оптимизации производительности](./performance).

## Что дальше

- [Оптимизация производительности](./performance) - руководство по настройке производительности
- [Конфигурация API](../api-reference/config) - справочник конфигурации соединений
- [Обзор безопасности](../security/) - безопасность SSRF и TLS
