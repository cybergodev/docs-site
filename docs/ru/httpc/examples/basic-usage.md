---
title: "Базовые примеры — HTTPC"
description: "Набор базовых примеров HTTPC: запросы GET с параметрами и аутентификацией, POST-запросы с JSON/формой/загрузкой файлов, FormData с несколькими полями, выбор DefaultConfig и других предустановок, настройка прокси ProxyURL, добавление промежуточного ПО Recovery/Logging, сбор метрик RequestID/Metrics и загрузка файлов с обратным вызовом прогресса."
---

# Базовые примеры

## GET-запросы

### Базовый GET

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())
}
```

### С параметрами запроса

```go
result, err := httpc.Get("https://httpbin.org/get",
    httpc.WithQuery("name", "test"),
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{
        "limit": 10,
        "sort":  "desc",
    }),
)
```

### С аутентификацией

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

## POST-запросы

### Тело запроса в формате JSON

```go
data := map[string]any{
    "name":  "John",
    "email": "john@example.com",
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithJSON(data),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// Парсинг JSON-ответа
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### Отправка формы

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### Загрузка файла

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### Форма с несколькими полями

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

## Создание клиента

### Пользовательская конфигурация

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

### Настройка прокси

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## Промежуточное ПО

### Логирование + восстановление

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(log.Printf),
}
cfg.Middleware.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### ID запроса + метрики

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
}

client, _ := httpc.New(cfg)
```

## Загрузка файлов

```go
client, _ := httpc.New()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rЗагрузка: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nЗагрузка завершена: %s, время %v, средняя скорость %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## Доменный клиент

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Установка данных сессии
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Запросы автоматически содержат заголовки сессии и Cookie
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## Что дальше

- [Расширенные примеры](./advanced-usage) — пользовательские повторные попытки, цепочка промежуточного ПО, параллельные загрузки
- [Запросы и ответы](../guides/request-response) — подробное описание параметров запросов
- [Доменный клиент и сессии](../guides/domain-session) — управление сессиями
