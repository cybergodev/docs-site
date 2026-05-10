---
title: 快速开始 - HTTPC
description: 五分钟快速上手 HTTPC 安全 HTTP 客户端库，涵盖模块安装、GET/POST 请求、客户端配置、JSON 解析与错误处理。
---

# 快速开始

## 安装

```bash
go get github.com/cybergodev/httpc
```

## 基本请求

无需创建客户端，直接使用包级函数：

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
    fmt.Println(result.Body())       // 响应内容
}
```

支持的 HTTP 方法：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

## 创建客户端

需要自定义配置时，创建客户端实例：

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

### 预设配置

| 配置 | 用途 | 特点 |
|------|------|------|
| `DefaultConfig()` | 通用场景 | 安全默认值，SSRF 防护开启 |
| `SecureConfig()` | 安全敏感场景 | 禁用自动重定向，严格超时 |
| `PerformanceConfig()` | 高吞吐场景 | 大连接池，长超时，启用 Cookie |
| `TestingConfig()` | 测试环境 | 禁用安全检查和 HTTP/2，短超时 |
| `MinimalConfig()` | 轻量请求 | 无重试，无重定向 |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

## 响应处理

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// 状态检查
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// JSON 解析
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

## 发送数据

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// 表单
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// 带认证
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

## 错误处理

HTTPC 区分**网络层错误**和 **HTTP 状态码**：

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("错误代码: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTP 状态码需手动检查
switch {
case result.IsSuccess():
    // 2xx 成功
case result.IsClientError():
    log.Printf("客户端错误: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("服务端错误: %d", result.StatusCode())
}
```

:::tip
4xx/5xx 不会作为 `error` 返回，需通过 `result.IsSuccess()` 等方法检查。详见 [错误处理](./advanced/error-handling)。
:::

## 下一步

- **[实战教程](./guides/tutorial)** - 30 分钟构建 GitHub API 客户端
- **[请求与响应](./guides/request-response)** - 完整的请求选项和响应处理
- **[基础示例](./examples/basic-usage)** - GET/POST/中间件等实际用例
- **[速查表](./cheatsheet)** - 常用操作快速参考
- **[安全](./security/)** - 安全最佳实践
