---
title: 域名客户端 - HTTPC
description: HTTPC 域名客户端 API 参考，包含 NewDomain 创建、七种 HTTP 方法、四种下载方法、URL 自动拼接、会话头与 Cookie 管理。
---

# 域名客户端

域名客户端提供针对特定域名的请求管理，自动维护 Cookie 和请求头。

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

创建域名作用域客户端。Cookie 自动启用。

```go
// 使用默认配置
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 使用自定义配置
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**参数说明：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `baseURL` | `string` | 基础 URL（必须包含 scheme 和 host） |
| `config` | `...*Config` | 可选配置，不传使用 DefaultConfig() |

**返回：** `DomainClienter` 接口（非具体类型 `*DomainClient`）。

## HTTP 方法

所有方法接受相对路径或绝对 URL：

```go
// 相对路径：自动拼接 baseURL
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// 绝对 URL：直接使用
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

带上下文的通用请求方法，支持超时和取消控制。

## 下载方法

```go
// 基本下载
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")

// 带配置下载
result, err := dc.DownloadWithOptions("/files/report.pdf", downloadOpts)

// 带上下文
result, err := dc.DownloadFileWithContext(ctx, "/files/report.pdf", "/tmp/report.pdf")
result, err := dc.DownloadWithOptionsWithContext(ctx, "/files/report.pdf", downloadOpts)
```

下载的响应 Cookie 会自动捕获到会话中。

## 访问方法

```go
dc.URL()      // string - 基础 URL
dc.Domain()   // string - 域名（不含端口）
dc.Session()  // *SessionManager - 底层会话管理器
dc.Close()    // error - 关闭客户端释放资源
```

## URL 拼接规则

| 输入路径 | 拼接结果（baseURL = `https://api.example.com/v1`） |
|----------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api`（绝对 URL） |

:::warning
仅允许 `http://` 和 `https://` 协议的绝对 URL，其他协议会被拒绝（防止 SSRF）。
:::

## DomainClienter 接口

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

推荐使用接口类型而非具体类型，便于测试和替换实现。

## 另见

- [会话管理](./session) - SessionManager 详细参考
- [域名客户端与会话](../guides/domain-session) - 使用指南
- [接口定义](./interfaces) - Client、Doer 接口参考
