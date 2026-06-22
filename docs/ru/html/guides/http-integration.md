---
title: "Интеграция с HTTP - CyberGo HTML | веб-сервисы"
description: "Интеграция CyberGo HTML с HTTP: скрейпинг через net/http, оптимизация пакетов, тайм-ауты контекста, веб-сервисы, синглтон Processor и продакшен."
---

# Интеграция с HTTP

Библиотека HTML не включает встроенный HTTP-клиент, а бесшовно работает со стандартной библиотекой `net/http`. В этой статье представлены распространённые паттерны интеграции.

## Базовый скрейпинг и извлечение

Простейший паттерн: получение страницы и извлечение контента.

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"

    "github.com/cybergodev/html"
)

func main() {
    resp, err := http.Get("https://example.com/article")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        log.Fatalf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatal(err)
    }

    result, err := html.Extract(body)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Заголовок:", result.Title)
    fmt.Println("Слов:", result.WordCount)
}
```

:::tip Рекомендация по оптимизации
Ограничьте размер ввода для предотвращения переполнения памяти:

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50 МБ
```
:::

## Настройка HTTP-клиента

В производственной среде следует настроить разумные тайм-ауты и параметры пула соединений:

```go
client := &http.Client{
    Timeout: 15 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

| Параметр | Рекомендуемое значение | Описание |
|------|--------|------|
| `Timeout` | 10-30с | Полный цикл: соединение + TLS + чтение/запись |
| `MaxIdleConns` | 10-50 | Глобальный максимум простаивающих соединений |
| `MaxIdleConnsPerHost` | 5-10 | Максимум простаивающих соединений на один хост |
| `IdleConnTimeout` | 90с | Время удержания простаивающих соединений |

## Singleton Processor + HTTP-сервис

В веб-сервисе используйте один экземпляр Processor для обработки всех запросов:

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    body, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
    if err != nil {
        http.Error(w, "Ошибка чтения", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning Валидация ввода
В веб-сервисе обязательно ограничивайте размер тела запроса для предотвращения атак с большими файлами. Используйте `io.LimitReader` или `http.MaxBytesReader`.
:::

## Параллельный скрейпинг нескольких URL

Использование потокобезопасности Processor для эффективной обработки нескольких страниц:

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := http.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, _ := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            result, err := processor.Extract(body)
            results[idx] = URLResult{URL: u, Result: result, Error: err}
        }(i, url)
    }

    wg.Wait()
    return results
}
```

Пример использования:

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(p, urls) {
    if r.Error != nil {
        log.Printf("%s: ошибка - %v", r.URL, r.Error)
        continue
    }
    fmt.Printf("%s: %s (%d слов)\n", r.URL, r.Result.Title, r.Result.WordCount)
}
```

## Скрейпинг с повторными попытками

Обработка сценариев нестабильной сети:

```go
func fetchWithRetry(client *http.Client, url string, maxRetries int) ([]byte, error) {
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            lastErr = err
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("ошибка сервера: HTTP %d", resp.StatusCode)
            resp.Body.Close()
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
        }

        body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
        resp.Body.Close()
        if err != nil {
            return nil, err
        }
        return body, nil
    }

    return nil, fmt.Errorf("не удалось после %d попыток: %w", maxRetries, lastErr)
}
```

:::tip Стратегия повторных попыток
- 4xx ошибки не повторять (проблема на стороне клиента)
- 5xx и сетевые ошибки можно повторять
- Использовать экспоненциальную задержку: 1с, 2с, 4с
- Установить максимальное количество попыток (обычно 3)
:::

## Пакетная обработка + отмена через контекст

Для больших пакетов URL используйте пакетную обработку с контекстом для поддержки отмены по тайм-ауту:

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
    // Установка общего тайм-аута
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    // Загрузка всех страниц
    pages := make([][]byte, len(urls))
    for i, u := range urls {
        select {
        case <-ctx.Done():
            fmt.Println("Тайм-аут загрузки, отменено")
            return
        default:
            body, err := fetchWithRetry(http.DefaultClient, u, 2)
            if err != nil {
                log.Printf("Пропуск %s: %v", u, err)
                continue
            }
            pages[i] = body
        }
    }

    // Пакетное извлечение
    batch := processor.ExtractBatchWithContext(ctx, pages)
    fmt.Printf("Успешно: %d, Неудачно: %d, Отменено: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)
}
```

## Обработка кодировок

HTTP-ответы могут использовать не-UTF-8 кодировки, библиотека HTML автоматически определяет и обрабатывает их:

```go
// Даже если ответ в кодировке GBK, извлечение будет корректным
resp, _ := http.Get("https://example.cn/page")
body, _ := io.ReadAll(resp.Body)
result, _ := html.Extract(body) // Автоматическое определение кодировки
```

Можно также получить кодировку из заголовка `Content-Type` и указать вручную:

```go
charset := "utf-8" // Из Content-Type
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if idx := strings.Index(ct, "charset="); idx != -1 {
        charset = ct[idx+8:]
    }
}

cfg := html.DefaultConfig()
cfg.Encoding = charset
result, _ := html.Extract(body, cfg)
```

## Лучшие практики

| Сценарий | Рекомендация |
|------|------|
| Извлечение одной страницы | `http.Get()` + `html.Extract()` |
| Веб-сервис | Singleton Processor + `ExtractWithContext()` |
| Пакетный скрейпинг | `processURLs()` + повторное использование Processor |
| Ненадёжные источники | `HighSecurityConfig()` + `io.LimitReader()` |
| Неопределённая кодировка | Полагаться на автоопределение или указать из Content-Type |

## Следующие шаги

- [Кэширование и повторное использование](../guides/processor-cache) - Управление жизненным циклом Processor
- [Система аудита на практике](../guides/audit-pipeline) - Мониторинг безопасности в производственной среде
- [Справочник API: Пакетная обработка](../api-reference/batch) - Полный API пакетной обработки
- [Оптимизация производительности](../advanced/performance) - Советы по оптимизации
