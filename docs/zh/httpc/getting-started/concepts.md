---
title: "核心概念 - CyberGo HTTPC | 双层架构与配置体系"
description: "HTTPC 核心概念详解：双层 API 架构与核心构件职责表（Client、Doer、Result、SessionManager、中间件、Mutator）、Config 与 With* 请求选项的分层、一次请求的生命周期、DomainClient 会话管理，以及 ClientError 错误模型与可重试判定。"
sidebar_label: "核心概念"
sidebar_position: 20
---

# 核心概念

HTTPC 是构建在标准库 `net/http` 之上的 HTTP 客户端库，由客户端实例、请求选项、中间件链与 `Result` 响应封装组成。本页说明各构件的职责、配置分层与一次请求的处理流程。

## 核心构件一览

| 构件 | 职责 | 关键点 |
|------|------|--------|
| `Client`（接口） | 执行请求、管理连接池与生命周期 | `New(cfg)` / `NewDefault()` 创建；7 个动词方法 + `Request` + `Download` + `Close` |
| `Doer`（接口） | 最小请求接口 | 仅 `Request(ctx, method, url, opts...)` 一个方法；用于 mock 与自定义实现 |
| `RequestOption`（`With*` 函数） | 构建单次请求 | 函数式选项；按传入顺序应用，任一失败立即中止请求 |
| `MiddlewareFunc` / `Handler` | 中间件与终点处理 | 洋葱模型；`Chain(mw...)` 组合 |
| `RequestMutator` / `ResponseMutator` | 中间件内的请求/响应读写视图 | 请求阶段读写请求、响应阶段读写响应 |
| `SessionManager` | 会话状态存储 | 线程安全；统一管理 Cookie 与公共请求头 |
| `DomainClienter`（接口） | 域名客户端 | 绑定 base URL + 内嵌会话；相对路径自动拼接 |
| `Result` | 响应封装 | 请求/响应/元信息三段结构；nil 安全访问器；GC 自动回收 |
| `ClientError` | 网络层错误分类 | `errors.As` 提取；`Code()` / `IsRetryable()` / `Attempts` |

构件之间的调用关系：

<!-- autocorrect-disable — 下面的 ASCII 架构图靠连续空格对齐三列，排版规则会压缩对齐空格，禁用。 -->
```text
包级函数 ──共享──▶ 默认 Client ◀──创建── New(cfg)
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   中间件链（可选）   引擎执行        Download
   Chain(mw...)     安全校验/重试    文件流式下载
        │              │
        ▼              ▼
  RequestMutator     Result（Request / Response / Meta）

DomainClienter = Client + base URL + SessionManager
（请求前注入会话头/Cookie，响应后回写 Set-Cookie）
```
<!-- autocorrect-enable -->


## 双层 API 架构

HTTPC 提供两种请求方式，与标准库 `net/http` 中 `http.Get` 与 `http.Client` 的关系对应：

**包级函数** — 不需要额外配置，内部使用惰性初始化的默认客户端，适合脚本和一次性请求：

```go
result, err := httpc.Get("https://api.example.com/data")
```

**Client 实例** — 完全控制配置、连接池和生命周期，适合长期运行的服务：

```go
client, err := httpc.NewDefault()
defer func() { _ = client.Close() }()
result, err := client.Get("https://api.example.com/data")
```

两种方式接受相同的请求选项（`WithHeader`、`WithJSON`…），返回相同的 `*Result` 类型。包级函数是 Client 实例的轻量封装。

默认客户端可以替换。`SetDefaultClient(client)` 将自定义实例设为默认，旧实例自动关闭；`CloseDefaultClient()` 关闭并重置。关闭后下一次包级调用会自动重建。

替换默认客户端会**关闭旧实例并中断其上仍在途的请求**，并发的调用方会观察到连接错误。因此只应在启动期或静默期调用，不应在活跃流量下替换。

:::tip 选择依据
一次性请求或快速原型 → 包级函数。生产服务、需自定义配置或连接池管理 → Client 实例。
:::

## 配置体系：Config 与 With\* 选项

HTTPC 将配置分为两个独立层级，避免混淆：

| 层级 | 载体 | 作用域 | 典型字段 |
|------|------|--------|----------|
| **实例配置** | `Config` 结构体 | 整个客户端生命周期 | 超时、重试策略、连接池、TLS |
| **请求选项** | `WithXxx()` 函数 | 单次请求 | `WithHeader`、`WithJSON`、`WithTimeout` |

实例配置通过 `Config` 结构体传入 `New()`，从 `DefaultConfig()` 出发按需修改：

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

请求选项在每次调用时传入，补充或覆盖实例级默认值：

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer "+token),
    httpc.WithTimeout(30*time.Second),
)
```

也可使用预设配置（`SecureConfig()`、`PerformanceConfig()` 等）作为起点，详见 [配置 API](../api-reference/client-config/config)。

全库配置遵循统一惯例：

- 主 `Config` 与 `SessionConfig` **按值传递**（必填）；
- 中间件配置**按指针传递**，传 `nil` 表示采用默认值；
- `DownloadConfig` 按指针传递，且必须设置 `FilePath`。

每个 `XxxConfig` 都有对应的 `DefaultXxxConfig()` 构造函数：从默认值出发按需修改字段。

## 请求生命周期

每次请求经历以下流程：

```text
选项应用 → 中间件链（如有）→ 引擎执行 → 重试（如需要）→ Result 返回
    ↑                                    ↑
  With* 函数                    连接池 / TLS / 代理 / SSRF 检查
```

各阶段细节：

- **选项应用** — `With*` 函数设置请求头、请求体、超时等；按传入顺序执行，任一选项返回错误（如请求头未通过 CRLF 校验）则请求立即失败。
- **中间件链** — 配置了 `Config.Middleware.Middlewares` 时启用。请求按注册顺序穿过中间件，终点 Handler 把经中间件处理后的请求交给引擎。未配置中间件时请求直连引擎，无额外开销。
- **引擎执行** — 依次完成 URL 与请求头校验（默认开启）、SSRF 拨号校验（默认阻止私有 IP）、DNS 解析（可选 DoH）。然后从连接池取连接（不足则新建，受 `MaxConnsPerHost` 约束），执行 TLS 握手（版本策略、可选证书锁定），发送请求。响应读取阶段检查响应体大小与解压上限。
- **重试** — 可重试条件：超时、传输错误、瞬时网络错误，以及状态码 408/429/500/502/503/504。退避按 `Delay × BackoffFactor^n` 计算并叠加抖动，单次等待不超过 `MaxRetryDelay`。响应带 `Retry-After` 头时优先采用，上限 60s。整体耗时受 `Timeouts.Request` 或 `WithTimeout` 约束。**超时预算跨重试共享**，不会每轮重置。
- **Result** — 包含响应数据、请求元信息和重试统计；引擎内部对象已池化但对调用方透明，`Result` 由 GC 自动回收，无需手动释放。

重试耗尽有两种结局：

- **网络错误耗尽** → 返回 `error`（`ClientError.Attempts` 记录尝试次数）；
- **可重试状态码（如 503）耗尽** → 返回**最后一次响应**（`result.StatusCode() == 503`，`Meta.Attempts` 记录总次数），调用方按状态码自行处理。

## 中间件模型

中间件是 `func(Handler) Handler` 形式的函数（`MiddlewareFunc`），`Handler` 是实际处理请求的函数签名：

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
type MiddlewareFunc func(Handler) Handler
```

中间件注册在 `Config.Middleware.Middlewares`，由 `Chain(middlewares...)` 组合成洋葱模型。第一个中间件在最外层：请求阶段按注册顺序执行，响应阶段逆序执行。

自定义中间件骨架：

```go
func TimingMiddleware(report func(d time.Duration)) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            start := time.Now()
            resp, err := next(ctx, req)        // 调用内层（下一中间件或引擎）
            report(time.Since(start))          // 响应阶段逻辑（逆序执行）
            return resp, err
        }
    }
}
```

内置中间件一览：

| 中间件 | 职责 | nil 配置时的行为 |
|--------|------|------------------|
| `LoggingMiddleware` | 输出请求/响应摘要（URL 自动脱敏） | 日志关闭（no-op） |
| `RecoveryMiddleware` | 捕获链内 panic 转为 error | — |
| `RequestIDMiddleware` | 注入 `X-Request-ID`（crypto/rand 生成） | 默认头名与安全生成器 |
| `TimeoutMiddleware` | 中间件层超时（先于客户端内建超时生效） | 超时关闭（直通） |
| `MetricsMiddleware` | 每请求回调（方法/URL/状态/耗时/错误） | 指标关闭（no-op） |
| `AuditMiddleware` | 合规审计事件（text/json 格式、敏感头打码） | 默认 text 配置 |
| `HeaderMiddleware` | 为每个请求附加静态头（创建期校验 CRLF） | 无头（直通） |

:::warning 注意
`TimeoutMiddleware` 不适用于 `Download` 与 `WithStreamBody(true)` 的请求：中间件在请求进入时即拒绝流式请求，返回 `TimeoutMiddleware is incompatible with streaming responses`。此类场景改用 `WithTimeout`。
:::

## 会话与域名客户端

对同一域名的连续请求（登录态、公共头、Cookie 透传），用 `DomainClient` 代替手工拼 URL 和逐次传 Cookie：

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token) // 会话头：后续请求自动携带

_, _ = dc.Post("/login", httpc.WithJSON(creds)) // 响应 Set-Cookie 自动进入会话
_, _ = dc.Get("/me")                            // 自动带上会话 Cookie
```

两个构件的分工：

- **`DomainClient`** — 绑定 base URL。相对路径自动拼接（`/users` → `https://api.example.com/users`），传入完整 `http(s)://` URL 时直接使用。内置路径穿越防护：拼接结果逃出 base 路径范围时返回错误。会话 Cookie 由内嵌的 `SessionManager` 存储，与 `Connection.EnableCookies` 无关。
- **`SessionManager`** — 线程安全的会话状态存储（Cookie + 请求头）。`DomainClient` 内嵌它：请求前注入会话状态，响应后回写 `Set-Cookie`。`SessionManager` 也可脱离 `DomainClient` 单独使用（`NewSessionManagerDefault()`）。

:::warning 选项会执行两次
`DomainClient` 的请求选项在内部会被应用**两次**：一次捕获会话状态（Cookie/请求头），一次执行真实请求。不应在选项中放置带副作用的逻辑（计数器、一次性 nonce 等）。
:::

详见 [域名会话指南](../guides/domain-session)。

## 安全默认值

默认配置已启用以下安全措施，无需额外设置：

- **TLS 1.2+** 强制加密
- **SSRF 防护** — 阻止连接私有 IP 地址，例如 `127.0.0.1`、`10.x`、`192.168.x`
- **CRLF 注入防护** — 请求头和 URL 自动验证
- **响应体大小限制** — 默认 10MB，防止内存耗尽
- **解压炸弹防线** — 解压后响应体默认上限 100MB
- **严格 Content-Length 校验** — 默认开启，响应体长度与声明不符时报错

如需连接内部服务（VPN、内网），可设置 `Security.AllowPrivateIPs = true`，或使用 `SSRFExemptCIDRs` 精确豁免。详见 [安全概述](../security/)。

## 错误模型

HTTPC 区分**网络层错误**与 **HTTP 状态码**：

- **网络层错误**（连接失败、超时、TLS 错误等）→ 作为 `error` 返回，可用 `errors.As` 提取 `ClientError` 获取分类和可重试性
- **HTTP 状态码**（4xx、5xx）→ **不**作为 `error` 返回，需通过 `result.IsSuccess()` 等方法检查

```go
result, err := client.Get(url)
if err != nil {
    // 网络层错误 — 请求未成功完成
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("错误类型: %s, 可重试: %v", clientErr.Code(), clientErr.IsRetryable())
    }
    return err
}
// 请求成功完成 — 检查 HTTP 状态码
if !result.IsSuccess() {
    log.Printf("HTTP 错误：%d", result.StatusCode())
}
```

`ClientError` 携带的上下文：

| 成员 | 说明 |
|------|------|
| `Type` | 错误分类（`ErrorTypeTimeout`、`ErrorTypeNetwork` 等 12 类枚举） |
| `Code()` | 短码字符串：`TIMEOUT`、`NETWORK_ERROR`、`TLS_ERROR`、`DNS_ERROR`、`CONTEXT_CANCELED`、`VALIDATION_ERROR`、`HTTP_ERROR` 等 |
| `IsRetryable()` | 是否可重试（上下文取消/校验/TLS/证书类恒为 false；超时/传输恒为 true；网络/DNS/5xx 视具体原因） |
| `Attempts` | 已尝试次数（含首次） |
| `StatusCode` | 关联的 HTTP 状态码（如适用） |
| `Cause` | 底层错误，`errors.Is` / `errors.As` 可穿透 |
| `URL` / `Method` | 已脱敏的请求 URL 与请求方法 |

常用哨兵错误可用 `errors.Is` 判断：

- `ErrClientClosed`：使用了已关闭的客户端
- `ErrResponseBodyEmpty`：`Unmarshal` 遇到空响应体
- `ErrResponseBodyTooLarge`：待解析响应体超过 50MB

完整列表见 [错误类型](../api-reference/types/errors)。

详见 [错误处理](../guides/error-handling)。

## 并发与资源管理

- **Client 并发安全** — 一个客户端可被任意多 goroutine 共享，连接池在内部按 host 管理，无需为并发另建客户端。
- **Result 独立且免释放** — 每次请求返回全新的 `*Result`，与三个元信息结构体一次性分配。持有它没有生命周期负担，交给 GC 即可。
- **显式 Close** — `client.Close()` 释放连接池与传输层资源；关闭后再发请求返回 `ErrClientClosed`。
- **默认客户端重建** — 包级函数使用的默认客户端可被 `SetDefaultClient()` 替换、`CloseDefaultClient()` 关闭；关闭后下一次包级调用自动重建。
- **panic 安全网** — `Request` 内部有兜底 recover：执行路径上的意外 panic 会转换为带堆栈的 `error` 返回，不会传播到调用方。

## 下一步

- [实战教程](../guides/tutorial) - 按顺序把上述概念逐一上手
