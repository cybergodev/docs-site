---
title: Практическое руководство - HTTPC
description: Тридцатиминутное практическое руководство по созданию клиента GitHub REST API, изучение конфигурации HTTPC, параметров запросов, доменного клиента, промежуточного ПО и обработки ошибок.
---

# Практическое руководство: создание клиента GitHub API

Создайте клиент GitHub API, чтобы связать основные концепции HTTPC. Приблизительное время выполнения — 30 минут.

**Вы научитесь:**

- Создавать клиент и использовать предустановки конфигурации
- Отправлять GET/POST запросы и обрабатывать JSON-ответы
- Использовать доменный клиент для управления базовым URL API
- Добавлять промежуточное ПО для логирования и метрик
- Обрабатывать ошибки и повторные попытки
- Оптимизировать производительность через повторное использование пула объектов

## Шаг 1: Базовый запрос

Установите зависимость и создайте `main.go`:

```bash
go get github.com/cybergodev/httpc
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://api.github.com/repos/golang/go")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON-ответ
}
```

Ключевые моменты:
- Функция уровня пакета `httpc.Get` не требует создания клиента, подходит для быстрой проверки
- `defer httpc.ReleaseResult(result)` возвращает результат в пул объектов

## Шаг 2: Разбор JSON-ответа

```go
type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

result, err := httpc.Get("https://api.github.com/repos/golang/go")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("Язык: %s\n", repo.Language)
fmt.Printf("Описание: %s\n", repo.Description)
```

Ключевые моменты:
- `result.Unmarshal(&v)` напрямую разбирает JSON-ответ в структуру
- Определите структуру Go, соответствующую ответу API

## Шаг 3: Создание доменного клиента

Все эндпоинты GitHub API находятся в `https://api.github.com`. Используйте доменный клиент, чтобы избежать повторения URL:

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// Путь запроса относительно baseURL
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)
```

Ключевые моменты:
- `NewDomain` создаёт клиент с областью видимости, пути относительно baseURL
- `SetHeader` устанавливает постоянные заголовки, автоматически добавляемые к каждому запросу
- `WithHeader` передаётся как параметр запроса и действует только для текущего запроса
- Доменный клиент автоматически управляет Cookie

## Шаг 4: Отправка данных (создание Issue)

```go
type CreateIssueRequest struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}

newIssue := CreateIssueRequest{
    Title: "Bug report",
    Body:  "Found a bug in the API response",
}

result, err := client.Post("/repos/owner/repo/issues",
    httpc.WithJSON(newIssue),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

if !result.IsSuccess() {
    log.Fatalf("Создание не удалось: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d создан: %s\n", created.Number, created.URL)
```

Ключевые моменты:
- `WithJSON(data)` автоматически сериализует и устанавливает Content-Type
- `result.IsSuccess()` проверяет код состояния 2xx

## Шаг 5: Добавление промежуточного ПО

Добавьте логирование и ID запроса к клиенту:

```go
// Настройка промежуточного ПО
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// Передайте конфигурацию в NewDomain для создания доменного клиента с промежуточным ПО
client, err := httpc.NewDomain("https://api.github.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

Ключевые моменты:
- Промежуточное ПО настраивается в `Config.Middleware.Middlewares`
- `LoggingMiddleware` записывает логи запросов
- `RecoveryMiddleware` предотвращает падение процесса при panic
- `RequestIDMiddleware` генерирует уникальный ID для каждого запроса

## Шаг 6: Обработка ошибок и повторные попытки

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("Тайм-аут запроса, повторите позже")
        case httpc.ErrorTypeNetwork:
            log.Println("Сетевая ошибка")
        case httpc.ErrorTypeTLS:
            log.Println("Ошибка TLS")
        default:
            log.Printf("HTTP ошибка: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("Эту ошибку можно автоматически повторить")
        }
    }
    return
}
defer httpc.ReleaseResult(result)

// Обработка HTTP-кодов состояния
switch {
case result.IsSuccess():
    // 2xx успех
case result.StatusCode() == 401:
    log.Println("Токен истёк или недействителен")
case result.IsClientError():
    log.Printf("Ошибка клиента: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Ошибка сервера: %d (автоматически повторено %d раз)",
        result.StatusCode(), result.Meta.Attempts)
}
```

Настройка стратегии повторных попыток:

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

Ключевые моменты:
- HTTPC разделяет сетевые ошибки и HTTP-коды состояния
- `ClientError` предоставляет классификацию ошибок и информацию о возможности повторной попытки
- По умолчанию автоматически повторяются ошибки 408, 429, 500, 502, 503, 504

## Шаг 7: Загрузка файла (скачивание релиза)

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rПрогресс загрузки: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions(
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nЗагрузка завершена: %s (%s)\n",
    result.FilePath,
    httpc.FormatBytes(result.BytesWritten),
)
```

## Шаг 8: Параллельные запросы

Одновременное получение информации о нескольких репозиториях:

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, _ := httpc.New(httpc.PerformanceConfig())
    defer client.Close()

    results := make([]*httpc.Result, len(repos))
    errs := make([]error, len(repos))

    var wg sync.WaitGroup
    for i, name := range repos {
        wg.Add(1)
        go func(idx int, repo string) {
            defer wg.Done()
            r, err := client.Request(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s", repo))
            results[idx] = r
            errs[idx] = err
        }(i, name)
    }
    wg.Wait()

    for i, err := range errs {
        if err != nil {
            return err
        }

        var repo Repo
        results[i].Unmarshal(&repo)
        fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
        httpc.ReleaseResult(results[i])
    }
    return nil
}
```

:::tip Совет
`PerformanceConfig()` предоставляет конфигурацию с большим пулом соединений, подходящую для высоконагруженных сценариев. Не забывайте правильно использовать `ReleaseResult` при параллельных запросах.
:::

## Полный пример

Полный код, объединяющий все шаги выше:

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/httpc"
)

type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

func main() {
    token := os.Getenv("GITHUB_TOKEN")

    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        httpc.RecoveryMiddleware(),
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Получение информации о репозитории
    result, err := client.Get("https://api.github.com/repos/golang/go",
        httpc.WithHeader("Authorization", "Bearer "+token),
    )
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && clientErr.IsRetryable() {
            log.Fatal("Запрос не удался (после повторных попыток):", err)
        }
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | Язык: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   Время: %s (повторных попыток: %d)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## Что дальше

- [Запросы и ответы](./request-response) — полный справочник параметров запросов
- [Цепочка промежуточного ПО](./middleware-chain) — разработка пользовательского промежуточного ПО
- [Повторные попытки и отказоустойчивость](./retry-fault-tolerance) — продвинутые стратегии повторов
- [Оптимизация производительности](../advanced/performance) — настройка для production
- [Контрольный список для production](../security/production-checklist) — лучшие практики безопасности
