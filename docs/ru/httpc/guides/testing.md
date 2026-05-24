---
title: "Руководство по тестированию — HTTPC"
description: "Руководство по тестированию HTTPC: конфигурация TestingConfig для тестовой среды, интеграция с net/http/httptest для моделирования серверов, моделирование ошибочных ответов/задержек/перенаправлений/загрузки файлов, табличные тесты, тестирование таймаутов context и лучшие практики очистки ресурсов ReleaseResult."
---

# Руководство по тестированию

## TestingConfig

`TestingConfig()` специально разработана для тестовой среды — отключает проверки безопасности, сокращает таймауты, ускоряя выполнение тестов:

```go
func TestAPI(t *testing.T) {
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("http://localhost:8080/test")
    // ...
}
```

:::danger Опасность
`TestingConfig` отключает проверку TLS, защиту от SSRF и другие функции безопасности, **используйте только в тестовой среде**. При использовании вне тестовой среды выводится предупреждение безопасности.
:::

## Интеграция с httptest.Server

Используйте стандартную библиотеку `net/http/httptest` для создания имитационного сервера, реализуя интеграционные тесты без реального бэкенда:

```go
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/cybergodev/httpc"
)

func TestGetUser(t *testing.T) {
    // Создание имитационного сервера
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/users/1" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-token" {
            t.Errorf("missing auth header")
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "id":   1,
            "name": "Test User",
        })
    }))
    defer server.Close()

    // Создание клиента с TestingConfig
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // Отправка запроса к имитационному серверу
    result, err := client.Get(server.URL+"/users/1",
        httpc.WithBearerToken("test-token"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        t.Fatalf("expected success, got %d", result.StatusCode())
    }

    var user struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }
    if err := result.Unmarshal(&user); err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("expected Test User, got %s", user.Name)
    }
}
```

## Моделирование различных сценариев

### Моделирование ошибочных ответов

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### Моделирование задержки

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// Тестирование обработки таймаута
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := httpc.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### Моделирование перенаправления

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/old":
        http.Redirect(w, r, "/new", http.StatusMovedPermanently)
    case "/new":
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("redirected"))
    }
}))
defer server.Close()
```

### Моделирование загрузки файлов

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // Разбор multipart-формы
    r.ParseMultipartForm(10 << 20)
    file, header, err := r.FormFile("upload")
    if err != nil {
        t.Fatal(err)
    }
    defer file.Close()

    if header.Filename != "test.txt" {
        t.Errorf("expected test.txt, got %s", header.Filename)
    }

    w.WriteHeader(http.StatusOK)
}))
defer server.Close()
```

## Табличные тесты

```go
func TestHTTPMethods(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(r.Method))
    }))
    defer server.Close()

    client, _ := httpc.New(httpc.TestingConfig())
    defer client.Close()

    tests := []struct {
        name   string
        method func(url string, opts ...httpc.RequestOption) (*httpc.Result, error)
    }{
        {"GET", client.Get},
        {"POST", client.Post},
        {"PUT", client.Put},
        {"PATCH", client.Patch},
        {"DELETE", client.Delete},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := tt.method(server.URL + "/test")
            if err != nil {
                t.Fatal(err)
            }
            defer httpc.ReleaseResult(result)

            if result.Body() != tt.name {
                t.Errorf("expected %s, got %s", tt.name, result.Body())
            }
        })
    }
}
```

## Лучшие практики

| Практика | Описание |
|----------|----------|
| Используйте `httptest.Server` | Имитация реального HTTP-поведения без сетевых зависимостей |
| Используйте `TestingConfig()` | Отключает проверки безопасности, предотвращая блокировку локальных соединений |
| Вызывайте `ReleaseResult()` | Возврат в пул объектов для поддержания производительности тестов |
| Используйте `defer` | Гарантия освобождения ресурсов даже при неудачных тестах |
| Табличные тесты | Покрытие различных входных данных, лаконичный код |

## Что дальше

- [Конфигурация API](../api-reference/config) — подробные параметры TestingConfig
- [Типы ошибок](../api-reference/errors) — справочник утверждений об ошибках
- [Цепочка промежуточного ПО](./middleware-chain) — паттерны тестирования промежуточного ПО
