---
title: "测试指南 - HTTPC"
description: "HTTPC 测试指南：TestingConfig 测试专用配置、net/http/httptest 模拟服务器集成、模拟错误响应/延迟/重定向/文件上传场景、表格驱动测试模式、context 超时测试与 ReleaseResult 资源清理最佳实践。"
---

# 测试指南

## TestingConfig

`TestingConfig()` 专为测试环境设计，禁用安全检查、缩短超时，加速测试执行：

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
`TestingConfig` 禁用了 TLS 验证、SSRF 防护等安全特性，**仅用于测试环境**。在非测试环境使用时会打印安全警告。
:::

## httptest.Server 集成

使用标准库 `net/http/httptest` 创建模拟服务器，实现无需真实后端的集成测试：

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
    // 创建模拟服务器
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

    // 使用 TestingConfig 创建客户端
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // 发送请求到模拟服务器
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

## 模拟不同场景

### 模拟错误响应

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### 模拟延迟

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// 测试超时处理
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := httpc.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### 模拟重定向

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

### 模拟文件上传

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // 解析 multipart 表单
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

## 表格驱动测试

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

## 最佳实践

| 实践 | 说明 |
|------|------|
| 使用 `httptest.Server` | 模拟真实 HTTP 行为，无需网络依赖 |
| 使用 `TestingConfig()` | 禁用安全检查，避免本地连接被阻止 |
| 调用 `ReleaseResult()` | 归还对象池，保持测试性能 |
| 使用 `defer` | 确保资源释放，即使测试失败 |
| 表格驱动 | 覆盖多种输入，代码简洁 |

## 下一步

- [配置 API](../api-reference/config) - TestingConfig 详细参数
- [错误类型](../api-reference/errors) - 错误断言参考
- [中间件链](./middleware-chain) - 中间件测试模式
