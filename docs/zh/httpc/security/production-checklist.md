---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo HTTPC | 上线前核查"
description: "HTTPC 生产环境安全检查清单：TLS 版本与证书固定、SSRF 豁免审计、五级超时预算、连接池上限、重试风暴控制、大小限制、Cookie 安全、文件下载、Body 关闭与临时文件清理、敏感信息日志脱敏，每项含默认值、推荐生产值与代码验证方法。"
sidebar_position: 4
---

# 生产检查清单

上线前逐项核查可有效消除常见安全配置缺陷。本清单按类别分组，每项标注默认值、推荐生产值与验证方法。建议在 CI 中用脚本（见文末）自动化检查高危项。

## TLS / 加密

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `InsecureSkipVerify` | `false` | `false` | 代码搜索，见文末命令 |
| `MinTLSVersion` | TLS 1.2 | TLS 1.2+（高安全可强制 1.3） | `grep MinTLSVersion` |
| `MaxTLSVersion` | TLS 1.3 | TLS 1.3 | `grep MaxTLSVersion` |
| 未使用 `TestingConfig()` | — | 是 | 代码搜索，见文末命令 |
| 证书固定（高安全场景） | 未启用 | 推荐启用 | `grep CertificatePinner` |

:::warning
`InsecureSkipVerify = true` 会使所有 TLS 安全措施失效。HTTPC 会在非测试环境的 `stderr` 打印警告，上线前务必确认日志中无此警告。
:::

版本语义补充：`MinTLSVersion`/`MaxTLSVersion` 为 `0` 时自动回退 1.2/1.3；`Min > Max` 无法通过 `New()` 校验。设置 `TLSConfig` 后版本字段被忽略，且 `Security.InsecureSkipVerify` 不再生效（须在 `TLSConfig` 内控制）——审查自定义 `TLSConfig` 时按其自身字段核查。

## SSRF 防护

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `AllowPrivateIPs` | `false` | `false`（处理不可信 URL） | 代码搜索，见文末命令 |
| `SSRFExemptCIDRs` | `nil` | 仅精确列出必要网段 | 审计网段是否可收窄 |
| 处理用户 URL 用 `SecureConfig()` | — | 是 | 代码审查 |
| `RedirectWhitelist` | `nil` | 处理用户 URL 时配置 | 代码审查 |

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = false
// 仅豁免实际需要的网段，且尽量收窄
cfg.Security.SSRFExemptCIDRs = []string{"10.50.0.0/16"}
cfg.Security.RedirectWhitelist = []string{"api.example.com"}
```

## 超时配置

超时是防御 Slowloris、资源耗尽与级联故障的第一道防线。

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `TimeoutConfig.Request` | 180s | 按业务设（如 30s） | 确认非 0 |
| `TimeoutConfig.Dial` | 10s | 5-10s | `grep Timeouts.Dial` |
| `TimeoutConfig.TLSHandshake` | 10s | 5-10s | `grep Timeouts.TLSHandshake` |
| `TimeoutConfig.ResponseHeader` | 0 | 按需（见下） | 理解其作用域 |
| `TimeoutConfig.IdleConn` | 90s | 60-120s | — |

:::warning
`TimeoutConfig.ResponseHeader` 是 transport 级硬上限，作用于该 client 的**所有请求**，**无法**用 `WithTimeout` 按请求覆盖。设为正值会覆盖较长的 `WithTimeout`。仅当需要抵御 Slowloris 的 transport 级独立防护时才设正值；AI API 等长响应场景应设为 0，依赖 `Request` 超时控制。
:::

### 超时预算怎么算

`Timeouts.Request`（默认 180s）与 `WithTimeout` 是**覆盖所有重试尝试与退避等待的总预算**：重试引擎为整个请求建立单一截止时间，而非每次尝试重新计时——`WithTimeout(30s)` + 3 次重试最多耗时 30s，而不是 4 倍。配置值与 `WithTimeout` 均有 30 分钟硬上限，超出即配置错误。

单次尝试由更窄的超时约束：`Dial`（默认 10s）限制 TCP 建立，`TLSHandshake`（默认 10s）限制握手。推荐从下游 API 的 P99 出发倒推：

```go
// 预算公式：Request ≥ Dial + TLSHandshake + 预期传输时间 × (1 + MaxRetries) + 退避总和
cfg.Timeouts.Request = 30 * time.Second // 总预算
cfg.Timeouts.Dial = 5 * time.Second     // 单次拨号
cfg.Timeouts.TLSHandshake = 5 * time.Second
```

## 连接池上限

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `MaxIdleConns`（全局空闲连接） | 50 | 按并发估算 | 确认非 0 |
| `MaxConnsPerHost`（单主机连接总数） | 10 | 高并发按需上调 | 注意 0 = 不限制 |
| `MaxIdleConnsPerHost`（单主机空闲） | 自动推导 | — | 由 `MaxConnsPerHost/2` 推导，钳制在 2-10 |
| 连接池总量上限 | 1000 | — | 连接层内置，超限返回连接池耗尽错误 |

配置校验硬上限：`MaxIdleConns` 与 `MaxConnsPerHost` 均为 0-1000（`ValidateConfig` 强制）。两个容易误解的语义：

- `MaxConnsPerHost = 0` 表示**不限制**（net/http 语义），不是「禁止连接」；默认配置为 10
- 连接池总量上限（1000）不可通过公共 `Config` 修改；达到上限时新拨号直接失败而非排队等待

```go
cfg := httpc.DefaultConfig()
cfg.Connection.MaxIdleConns = 50    // 全局空闲连接
cfg.Connection.MaxConnsPerHost = 10 // 单主机连接上限（idle + active）
```

`SecureConfig()` 使用更保守的 20/5；`PerformanceConfig()` 放宽到 100/20。

## 大小限制

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `MaxResponseBodySize` | 10MB | 按业务（如 5MB） | 确认非 0 |
| `MaxDecompressedBodySize` | 100MB | 按业务（如 50MB） | 确认非 0 |
| `MaxRequestBodySize` | 0（不限） | **显式设置**上传上限 | `grep MaxRequestBodySize` |
| `MaxResponseHeaderBytes` | 0（Go 默认 10MB） | 高安全可收紧至 1MB | `grep MaxResponseHeaderBytes` |

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 5 * 1024 * 1024     // 5MB 响应
cfg.Security.MaxDecompressedBodySize = 50 * 1024 * 1024 // 50MB 解压
cfg.Security.MaxRequestBodySize = 2 * 1024 * 1024       // 2MB 上传（默认 0 不限制！）
cfg.Connection.MaxResponseHeaderBytes = 1 * 1024 * 1024  // 1MB 响应头
```

:::danger
`MaxRequestBodySize` 默认为 0（不限制），且**无自动回退**。代理转发或处理用户上传时若不设置，攻击者可发送超大请求耗尽带宽与内存。务必显式设置。
:::

## 重试策略

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `MaxRetries` | 3 | 不超过 5 | 代码审查 |
| 非幂等请求重试 | — | POST/PUT/PATCH 谨慎 | 代码审查幂等性 |
| `EnableJitter` | `true` | `true`（防惊群） | `grep EnableJitter` |
| `MaxRetryDelay` | 30s | 30s | — |

:::warning
非幂等请求（POST 创建资源、PUT 部分更新）的重试可能导致重复创建或重复扣款。若业务非幂等，应对该类请求设置 `WithMaxRetries(0)`，或在服务端实现幂等键。
:::

### 重试风暴控制

内置可重试状态码固定为 408/429/500/502/503/504（`internal/engine/errors.go`），网络层瞬时错误（连接拒绝/重置/不可达、非 context 的传输超时）同样重试。防风暴机制默认就位，上线前逐项确认未被改弱：

| 机制 | 默认值 | 作用 |
|------|--------|------|
| 指数退避 | `Delay=1s`、`BackoffFactor=2.0` | 拉大重试间隔，不给故障服务雪上加霜 |
| 抖动 | `EnableJitter=true` | 打散并发重试的同步节奏，防惊群 |
| 单次延迟上限 | `MaxRetryDelay=30s` | 退避不会无限放大 |
| Retry-After 遵从 | 自动解析 | 按服务端指示等待，但**封顶 60s**——防止恶意服务器用超大 Retry-After 拖死客户端 |
| 总预算 | `WithTimeout` 覆盖全部尝试 | 重试无法突破请求总超时 |

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3                   // 上限 10（ValidateConfig 强制）
cfg.Retry.MaxRetryDelay = 30 * time.Second
cfg.Retry.EnableJitter = true              // 默认已开，显式写出便于审计
// 非幂等接口在请求级关闭重试：
// client.Post(url, httpc.WithJSON(body), httpc.WithMaxRetries(0))
```

:::tip
配置 `ProxyRotateOnStatus`（按状态码换代理重试）时，`MaxRetries` 会被自动提升到 `len(ProxyPool)-1`（封顶 10），保证每个代理至少被尝试一次。
:::

另有两个易踩的坑：`io.Reader` 请求体为支持重试重放会被完整缓冲，超过 100MB 直接报错（`retry not supported for streaming bodies`）；`context.Canceled`/`context.DeadlineExceeded` 永不重试，主动取消不会触发重复请求。

## Cookie 安全

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| `CookieSecurity` | `nil`（不验证） | `StrictCookieSecurityConfig()` | `grep CookieSecurity` |
| `WithSecureCookie` 顺序 | — | 放在所有 Cookie 添加选项（`WithCookies` 等）之后 | 代码审查 |

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// 要求 Secure + HttpOnly + SameSite=Strict
```

## 文件下载安全

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| 下载路径不可信 | — | 仅用可信路径，不拼用户输入 | 代码审查 |
| `Checksum` 校验 | 未设置 | 关键文件设置 SHA-256 | `grep Checksum` |
| `Overwrite` / `ResumeDownload` | `false` | 按需 | 代码审查 |

HTTPC 的 `Download` 已内置五层路径防护（UNC 阻止、控制字符过滤、系统路径保护、路径穿越检测、符号链接防护），但仍应避免将用户输入直接作为 `FilePath`。

## 资源管理

| 检查项 | 默认值 | 推荐生产值 | 验证方法 |
|--------|--------|-----------|----------|
| 显式 `client.Close()` | — | `defer client.Close()` | 代码审查 |
| 默认客户端关闭 | — | 长服务退出时 `CloseDefaultClient()` | 代码审查 |
| `WithContext` 传取消 | — | 是 | 代码审查 |
| 响应 Body 释放 | 自动 | 普通请求无需手动关闭（也无法关闭） | 确认未自行持有流 |
| Download 残留清理 | 自动 | 中断/校验失败自动删除残缺文件 | 确认未绕过 `Download` 自行写盘 |

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
	cfg := httpc.DefaultConfig()
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	// 确保连接池释放
	defer func() {
		if cerr := client.Close(); cerr != nil {
			log.Printf("关闭客户端失败: %v", cerr)
		}
	}()

	// 用 context 控制单请求超时与取消
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := client.Get("https://api.example.com", httpc.WithContext(ctx))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("状态码: %d\n", result.StatusCode())
}
```

:::tip
使用包级函数（`httpc.Get` 等）时，默认客户端在程序退出时不会自动关闭连接。长运行服务应在优雅停机时调用 `httpc.CloseDefaultClient()` 释放连接池。生产服务推荐用显式 `httpc.New(cfg)` 创建客户端，掌控配置与生命周期。
:::

### 响应 Body 与临时文件

- **普通请求**：`Result` 持有的是已读取并复制的字节——HTTPC 在内部完成读取、排空（最多 `min(10MB, MaxResponseBodySize)`，便于连接复用）与关闭，没有需要（也没有入口）手动关闭的 Body
- **大文件**：用 `Download` 而非普通请求——流式写盘、支持进度回调与断点续传；传输中断、校验失败、磁盘写错的残缺文件会被自动删除，不会留下半截文件
- **`client.Close()`**：关闭空闲连接、DoH 解析器与连接池，幂等可重复调用；关闭后的客户端再发请求返回 `ErrClientClosed`

## 监控与审计

### 审计中间件（高安全场景）

`AuditMiddleware` 生成结构化审计事件，适用于合规要求严格的场景。事件中 URL 已脱敏（凭据移除），敏感请求头默认掩码。

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    // event.SourceIP / event.UserID 从 context 注入
    data, _ := json.Marshal(event)
    log.Println(string(data))
}
auditCfg.Format = "json"
auditCfg.IncludeHeaders = true
auditCfg.MaskHeaders = []string{"Authorization", "Cookie", "Set-Cookie", "X-API-Key"}
auditMiddleware := httpc.AuditMiddleware(auditCfg)
```

`SourceIP` 与 `UserID` 通过 context 键 `httpc.SourceIPKey`、`httpc.UserIDKey` 注入，便于关联请求与调用方。`AuditEvent` 包含时间戳、方法、URL、状态码、耗时、重试次数、错误、重定向链、请求/响应头等字段。

### 日志与指标中间件

| 检查项 | 推荐生产值 | 验证方法 |
|--------|-----------|----------|
| `RecoveryMiddleware()` | 启用（防 panic 崩溃） | `grep RecoveryMiddleware` |
| `LoggingMiddleware()` | 启用（请求日志） | `grep LoggingMiddleware` |
| `MetricsMiddleware()` | 启用（收集指标） | `grep MetricsMiddleware` |
| `RequestIDMiddleware()` | 启用（请求追踪） | `grep RequestIDMiddleware` |

### 敏感信息日志脱敏

HTTPC 默认对输出做多通道脱敏，上线前确认没有被绕过：

| 输出通道 | 脱敏行为 |
|----------|----------|
| 错误信息 | URL 凭据 → `***:***`；`token`/`password`/`api_key` 等 20 余个敏感参数 → `[REDACTED]`；fragment 移除 |
| `LoggingMiddleware` | 请求日志 URL 同上（`SanitizeURL`，不可关闭） |
| `AuditMiddleware` | 审计事件 URL 脱敏；`MaskHeaders` 列出的请求头掩码 |
| `Config.String()` | 代理 URL 凭据掩码；请求头不打印 |

检查点：自定义日志中间件若直接打印原始请求 URL，会绕过内置脱敏——应打印脱敏后的 URL 或直接复用 `LoggingMiddleware`；`MaskHeaders` 应覆盖业务自定义的敏感头（如 `X-API-Key`、`X-Auth-Token`）。

## 证书固定

高安全场景（金融、医疗）推荐启用证书固定，防御 CA 被攻破后的中间人攻击：

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前密钥
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用（轮换）
)
if err != nil {
    log.Fatal(err)
}
cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
```

固定配置与维护细节见 [TLS 与证书固定](./tls-certpin)。

## 代码示例

### 生产级客户端创建

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()

	// 超时
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Timeouts.Dial = 10 * time.Second
	cfg.Timeouts.TLSHandshake = 10 * time.Second
	cfg.Timeouts.ResponseHeader = 0 // 依赖 Request 超时，不设 transport 级硬上限
	cfg.Timeouts.IdleConn = 90 * time.Second

	// 连接池
	cfg.Connection.MaxIdleConns = 50
	cfg.Connection.MaxConnsPerHost = 10

	// 安全
	cfg.Security.AllowPrivateIPs = false
	cfg.Security.MaxResponseBodySize = 5 * 1024 * 1024      // 5MB
	cfg.Security.MaxDecompressedBodySize = 50 * 1024 * 1024 // 50MB
	cfg.Security.MaxRequestBodySize = 2 * 1024 * 1024       // 2MB 上传

	// 重试
	cfg.Retry.MaxRetries = 3
	cfg.Retry.Delay = 1 * time.Second
	cfg.Retry.EnableJitter = true

	// 请求默认值
	cfg.Defaults.UserAgent = "my-service/1.0"
	cfg.Defaults.FollowRedirects = true
	cfg.Defaults.MaxRedirects = 5

	// 中间件
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
		httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	log.Println("生产客户端已就绪")
}
```

### 安全级客户端（处理用户 URL）

```go
func createSecureClient() (httpc.Client, error) {
	cfg := httpc.SecureConfig()
	cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
	cfg.Security.RedirectWhitelist = []string{"api.example.com"}
	// SecureConfig 已设 FollowRedirects = false、AllowPrivateIPs = false、5MB 响应上限
	return httpc.New(cfg)
}
```

## 检查命令

在 CI 或提交前运行以下命令扫描高危配置：

```bash
# 检查是否误用 TestingConfig（排除测试文件）
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# 检查 InsecureSkipVerify = true
grep -rn "InsecureSkipVerify.*true\|InsecureSkipVerify:\s*true" --include="*.go" | grep -v "_test.go"

# 检查 AllowPrivateIPs = true（生产危险）
grep -rn "AllowPrivateIPs.*true\|AllowPrivateIPs:\s*true" --include="*.go" | grep -v "_test.go"

# 检查 MaxRequestBodySize 是否设置（默认 0 不限制）
grep -rn "MaxRequestBodySize" --include="*.go" | grep -v "_test.go"
```

:::tip
建议将上述命令封装为 CI 步骤，高危配置（`TestingConfig`、`InsecureSkipVerify: true`、`AllowPrivateIPs: true` 出现在非测试代码）命中即阻断构建。
:::

## 下一步

- [安全概述](./) - 安全特性总览
- [SSRF 防护](./ssrf) - SSRF 防护详解
- [TLS 与证书固定](./tls-certpin) - 证书固定生产实践
- [配置 API](../api-reference/client-config/config) - 完整配置参考
