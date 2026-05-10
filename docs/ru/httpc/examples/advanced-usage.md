---
title: Расширенные примеры - HTTPC
description: Набор расширенных примеров HTTPC, включая пользовательскую стратегию повторных попыток, конфигурацию цепочки промежуточного ПО, обёртку RESTful API, параллельную загрузку и аутентификацию с подписью HMAC.
---

# Расширенные примеры

## Пользовательская стратегия повторных попыток

Повторные попытки только для 502/503/504 с фиксированной задержкой:

:::warning Внутренний тип
Параметр `resp` типа `ResponseReader` в `RetryPolicy.ShouldRetry` является внутренним интерфейсом (определён в пакете `internal/types`), на который нельзя ссылаться из внешних пакетов. Пользовательский `RetryPolicy` должен быть реализован в том же модуле, что и `httpc`. Большинство сценариев можно удовлетворить через конфигурацию `RetryConfig`. Ниже показан паттерн реализации, фактический код должен компилироваться внутри модуля `httpc`.
:::

```go
// Примечание: ResponseReader — внутренний тип (пакет internal/types).
// Этот код компилируется только внутри модуля github.com/cybergodev/httpc.
// Большинство пользователей должны настраивать повторные попытки через RetryConfig и WithMaxRetries.

type selectiveRetry struct {
    maxAttempts int
    baseDelay   time.Duration
}

// Определяет, следует ли повторить попытку
func (p *selectiveRetry) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    if err != nil {
        return true // Повторная попытка при сетевой ошибке
    }
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

func (p *selectiveRetry) GetDelay(attempt int) time.Duration {
    return p.baseDelay * time.Duration(attempt+1)
}

func (p *selectiveRetry) MaxRetries() int {
    return p.maxAttempts
}

// Применение пользовательской стратегии
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &selectiveRetry{maxAttempts: 5, baseDelay: time.Second}
```

Альтернатива для внешних проектов — использование конфигурации `RetryConfig`:

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 5
    cfg.Retry.Delay = 500 * time.Millisecond
    cfg.Retry.BackoffFactor = 1.5
    cfg.Retry.EnableJitter = true

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://api.example.com/unstable")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode())
}
```

## Полная цепочка промежуточного ПО

```go
package main

import (
    "encoding/json"
    "log"
    "sync/atomic"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // Счётчик запросов
    var requestCount int64

    // Сбор метрик
    metricsMiddleware := httpc.MetricsMiddleware(
        func(method, url string, statusCode int, duration time.Duration, err error) {
            atomic.AddInt64(&requestCount, 1)
            log.Printf("[METRICS] %s %s -> %d (%v)", method, url, statusCode, duration)
        },
    )

    // Журнал аудита (формат JSON)
    auditCfg := &httpc.AuditMiddlewareConfig{
        Format:         "json",
        IncludeHeaders: true,
        MaskHeaders:    []string{"Authorization", "Cookie"},
        SanitizeError:  true,
    }
    auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
        data, _ := json.Marshal(event)
        log.Printf("[AUDIT] %s", data)
    }, auditCfg)

    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),                              // восстановление после panic
        httpc.TimeoutMiddleware(30 * time.Second),              // принудительный тайм-аут
        httpc.RequestIDMiddleware("X-Request-ID", nil),         // ID запроса
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        metricsMiddleware,
        auditMiddleware,
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Printf("Всего запросов: %d", atomic.LoadInt64(&requestCount))
}
```

## Обёртка клиента REST API

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

type APIClient struct {
    dc httpc.DomainClienter
}

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

func NewAPIClient(baseURL, token string) (*APIClient, error) {
    dc, err := httpc.NewDomain(baseURL)
    if err != nil {
        return nil, err
    }
    if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
        dc.Close()
        return nil, err
    }
    if err := dc.SetHeader("Accept", "application/json"); err != nil {
        dc.Close()
        return nil, err
    }

    return &APIClient{dc: dc}, nil
}

func (c *APIClient) GetUser(ctx context.Context, id int) (*User, error) {
    result, err := c.dc.Request(ctx, "GET", fmt.Sprintf("/users/%d", id))
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        return nil, fmt.Errorf("API error: %d", result.StatusCode())
    }

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) CreateUser(ctx context.Context, name string) (*User, error) {
    result, err := c.dc.Request(ctx, "POST", "/users",
        httpc.WithJSON(map[string]string{"name": name}),
    )
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) Close() error {
    return c.dc.Close()
}

func main() {
    api, err := NewAPIClient("https://api.example.com", "my-token")
    if err != nil {
        log.Fatal(err)
    }
    defer api.Close()

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Создание пользователя
    user, err := api.CreateUser(ctx, "Alice")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Создан: %+v\n", user)

    // Получение пользователя
    user, err = api.GetUser(ctx, user.ID)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Получен: %+v\n", user)
}
```

## Параллельная загрузка

```go
package main

import (
    "fmt"
    "log"
    "sync"
    "sync/atomic"

    "github.com/cybergodev/httpc"
)

func main() {
    urls := map[string]string{
        "file1.zip": "https://example.com/files/file1.zip",
        "file2.zip": "https://example.com/files/file2.zip",
        "file3.zip": "https://example.com/files/file3.zip",
    }

    client, _ := httpc.New()
    defer client.Close()

    var successCount int64
    var totalBytes int64
    var wg sync.WaitGroup

    for filename, url := range urls {
        wg.Add(1)
        go func(name, u string) {
            defer wg.Done()

            cfg := httpc.DefaultDownloadConfig()
            cfg.FilePath = "/tmp/" + name
            cfg.Overwrite = true
            cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
                fmt.Printf("\r%s: %.1f%% (%s/s)", name,
                    float64(downloaded)/float64(total)*100,
                    httpc.FormatSpeed(speed))
            }

            result, err := client.DownloadWithOptions(u, cfg)
            if err != nil {
                log.Printf("%s ошибка загрузки: %v", name, err)
                return
            }

            atomic.AddInt64(&successCount, 1)
            atomic.AddInt64(&totalBytes, result.BytesWritten)
            fmt.Printf("\n%s завершено: %s\n", name, httpc.FormatBytes(result.BytesWritten))
        }(filename, url)
    }

    wg.Wait()
    fmt.Printf("\nЗагрузка завершена: %d/%d, всего %s\n",
        successCount, len(urls), httpc.FormatBytes(totalBytes))
}
```

## Пользовательское промежуточное ПО: подпись запроса

```go
package main

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func SigningMiddleware(secret string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            timestamp := time.Now().Unix()
            message := fmt.Sprintf("%s%s%d", req.Method(), req.URL(), timestamp)

            mac := hmac.New(sha256.New, []byte(secret))
            mac.Write([]byte(message))
            signature := hex.EncodeToString(mac.Sum(nil))

            req.SetHeader("X-Timestamp", fmt.Sprintf("%d", timestamp))
            req.SetHeader("X-Signature", signature)

            return next(ctx, req)
        }
    }
}

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        SigningMiddleware("my-secret-key"),
    }

    client, _ := httpc.New(cfg)
    defer client.Close()

    result, err := client.Get("https://api.example.com/protected")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Println(result.StatusCode())
}
```

## Что дальше

- [Цепочка промежуточного ПО](../guides/middleware-chain) - архитектура промежуточного ПО
- [Повторные попытки и отказоустойчивость](../guides/retry-fault-tolerance) - пользовательские стратегии повторных попыток
- [Оптимизация производительности](../advanced/performance) - рекомендации по настройке производительности
