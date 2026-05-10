---
title: Быстрый старт - HTTPC
description: Пятиминутный быстрый старт с библиотекой безопасного HTTP-клиента HTTPC, охватывающий установку модуля, GET/POST запросы, конфигурацию клиента, разбор JSON и обработку ошибок.
---

# Быстрый старт

## Установка

```bash
go get github.com/cybergodev/httpc
```

## Базовые запросы

Нет необходимости создавать клиент — используйте функции уровня пакета напрямую:

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
    fmt.Println(result.Body())       // содержимое ответа
}
```

Поддерживаемые HTTP-методы: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

## Создание клиента

Для пользовательской конфигурации создайте экземпляр клиента:

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

### Предустановки конфигурации

| Конфигурация | Назначение | Особенности |
|---------------|-----------|------------|
| `DefaultConfig()` | Общие сценарии | Безопасные значения по умолчанию, защита от SSRF включена |
| `SecureConfig()` | Чувствительные к безопасности сценарии | Отключены авто-перенаправления, строгие тайм-ауты |
| `PerformanceConfig()` | Высокая пропускная способность | Большой пул соединений, длинные тайм-ауты, включены Cookie |
| `TestingConfig()` | Тестовая среда | Отключены проверки безопасности и HTTP/2, короткие тайм-ауты |
| `MinimalConfig()` | Лёгкие запросы | Без повторных попыток, без перенаправлений |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

## Обработка ответов

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// Проверка статуса
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// Разбор JSON
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

## Отправка данных

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// Форма
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// С аутентификацией
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

## Обработка ошибок

HTTPC разделяет **ошибки сетевого уровня** и **HTTP-коды состояния**:

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("код ошибки: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTP-коды состояния проверяются вручную
switch {
case result.IsSuccess():
    // 2xx успех
case result.IsClientError():
    log.Printf("ошибка клиента: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("ошибка сервера: %d", result.StatusCode())
}
```

:::tip Совет
4xx/5xx не возвращаются как `error`, проверяйте через `result.IsSuccess()` и другие методы. Подробнее в [Обработке ошибок](./advanced/error-handling).
:::

## Что дальше

- **[Практическое руководство](./guides/tutorial)** - создание клиента GitHub API за 30 минут
- **[Запросы и ответы](./guides/request-response)** - полные параметры запросов и обработка ответов
- **[Базовые примеры](./examples/basic-usage)** - практические примеры GET/POST/middleware
- **[Шпаргалка](./cheatsheet)** - быстрый справочник по часто используемым операциям
- **[Безопасность](./security/)** - лучшие практики безопасности
