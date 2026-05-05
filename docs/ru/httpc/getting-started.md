---
title: Быстрый старт - HTTPC
description: "Пяти минутное руководство по началу работы с безопасной библиотекой HTTP-клиента CyberGo HTTPC, охватывающее установку Go-модуля, отправку GET и POST запросов, создание и настройку клиента, обработку JSON-ответов, использование всех функций параметров запроса и базовую обработку ошибок ClientError"
---

# Быстрый старт

## Установка

```bash
go get github.com/cybergodev/httpc
```

## Базовые запросы

Создавать клиент не нужно — используйте функции пакета напрямую:

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

Когда нужна пользовательская конфигурация, создайте экземпляр клиента:

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
|---------------|------------|-------------|
| `DefaultConfig()` | Общие сценарии | Безопасные значения по умолчанию, защита SSRF включена |
| `SecureConfig()` | Чувствительные к безопасности | Автоматические редиректы отключены, строгие таймауты |
| `PerformanceConfig()` | Высокая пропускная способность | Большой пул соединений, длинные таймауты, Cookie включены |
| `TestingConfig()` | Тестовая среда | Проверки безопасности и HTTP/2 отключены, короткие таймауты |
| `MinimalConfig()` | Лёгкие запросы | Без повторов, без редиректов |

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

HTTPC различает **ошибки сетевого уровня** и **HTTP-коды состояния**:

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("Код ошибки: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTP-коды состояния проверяются вручную
switch {
case result.IsSuccess():
    // 2xx — успех
case result.IsClientError():
    log.Printf("Ошибка клиента: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("Ошибка сервера: %d", result.StatusCode())
}
```

:::tip
4xx/5xx не возвращаются как `error`, их нужно проверять через методы `result.IsSuccess()` и др. Подробнее в разделе [Обработка ошибок](./advanced/error-handling).
:::

## Что дальше

- **[Практическое руководство](./guides/tutorial)** — создание клиента GitHub API за 30 минут
- **[Запросы и ответы](./guides/request-response)** — полный список параметров запроса и обработка ответов
- **[Базовые примеры](./examples/basic-usage)** — практические примеры GET/POST/middleware
- **[Шпаргалка](./cheatsheet)** — быстрый справочник по часто используемым операциям
- **[Безопасность](./security/)** — лучшие практики безопасности
