---
title: "Доменный клиент и сессии — HTTPC"
description: "Руководство по доменному клиенту и управлению сессиями HTTPC: создание через NewDomain, автоматическая сборка URL, управление заголовками сессии SetHeader, автоматическое управление и захват Cookie, стратегия проверки безопасности CookieSecurity и пример обёртки клиента REST API."
---

# Доменный клиент и сессии

Доменный клиент (DomainClient) — это клиент управления сессиями для определённого домена с автоматическим поддержанием Cookie и заголовков.

## Создание доменного клиента

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie автоматически включены
dc.SetHeader("Authorization", "Bearer "+token)

// Использование относительных путей для запросов
result, err := dc.Get("/users")
```

:::tip Совет
`NewDomain` автоматически включает управление Cookie (`EnableCookies = true`), ручная настройка не требуется.
:::

## Управление заголовками сессии

```go
// Установка заголовков сессии (автоматически добавляются ко всем последующим запросам)
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Массовая установка
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// Удаление и очистка
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// Запрос
headers := dc.GetHeaders()
```

## Управление Cookie

```go
// Установка Cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// Массовая установка
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "ru"},
})

// Автоматический захват Cookie из ответов
result, _ := dc.Get("/login")
// Set-Cookie от сервера автоматически сохраняются в сессию

// Запрос
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// Удаление и очистка
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip Совет
После каждого запроса Cookie, возвращённые сервером, автоматически обновляются в сессии — ручная обработка не требуется.
:::

## Способы выполнения запросов

```go
// Относительные пути
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// С контекстом
result, _ := dc.Request(ctx, "GET", "/users")

// Абсолютный URL (пропускает сборку с base URL)
result, _ := dc.Get("https://other-api.com/data")
```

## Доступ к сессии

```go
// Получение базовой информации
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// Доступ к底层 SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Проверка безопасности Cookie

Можно настроить политику безопасности Cookie для принятия только тех, которые соответствуют стандартам безопасности:

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// Установка строгой безопасности Cookie
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// Требуется: Secure=true, HttpOnly=true, SameSite=Strict

// Cookie, не соответствующие требованиям безопасности, вызовут ошибку SetCookie
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Отсутствуют Secure, HttpOnly → отклонено
}); err != nil {
    log.Println("Cookie отклонён:", err)
}
```

## Полный пример: клиент REST API

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // Создание доменного клиента
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // Вход для получения Token
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // Парсинг Token из ответа
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }
    httpc.ReleaseResult(loginResult)

    // Установка заголовков сессии
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // Последующие запросы автоматически содержат Token и Cookie
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(users)

    fmt.Println(users.StatusCode()) // 200
}
```

## Что дальше

- [Доменный клиент API](../api-reference/domain-client) — полный справочник API
- [Управление сессиями API](../api-reference/session) — справочник SessionManager
- [Запросы и ответы](./request-response) — руководство по базовым запросам
