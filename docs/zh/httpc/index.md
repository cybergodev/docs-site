---
title: "HTTP 客户端 - CyberGo HTTPC | 安全高性能客户端"
description: "CyberGo HTTPC 是 Go 语言安全高性能 HTTP 客户端库，提供 TLS 1.2+ 强制加密、SSRF 防护、智能指数退避重试、洋葱模型中间件链、连接池管理与 Result 生命周期自动管理，适用于微服务通信与高并发 API 调用场景。"
---

# HTTPC

安全 HTTP 客户端库，默认安全，内置智能重试、中间件链和对象池复用。

## 特性

- **TLS 1.2+** - 强制最低 TLS 版本，默认 TLS 1.2-1.3
- **SSRF 防护** - 默认阻止私有 IP 连接，可配置豁免 CIDR
- **智能重试** - 指数退避 + 抖动，可自定义重试策略
- **连接池管理** - 高性能连接复用，支持 HTTP/2
- **中间件链** - 日志、审计、指标、恢复、请求 ID 等内置中间件
- **文件下载** - 支持断点续传、进度回调、校验和验证
- **DNS-over-HTTPS** - 内置 DoH 解析，减少 DNS 劫持风险
- **对象池复用** - 内部响应对象与字符串构建器通过 sync.Pool 复用，减少 GC 压力

## 安装

```bash
go get github.com/cybergodev/httpc
```

## 30 秒体验

```go
package main

import (
    "fmt"
    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        panic(err)
    }

    fmt.Println(result.StatusCode()) // 200
}
```

## 从这里开始

根据你的目标选择阅读路径：

| 目标 | 推荐 |
|------|------|
| 5 分钟上手 | [快速开始](./getting-started) |
| 30 分钟实战 | [实战教程](./guides/tutorial) |
| 查找某个用法 | [速查表](./cheatsheet) |
| 了解安全特性 | [安全概述](./security/) |
| 查 API 签名 | [API 参考](./api-reference/) |

## 核心概念

HTTPC 提供三种使用方式，从简单到灵活：

```text
包级函数            客户端实例                  域名客户端
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
一次性请求       自定义配置/中间件       会话管理/Cookie 自动维护
```

### 配置预设

| 预设 | 适用场景 |
|------|----------|
| `DefaultConfig()` | 通用场景，安全默认值 |
| `SecureConfig()` | 安全敏感场景，严格超时 |
| `PerformanceConfig()` | 高吞吐，大连接池 |
| `TestingConfig()` | 测试环境，禁用安全检查 |
| `MinimalConfig()` | 轻量脚本，无重试无重定向 |
