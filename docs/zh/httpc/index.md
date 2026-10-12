---
sidebar_label: "概述"
title: "HTTP 客户端 - CyberGo HTTPC | 安全高性能客户端"
description: "CyberGo HTTPC 是 Go 语言安全高性能 HTTP 客户端库，提供 TLS 1.2+ 强制加密、SSRF 防护、智能指数退避重试、洋葱模型中间件链、连接池管理与 Result 生命周期自动管理，适用于微服务通信与高并发 API 调用场景。"
---

# HTTPC

安全 HTTP 客户端库，默认安全，内置智能重试、中间件链和对象池复用。

HTTPC 构建在标准库 `net/http` 传输层之上：连接复用、HTTP/2 协商、TLS 会话等底层能力与标准库一致；在此之上补齐了生产级 HTTP 客户端需要、而标准库不提供的能力——强制 TLS 策略、SSRF 防护、指数退避重试、中间件链、响应体大小防线以及一站式 `Result` 封装。

## 特性

- **TLS 1.2+** - 强制最低 TLS 版本，默认 TLS 1.2-1.3
- **SSRF 防护** - 默认阻止私有 IP 连接，可配置豁免 CIDR
- **智能重试** - 指数退避 + 抖动，可自定义重试策略
- **连接池管理** - 高性能连接复用，支持 HTTP/2
- **中间件链** - 日志、审计、指标、恢复、请求 ID 等内置中间件
- **文件下载** - 支持断点续传、进度回调、校验和验证
- **DNS-over-HTTPS** - 内置 DoH 解析，减少 DNS 劫持风险
- **对象池复用** - 内部响应对象与字符串构建器通过 sync.Pool 复用，减少 GC 压力
- **代理与代理池** - 单代理、系统代理、代理池轮换（顺序/随机），支持失败熔断与按状态码换 IP
- **证书锁定** - SPKI 哈希/公钥锁定，即使受信 CA 被攻破也能防御中间人攻击
- **域名会话** - DomainClient 绑定 base URL，SessionManager 自动维护 Cookie 与公共请求头
- **重定向管控** - 跟随开关、次数上限与目标域名白名单

### 能力矩阵

| 能力 | 默认行为 | 主要定制点 | 延伸阅读 |
|------|----------|------------|----------|
| 重试与容错 | 最多重试 3 次，指数退避（1s 起、×2、单次上限 30s）+ 抖动，尊重 `Retry-After` | 次数/退避参数/自定义策略/请求级覆盖 | [重试与容错](./guides/retry-fault-tolerance) |
| 中间件链 | 不启用 | 日志/指标/审计/恢复/请求 ID/超时/静态头，支持自定义 | [中间件链](./guides/middleware-chain) |
| SSRF 防护 | 阻止私有/保留 IP（127.0.0.1、10.x、192.168.x 等） | `SSRFExemptCIDRs` 精确豁免/按请求豁免/整体关闭 | [SSRF 防护](./security/ssrf) |
| TLS 与证书锁定 | TLS 1.2–1.3 | 版本上下限、自定义 `tls.Config`、SPKI/公钥锁定 | [TLS 与证书锁定](./security/tls-certpin) |
| 连接池与 HTTP/2 | 空闲连接 50、每主机 10，HTTP/2 开启 | 池大小、空闲时长、响应头大小限制 | [连接池](./guides/connection-pool) |
| 代理与代理池 | 不使用代理 | 单代理/系统代理/池轮换/失败熔断/按状态码换 IP | [代理与代理池](./guides/proxy) |
| DNS-over-HTTPS | 关闭 | `EnableDoH`、缓存 TTL（默认 5 分钟） | [连接池](./guides/connection-pool) |
| 会话与 Cookie | 客户端级 Cookie 关闭；DomainClient 自动开启 | `EnableCookies`、域名客户端会话管理 | [域名会话](./guides/domain-session) |
| 文件传输 | — | `Download`（断点续传/进度回调/校验和）、`WithFile` 上传 | [文件传输](./guides/file-transfer) |
| 超时控制 | 整体 180s、拨号/TLS 10s、空闲连接 90s | 五级超时独立配置、请求级 `WithTimeout` 覆盖 | [请求与响应](./guides/request-response) |

## 安装

```bash
# 初始化模块（已有项目可跳过）
go mod init example.com/demo

# 安装 HTTPC（要求 Go 1.26+）
go get github.com/cybergodev/httpc
```

```go
import "github.com/cybergodev/httpc"
```

除 `golang.org/x/sys` 外无其他第三方依赖，导入即可使用，无需任何初始化配置。

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

这行请求背后发生了什么：

1. `httpc.Get` 内部解析到共享的默认客户端（首次调用惰性创建，之后复用，并发安全）；
2. 请求经过 CRLF 注入防护、SSRF 检查与 TLS 1.2+ 握手后发出；
3. 遇到可重试错误（超时、408/429/5xx 等）时按指数退避自动重试，最多 3 次；
4. 响应封装为 `*Result` 返回——状态码、响应体与重试统计一站式读取。

:::tip
4xx/5xx **不会**作为 `error` 返回，需用 `result.IsSuccess()` 等方法检查状态码；`err` 只表示网络层错误。详见[快速开始](./getting-started/)。
:::

## 与标准库 net/http 的关系

HTTPC 的 API 分层刻意对应标准库，降低迁移与心智成本：

- **双层 API 对应** — 包级 `httpc.Get` 对应 `http.Get`（共享默认实例）；`httpc.New(cfg)` 返回的 `Client` 对应 `http.Client`（显式配置与生命周期）。
- **复用而非重造传输层** — 底层连接池、HTTP/2、代理隧道由 `net/http` 的 Transport 提供；HTTPC 在外层叠加安全校验、重试引擎、中间件链与 `Result` 转换。
- **最小接口 `Doer`** — 仅一个 `Request` 方法；需要替换实现（如测试 mock）时实现它即可，无需对接完整 `Client` 接口。
- **一致的心智模型** — `http.Cookie`、`context.Context`、超时语义与标准库用法一一对应，已有 `net/http` 经验可直接迁移。

## 从这里开始

根据你的目标选择阅读路径：

| 目标 | 推荐 |
|------|------|
| 5 分钟上手 | [快速开始](./getting-started/) |
| 从 net/http 迁移 | [迁移指南](./guides/migration) |
| 30 分钟实战 | [实战教程](./guides/tutorial) |
| 查找某个用法 | [速查表](./getting-started/cheatsheet) |
| 理解设计思路 | [核心概念](./getting-started/concepts) |
| 请求选项与响应处理 | [请求与响应](./guides/request-response) |
| 重试与容错 | [重试与容错](./guides/retry-fault-tolerance) |
| 中间件链 | [中间件链](./guides/middleware-chain) |
| 连接池与 DNS | [连接池](./guides/connection-pool) |
| 代理与代理池 | [代理与代理池](./guides/proxy) |
| 文件上传下载 | [文件传输](./guides/file-transfer) |
| 会话与 Cookie | [域名会话](./guides/domain-session) |
| 重定向控制 | [重定向](./guides/redirects) |
| 性能调优 | [性能](./guides/performance) |
| 了解安全特性 | [安全概述](./security/) |
| 查 API 签名 | [API 参考](./api-reference/) |
| 常见问题 | [FAQ](./faq/) |

## 核心概念

HTTPC 提供三种使用方式，从简单到灵活：

```text
包级函数            客户端实例                  域名客户端
httpc.Get()  →  client, _ := httpc.NewDefault()  →  dc, _ := httpc.NewDomainDefault(url)
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

:::tip 如何选择
拿不准就从 `DefaultConfig()` 出发；处理用户提供的 URL 时用 `SecureConfig()`（禁重定向、严格超时、5MB 响应上限）；高吞吐场景用 `PerformanceConfig()`（大连接池、启用 Cookie）；单元测试/本地联调用 `TestingConfig()`（关闭证书校验与 SSRF 防护，**切勿用于生产**）；一次性脚本用 `MinimalConfig()`。
:::

## 生产就绪

- **并发安全** — `Client` 可被多个 goroutine 共享使用，无需为并发另建客户端
- **panic 安全网** — 请求路径上的意外 panic 会被捕获并转换为 `error` 返回，不会击穿调用方
- **内存防线** — 响应体默认上限 10MB、解压后上限 100MB，防止内存耗尽与解压炸弹攻击
- **可观测性** — 内置日志、指标、审计、请求 ID 中间件；日志与错误中的 URL 凭据、敏感头自动脱敏
- **生命周期明确** — 实例客户端用完调用 `Close()` 释放连接池；包级函数的默认客户端由库内部管理，也可用 `SetDefaultClient()` 替换为自定义实例
