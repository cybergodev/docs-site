---
title: Testing Guide - HTTPC
description: Guide to HTTPC testing, covering TestingConfig setup, httptest.Server mock responses, table-driven tests, network error simulation, and client resource cleanup.
---

# Testing Guide

## TestingConfig

`TestingConfig()` is designed for test environments, disabling security checks and shortening timeouts to speed up test execution:

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

:::danger
`TestingConfig` disables TLS verification, SSRF protection, and other security features. **Only use it in test environments.** A security warning is printed when used in non-test environments.
:::

## httptest.Server Integration

Use the standard library `net/http/httptest` to create a mock server for integration testing without a real backend:

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
    // Create mock server
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

    // Create client with TestingConfig
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // Send request to mock server
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

## Simulating Different Scenarios

### Simulating Error Responses

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### Simulating Delays

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// Test timeout handling
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := httpc.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### Simulating Redirects

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

### Simulating File Uploads

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // Parse multipart form
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

## Table-Driven Tests

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

## Best Practices

| Practice | Description |
|----------|-------------|
| Use `httptest.Server` | Simulates real HTTP behavior without network dependencies |
| Use `TestingConfig()` | Disables security checks, preventing local connections from being blocked |
| Call `ReleaseResult()` | Returns to object pool, maintaining test performance |
| Use `defer` | Ensures resource cleanup even if tests fail |
| Table-driven tests | Covers multiple inputs with concise code |

## Next Steps

- [Config API](../api-reference/config) - TestingConfig detailed parameters
- [Error Types](../api-reference/errors) - Error assertion reference
- [Middleware Chain](./middleware-chain) - Middleware testing patterns
