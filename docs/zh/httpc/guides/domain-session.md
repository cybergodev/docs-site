---
title: "域名客户端与会话 - CyberGo HTTPC | 会话与域名管理"
description: "HTTPC 域名客户端与会话管理指南：NewDomain 创建域名作用域客户端、URL 自动拼接规则、SetHeader 会话头维护、Cookie 自动管理与响应捕获、CookieSecurity 安全验证策略与 REST API 客户端封装实战示例。"
---

# 域名客户端与会话

域名客户端（DomainClient）是针对同一域名的会话管理客户端，自动维护 Cookie 和请求头。

## 创建域名客户端

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie 自动启用
dc.SetHeader("Authorization", "Bearer "+token)

// 使用相对路径发送请求
result, err := dc.Get("/users")
```

:::tip
`NewDomain` 会自动启用 Cookie 管理（`EnableCookies = true`），无需手动配置。
:::

## 会话头管理

```go
// 设置会话头（所有后续请求自动携带）
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 批量设置
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// 删除和清空
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// 查询
headers := dc.GetHeaders()
```

## Cookie 管理

```go
// 设置 Cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// 批量设置
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "zh"},
})

// 响应 Cookie 自动捕获
result, _ := dc.Get("/login")
// 服务器返回的 Set-Cookie 自动存储到会话

// 查询
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// 删除和清空
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
每次请求后，服务器返回的 Cookie 会自动更新到会话中，无需手动处理。
:::

## 请求方式

```go
// 相对路径
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// 带上下文
result, _ := dc.Request(ctx, "GET", "/users")

// 绝对 URL（跳过 base URL 拼接）
result, _ := dc.Get("https://other-api.com/data")
```

## 会话访问

```go
// 获取基础信息
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// 访问底层 SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Cookie 安全验证

可配置 Cookie 安全策略，仅接受符合安全标准的 Cookie：

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// 设置严格 Cookie 安全
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// 要求: Secure=true, HttpOnly=true, SameSite=Strict

// 不符合安全要求的 Cookie 会导致 SetCookie 返回错误
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // 缺少 Secure, HttpOnly → 被拒绝
}); err != nil {
    log.Println("Cookie 被拒绝:", err)
}
```

## 完整示例：REST API 客户端

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
    // 创建域名客户端
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // 登录获取 Token
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // 从响应中解析 Token
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }

    // 设置会话头
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // 后续请求自动携带 Token 和 Cookie
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(users.StatusCode()) // 200
}
```

## 下一步

- [域名客户端 API](../api-reference/domain-client) - 完整 API 参考
- [会话管理 API](../api-reference/session) - SessionManager 参考
- [请求与响应](./request-response) - 基本请求指南
