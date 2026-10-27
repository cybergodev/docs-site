---
sidebar_label: "配置"
title: "配置 - CyberGo HTTPC | Config 与预设"
description: "HTTPC 配置 API 参考：Timeouts、Connection、Security、Retry 各子配置全字段说明，DefaultConfig 等五个预设、EnableProxyPoolHTTP2 与 SensitiveHeaders 关键字段、ValidateConfig 校验及代理池重试派生规则。"
sidebar_position: 10
---

# 配置

`Config` 是 HTTPC 的主配置结构体，由五个子配置与 `Defaults` 组成；本页列出各字段的类型、默认值与校验边界，以及五个预设配置的取值。

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
    Defaults   RequestDefaults
}
```

五个子配置与 `Defaults` 均为**值类型**。`DefaultConfig()` 返回带安全默认值的 Config，调用方可直接修改字段。

| 字段 | 类型 | 说明 |
|------|------|------|
| `Config.Timeouts` | `TimeoutConfig` | 请求/拨号/TLS 握手/响应头/空闲连接超时 |
| `Config.Connection` | `ConnectionConfig` | 连接池、代理、HTTP/2、Cookie 与 DNS-over-HTTPS |
| `Config.Security` | `SecurityConfig` | TLS、校验与 SSRF 防护 |
| `Config.Retry` | `RetryConfig` | 瞬态失败自动重试 |
| `Config.Middleware` | `MiddlewareConfig` | 每客户端中间件链 |
| `Config.Defaults` | `RequestDefaults` | 每请求默认值（User-Agent、默认请求头） |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

`New()` 内部对 Config 做深拷贝（含 `Defaults.Headers` map 与 `Middleware.Middlewares` 切片）。客户端创建后再修改原 `cfg` 不影响该客户端行为。

两个字段按**引用共享**、不做深拷贝：

- `Retry.CustomPolicy`：若自定义重试策略带有可变状态，不要将同一 Config 实例并发传给多个 `New()`。
- `Security.CertificatePinner`：pinner 实现约定为并发安全，可跨客户端共享。

:::tip 相关类型
请求级细粒度控制使用 `RequestOption` 函数选项（见 [Options 详解](../core/options)）；自定义重试策略需实现 [`RetryPolicy`](../types/interfaces#retrypolicy) 接口。
:::

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

设为 0 表示不设超时上限（生产环境不推荐）。`ResponseHeader` 的默认值 0 即禁用该超时。

:::tip ResponseHeader 设计
`ResponseHeader` 默认为 0（禁用）。此时 `TimeoutConfig.Request` 或 `WithTimeout()` 是唯一的超时机制，`WithTimeout()` 对请求持续时间有完全控制权。该设计适合 AI API 和长轮询等需要延长响应时间的场景。

仅在需要传输层硬性上限（如防御 Slowloris 攻击）时设为正值。此时需注意两点：

- 该超时在 Transport 层生效，作用于**共享同一客户端的所有请求**。
- 当其值短于 `WithTimeout` 设定的截止时间时，它会提前生效。
:::

## ProxyStrategy

```go
type ProxyStrategy = proxypool.Strategy

const (
    ProxyStrategyRoundRobin = proxypool.StrategyRoundRobin // 轮询（默认）
    ProxyStrategyRandom     = proxypool.StrategyRandom     // 随机
)
```

代理池选择策略。

| 常量 | 说明 |
|------|------|
| `ProxyStrategyRoundRobin` | 轮询（默认），每次选择推进到下一个代理，重试时自然落到不同 IP |
| `ProxyStrategyRandom` | 随机，从健康代理中均匀随机选择 |

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // 全局最大空闲连接，默认 50
    MaxConnsPerHost        int           // 每主机最大连接数，默认 10
    ProxyURL               string        // 代理地址，如 "http://proxy:8080"
    EnableSystemProxy      bool          // 自动检测系统代理，默认 false
    ProxyPool              []string      // 代理服务器列表，用于轮换
    ProxyPoolStrategy      ProxyStrategy // 代理选择策略，默认 RoundRobin
    ProxyFailureThreshold  int           // 连续 TCP 拨号失败次数阈值，0 默认为 3
    ProxyCooldown            time.Duration // 断路冷却时间，0 默认为 30s
    ProxyRotatePerRequest    bool          // 每次独立请求强制换代理，默认 false
    ProxyRotateOnStatus      []int         // 触发代理轮换的 HTTP 状态码
    EnableProxyPoolHTTP2   bool          // 多代理池下恢复 HTTP/2（每代理独立传输），默认 false
    EnableHTTP2            bool          // 启用 HTTP/2，默认 true；多代理轮换池激活时自动强制 HTTP/1，除非设 EnableProxyPoolHTTP2
    EnableCookies          bool          // 启用 Cookie 管理，默认 false
    PublicSuffixList       cookiejar.PublicSuffixList // Cookie jar 的 Public Suffix 数据库，默认 nil
    EnableDoH              bool          // 启用 DNS-over-HTTPS，默认 false
    DoHCacheTTL            time.Duration // DoH 缓存 TTL，默认 5min
    MaxResponseHeaderBytes int64         // 响应头最大字节数，默认 0（使用 Go 标准库默认 1MB）
}
```

### 字段一览

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ConnectionConfig.MaxIdleConns` | `int` | 50 | 全局最大空闲连接数 |
| `ConnectionConfig.MaxConnsPerHost` | `int` | 10 | 每主机最大连接数（空闲 + 活跃） |
| `ConnectionConfig.ProxyURL` | `string` | `""` | 显式代理地址（如 `"http://proxy:8080"`），优先级最高 |
| `ConnectionConfig.EnableSystemProxy` | `bool` | `false` | 自动检测系统代理设置 |
| `ConnectionConfig.ProxyPool` | `[]string` | `nil` | 代理池列表，用于轮换 |
| `ConnectionConfig.ProxyPoolStrategy` | `ProxyStrategy` | `ProxyStrategyRoundRobin` | 代理选择策略 |
| `ConnectionConfig.ProxyFailureThreshold` | `int` | 3（0 视为 3） | 连续 TCP 拨号失败次数阈值，达到后熔断该代理 |
| `ConnectionConfig.ProxyCooldown` | `time.Duration` | 30s（0 视为 30s） | 熔断代理的冷却时长 |
| `ConnectionConfig.ProxyRotatePerRequest` | `bool` | `false` | 每次独立请求强制换代理（需设置 `ProxyPool`） |
| `ConnectionConfig.ProxyRotateOnStatus` | `[]int` | `nil` | 触发换代理重试的 HTTP 状态码（需 `Retry.MaxRetries > 0`） |
| `ConnectionConfig.EnableProxyPoolHTTP2` | `bool` | `false` | 多代理池下恢复 HTTP/2（每代理独立传输），需 `EnableHTTP2=true`；详见[代理池与 HTTP/2](#代理池与-http-2-enableproxypoolhttp2) |
| `ConnectionConfig.EnableHTTP2` | `bool` | `true` | 启用 HTTP/2；多代理轮换池激活时自动强制 HTTP/1，除非设 `EnableProxyPoolHTTP2` |
| `ConnectionConfig.EnableCookies` | `bool` | `false` | 启用 Cookie jar 自动管理 |
| `ConnectionConfig.PublicSuffixList` | `cookiejar.PublicSuffixList` | `nil` | 为 Cookie jar 提供 Public Suffix 数据库（推荐 `golang.org/x/net/publicsuffix.List`）。未提供时 jar 会接受公共后缀上的 Cookie 并采用宽松的域匹配，Cookie 因此可被发送到不相关子域 |
| `ConnectionConfig.EnableDoH` | `bool` | `false` | 启用 DNS-over-HTTPS 解析 |
| `ConnectionConfig.DoHCacheTTL` | `time.Duration` | 5min | DoH DNS 响应缓存时长 |
| `ConnectionConfig.MaxResponseHeaderBytes` | `int64` | 0 | 响应头最大字节数；0 使用 Go 标准库默认 1MB（`net/http.DefaultMaxHeaderBytes`），防御恶意服务器发送超大响应头 |

`PublicSuffixList` 仅在 `EnableCookies` 开启（Cookie jar 生效）时被使用。提供该列表可收紧 Cookie 域匹配，防止「超级 Cookie」泄漏。

### 代理池

`ProxyPool` 指定一组代理服务器，请求按 `ProxyPoolStrategy` 在代理间分发。**TCP 拨号失败**（到代理地址的首跳拨号）触发被动熔断，规则如下：

- 累计 `ProxyFailureThreshold` 次连续拨号失败后，该代理临时移出轮换。
- `ProxyCooldown` 后该代理恢复（半开探测）。

熔断只统计拨号结果：拨号成功即上报成功，即使代理随后拒绝所有 CONNECT。拨号之后的失败——到 `https://` 代理的 TLS 握手错误、CONNECT 被拒（407/502）、SOCKS5 握手失败——不计入熔断。按 HTTP 状态码维度的轮换用 `ProxyRotateOnStatus`（见下）。

优先级：低于 `ProxyURL`，高于 `EnableSystemProxy`。若同时设置 `ProxyURL` 和 `ProxyPool`，`ProxyURL` 生效（单代理模式）。

`ProxyRotateOnStatus` 指定触发换代理重试的 HTTP 状态码（如 `[]int{403}` 用于 CF/WAF 基于 IP 的封锁）。该字段需 `Retry.MaxRetries > 0` 才生效。

与拨号失败不同，状态码轮换**不会**熔断代理。原因是封锁属目标特定：同一代理在某站点被封，在另一站点仍可正常使用。

`ProxyRotatePerRequest` 确保每个独立请求（如每次 `Get`/`Post` 调用）使用不同的代理。不启用时，HTTP 连接复用会让对同一主机的连续请求沿用前一次请求的代理隧道，绕过代理池选择。启用后，每次请求开始时关闭空闲连接，强制 Transport 重新评估代理池。

该开关增加少量开销（无连接复用），换取按请求轮换。需设置 `ProxyPool` 才生效；对 `ProxyURL` 或无代理池配置无效。

:::tip ProxyRotatePerRequest vs ProxyRotateOnStatus
两者都用于代理轮换，触发机制不同：

- `ProxyRotateOnStatus`：**收到特定状态码**时触发重试轮换，属被动方式，需配合重试。
- `ProxyRotatePerRequest`：**每次请求开始**时主动切换代理，无需重试。

对同一主机的爬虫/数据采集场景，`ProxyRotatePerRequest` 可确保每次请求的源 IP 不同。
:::

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
cfg.Connection.ProxyFailureThreshold = 3
cfg.Connection.ProxyCooldown = 30 * time.Second
cfg.Connection.ProxyRotateOnStatus = []int{403}
```

#### 代理池与 HTTP/2 (`EnableProxyPoolHTTP2`)

多代理池（`ProxyPool` 多于 1 条且未设 `ProxyURL`）激活时，HTTP/2 被**自动禁用**，强制走 HTTP/1.1。原因是 net/http 的 h2 连接池只按目标主机键控。

多个代理共用一个池时，所有请求会被钉死在第一个建立隧道的代理上，轮换与负载分散因此被静默绕过。

`EnableProxyPoolHTTP2 = true` 可恢复 HTTP/2：每个代理获得独立传输（独立的 h2 连接池），由每请求分发器路由。轮换、`ProxyRotateOnStatus` 与 `Meta.ProxyURL` 上报与默认 HTTP/1 模式完全一致。差异在于：路由到同一代理的并发请求在一条 HTTP/2 隧道上多路复用，而非各自新开一条 HTTP/1 连接。

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.EnableHTTP2 = true          // 前提（DefaultConfig 默认即 true）
cfg.Connection.EnableProxyPoolHTTP2 = true // 恢复代理池的 HTTP/2

client, err := httpc.New(cfg)
```

两个权衡：

- **请求关联性**：路由到同一代理的请求共享该代理的连接，**含并发请求**（在途隧道会被下一个同代理请求加入），网络层可据此关联这些请求。要求请求间不可关联时保持该开关关闭。
  - `ProxyRotatePerRequest` **不能**防止此共享：轮换索引每池大小次请求重复一次，其空闲连接排空也只触及不再在途的连接。
- **连接限额放大**：`MaxConnsPerHost` 与派生的 MaxIdleConnsPerHost 按每代理传输独立计算。进程级上限 = 限额 × 池大小；全部拨号总数仍受引擎级全局上限约束。

校验与例外：

- 该字段需 `EnableHTTP2 = true`，否则 `New()` 返回 `ErrInvalidConnection`。要为池恢复 HTTP/2 却关闭总开关，属配置错误。
- `Security.TLSFingerprint` 路径忽略该字段（指纹栈自带每代理后端）。

完整机制说明见[代理与代理池](../../guides/proxy#代理池与-http-2-enableproxypoolhttp2)。

### DNS-over-HTTPS

启用 DoH 可减少 DNS 解析延迟并防止 DNS 劫持：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

默认 DoH 提供商（按优先级）：Cloudflare → Google → AliDNS。详见 [连接池](../../guides/connection-pool)。

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config           // 自定义 TLS 配置
    MinTLSVersion           uint16                // 最低 TLS 版本，默认 TLS 1.2
    MaxTLSVersion           uint16                // 最高 TLS 版本，默认 TLS 1.3
    InsecureSkipVerify      bool                  // 跳过证书验证（仅测试用）
    TLSFingerprint          string                // 浏览器 TLS 指纹预设，默认 ""（标准栈，无伪装）
    TLSFingerprintDisableSessionTickets bool      // 禁用指纹路径的 TLS 会话票据缓存/恢复，默认 false
    MaxResponseBodySize     int64                 // 响应体大小限制，默认 10MB
    MaxRequestBodySize      int64                 // 请求体大小限制，默认 0（不限制请求体大小；与 MaxResponseBodySize 不同，无自动回退）
    MaxDecompressedBodySize int64                 // 解压后大小限制，默认 100MB
    AllowPrivateIPs         bool                  // 允许私有 IP，默认 false
    SSRFExemptCIDRs         []string              // SSRF 豁免 CIDR
    ValidateURL             bool                  // URL 验证，默认 true
    ValidateHeaders         bool                  // 请求头验证，默认 true
    StrictContentLength     bool                  // 严格 Content-Length，默认 true
    CertificatePinner       CertificatePinner     // 证书固定（SPKI 哈希/公钥），默认 nil（禁用）
    RedirectWhitelist       []string              // 重定向白名单域名
    SensitiveHeaders        []string              // 跨域重定向跳转时按凭据剥离的附加头名，默认 nil
    FollowRedirects         bool                  // 跟随重定向，默认 true
    MaxRedirects            int                   // 最大重定向次数，默认 10（0 为「未设置」哨兵值，回退默认 10）
}
```

#### 三个体积限制的关系

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `MaxResponseBodySize` | 10MB | 限制**未压缩（identity）**响应体字节数；压缩响应按解压后大小受 `MaxDecompressedBodySize` 约束（该字段为 0 时回退到这里） |
| `MaxDecompressedBodySize` | 100MB | 限制压缩响应**解压后**的字节数（防解压炸弹）；未设置（≤0）时回退 `MaxResponseBodySize`。压缩输入本身另有固定的 100MB 上限，不可配置 |
| `MaxRequestBodySize` | 0（不限制） | 上传请求体上限；与响应侧不同**无自动回退**，需显式设置才生效 |

### 证书固定（CertificatePinner）

`CertificatePinner` 启用证书固定：服务端未提供已固定密钥/证书时，TLS 握手被拒绝。即便受信任 CA 被攻破，该机制仍可防御中间人攻击。默认 `nil`（禁用）。使用以下构造函数创建：

| 构造函数 | 说明 |
|----------|------|
| `NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)` | 由一个或多个 base64 编码的 SPKI SHA-256 哈希创建（最常用，支持密钥轮换） |
| `NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)` | 由 DER 编码的 PKIX 公钥创建（内部计算 SHA-256） |
| `NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner` | 组合多个 pinner，任一通过即接受 |

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前密钥
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用密钥（轮换）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::warning 维护成本
证书固定要求在服务端更换证书（如 Let's Encrypt 续期）时同步更新固定值。应固定多个哈希（当前 + 备用）并建立更新机制，避免因密钥轮换导致连接中断。
:::

:::warning SSRF 防护
`AllowPrivateIPs` 默认为 `false`，阻止连接到私有/保留 IP（127.0.0.1、10.x、192.168.x、169.254.x 等，覆盖 localhost、回环、链路本地与私有/保留段）。

设为 `true` 将**完全绕过连接级 SSRF 拨号校验**（不只是放行私有 IP 段）。该设置仅在连接内部服务（VPN、代理、企业内网）时使用；选择性放行请改用 `SSRFExemptCIDRs`。

详见 [SSRF 防护](../../security/ssrf)。
:::

### SSRF 豁免示例

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}
```

非法 CIDR 使 `New()` 直接返回错误（`invalid configuration: ...`），不会被静默忽略。

### TLS 指纹（TLSFingerprint）

`TLSFingerprint` 启用浏览器传输层指纹伪装，一次性模拟以下三部分：

- TLS ClientHello（JA3/JA4）。
- HTTP/2 帧（SETTINGS 顺序与值、连接窗口、初始流 ID、伪头顺序）。
- 有序头块（浏览器原样大小写 + 版本匹配的 User-Agent）。

值为预设名（大小写不敏感）。`""`（默认）走标准栈、无伪装。完整预设清单与行为语义见 [TLS 指纹指南](../../guides/tls-fingerprint)。

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSFingerprint = "chrome-latest" // 或 "chrome-windows"、"firefox-latest" 等
client, err := httpc.New(cfg)
```

:::warning 与 TLSConfig 互斥
`Security.TLSConfig` 与该字段互斥（同时设置时校验拒绝）。设置该字段后，`MinTLSVersion`/`MaxTLSVersion` **被静默忽略**，版本范围由预设的 ClientHello 决定。详见 [TLS 指纹指南](../../guides/tls-fingerprint)。
:::

`SecurityConfig.TLSFingerprintDisableSessionTickets` 置 `true` 时，指纹路径每次连接都完整握手；默认 `false`，此时 Chrome 预设按连接池缓存 TLS 会话票据，以 PSK 恢复重复连接（与真实浏览器重访同一主机的行为一致）。`TLSFingerprintDisableSessionTickets` 适用于指纹轮换管线（要求每条连接完全独立）或排查目标站点问题时排除会话恢复变量。ClientHello 不含 `pre_shared_key` 扩展的预设（Firefox、iOS WebKit 系列）本就总是完整握手，该字段对它们无效果。会话恢复机制详见 [TLS 指纹指南](../../guides/tls-fingerprint#会话恢复)。

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSFingerprint = "chrome-latest"
cfg.Security.TLSFingerprintDisableSessionTickets = true // 每次连接都完整握手
client, err := httpc.New(cfg)
```

### 重定向白名单

`RedirectWhitelist` 限制重定向只允许跳往列出的域名，默认 `nil`（允许所有重定向目标）。该字段是防「重定向型 SSRF」的闸门。更保守的替代方案是 `Security.FollowRedirects = false`（`SecureConfig()` 即采用）。

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "cdn.example.com",
}
```

重定向行为的完整说明见[重定向控制](../../guides/redirects)。

### 敏感头剥离（SensitiveHeaders）

`SecurityConfig.SensitiveHeaders` 扩展跨域重定向跳转时**按凭据处理**的头名集合，规则如下：

- **内置集始终剥离**：`Authorization`、`Proxy-Authorization`、`Cookie`、`X-Api-Key`、`X-Auth-Token` 在跨源跳转时始终剥离（net/http 自身只覆盖前三个），无论是否列出。
- **自定义凭据头需显式列出**：如 `X-Secret-Key` 不在此列出时，会被原样转发给 `Location` 指向的任意目标，构成开放重定向凭据泄漏（CWE-525）。
- **条目匹配**：按规范形式匹配（大小写不敏感），并自动去重。

默认 `nil`。

```go
cfg := httpc.DefaultConfig()
cfg.Security.SensitiveHeaders = []string{"X-Secret-Key", "X-Tenant-Token"}
```

非法头名使 `New()` 返回 `ErrInvalidSecurity`（与 `WithHeader` 相同的键校验规则）。跨域凭据剥离的完整语义见[重定向控制](../../guides/redirects)。

:::warning 掩码范围
`Result.String()` 与审计输出的脱敏只覆盖内置敏感头名。此处列出的自定义头在那些输出中**仍可见**，不能依赖它们隐藏凭据。
:::

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries         int           // 最大重试次数，默认 3
    Delay              time.Duration // 初始重试延迟，默认 1s
    BackoffFactor      float64       // 退避倍数，默认 2.0
    EnableJitter       bool          // 启用抖动，默认 true
    MaxRetryDelay      time.Duration // 最大重试延迟上限，默认 30s
    RetryNonIdempotent bool          // 允许重试非幂等方法（POST、PATCH 及自定义方法），默认 false
    CustomPolicy       RetryPolicy   // 自定义重试策略，默认 nil
}
```

| 字段 | 默认值 | 范围 |
|------|--------|------|
| `RetryConfig.MaxRetries` | 3 | 0-10 |
| `RetryConfig.Delay` | 1s | 0-30min |
| `RetryConfig.BackoffFactor` | 2.0 | 1.0-10.0 |
| `RetryConfig.MaxRetryDelay` | 30s | 0-30min |
| `RetryConfig.EnableJitter` | true | — |
| `RetryConfig.RetryNonIdempotent` | false | — |
| `RetryConfig.CustomPolicy` | nil | 实现 [`RetryPolicy`](../types/interfaces#retrypolicy) 即可 |

重试延迟公式：`min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

响应携带 `Retry-After` 时以其为准（上限 60s），优先于上述退避序列与 `MaxRetryDelay`（源码 `internal/engine/retry.go` 中带 Retry-After 的延迟计算路径）；退避公式的钳制只作用于指数退避回退路径。

`CustomPolicy` 实现 [`RetryPolicy`](../types/interfaces#retrypolicy) 接口，可整体替换内置重试判定；默认 `nil`（使用内置策略）。

与内置策略一样，`CustomPolicy` 仅对幂等方法生效。要让它接管 POST/PATCH 的重试，需同时设置 `RetryNonIdempotent`，或逐请求使用 [`WithRetryNonIdempotent`](../core/options#withretrynonidempotent)。

配置代理状态码轮换时，有效重试次数会被自动提升，见[配置派生与内部换算](#配置派生与内部换算)。

`RetryNonIdempotent` 默认 `false`，此时非幂等请求**恰好执行一次**。超时或可重试 5xx 可能在服务端已提交操作后才到达；若重放请求体，会造成重复（重复支付、重复插入等）。仅当端点已知可容忍重放、或以幂等键保护时才启用该开关。幂等方法（GET/HEAD/PUT/DELETE/OPTIONS/TRACE）不受此开关影响，始终按 `MaxRetries` 重试。

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares []MiddlewareFunc // 中间件列表，默认 nil
}
```

`MiddlewareConfig` 仅包含 `Middlewares` 一个字段。请求默认值（User-Agent、默认请求头）位于 [`RequestDefaults`](#requestdefaults)；重定向策略位于 [`SecurityConfig`](#securityconfig)。

## RequestDefaults

```go
type RequestDefaults struct {
    UserAgent string            // User-Agent，默认 "httpc/1.0"
    Headers   map[string]string // 默认请求头，默认空
}
```

`RequestDefaults` 是每请求默认值的规范位置：User-Agent 与默认请求头。`DefaultConfig()` 已提供合理默认值，调用方按需修改。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `RequestDefaults.UserAgent` | `string` | `"httpc/1.0"` | User-Agent 请求头 |
| `RequestDefaults.Headers` | `map[string]string` | 空 | 添加到每个请求的默认请求头 |

```go
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers = map[string]string{"Accept": "application/json"}
```

## 配置预设

### DefaultConfig

```go
func DefaultConfig() Config
```

安全默认配置，SSRF 防护默认开启。

### SecureConfig

```go
func SecureConfig() Config
```

安全优先配置：更短的超时、禁用自动重定向、严格的 SSRF 防护。

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
func PerformanceConfig() Config
```

高吞吐配置：更大连接池、更长超时，保持安全验证。

:::tip
`PerformanceConfig` 保持 `ValidateURL` 和 `ValidateHeaders` 开启以确保安全性。在可信环境中如需最大性能，可手动关闭：`cfg.Security.ValidateURL = false`。关闭后需自行承担安全风险（注入攻击、SSRF）。
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
func TestingConfig() Config
```

测试环境配置：禁用安全检查、短超时。

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
此配置禁用 TLS 验证和 SSRF 防护，**仅用于测试**。在非测试环境使用会打印安全警告（详见 [安全警告输出](#setsecuritywarnoutput)）。
:::

### MinimalConfig

```go
func MinimalConfig() Config
```

轻量级配置：禁用重试和重定向，最小连接池。

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

## 配置派生与内部换算

`New()` 把公开 Config 换算为引擎配置时，部分零值字段会回退到内置默认。以下派生规则会改变实际行为：

| 派生项 | 规则 |
|--------|------|
| MaxIdleConnsPerHost | 按 `MaxConnsPerHost / 2` 计算，夹在 [2, 10] 区间且不超过 MaxConnsPerHost；`MaxConnsPerHost = 0`（不限连接）时取 10 |
| TLS 版本回退 | `MinTLSVersion` / `MaxTLSVersion` 为 0 时分别回退 TLS 1.2 / TLS 1.3 |
| MaxRetryDelay 回退 | `Retry.MaxRetryDelay` 为 0 时按 30s 处理 |
| TCP KeepAlive | 固定 30s，随连接池配置自动应用，无需设置 |
| 响应体大小回退 | 未压缩响应按 `MaxResponseBodySize` 限制；压缩响应按 `MaxDecompressedBodySize`（≤0 时回退 `MaxResponseBodySize`，仍 ≤0 时回退引擎默认 100MB） |
| 代理轮换自动提升重试 | 设置 `ProxyRotateOnStatus` 或 `ProxyRotatePerRequest`、代理池多于 1 个且未设 `ProxyURL`（池实际生效）时，有效 MaxRetries 自动提升到 `len(ProxyPool)-1`（上限 10，不会被调低） |
| ProxyRotateOnStatus | 作为「额外可重试状态码」传入引擎，命中即消耗一次重试预算换代理 |

:::tip 为什么需要自动提升重试
默认 `MaxRetries = 3` 时，5 个代理的池子在遇到 403 后只能试到第 4 个代理就放弃。设置 `ProxyRotateOnStatus` 或 `ProxyRotatePerRequest` 的意图是遍历整个代理池，因此有效重试预算被提升到「池大小 − 1」。

若 `Retry.MaxRetries` 已显式设为更大的值，则保持该值不变（自动提升只会调高，不会调低）。
:::

## 安全警告输出

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

`SetSecurityWarnOutput` 设置安全警告的输出目标。进程不在测试环境（可执行文件名含 `.test`，或设置了 `GO_TEST`、`GOTEST=1`）时，以下情况会向该 writer 打印告警：

- 打印 `[SECURITY WARNING]`：在非测试环境调用 `TestingConfig()`（警告在该预设函数内部触发，与是否创建客户端无关）。
- 打印 `[SECURITY WARNING]`：`SecurityConfig.InsecureSkipVerify`（`Config.Security`）或 `SecurityConfig.TLSConfig.InsecureSkipVerify` 为 `true`。
- 打印 `[CONFIG WARNING]`：手写 `Config` 结构体字面量恰好命中全关签名——`ValidateURL`、`ValidateHeaders`、`StrictContentLength`、`FollowRedirects`、`EnableHTTP2` 全为 false，且 `Security.MaxResponseBodySize == 0`。这些字段文档标注 `Default: true`，但只在 `DefaultConfig()`/预设中为 true，结构体字面量会把它们清零；提示应从 `DefaultConfig()` 起步再改字段（源码 `client.go` 的 `newFromConfig`）。

三类告警共用同一 writer，各自每进程最多打印一次。默认输出到 `os.Stderr`；传入 `io.Discard` 可完全抑制警告，适合测试或已知安全的内部场景。传入 `nil` 会被归一化为 `io.Discard`。

```go
// 测试中抑制安全警告
httpc.SetSecurityWarnOutput(io.Discard)
cfg := httpc.TestingConfig()
```

:::tip 影响范围
该设置为进程级全局状态，影响所有后续创建的客户端。`TestingConfig`、`InsecureSkipVerify` 与手写 `Config` 三类告警共享同一输出 writer。
:::

## 验证

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

校验配置有效性。`New()` 内部自动调用，也可显式调用。

等价的方法形式 `Validate`（完整方法名 `Config.Validate`，签名 `func (c *Config) Validate() error`，内部直接委托 `ValidateConfig`）适用于已持有 Config 实例的场景，新代码推荐使用该方法。对 nil `*Config` 调用 `Validate` 是安全的，返回 `ErrNilConfig`：

```go
cfg := httpc.DefaultConfig()
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // 超出范围

if err := httpc.ValidateConfig(&cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

校验规则一览（传入 `nil` 返回 `ErrNilConfig`）：

| 字段 | 约束 |
|------|------|
| `Timeouts.*`（全部 5 项） | 0 – 30min |
| `Connection.MaxIdleConns` | 0 – 1000 |
| `Connection.MaxConnsPerHost` | 0 – 1000 |
| `Connection.ProxyURL` 及 `ProxyPool` 每项 | 必须是合法代理 URL |
| `Connection.ProxyFailureThreshold` | ≥ 0 |
| `Connection.ProxyCooldown` | 0 – 30min |
| `Connection.ProxyRotateOnStatus` | 每个状态码在 100 – 599 |
| `Connection.EnableProxyPoolHTTP2` | 需同时设置 `Connection.EnableHTTP2`（组合矛盾即 `ErrInvalidConnection`） |
| `Connection.DoHCacheTTL` | ≥ 0 |
| `Connection.MaxResponseHeaderBytes` | ≥ 0 |
| `Security.MaxResponseBodySize` | 0 – 1GB |
| `Security.MaxDecompressedBodySize` | 0 – 100MB |
| `Security.MaxRequestBodySize` | 0 – 1GB |
| `Security.MinTLSVersion` / `MaxTLSVersion` | 详见表后 TLS 版本校验规则 |
| `Security.SSRFExemptCIDRs` | 每项必须是合法 CIDR |
| `Security.SensitiveHeaders` | 每项须通过头名合法性校验（同 `WithHeader` 键规则） |
| `Retry.MaxRetries` | 0 – 10 |
| `Retry.Delay` | 0 – 30min |
| `Retry.BackoffFactor` | 1.0 – 10.0 |
| `Retry.MaxRetryDelay` | 0 – 30min |
| `Security.MaxRedirects` | 0 – 50 |
| `Defaults.UserAgent` | ≤ 512 字符且不含控制字符 |
| `Defaults.Headers` | 每组键值均通过头部合法性校验 |

**TLS 版本校验规则**：非 0 值必须是 `tls.VersionTLS*` 常量（TLS 1.0–1.3）；两者均非 0 时要求 Min ≤ Max。除原始值比较外，`ValidateConfig` 还按「0 回退默认（Min→TLS 1.2 / Max→TLS 1.3）」换算出**有效版本对**再比较一次——只设置单个边界的 Config（如仅 `MaxTLSVersion = TLS 1.1`）同样会在构造期报 `ErrInvalidSecurity`，而非等到握手期才以晦涩错误失败。

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
| `CookieSecurityConfig.RequireSecure` | `bool` | 要求 Cookie 设置 Secure 属性 |
| `CookieSecurityConfig.RequireHttpOnly` | `bool` | 要求 Cookie 设置 HttpOnly 属性 |
| `CookieSecurityConfig.RequireSameSite` | `string` | 要求的 SameSite 值，如 `"Strict"`、`"Lax"`；空字符串表示不检查 |
| `CookieSecurityConfig.AllowSameSiteNone` | `bool` | 是否允许 SameSite=None；为 `false` 且 `RequireSameSite` 为空时，SameSite=None 的 Cookie 会被拒绝 |
| `CookieSecurityConfig.RequireSecureForSameSiteNone` | `bool` | SameSite=None 时强制要求 Secure 属性（`DefaultCookieSecurityConfig()` 中为 `true`；直接构造零值结构体时是 `false`，建议始终经工厂构造） |

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
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
```

两个工厂的字段取值对比：

| 字段 | DefaultCookieSecurityConfig | StrictCookieSecurityConfig |
|------|------------------------------|----------------------------|
| `RequireSecure` | `false` | `true` |
| `RequireHttpOnly` | `false` | `true` |
| `RequireSameSite` | `""`（不要求） | `"Strict"` |
| `AllowSameSiteNone` | `true` | `false` |
| `RequireSecureForSameSiteNone` | `true` | `true` |
