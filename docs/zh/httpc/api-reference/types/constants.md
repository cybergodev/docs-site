---
sidebar_label: "常量与类型"
title: "常量与类型 - CyberGo HTTPC | 常量与辅助类型"
description: "HTTPC 常量与辅助类型 API 参考：BodyKind 六种请求体枚举与自动检测、ProxyStrategy 代理策略、FormData/FileData 上传类型、AuditEvent 审计事件、AuditConfig 审计配置与 SourceIPKey 等上下文键。"
sidebar_position: 20
---

# 常量与类型

本页汇集 HTTPC 的所有公开常量与辅助类型，包括请求体类型枚举、代理策略、表单/文件上传类型、校验算法、审计事件、格式化工具函数、进度回调与 Cookie 安全配置。

## BodyKind

```go
type BodyKind int
```

请求体类型，用于 `WithBody` 指定请求体格式。

| 常量 | 值 | 含义 | 输入要求 | 对应 Content-Type |
|------|-----|------|----------|-------------------|
| `BodyAuto` | 0 | 自动检测 | 任意（按类型推断） | 见下方检测规则表 |
| `BodyJSON` | 1 | 强制 JSON 编码 | 任意可序列化类型 | application/json |
| `BodyXML` | 2 | 强制 XML 编码 | 任意可序列化类型 | application/xml |
| `BodyForm` | 3 | 表单编码 | `map[string]string` 或兼容类型 | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | 二进制流 | `[]byte` 或 `string` | application/octet-stream |
| `BodyMultipart` | 5 | 多部分表单 | `*FormData` | multipart/form-data |

### BodyAuto 自动检测规则

`BodyAuto`（默认值）根据输入数据的 Go 类型自动推断请求体格式与 Content-Type：

| 输入 Go 类型 | 推断格式 | Content-Type |
|-------------|----------|-------------|
| `string` | 纯文本 | text/plain; charset=utf-8 |
| `[]byte` | 二进制流 | application/octet-stream |
| `map[string]string` | 表单 | application/x-www-form-urlencoded |
| `*FormData` | 多部分表单 | multipart/form-data |
| `io.Reader` | 原样透传 | 不设置（由调用方指定） |
| 其他类型 | JSON 序列化 | application/json |

:::tip BodyAuto vs 显式指定
多数场景下 `BodyAuto` 足以满足需求。当自动推断不符合预期时（如需将 struct 以 XML 而非 JSON 发送），显式传入 `BodyJSON`/`BodyXML`/`BodyForm` 等可强制指定编码格式。
:::

```go
// 自动检测（默认）
result, _ := client.Post(url, httpc.WithBody(data))

// 强制 JSON（即使 data 是 map[string]string 也用 JSON 编码）
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// 强制 XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

## ProxyStrategy

```go
type ProxyStrategy = proxypool.Strategy
```

代理池选择策略，用于 `ConnectionConfig.ProxyPoolStrategy`。是内部 `proxypool.Strategy` 的类型别名，避免导入内部包。

| 常量 | 说明 | 重试行为 |
|------|------|----------|
| `ProxyStrategyRoundRobin` | 轮询（默认）。按顺序循环选择代理，每次选择前进到下一个 | 重试时自然落到不同 IP，无需额外配置 |
| `ProxyStrategyRandom` | 随机。从健康代理中均匀随机选取 | 重试时随机选择，统计上倾向于换 IP |

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
client, _ := httpc.New(cfg)
```

:::tip 状态码触发轮换
配合 `ProxyRotateOnStatus`（如 `[]int{403}`）可在收到特定状态码时触发重试+代理轮换，适用于绕过 CF/WAF 等 IP 维度的封锁。详见 [配置参考](../client-config/config)。
:::

## FormData / FileData

### FormData

```go
type FormData struct {
    Fields map[string]string    // 普通表单字段
    Files  map[string]*FileData // 文件字段
}
```

用于 `BodyMultipart` 模式的多部分表单数据：文本字段放 `Fields`（键值对），文件放 `Files`（按字段名索引到 `FileData`，其 `Filename`/`Content` 分别为文件名与原始字节）。是内部 `types.FormData` 的类型别名。

| 字段 | 类型 | 说明 |
|------|------|------|
| `FormData.Fields` | `map[string]string` | 普通表单字段（键值对） |
| `FormData.Files` | `map[string]*FileData` | 文件字段（按字段名索引） |

### FileData

```go
type FileData struct {
    Filename    string // 文件名
    Content     []byte // 文件内容
    ContentType string // MIME 类型，如 "image/png"、"application/pdf"
}
```

是内部 `types.FileData` 的类型别名。

| 字段 | 类型 | 说明 |
|------|------|------|
| `FileData.Filename` | `string` | 发送给服务端的文件名 |
| `FileData.Content` | `[]byte` | 文件原始内容 |
| `FileData.ContentType` | `string` | MIME 类型（如 `"image/png"`、`"application/pdf"`）；为零值时回退 `application/octet-stream` |

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatalf("创建客户端失败: %v", err)
	}
	defer func() { _ = client.Close() }()

	form := &httpc.FormData{
		Fields: map[string]string{
			"username": "alice",
			"title":    "profile photo",
		},
		Files: map[string]*httpc.FileData{
			"avatar": {
				Filename:    "photo.png",
				Content:     []byte("\x89PNG..."), // 实际使用 os.ReadFile 读取
				ContentType: "image/png",
			},
		},
	}

	result, err := client.Post("https://httpbin.org/post", httpc.WithFormData(form))
	if err != nil {
		log.Fatalf("上传失败: %v", err)
	}

	fmt.Println("上传完成，状态码:", result.StatusCode())
}
```

## ChecksumAlgorithm

```go
type ChecksumAlgorithm string

const ChecksumSHA256 ChecksumAlgorithm = "sha256"
```

下载校验算法。当前仅支持 `"sha256"`。用于 `DownloadConfig.ChecksumAlgorithm`，在 `DefaultDownloadConfig()` 中默认设为 `ChecksumSHA256`。传入不支持的算法会在下载开始前返回 `"unsupported checksum algorithm"` 错误。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/archive.zip"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb924..." // 预期的 SHA-256 十六进制值
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256
```

## AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // 脱敏（凭据已移除）
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"-"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

安全审计事件，由 `AuditMiddleware` 在每次请求/响应周期完成后生成。专为金融、医疗、政府等高合规场景设计，捕获完整的请求/响应上下文：时间线由 `Timestamp`（请求开始时间）加 `Duration` 还原；开启 `AuditConfig.IncludeHeaders` 后，脱敏的请求/响应头分别填充到 `ReqHeaders` 与 `RespHeaders`。

| 字段 | 类型 | 说明 |
|------|------|------|
| `AuditEvent.Timestamp` | `time.Time` | 请求开始时间；加上 `AuditEvent.Duration` 即为结束时间 |
| `AuditEvent.Method` | `string` | HTTP 方法 |
| `AuditEvent.URL` | `string` | 请求 URL（已脱敏，凭据移除） |
| `AuditEvent.StatusCode` | `int` | 最终响应状态码（请求出错时为 0） |
| `AuditEvent.Duration` | `time.Duration` | 覆盖全部尝试的总耗时（含重试延迟） |
| `AuditEvent.Attempts` | `int` | 发送的请求数（无重试时为 1） |
| `AuditEvent.Error` | `error` | 请求错误；JSON 序列化时输出为字符串（配合 `AuditConfig.SanitizeError` 可脱敏） |
| `AuditEvent.SourceIP` | `string` | 源 IP（应用经 `SourceIPKey` 注入 context） |
| `AuditEvent.UserID` | `string` | 用户 ID（应用经 `UserIDKey` 注入 context） |
| `AuditEvent.RedirectChain` | `[]string` | 到达最终响应前跟随过的 URL 链 |
| `AuditEvent.ReqHeaders` | `map[string][]string` | 最终请求头（早期失败时可为 nil；需 `AuditConfig.IncludeHeaders=true`） |
| `AuditEvent.RespHeaders` | `map[string][]string` | 最终响应头（请求出错时为 nil；需 `AuditConfig.IncludeHeaders=true`） |

### MarshalJSON 自定义序列化

`AuditEvent.MarshalJSON`（签名 `func (e AuditEvent) MarshalJSON() ([]byte, error)`）实现自定义 JSON 序列化，提供两个 JSON 友好的派生字段：

| JSON 字段 | 来源 | 说明 |
|-----------|------|------|
| `durationMs` | `Duration.Milliseconds()` | 毫秒整数，便于日志聚合工具解析 |
| `error` | `Error.Error()` | 错误字符串（替代 error 接口的默认序列化） |

这样 JSON 输出中的耗时字段只有易读的 `durationMs`（毫秒整数）——`Duration` 字段本身带 `json:"-"` 标签，不序列化为纳秒形式；`error` 字段输出为字符串而非空对象。

### AuditConfig

```go
type AuditConfig struct {
    OnAudit        func(event AuditEvent) // 审计回调，nil 时中间件为空操作
    Format         string                 // "text" 或 "json"
    IncludeHeaders bool                   // 包含请求/响应头
    MaskHeaders    []string               // 需脱敏的头名称（如 "Authorization"、"Cookie"）
    SanitizeError  bool                   // 脱敏错误信息（替换为 "[sanitized]"）
}
```

`DefaultAuditConfig()` 提供默认值：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `AuditConfig.OnAudit` | `nil` | 审计回调，为 nil 时中间件为空操作 |
| `AuditConfig.Format` | `"text"` | 输出格式提示（`"text"` / `"json"`），由回调方消费，中间件不据此分支 |
| `AuditConfig.IncludeHeaders` | `false` | 是否在审计日志中包含请求/响应头 |
| `AuditConfig.MaskHeaders` | 六个标准敏感头 | `Authorization`、`Cookie`、`Set-Cookie`、`X-Api-Key`、`X-Auth-Token`、`Proxy-Authorization`，命中即替换为 `[REDACTED]` |
| `AuditConfig.SanitizeError` | `true` | 错误信息替换为 `[sanitized]` |

## 上下文键

| 常量 | 值 | 说明 |
|------|-----|------|
| `SourceIPKey` | `"source_ip"` | 审计事件中的源 IP 地址 |
| `UserIDKey` | `"user_id"` | 审计事件中的用户标识符 |

这两个键的类型是 `auditContextKey`（非导出的字符串类型），用于 `context.WithValue` 传递审计信息。`AuditMiddleware` 通过 `ctx.Value(httpc.SourceIPKey)` 和 `ctx.Value(httpc.UserIDKey)` 提取这些值并填充到 `AuditEvent` 中。

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// 通过 context 传递审计信息
	ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.100")
	ctx = context.WithValue(ctx, httpc.UserIDKey, "user-789")

	// 配置审计中间件
	auditCfg := httpc.DefaultAuditConfig()
	auditCfg.Format = "json"
	auditCfg.IncludeHeaders = true
	auditCfg.OnAudit = func(event httpc.AuditEvent) {
		fmt.Printf("[AUDIT] %s %s -> %d (%v) src=%s user=%s\n",
			event.Method, event.URL, event.StatusCode,
			event.Duration, event.SourceIP, event.UserID)
	}

	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.AuditMiddleware(auditCfg),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatalf("创建客户端失败: %v", err)
	}
	defer func() { _ = client.Close() }()

	// context 中的 SourceIP/UserID 会被中间件提取到审计事件
	result, err := client.Request(ctx, "GET", "https://httpbin.org/get")
	if err != nil {
		log.Fatalf("请求失败: %v", err)
	}
	fmt.Println("状态码:", result.StatusCode())
}
```

## FormatBytes / FormatSpeed

将字节数与字节速率格式化为人类可读字符串（二进制 1024 进制单位，如 `"1.50 MB"`、`"1.50 MB/s"`），常用于下载进度展示与结果日志。完整签名、输入输出对照表与配合 `DownloadProgressCallback` 的用法见 [FormatBytes](../core/functions#formatbytes) 与 [FormatSpeed](../core/functions#formatspeed)。

## DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

下载进度回调函数签名，用于 `DownloadConfig.ProgressCallback`。

| 参数 | 类型 | 说明 |
|------|------|------|
| `downloaded` | `int64` | 已下载字节数（断点续传时含已续传部分） |
| `total` | `int64` | 总字节数（服务器未返回 Content-Length 时为 -1） |
| `speed` | `float64` | 当前下载速率（字节/秒），可直接传给 `FormatSpeed` |

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large.zip"
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
	if total > 0 {
		pct := float64(downloaded) / float64(total) * 100
		fmt.Printf("\r%.1f%%  %s / %s  %s",
			pct,
			httpc.FormatBytes(downloaded),
			httpc.FormatBytes(total),
			httpc.FormatSpeed(speed),
		)
	}
}
```

## CookieSecurityConfig

```go
type CookieSecurityConfig = validation.CookieSecurityConfig
```

Cookie 安全属性验证配置。是内部 `validation.CookieSecurityConfig` 的类型别名，用于 SessionManager 和 `WithSecureCookie` 请求选项。

```go
type CookieSecurityConfig struct {
    RequireSecure                bool    // 要求 Secure 属性（仅 HTTPS 传输）
    RequireHttpOnly              bool    // 要求 HttpOnly 属性（防 XSS 窃取）
    RequireSameSite              string  // 要求 SameSite 值："Strict"/"Lax"/"None"/""
    AllowSameSiteNone            bool    // 是否允许 SameSite=None
    RequireSecureForSameSiteNone bool    // SameSite=None 时强制要求 Secure
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `CookieSecurityConfig.RequireSecure` | `bool` | 要求 Secure 属性，仅通过 HTTPS 传输。生产环境推荐 true |
| `CookieSecurityConfig.RequireHttpOnly` | `bool` | 要求 HttpOnly 属性，禁止 JS 访问，防 XSS。会话 Cookie 推荐 true |
| `CookieSecurityConfig.RequireSameSite` | `string` | 要求 SameSite 值。`"Strict"`（仅第一方）、`"Lax"`（第一方+顶层导航）、`"None"`（所有上下文，需 Secure）、`""`（无要求） |
| `CookieSecurityConfig.AllowSameSiteNone` | `bool` | 是否允许 SameSite=None。false 且 RequireSameSite 为空时拒绝 SameSite=None 的 Cookie |
| `CookieSecurityConfig.RequireSecureForSameSiteNone` | `bool` | SameSite=None 时强制要求 Secure（符合 RFC 6265bis）。默认 true |

可用工厂函数：

| 工厂函数 | 策略 | 适用场景 |
|----------|------|----------|
| `DefaultCookieSecurityConfig()` | 宽松：允许非 HTTPS、允许 JS 访问、允许 SameSite=None | 开发环境、兼容性优先 |
| `StrictCookieSecurityConfig()` | 严格：要求 Secure + HttpOnly + SameSite=Strict | 生产环境、高安全场景（金融/医疗/政府） |

```go
// 严格策略：要求 Secure + HttpOnly + SameSite=Strict
strict := httpc.StrictCookieSecurityConfig()

// 自定义策略：要求 HttpOnly，允许 SameSite=Lax
custom := &httpc.CookieSecurityConfig{
    RequireHttpOnly: true,
    RequireSameSite: "Lax",
    AllowSameSiteNone: false,
}

// 应用到 SessionManager
sm.SetCookieSecurity(strict)

// 或应用到单个请求的 Cookie 验证
result, err := client.Get(url, httpc.WithSecureCookie(strict))
```

:::warning WithSecureCookie 顺序敏感
`WithSecureCookie` 只验证**应用时已存在**的 Cookie。必须放在所有 `WithCookies`/`WithCookieMap`/`WithCookieString` 之后。如需会话级的无序验证，使用 `SessionManager.SetCookieSecurity`。
:::

## 错误分类常量（ErrorType）

根包还导出 12 个 `ErrorType` 错误分类常量：`ErrorTypeUnknown`、`ErrorTypeNetwork`、`ErrorTypeTimeout`、`ErrorTypeContextCanceled`、`ErrorTypeResponseRead`、`ErrorTypeTransport`、`ErrorTypeRetryExhausted`、`ErrorTypeTLS`、`ErrorTypeCertificate`、`ErrorTypeDNS`、`ErrorTypeValidation`、`ErrorTypeHTTP`。

这些常量连同 `ClientError` 结构体、`Code()`/`IsRetryable()` 方法与 `ErrClientClosed` 等哨兵错误变量的完整参考见[错误类型](./errors)。

至此本站已覆盖根包全部导出常量：BodyKind 6 个（本文）、代理策略 2 个（本文）、校验算法 1 个（本文）、上下文键 2 个（本文）、错误分类 12 个（[错误类型](./errors)）。

## 另见

- [错误类型](./errors) - ClientError、ErrorType 和错误变量的完整参考
- [请求选项](../core/options) - BodyKind 在 WithBody 中的使用
- [内置中间件](../client-config/middleware) - AuditMiddleware 和审计配置
- [会话管理](../client-config/session) - SessionManager 与 CookieSecurityConfig 的会话级使用
