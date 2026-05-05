---
title: Доменный клиент и сессии - HTTPC
description: "Полное руководство по доменному клиенту HTTPC и управлению сессиями, подробно описывающее создание клиента с областью видимости домена через NewDomain, правила автоматической склейки URL и объединения путей, автоматическое обслуживание заголовков сессии и Cookie, потокобезопасное хранение SessionManager и рекомендации по настройке безопасности"
---

# Доменный клиент и сессии

Доменный клиент (DomainClient) — это клиент для управления сессиями в рамках одного домена, автоматически поддерживающий Cookie и заголовки.

## Создание доменного клиента

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie автоматически включены
dc.SetHeader("Authorization", "Bearer "+token)

// Отправка запросов с относительными путями
result, err := dc.Get("/users")
```

:::tip
`NewDomain` автоматически включает управление Cookie (`EnableCookies = true`), ручная настройка не требуется.
:::

## Управление заголовками сессии

```go
// Установка заголовков сессии (автоматически добавляются ко всем последующим запросам)
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// Пакетная установка
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// Удаление и очистка
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// Получение
headers := dc.GetHeaders()
```

## Управление Cookie

```go
// Установка Cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// Пакетная установка
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "ru"},
})

// Автоматический захват Cookie из ответа
result, _ := dc.Get("/login")
// Set-Cookie от сервера автоматически сохраняется в сессию

// Получение
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// Удаление и очистка
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
После каждого запроса Cookie, возвращённые сервером, автоматически обновляются в сессии — ручная обработка не требуется.
:::

## Способы отправки запросов

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

// Абсолютный URL (обходит склейку base URL)
result, _ := dc.Get("https://other-api.com/data")
```

## Доступ к сессии

```go
// Получение базовой информации
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// Доступ к базовому SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Проверка безопасности Cookie

Можно настроить политику безопасности Cookie, чтобы принимать только Cookie, соответствующие стандартам безопасности:

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// Установка строгой безопасности Cookie
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// Требования: Secure=true, HttpOnly=true, SameSite=Strict

// Cookie, не соответствующие требованиям безопасности, вызовут ошибку SetCookie
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Отсутствует Secure, HttpOnly → отклонено
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

    // Разбор Token из ответа
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

- [API доменного клиента](../api-reference/domain-client) — полный справочник API
- [API управления сессиями](../api-reference/session) — справочник SessionManager
- [Запросы и ответы](./request-response) — базовое руководство по запросам
