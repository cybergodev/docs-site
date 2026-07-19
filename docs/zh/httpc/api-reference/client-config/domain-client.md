---
sidebar_label: "域名客户端"
title: "域名客户端 - CyberGo HTTPC | NewDomain 与会话"
description: "HTTPC 域名客户端 API 参考：NewDomain 创建函数、七种 HTTP 方法与 Request 通用方法、URL 自动拼接规则、DomainClienter 接口的 SetHeader/SetCookie 会话管理与 Close 生命周期。"
sidebar_position: 2
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

:::warning 请求选项会应用两次
域名客户端在内部对请求选项**应用两次**——一次用于捕获会话状态（Cookie、请求头），一次用于实际请求。请避免使用带副作用的选项（如计数器、nonce 生成）；如需此类选项，请改用底层 `Client`。
:::

## 下载方法

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

下载文件到 `cfg.FilePath`，`path` 相对于 `baseURL` 拼接。与包级 `Download` 和 `Client.Download` 签名一致——`Download` 是贯穿三者的唯一规范下载入口。`cfg` 不能为 nil，`cfg.FilePath` 必须设置（否则返回 `ErrEmptyFilePath`）。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
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
只有 `http://` 和 `https://` 开头的路径会被识别为绝对 URL；其他协议（如 `ftp://`）不会被识别为绝对路径，会按相对路径拼接，通常导致请求失败。
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
- [域名客户端与会话](../../guides/domain-session) - 使用指南
- [接口定义](../types/interfaces) - Client、Doer 接口参考
