---
title: "配置 - HTTPC"
description: "HTTPC 配置系统 API 参考：Config 主结构体及 Timeouts、Connection、Security、Retry、Middleware 五个子配置组的全部字段说明、DefaultConfig 等五种预设函数、ValidateConfig 验证与 Cookie 安全配置。"
---

# 配置

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
}
```

主配置结构体，通过 `DefaultConfig()` 获取安全默认值。

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // 总请求超时（含重试），默认 180s
    Dial           time.Duration // TCP 连接超时，默认 10s
    TLSHandshake   time.Duration // TLS 握手超时，默认 10s
    ResponseHeader time.Duration // 等待响应头超时，默认 0（禁用，依赖上下文超时）
    IdleConn       time.Duration // 空闲连接保持时间，默认 90s
}
```

| 字段 | 默认值 | 最大值 |
|------|--------|--------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

设为 0 表示无超时（生产环境不推荐）。

:::tip ResponseHeader 设计
`ResponseHeader` 默认为 0（禁用），此时使用 `Timeouts.Request` 或 `WithTimeout()` 作为唯一的超时机制，确保 `WithTimeout()` 对请求持续时间有完全控制。此设计适合 AI API 和长轮询等需要扩展响应时间的场景。仅在需要传输层硬性上限（如防御 Slowloris 攻击）时设为正值，但需注意这会覆盖 `WithTimeout`。
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // 全局最大空闲连接，默认 50
    MaxConnsPerHost        int           // 每主机最大连接数，默认 10
    ProxyURL               string        // 代理地址，如 "http://proxy:8080"
    EnableSystemProxy      bool          // 自动检测系统代理，默认 false
    EnableHTTP2            bool          // 启用 HTTP/2，默认 true
    EnableCookies          bool          // 启用 Cookie 管理，默认 false
    EnableDoH              bool          // 启用 DNS-over-HTTPS，默认 false
    DoHCacheTTL            time.Duration // DoH 缓存 TTL，默认 5min
    BrowserFingerprint     string        // TLS 指纹伪装，默认 ""（使用标准 Go TLS）
    MaxResponseHeaderBytes int64         // 响应头最大字节数，默认 0（使用 Go 标准库默认 10MB）
}
```

### DNS-over-HTTPS

启用 DoH 减少 DNS 解析延迟和防止 DNS 劫持：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

默认 DoH 提供商（按优先级）：Cloudflare → Google → AliDNS。详见 [连接池与代理](../advanced/connection-pool)。

### TLS 指纹伪装

启用 `BrowserFingerprint` 模拟真实浏览器的 TLS ClientHello 握手，绕过基于 TLS 指纹的反爬检测。设置后连接使用 utls 替代 Go 标准 `crypto/tls`：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.BrowserFingerprint = "chrome" // 可选: "chrome", "firefox", "safari", "ios"
```

| 值 | 模拟浏览器 |
|------|----------|
| `"chrome"` | Google Chrome |
| `"firefox"` | Mozilla Firefox |
| `"safari"` | Apple Safari |
| `"ios"` | iOS Safari |
| `""` (默认) | 使用标准 Go TLS |

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // 自定义 TLS 配置
    MinTLSVersion           uint16         // 最低 TLS 版本，默认 TLS 1.2
    MaxTLSVersion           uint16         // 最高 TLS 版本，默认 TLS 1.3
    InsecureSkipVerify      bool           // 跳过证书验证（仅测试用）
    MaxResponseBodySize     int64          // 响应体大小限制，默认 10MB
    MaxRequestBodySize      int64          // 请求体大小限制，默认 0（使用 MaxResponseBodySize 的值）
    MaxDecompressedBodySize int64          // 解压后大小限制，默认 100MB
    AllowPrivateIPs         bool           // 允许私有 IP，默认 false
    SSRFExemptCIDRs         []string       // SSRF 豁免 CIDR
    ValidateURL             bool           // URL 验证，默认 true
    ValidateHeaders         bool           // 请求头验证，默认 true
    StrictContentLength     bool           // 严格 Content-Length，默认 true
    CookieSecurity          *CookieSecurityConfig // Cookie 安全验证
    RedirectWhitelist       []string       // 重定向白名单域名
}
```

:::warning SSRF 防护
`AllowPrivateIPs` 默认为 `false`，阻止连接到私有/保留 IP（127.0.0.1、10.x、192.168.x 等）。仅在连接内部服务时设为 `true`。
:::

### SSRF 豁免示例

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // 最大重试次数，默认 3
    Delay         time.Duration // 初始重试延迟，默认 1s
    BackoffFactor float64       // 退避倍数，默认 2.0
    EnableJitter  bool          // 启用抖动，默认 true
    MaxRetryDelay time.Duration // 最大重试延迟上限，默认 30s
    CustomPolicy  RetryPolicy   // 自定义重试策略
}
```

| 字段 | 默认值 | 范围 |
|------|--------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

重试延迟公式：`min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // 中间件列表
    UserAgent       string           // User-Agent，默认 "httpc/1.0"
    Headers         map[string]string // 默认请求头
    FollowRedirects bool             // 跟随重定向，默认 true
    MaxRedirects    int              // 最大重定向次数，默认 10
}
```

## 配置预设

### DefaultConfig

```go
func DefaultConfig() *Config
```

安全默认配置。SSRF 防护默认开启。

### SecureConfig

```go
func SecureConfig() *Config
```

安全优先配置。更短的超时、禁用自动重定向、严格的 SSRF 防护。

| 配置项 | 值 |
|--------|-----|
| Request 超时 | 15s |
| Dial 超时 | 5s |
| TLSHandshake 超时 | 5s |
| ResponseHeader 超时 | 10s（Slowloris 防御） |
| IdleConn 超时 | 30s |
| MaxIdleConns | 20 |
| MaxConnsPerHost | 5 |
| MaxResponseBodySize | 5MB |
| MaxRetries | 1 |
| Delay | 2s |
| EnableJitter | true |
| FollowRedirects | false |

### PerformanceConfig

```go
func PerformanceConfig() *Config
```

高吞吐配置。更大连接池、更长超时，保持安全验证。

:::tip
PerformanceConfig 保持 `ValidateURL` 和 `ValidateHeaders` 开启以确保安全性。在可信环境中如需最大性能，可手动关闭：`cfg.Security.ValidateURL = false`，但需注意安全风险（注入攻击、SSRF）。
:::

| 配置项 | 值 |
|--------|-----|
| Request 超时 | 60s |
| Dial 超时 | 15s |
| TLSHandshake 超时 | 15s |
| ResponseHeader 超时 | 0（禁用，使用 Request 超时） |
| IdleConn 超时 | 120s |
| MaxIdleConns | 100 |
| MaxConnsPerHost | 20 |
| EnableCookies | true |
| MaxResponseBodySize | 50MB |
| StrictContentLength | false |
| ValidateURL | true |
| ValidateHeaders | true |
| Delay | 500ms |
| BackoffFactor | 1.5 |
| EnableJitter | true |

### TestingConfig

```go
func TestingConfig() *Config
```

测试环境配置。禁用安全检查、短超时。

| 配置项 | 值 |
|--------|-----|
| Dial 超时 | 5s |
| TLSHandshake 超时 | 5s |
| ResponseHeader 超时 | 0（禁用，使用 Request 超时） |
| IdleConn 超时 | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 5 |
| EnableHTTP2 | false |
| EnableCookies | true |
| InsecureSkipVerify | true |
| AllowPrivateIPs | true |
| ValidateURL | false |
| ValidateHeaders | false |
| MaxRetries | 1 |
| Delay | 100ms |
| EnableJitter | false |
| UserAgent | httpc-test/1.0 |

:::danger
此配置禁用 TLS 验证和 SSRF 防护，**仅用于测试**。在非测试环境使用会打印安全警告。
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

轻量级配置。禁用重试和重定向，最小连接池。

| 配置项 | 值 |
|--------|-----|
| Dial 超时 | 5s |
| TLSHandshake 超时 | 5s |
| ResponseHeader 超时 | 0（禁用，使用 Request 超时） |
| IdleConn 超时 | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1MB |
| MaxRetries | 0 |
| Delay | 0 |
| BackoffFactor | 1.0 |
| EnableJitter | false |
| FollowRedirects | false |

## 验证

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

验证配置有效性。`New()` 内部会自动调用，也可显式调用。

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // 超出范围

if err := httpc.ValidateConfig(cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

### Config.String

```go
func (c *Config) String() string
```

返回安全的字符串表示。ProxyURL 凭据会被脱敏，TLSConfig 显示为 `<configured>` 或 `<default>`，Headers 不会被输出。

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Cookie 安全

### CookieSecurityConfig

```go
type CookieSecurityConfig struct {
    RequireSecure                bool
    RequireHttpOnly              bool
    RequireSameSite              string
    AllowSameSiteNone            bool
    RequireSecureForSameSiteNone bool
}
```

Cookie 安全属性验证配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| `RequireSecure` | `bool` | 要求 Cookie 设置 Secure 属性 |
| `RequireHttpOnly` | `bool` | 要求 Cookie 设置 HttpOnly 属性 |
| `RequireSameSite` | `string` | 要求的 SameSite 值，如 `"Strict"`、`"Lax"`；空字符串表示不检查 |
| `AllowSameSiteNone` | `bool` | 是否允许 SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | SameSite=None 时要求 Secure 属性（默认 `true`） |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

默认 Cookie 安全配置。不要求 Secure/HttpOnly/SameSite 属性，但强制 SameSite=None 的 Cookie 必须设置 Secure。

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

严格 Cookie 安全配置。要求 Secure、HttpOnly 和 SameSite=Strict。

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
