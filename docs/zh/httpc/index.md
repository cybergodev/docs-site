---
sidebar_label: "概述"
title: "HTTP 客户端 - CyberGo HTTPC | TLS 与 SSRF 防护"
description: "CyberGo HTTPC 是 Go 语言的 HTTP 客户端库，提供 TLS 1.2+ 强制加密、SSRF 防护、指数退避重试、中间件链、连接池管理与 Result 响应封装，适用于微服务通信、高并发 API 调用与需要出口控制的数据采集场景。"
---

# HTTPC

HTTPC 是 Go 语言的 HTTP 客户端库，构建在标准库 `net/http` 之上。它提供 TLS 策略、SSRF 防护、重试、中间件链与 `Result` 响应封装。

连接复用、HTTP/2 协商与 TLS 会话等底层能力由标准库 Transport 提供。HTTPC 在此之上增加 URL 与请求头校验、SSRF 拨号校验，以及响应体大小与解压上限检查。

## 特性

- **TLS 1.2+** - 强制最低 TLS 版本，默认 TLS 1.2-1.3
- **SSRF 防护** - 默认阻止私有 IP 连接，可配置豁免 CIDR
- **自动重试** - 指数退避 + 抖动，可自定义重试策略
- **连接池管理** - 连接复用，支持 HTTP/2
- **中间件链** - 日志、审计、指标、恢复、请求 ID 等内置中间件
- **文件下载** - 支持断点续传、进度回调、校验和验证
- **DNS-over-HTTPS** - 内置 DoH 解析，降低 DNS 劫持风险
- **对象池复用** - 内部响应对象与字符串构建器通过 sync.Pool 复用，减少 GC 压力
- **代理与代理池** - 单代理、系统代理、代理池轮换（顺序/随机），支持失败熔断与按状态码换 IP
- **证书锁定** - SPKI 哈希/公钥锁定，受信 CA 被攻破时仍可防御中间人攻击
- **TLS 指纹** - 浏览器传输层指纹伪装（JA3/JA4 + HTTP/2 帧 + 有序头块），覆盖 Chrome/Firefox/Safari 预设
- **域名会话** - DomainClient 绑定 base URL，SessionManager 维护 Cookie 与公共请求头
- **重定向管控** - 跟随开关、次数上限与目标域名白名单

### 能力矩阵

| 能力 | 默认行为 | 主要定制点 | 延伸阅读 |
|------|----------|------------|----------|
| 重试与容错 | 幂等请求最多重试 3 次（POST/PATCH 默认单次执行不重试），指数退避（1s 起、×2、单次上限 30s）+ 抖动，尊重 `Retry-After` | 次数/退避参数/自定义策略/`WithRetryNonIdempotent` 开启非幂等重试 | [重试与容错](./guides/retry-fault-tolerance) |
| 中间件链 | 不启用 | 日志/指标/审计/恢复/请求 ID/超时/静态头，支持自定义 | [中间件链](./guides/middleware-chain) |
| SSRF 防护 | 阻止私有/保留 IP（127.0.0.1、10.x、192.168.x 等） | `SSRFExemptCIDRs` 精确豁免/按请求豁免/整体关闭 | [SSRF 防护](./security/ssrf) |
| TLS 与证书锁定 | TLS 1.2–1.3 | 版本上下限、自定义 `tls.Config`、SPKI/公钥锁定 | [TLS 与证书锁定](./security/tls-certpin) |
| TLS 指纹（浏览器伪装） | 关闭（标准栈） | `Security.TLSFingerprint` 预设 + 包级 `WithTLSFingerprint` 路由 | [TLS 指纹](./guides/tls-fingerprint) |
| 连接池与 HTTP/2 | 空闲连接 50、每主机 10，HTTP/2 开启 | 池大小、空闲时长、响应头大小限制 | [连接池](./guides/connection-pool) |
| 代理与代理池 | 不使用代理 | 单代理/系统代理/池轮换/失败熔断/按状态码换 IP | [代理与代理池](./guides/proxy) |
| DNS-over-HTTPS | 关闭 | `EnableDoH`、缓存 TTL（默认 5 分钟） | [连接池](./guides/connection-pool) |
| 会话与 Cookie | 客户端级 Cookie 关闭；DomainClient 由 SessionManager 管理会话 Cookie | `EnableCookies`、域名客户端会话管理 | [域名会话](./guides/domain-session) |
| 文件传输 | — | `Download`（断点续传/进度回调/校验和）、`WithFile` 上传 | [文件传输](./guides/file-transfer) |
| 超时控制 | 整体 180s、拨号/TLS 10s、空闲连接 90s | 五级超时独立配置、请求级 `WithTimeout` 覆盖 | [请求与响应](./guides/request-response) |

## 安装

```bash
# 初始化模块（已有项目可跳过）
go mod init example.com/demo

# 安装 HTTPC（要求 Go 1.27+）
go get github.com/cybergodev/httpc
```

```go
import "github.com/cybergodev/httpc"
```

共 7 个直接依赖，均无条件参与编译（不存在按功能裁剪的构建标签）。`golang.org/x/net` 与 `golang.org/x/sys` 用于标准路径；brotli / compress / uTLS / tls-client / fhttp 服务于 `Security.TLSFingerprint` 路径，未启用指纹时只是不参与运行，请求按标准栈发出。导入后无需初始化配置。

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

该请求的处理过程：

1. `httpc.Get` 内部使用默认客户端（首次调用时惰性创建，之后复用，并发安全）；
2. 请求经过 CRLF 注入防护、SSRF 检查与 TLS 1.2+ 握手后发出；
3. 遇到可重试错误（超时、408/429/5xx 等）时按指数退避重试，最多 3 次。`Get` 为幂等请求；POST/PATCH 默认不重试；
4. 响应封装为 `*Result` 返回，状态码、响应体与重试统计通过该对象读取。

:::tip
4xx/5xx **不会**作为 `error` 返回，需用 `result.IsSuccess()` 等方法检查状态码；`err` 只表示网络层错误。详见[快速开始](./getting-started/)。
:::

## 与标准库 net/http 的关系

HTTPC 的 API 分层对应标准库，降低迁移成本：

- **双层 API 对应** — 包级 `httpc.Get` 对应 `http.Get`（使用默认客户端）。`httpc.New(cfg)` 返回的 `Client` 对应 `http.Client`（显式配置与生命周期）。
- **复用传输层** — 底层连接池、HTTP/2、代理隧道由 `net/http` 的 Transport 提供。HTTPC 在外层叠加安全校验、重试引擎、中间件链与 `Result` 转换。
- **最小接口 `Doer`** — 仅一个 `Request` 方法。替换实现（如测试 mock）时实现该接口即可，无需对接完整 `Client` 接口。
- **一致的心智模型** — `http.Cookie`、`context.Context`、超时语义与标准库用法一一对应。已有的 `net/http` 代码可直接迁移。

## 从这里开始

按目标选择阅读路径：

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
| 浏览器 TLS 指纹伪装 | [TLS 指纹](./guides/tls-fingerprint) |
| 了解安全特性 | [安全概述](./security/) |
| 查 API 签名 | [API 参考](./api-reference/) |
| 常见问题 | [FAQ](./faq/) |

## 核心概念

HTTPC 提供包级函数、`Client` 实例与域名客户端三种使用方式，控制粒度依次增强：

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
- 无法确定时：`DefaultConfig()`
- 处理不可信 URL：`SecureConfig()`，禁重定向、严格超时、5MB 响应上限
- 高吞吐场景：`PerformanceConfig()`，大连接池、启用 Cookie
- 单元测试与本地联调：`TestingConfig()`，关闭证书校验与 SSRF 防护，**不可用于生产**
- 一次性脚本：`MinimalConfig()`
:::

## 生产就绪

- **并发安全** — `Client` 可被多个 goroutine 共享，无需按并发另建客户端
- **panic 安全网** — 请求路径上的意外 panic 会被捕获并转换为 `error` 返回，不会传播到调用方
- **内存保护** — 响应体默认上限 10MB、解压后上限 100MB，防止内存耗尽与解压炸弹攻击
- **可观测性** — 内置日志、指标、审计、请求 ID 中间件；日志与错误中的 URL 凭据、敏感头自动脱敏
- **生命周期** — 实例客户端用完调用 `Close()` 释放连接池；包级函数的默认客户端由库内部管理，也可用 `SetDefaultClient()` 替换
