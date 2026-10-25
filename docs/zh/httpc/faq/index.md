---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo HTTPC | 疑问与解答"
description: "HTTPC 常见问题解答：包级函数与客户端实例的选择依据、五种配置预设对比与适用场景、HTTP/SOCKS5 代理与 DoH 设置、Cookie 会话管理与重试配置、errors.Is/As 错误匹配与五级超时体系调优策略。"
sidebar_position: 10
---

# 常见问题

本页按问题归类 HTTPC 的常见疑问，每条给出结论与指向详情页的链接；答案以源码行为为准。

## 包级函数 vs Client 实例怎么选？

**答：** 包级函数（`httpc.Get`/`httpc.Post` 等）共用一个默认客户端（`defaultClient`），首次调用时创建，关闭后再次调用时重建。不需要自定义配置的一次性请求、脚本与 CLI 工具直接使用包级函数。默认客户端的生命周期见[核心概念](../getting-started/concepts)。

```go
// 包级函数：简单快捷，共享默认客户端的连接池
result, err := httpc.Get("https://api.example.com/data")
```

需要以下任一能力时，创建显式 Client 实例：

- 自定义配置（超时、代理、重试、TLS 等）
- 独立的连接池生命周期管理
- 使用中间件链（日志/审计/指标/请求 ID）
- 多个不同配置的客户端并存

```go
// 显式 Client：完全控制配置与生命周期
client, err := httpc.New(httpc.PerformanceConfig())
if err != nil {
    log.Fatal(err)
}
defer func() { _ = client.Close() }()

result, err := client.Get("https://api.example.com/data")
```

包级函数改用自定义配置时，用 `SetDefaultClient` 替换默认客户端。替换会关闭旧客户端，并中断旧实例的在途请求，因而应在启动期调用：

```go
customClient, _ := httpc.New(httpc.SecureConfig())
if err := httpc.SetDefaultClient(customClient); err != nil {
    log.Fatal(err)
}
// 此后所有包级函数使用 customClient
```

:::tip 生产环境建议
长运行服务优先使用显式 Client，避免全局状态带来的隐式耦合。包级函数适用于短生命周期程序与快速原型。
:::

## 五种配置预设怎么选？

**答：** HTTPC 提供五种预设配置，按安全性与性能权衡排列。完整对比与选型依据见[性能优化](../guides/performance)。

| 预设 | 超时 | 重试 | 重定向 | SSRF | 响应上限 | TLS 验证 | 适用场景 |
|------|------|------|--------|------|----------|----------|----------|
| `SecureConfig()` | 严格（15s） | 1 次 | 禁止 | 启用 | 5MB | 启用 | 处理不可信 URL、金融/医疗 |
| `DefaultConfig()` | 适中（180s） | 3 次 | 允许 | 启用 | 10MB | 启用 | 通用场景 |
| `PerformanceConfig()` | 较长（60s） | 3 次 | 允许 | 启用 | 50MB | 启用 | 内部微服务、高并发 API |
| `MinimalConfig()` | 适中 | 0 次 | 禁止 | 启用 | 1MB | 启用 | 一次性脚本、简单调用 |
| `TestingConfig()` | 短（5s Dial） | 1 次 | 允许 | **禁用** | 默认 | **跳过** | 单元测试、本地开发 |

决策树：

```text
是否处理不可信 URL？
├── 是 → SecureConfig()
└── 否 → 是否需要高吞吐？
         ├── 是 → PerformanceConfig()
         └── 否 → 是否一次性请求？
                  ├── 是 → MinimalConfig()
                  └── 否 → DefaultConfig()
测试环境 → TestingConfig()
```

:::warning TestingConfig 安全风险
`TestingConfig()` 禁用了 TLS 验证和 SSRF 防护，在非测试环境使用会打印警告。**严禁用于生产环境**，仅限 `*_test.go` 文件或本地开发。
:::

## 如何设置 HTTP/SOCKS5 代理？

**答：** HTTPC 提供三种代理方式，优先级为 `ProxyURL` > `ProxyPool` > `EnableSystemProxy`。

| 方式 | 字段 | 适用场景 | 特点 |
|------|------|----------|------|
| 单代理 | `ProxyURL` | 固定代理服务器 | 最高优先级，直接指定 |
| 代理池 | `ProxyPool` | 多代理轮换、高可用 | 支持轮换策略与被动熔断 |
| 系统代理 | `EnableSystemProxy` | 读取环境变量 | 最低优先级，跟随系统配置 |

同时设置多个字段时，只有优先级最高的一个生效。

```go
// 方式一：单代理（支持 http/https/socks5 协议）
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://user:pass@proxy:1080"
client, _ := httpc.New(cfg)

// 方式二：系统代理（读取 HTTP_PROXY/HTTPS_PROXY 环境变量）
cfg.Connection.EnableSystemProxy = true

// 方式三：代理池（多代理轮换 + 被动熔断）
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "socks5://proxy3:1080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
```

## 代理池轮换原理是什么？

**答：** 代理池通过三种机制实现 IP 轮换：

**1. 策略轮换**（每次选择时）：`ProxyStrategyRoundRobin` 按顺序循环选择，每次前进到下一个代理，因此重试会**落到不同 IP**，无需额外配置。`ProxyStrategyRandom` 从健康代理中随机选取。

**2. 每请求轮换**（请求开始时）：设置 `ProxyRotatePerRequest = true`，每次独立请求开始时关闭所有空闲连接，强制 Transport 重新评估代理池。不启用时，HTTP 连接复用会使对同一主机的连续请求复用前一次请求的代理隧道，绕过策略轮换。代价是不再复用连接（每次请求新建连接），换来按请求轮换。适用于对同一主机的爬虫/数据采集：每次请求的源 IP 不同。

**3. 状态码触发轮换**（响应时）：设置 `ProxyRotateOnStatus`（如 `[]int{403}`），响应返回这些状态码且 `Retry.MaxRetries > 0` 时触发重试，重试时策略轮换确保换 IP。适用于绕过 CF/WAF 等 IP 维度封锁。

代理池内置**被动熔断与自动恢复**：连续连接失败（dial/TLS）达到 `ProxyFailureThreshold`（默认 3）后，该代理被临时移出轮换池；经过 `ProxyCooldown`（默认 30s）后以半开探测方式恢复。

HTTP 状态码**不**触发熔断：封锁针对具体目标站点，在某站被封的代理对其他站点仍可用。

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
cfg.Connection.ProxyFailureThreshold = 3   // 连续 3 次连接失败后熔断
cfg.Connection.ProxyCooldown = 30 * time.Second // 30s 后半开探测恢复
cfg.Connection.ProxyRotateOnStatus = []int{403} // 收到 403 时换 IP 重试
cfg.Retry.MaxRetries = 3 // ProxyRotateOnStatus 需配合重试
```

代理池与重试预算的关系见[代理配置](../guides/proxy)。

## DoH 怎么配置？

**答：** DNS-over-HTTPS（DoH）可减少 DNS 解析延迟，并防止 DNS 劫持与缓存投毒。开启方式：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // DNS 响应缓存时长（默认 5 分钟）
```

默认使用 Cloudflare、Google、AliDNS 三个提供商，按优先级回退。所有 DoH 提供商不可用时，自动回退到系统 DNS。

:::tip 何时使用 DoH
DoH 适用于对 DNS 解析安全性有要求的场景，如防止 ISP DNS 劫持。常规 API 调用无需开启：系统 DNS 已满足需求，且 DoH 会增加解析延迟（首次查询需一次 HTTPS 往返）。
:::

详见 [连接池与 DNS](../guides/connection-pool#dns-over-https)。

## Cookie 会话怎么管理？

**答：** Cookie 管理有两个层次：

**1. 自动管理（DomainClient）**：`NewDomain` 创建的 DomainClient 内置一个 SessionManager。请求前由 `prepareOptions` 注入会话 Cookie，响应后由 `UpdateFromResult` 捕获 `Set-Cookie` 写回会话。

会话存储独立于 `Connection.EnableCookies`。适合登录会话维持等场景。

**2. 手动管理（SessionManager）**：需要更精细控制时，直接操作 `dc.Session()` 返回的 `*SessionManager`：设置/删除/查询 Cookie、运行时切换安全策略、从响应批量提取。

```go
// 自动管理：登录后会话自动维持
dc, _ := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
defer func() { _ = dc.Close() }()

// 登录（响应的 Set-Cookie 自动捕获）
_, _ = dc.Request(ctx, "POST", "/login", httpc.WithJSON(loginData))

// 后续请求自动携带会话 Cookie
result, _ := dc.Request(ctx, "GET", "/profile")
```

普通 Client 设置 `cfg.Connection.EnableCookies = true` 后，由 cookie jar 自动管理 Cookie，但不会提取到 SessionManager。

详见 [会话管理](../api-reference/client-config/session)。

## 重试怎么配置？

**答：** HTTPC 默认重试 3 次，只重试**可重试的瞬时错误**。

**默认重试条件**（无需配置）：
- 网络层错误：连接拒绝、连接重置、网络不可达等
- 传输层超时：`net.OpError` 超时（**非**上下文截止）
- 特定 HTTP 状态码：408（请求超时）、429（限流）、500、502、503、504

**Retry-After 头解析**：429/503 等可重试响应带 `Retry-After` 头时，HTTPC 按服务端指示的延迟等待，不再自行计算退避，避免加剧服务端压力。该等待**封顶 60s**，服务端无法用超大 Retry-After 值长时间占住客户端。

**自定义重试**：实现 `RetryPolicy` 接口（`ShouldRetry` + `GetDelay` 两个方法）替换内置逻辑，赋值到 `cfg.Retry.CustomPolicy`。详见 [重试与容错指南](../guides/retry-fault-tolerance)。

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5              // 最多重试 5 次（上限 10）
cfg.Retry.Delay = 2 * time.Second     // 初始延迟
cfg.Retry.BackoffFactor = 2.0         // 指数退避因子
cfg.Retry.MaxRetryDelay = 60 * time.Second // 单次最大延迟
cfg.Retry.EnableJitter = true         // 抖动（防惊群）
```

:::warning context 取消不重试
由 `context.Canceled` 和 `context.DeadlineExceeded` 触发的失败**永不重试**：它们表示调用方显式的取消/超时意图，重试会违背该意图。
:::

详见 [重试与容错](../guides/retry-fault-tolerance)。

## 超时怎么选？

**答：** HTTPC 提供五级超时体系，作用范围从宽到窄：

| 超时层 | 字段 | 默认值 | 作用域 | 可请求级覆盖 |
|--------|------|--------|--------|:----------:|
| 请求总超时 | `TimeoutConfig.Request` | 180s | 含重试的全过程 | `WithTimeout()` |
| 拨号超时 | `TimeoutConfig.Dial` | 10s | TCP 连接建立 | 否 |
| TLS 握手超时 | `TimeoutConfig.TLSHandshake` | 10s | TLS 握手（仅 HTTPS） | 否 |
| 空闲连接超时 | `TimeoutConfig.IdleConn` | 90s | 连接保持空闲时长 | 否 |
| 响应头超时 | `TimeoutConfig.ResponseHeader` | 0（禁用） | 等待响应头到达 | **不可**覆盖 |

**ResponseHeader 行为**：默认为 0（禁用），此时由 `TimeoutConfig.Request` 或 `WithTimeout()` 的上下文超时控制。设为正值后成为传输层硬上限（防御 slowloris）：短于 `WithTimeout` 预算时先触发，且作用于**共用同一 client 的所有请求**。

设计原因见[配置参考](../api-reference/client-config/config)。

```go
// 推荐：上下文超时（精细控制，可逐请求设置）
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, _ := client.Request(ctx, "GET", url)

// 请求选项覆盖（内部转为上下文超时）
result, _ := client.Get(url, httpc.WithTimeout(30*time.Second))
```

:::warning TimeoutMiddleware 不适用于 Download
`TimeoutMiddleware` 的上下文在 handler 返回（收到响应头）时即被取消，而响应体尚未读取。中间件因此在请求进入时直接拒绝流式请求：`Download` 或 `WithStreamBody` 请求返回 `TimeoutMiddleware is incompatible with streaming responses`。

此类场景改用 `WithTimeout`：其截止时间作用于引擎的整体上下文，覆盖 body 读取。
:::

## 4xx/5xx 为什么不返回 error？

**答：** HTTP 状态码是**应用层语义**，不是传输层错误。返回 404 的响应在网络层是完全成功的：TCP 连接建立、TLS 握手完成、HTTP 请求送达、响应正确返回。把状态码视为 error 会与网络层错误混淆，增加错误处理复杂度。

因此 HTTPC 只在**网络层失败**时返回 error（连接拒绝、超时、DNS 失败等），HTTP 状态码通过 `Result` 检查：

```go
result, err := client.Get(url)
if err != nil {
    // 网络层错误（连接失败、超时等）
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("网络错误: %s", clientErr.Code())
    }
    return err
}

// HTTP 状态码检查
switch {
case result.IsSuccess():      // 2xx
    handleSuccess(result)
case result.IsClientError():  // 4xx
    log.Printf("客户端错误：%d", result.StatusCode())
case result.IsServerError():  // 5xx
    log.Printf("服务端错误：%d", result.StatusCode())
}
```

## 如何处理大文件下载？

**答：** 使用 `Download` 方法进行流式下载，支持进度回调、断点续传、SHA-256 校验与路径安全检查：

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
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatalf("创建客户端失败: %v", err)
	}
	defer func() { _ = client.Close() }()

	cfg := httpc.DefaultDownloadConfig()
	cfg.FilePath = "/tmp/large-file.zip"
	cfg.Overwrite = true
	cfg.ResumeDownload = true                            // 断点续传：中断后重下会从断点继续
	cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb924..." // 预期 SHA-256
	cfg.ChecksumAlgorithm = httpc.ChecksumSHA256
	cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
		if total > 0 {
			fmt.Printf("\r%.1f%% (%s / %s, %s)",
				float64(downloaded)/float64(total)*100,
				httpc.FormatBytes(downloaded),
				httpc.FormatBytes(total),
				httpc.FormatSpeed(speed))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	result, err := client.Download(ctx, "https://example.com/large-file.zip", cfg)
	if err != nil {
		log.Fatalf("下载失败: %v", err)
	}
	fmt.Printf("\n下载完成: %s (%d 字节)\n", result.FilePath, result.BytesWritten)
}
```

:::tip 路径安全
Download 会校验 FilePath：拒绝目录路径（返回文件打开错误），也拒绝不支持的校验算法（在触碰目标文件之前拒绝）。

断点续传依赖服务器支持 Range 请求。服务器返回 200 而非 206 时，HTTPC 返回错误并保留已有的部分文件（不截断，也不从头覆盖）。
:::

## 证书固定怎么做？

**答：** 证书固定（Certificate Pinning）在 TLS 握手阶段验证服务器公钥是否匹配预置指纹，受信任 CA 被攻破时仍可防御中间人攻击。

**SPKI 哈希生成步骤**（使用 OpenSSL）：

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

**多哈希轮换**：传入多个哈希支持密钥轮换，服务器密钥匹配**任意一个**预置哈希即通过。始终配置一个备份哈希，服务端轮换密钥时客户端不会断连。

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前密钥
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备份密钥（轮换用）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, _ := httpc.New(cfg)
```

Pinner 实例可由多个 Client 共享：内部并发安全，且不会被深拷贝。

## context 取消后请求会重试吗？

**答：** **不会**。`context.Canceled` 和 `context.DeadlineExceeded` 不可重试：它们表示调用方的显式取消或超时意图，重试会违背该意图。

HTTPC 的 `IsRetryable()` 在其余判断之前**先检查 context 错误**：Cause 链中包含 `context.Canceled` 或 `context.DeadlineExceeded` 时直接返回 false。

即使错误被归类为 `ErrorTypeNetwork`，该检查仍将其判定为不可重试。

```go
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(100 * time.Millisecond)
    cancel() // 主动取消
}()

_, err := client.Request(ctx, "GET", "https://example.com/slow")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        fmt.Println(clientErr.Type == httpc.ErrorTypeContextCanceled) // true
        fmt.Println(clientErr.IsRetryable())                          // false
    }
}
```

## MaxRedirects(0) 为什么不禁止重定向？

**答：** `MaxRedirects = 0` 是"未设置"哨兵值，不是"禁止重定向"。`DefaultConfig()` 中 `MaxRedirects` 默认为 10。禁止重定向用 `WithFollowRedirects(false)`，或设置 `Config.Security.FollowRedirects = false`：

```go
// 方式一：配置级禁止
cfg := httpc.DefaultConfig()
cfg.Security.FollowRedirects = false
client, _ := httpc.New(cfg)

// 方式二：请求级禁止
result, _ := client.Get(url, httpc.WithFollowRedirects(false))
```

`SecureConfig()` 预设已默认禁止重定向（`FollowRedirects = false`），防止基于重定向的 SSRF 攻击。

重定向的完整行为（跟随控制、链追踪、域名白名单）见 [重定向指南](../guides/redirects)。

## io.Reader 请求体为什么不验证大小？

**答：** `io.Reader` 无法预知数据长度，也没有 `Len()` 方法，读取即消费。默认 `Security.MaxRequestBodySize = 0` 时不施加限制，数据量由调用方控制。

需要封顶时，可在调用方用标准库 `io.LimitReader` 包装：

```go
// 限制最多上传 1MB
limitedReader := io.LimitReader(unlimitedReader, 1024*1024)
result, err := client.Post(url, httpc.WithBody(limitedReader))
```

或配置 `SecurityConfig.MaxRequestBodySize` 设置引擎级上传上限（默认 0 = 不限制）。设置后引擎在发送时用计数读取器包裹 `io.Reader`，读取超过上限即中止传输并返回 `request body exceeds limit of N bytes`：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxRequestBodySize = 10 * 1024 * 1024 // 全局限制 10MB
```

## 如何抑制安全警告？

**答：** `TestingConfig()` 等不安全配置在非测试环境使用时，向默认的 `os.Stderr` 打印警告。需要抑制时（如 CI 环境的特定场景），用 `SetSecurityWarnOutput(io.Writer)` 将警告输出重定向到 `io.Discard`：

```go
// 抑制所有安全警告输出
httpc.SetSecurityWarnOutput(io.Discard)

cfg := httpc.TestingConfig() // 不再打印警告
```

:::warning 仅限受控环境
抑制安全警告只是静默输出，**不会**恢复被禁用的安全特性。务必仅在受控环境（CI、容器化测试）中使用，生产环境应使用 `SecureConfig()` 或 `DefaultConfig()`。
:::

## 如何访问内部服务？

**答：** 默认 SSRF 防护阻止私有 IP 连接（127.0.0.1、10.x、192.168.x、169.254.x 等）。访问内部服务有两种方式：

```go
// 方式一：精确豁免（推荐）——仅允许指定 CIDR 范围
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",     // VPC 内网
    "100.64.0.0/10",  // Tailscale/VPN
}

// 方式二：完全禁用（危险）——关闭所有连接级 SSRF 拨号校验
cfg.Security.AllowPrivateIPs = true
```

:::warning AllowPrivateIPs 的风险
`AllowPrivateIPs = true` 不仅允许私有 IP，还**完全绕过连接级 SSRF 拨号验证**（含 localhost/loopback/link-local 检查）。仅在连接受信任的内部服务时使用；处理用户输入的 URL 时**不要**开启，改用 `SSRFExemptCIDRs` 精确豁免。
:::

## 如何记录请求日志？

**答：** 使用 `LoggingMiddleware` 添加请求日志，URL 自动脱敏以防凭证泄漏：

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{
        LogFunc: func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        },
    }),
}
client, _ := httpc.New(cfg)
```

如需合规级审计（记录请求/响应头、重定向链、源 IP、用户 ID），使用 `AuditMiddleware`。详见 [内置中间件参考](../api-reference/client-config/middleware)。

## HTTPC 和 net/http 是什么关系？

**答：** HTTPC 构建在 `net/http` 之上，不是替代品。底层引擎仍是 `http.Client` 与 `http.Transport`：HTTPC 用自己的连接池管理器创建并配置 `*http.Transport`，连接复用、TLS、HTTP/2 与代理选择由标准库执行。

重定向策略通过 `CheckRedirect` 回调注入，SSRF 校验包装在拨号函数 `DialContext` 中。

在此之上，HTTPC 补充了标准库没有的部分：请求级选项链、结果对象池化（低分配）、重试引擎、中间件链、多层安全校验、审计与日志中间件。

:::tip 生态兼容
与标准库生态兼容：`http.Cookie`、`tls.Config`、`context.Context`、`io.Reader` 等类型直接使用，无需适配层。

`tls.Config` 的既有知识（mTLS、自定义 CA、密码套件）可原样迁移到 `Security.TLSConfig`。
:::

## WithTimeout 的超时包含重试时间吗？

**答：** 包含。`WithTimeout`（以及 `Timeouts.Request`）是**覆盖所有重试尝试与退避等待的总预算**：重试引擎为整个请求建立单一截止时间，不在每次尝试时重新计时。

```go
// 总预算 30s：首次尝试 + 最多 3 次重试 + 退避等待，合计不超过 30s
result, err := client.Get(url, httpc.WithTimeout(30*time.Second))
```

退避等待同样消耗预算，预算过紧时重试无法完成；`WithTimeout` 上限为 30 分钟，超出返回 `ErrInvalidTimeout`。预算共享的实现见[重试与容错](../guides/retry-fault-tolerance)。

## 重试会导致 POST 重复提交吗？

**答：** 默认**不会**。HTTPC 对 408/429/500/502/503/504 与网络层瞬时错误自动重试，但**只作用于幂等请求**（GET/HEAD/PUT/DELETE/OPTIONS/TRACE）。

POST、PATCH 及自定义方法默认**单次执行、不重试**：超时或可重试 5xx 可能在服务端已提交操作后才到达，重放请求体会造成重复创建、重复扣款。

只有显式启用非幂等重试时才有风险：

```go
// 显式开启非幂等重试：请求体可能被发送不止一次（警惕重复提交）
client.Post(url, httpc.WithJSON(order), httpc.WithRetryNonIdempotent(true))

// 推荐：服务端幂等键去重（即便开启重试也安全）
client.Post(url,
    httpc.WithJSON(order),
    httpc.WithHeader("Idempotency-Key", orderID),
)
```

补充两点：`io.Reader` 请求体为支持重试重放会完整缓冲（上限 100MB，超出报错），重试发送的 body 与首次一致。

`context.Canceled`/`DeadlineExceeded` 永不重试，主动取消不会触发重复提交。详见 [重试与容错](../guides/retry-fault-tolerance)。

## 响应 Body 需要手动关闭吗？

**答：** 不需要，也没有关闭入口。普通请求（`Get`/`Post`/`Request` 等）返回的 `Result` 持有**已读取并复制的字节**：HTTPC 在内部完成读取、排空（最多 10MB，便于连接复用）与关闭，底层连接由连接池管理。

```go
result, err := client.Get(url)
if err != nil {
    log.Fatal(err)
}
fmt.Println(len(result.RawBody())) // 字节已在内存中，没有未关闭的句柄
```

大文件不要用普通请求读进内存，改用 `Download`（流式写盘、进度回调、断点续传）。

`WithStreamBody` 只在 `Download` 路径生效：与普通请求方法（`Get`/`Post`/`Request` 等）同用时，请求直接以 `ErrStreamBodyRequiresDownload` 失败，不会返回空响应体。详见 [文件传输指南](../guides/file-transfer)。

## 设置了代理为什么不生效？

**答：** 按以下顺序排查（每项均为源码可验证的行为）：

**1. 优先级冲突。** `ProxyURL` > `ProxyPool` > `EnableSystemProxy`，同时设置时只有最高优先级者生效：配置了 `ProxyURL` 就不再走代理池。

**2. 连接复用绕过了代理选择。** 对同一主机的连续请求复用已建立的连接（包括 HTTP 代理的 CONNECT 隧道），不再触发代理选择函数。需要**每个请求换出口 IP** 时设置：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{"http://proxy1:8080", "http://proxy2:8080"}
cfg.Connection.ProxyRotatePerRequest = true // 每请求关闭空闲连接，强制重新选代理
```

**3. 系统代理的探测时机。** `EnableSystemProxy` 在客户端**构建时**探测一次代理地址（用于 SSRF 豁免）。环境变量此后才指向 localhost 代理（如 `127.0.0.1:7890`）时，该代理会被 SSRF 防护拦截。动态本地代理改用显式 `ProxyURL`（支持 http/https/socks5/socks5h）。

**4. 代理池熔断。** 连续连接失败达 `ProxyFailureThreshold`（默认 3）的代理被移出轮换，`ProxyCooldown`（默认 30s）后半开探测恢复；全部熔断时退化为选择最早恢复的代理，不会直接失败。代理持续不可用时，检查熔断阈值与冷却时间。

详见 [代理与代理池](../guides/proxy)。

## 为什么豁免了 127.0.0.0/8 还是访问不了 localhost？

**答：** 预检校验层的 localhost 主机名检查**先于** CIDR 豁免执行：URL 主机名为 `localhost`、`127.x.x.x`、`::1` 等形式时直接拒绝，不进入豁免匹配。`SSRFExemptCIDRs` 只能放行非回环的私网段（如 `10.0.0.0/8`）。

确需访问回环地址（如本机健康检查）：

```go
// 请求级放行（推荐）：仅该请求跳过 SSRF 校验，客户端整体策略不变
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

详见 [SSRF 防护的已知边界](../security/ssrf)。

## 错误信息里的 URL 为什么被打了码？

**答：** HTTPC 对进入错误信息、日志与审计事件的 URL 自动脱敏：凭据替换为 `***:***`，`token`/`password`/`api_key` 等敏感查询参数替换为 `[REDACTED]`，fragment 整体移除。

```go
// 请求 https://user:pass@example.com/api?token=secret 失败时
// 错误信息中出现的是 https://***:***@example.com/api?token=[REDACTED]
```

这是防「二次泄漏」：请求失败本身无害，但原始 URL 进入日志聚合系统（ELK、Sentry）后，凭据就成了新的泄漏面。该行为内置且不可关闭。

## 更多资源

- [快速开始](../getting-started/) - 5 分钟上手
- [实战教程](../guides/tutorial) - 完整示例
- [配置 API](../api-reference/client-config/config) - 完整配置参考
- [错误类型](../api-reference/types/errors) - ClientError 与错误分类详解
- [错误处理](../guides/error-handling) - 错误处理指南
