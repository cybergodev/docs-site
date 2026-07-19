---
sidebar_label: "Практическое руководство"
title: "Практическое руководство - CyberGo HTTPC | GitHub API Tour"
description: "Практическое руководство HTTPC: пошаговое построение клиента GitHub REST API от httpc.Get с парсингом JSON, доменным клиентом, middleware и загрузкой файлов."
sidebar_position: 1
---

# Практическое руководство: создание клиента GitHub API

Путём создания клиента GitHub API вы освоите основные концепции HTTPC. Приблизительно 30 минут.

**Вы научитесь:**

- Создавать клиент и выбирать предустановки конфигурации
- Отправлять GET/POST запросы и обрабатывать JSON-ответы
- Использовать доменный клиент для управления базовым URL API
- Добавлять промежуточное ПО для логирования и метрик
- Обрабатывать ошибки и повторные попытки
- Объекты ответа Result и автоматическое управление

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

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON-ответ
}
```

Ключевые моменты:
- Функция пакета `httpc.Get` не требует создания клиента, подходит для быстрой проверки
- Result создаётся заново для каждого запроса, утилизируется GC, ручное освобождение не требуется

## Шаг 2: Парсинг JSON-ответов

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
- Определите Go-структуру, соответствующую ответу API

## Шаг 3: Создание доменного клиента

Все эндпоинты GitHub API находятся под `https://api.github.com`, используйте доменный клиент, чтобы не повторять URL:

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// Путь запроса относителен к baseURL
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
```

Ключевые моменты:
- `NewDomain` создаёт клиент с областью действия, пути относительны к baseURL
- `SetHeader` устанавливает постоянный заголовок, автоматически добавляемый к каждому запросу
- `WithHeader` как параметр запроса действует только для текущего запроса
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

if !result.IsSuccess() {
    log.Fatalf("Ошибка создания: %d %s", result.StatusCode(), result.Body())
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

Добавьте логирование и Request ID к клиенту:

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

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

Ключевые моменты:
- Промежуточное ПО настраивается в `MiddlewareConfig.Middlewares`
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
            log.Println("Таймаут запроса, попробуйте позже")
        case httpc.ErrorTypeNetwork:
            log.Println("Сетевая ошибка")
        case httpc.ErrorTypeTLS:
            log.Println("Ошибка TLS")
        default:
            log.Printf("HTTP-ошибка: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("Эта ошибка может быть автоматически повторена")
        }
    }
    return
}

// Обработка HTTP-кодов состояния
switch {
case result.IsSuccess():
    // 2xx успешно
case result.StatusCode() == 401:
    log.Println("Token истёк или недействителен")
case result.IsClientError():
    log.Printf("Ошибка клиента: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Ошибка сервера: %d (всего попыток: %d, включая первую)",
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
- HTTPC разделяет обработку сетевых ошибок и HTTP-кодов состояния
- `ClientError` предоставляет классификацию ошибок и определение повторяемости
- По умолчанию автоматически повторяются запросы при 408, 429, 500, 502, 503, 504

## Шаг 7: Загрузка файлов (скачивание релиза)

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rПрогресс загрузки: %.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(
    context.Background(),
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nЗагрузка завершена: %s (%d bytes)\n",
    result.FilePath,
    result.BytesWritten,
)
```

## Шаг 8: Параллельные запросы

Одновременное получение информации о нескольких репозиториях:

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, err := httpc.New(httpc.PerformanceConfig())
    if err != nil {
        return err
    }
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
    }
    return nil
}
```

:::tip
`PerformanceConfig()` предоставляет конфигурацию с большим пулом соединений, подходящую для высоконагруженных сценариев. Result создаётся заново для каждого запроса и утилизируется GC.
:::

## Полный пример

Объединённый код всех шагов:

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

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | Язык: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   Время: %s (всего попыток: %d, включая первую)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## Что дальше

- [Запросы и ответы](./request-response) — полный справочник параметров запроса
- [Цепочки промежуточного ПО](./middleware-chain) — разработка пользовательского промежуточного ПО
- [Повторные попытки и отказоустойчивость](./retry-fault-tolerance) — продвинутые стратегии повторов
- [Оптимизация производительности](../advanced/performance) — настройка для продакшена
- [Контрольный список для продакшена](../security/production-checklist) — лучшие практики безопасности
