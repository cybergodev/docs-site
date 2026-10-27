---
sidebar_label: "连接池与 DNS"
title: "连接池与 DNS - CyberGo HTTPC | 连接池调优与 DNS 解析"
description: "HTTPC 连接池与 DNS 指南：MaxIdleConns 与 MaxConnsPerHost 调优、空闲连接与总连接上限、TIME_WAIT 治理、对象池复用、并发请求模式、DoH 加密解析降级回退与 HTTP/2 多路复用实践，附高并发场景推荐参数。"
sidebar_position: 90
---

# 连接池与 DNS

连接池决定 HTTPC 如何复用 TCP 连接，DNS 解析决定连接指向哪个地址；两者共同决定并发能力与建连延迟。本页说明相关参数、派生规则与 DoH 行为。

## 连接池配置

HTTPC 使用 `ConnectionConfig` 管理连接池。

```go
cfg := httpc.DefaultConfig()

// 连接池参数
cfg.Connection.MaxIdleConns = 100         // 全局最大空闲连接
cfg.Connection.MaxConnsPerHost = 20       // 每主机最大连接数
cfg.Timeouts.IdleConn = 120 * time.Second // 空闲连接保持时间
```

### 参数说明

| 参数 | 默认 | 说明 |
|------|------|------|
| `MaxIdleConns` | 50 | 全局最大空闲连接数 |
| `MaxConnsPerHost` | 10 | 每主机最大连接数（含活跃 + 空闲） |
| `IdleConn` | 90s | 空闲连接超时，超时后关闭 |
| `Dial` | 10s | 建立连接超时 |
| `TLSHandshake` | 10s | TLS 握手超时 |
| `ResponseHeader` | 0 | 禁用（使用 Request 超时） |
| `MaxResponseHeaderBytes` | 0 | 响应头大小上限；0 = Go 标准库默认 1MB（`net/http.DefaultMaxHeaderBytes`） |

### 场景推荐

| 场景 | MaxIdleConns | MaxConnsPerHost | IdleConn |
|------|-------------|-----------------|----------|
| 高并发 API | 100 | 20 | 120s |
| 常规服务 | 50 | 10 | 90s |
| 低频请求 | 10 | 2 | 30s |
| 微服务内部 | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` 包含活跃连接和空闲连接。超过此限制的新请求会排队等待连接释放。
:::

### 派生参数与内部上限

部分连接参数没有独立配置项，由引擎从现有参数**推导**或使用固定值：

| 参数 | 值 | 来源 |
|------|-----|------|
| `MaxIdleConnsPerHost` | `clamp(MaxConnsPerHost/2, 2, 10)`；`MaxConnsPerHost=0` 时取 10 | 由 `MaxConnsPerHost` 派生，无独立字段 |
| 单客户端总连接上限 | 1000（活跃 + 空闲） | 固定值，超出返回连接池耗尽错误 |
| TCP KeepAlive 探测间隔 | 30s | 固定值 |
| `ExpectContinueTimeout` | 1s | 固定值（`Expect: 100-continue` 等待时长） |

:::tip TCP KeepAlive 与 IdleConn 的分工
30s 的 TCP keep-alive 探测维持的是 TCP 层心跳——防止 NAT/防火墙静默丢弃长时间空闲的连接；`IdleConn` 决定的是 HTTP 层何时主动关闭空闲连接。两者独立生效，TCP keep-alive 无公开开关（始终开启）。
:::

### 连接池何时耗尽与如何缓解

总连接上限（1000）在**拨号时刻**以原子计数执行准入：每次新建连接先占用一个名额，连接关闭时归还。计数同时覆盖**活跃与空闲**连接。

名额不足时拨号立即失败，错误归类为 `ClientError`（`ErrorTypeNetwork`，Message 为 `connection pool exhausted`，底层原因保留 `(max 1000)` 字样）。分类流程见[错误类型](../api-reference/types/errors#错误分类流程)。

该上限是内部固定值，`ConnectionConfig` 未暴露对应字段。它用于极端并发下的保护，不是调优参数。

**触发条件**：上限按单客户端、跨全部主机统计。默认 `MaxConnsPerHost=10` 时，需约 100 个主机同时打满（100 × 10）才触顶。其中大部分必须是在途活跃连接，空闲连接另受 `MaxIdleConns=50` 约束。典型触发场景是高扇出爬虫在同一客户端上并发访问数百个主机。

**缓解手段**（按优先级）：

1. **拆分客户端**：把大扇出流量分散到多个 Client，各自拥有独立的 1000 名额；
2. **缩短 `IdleConn`**：空闲连接更快关闭，提前归还名额；
3. **控制并发**：用信号量或 worker 池限制同时在途的请求数。

错误的匹配写法与处理实践见[错误处理](./error-handling)。

### 多 IP 拨号与 IPv6 回退

无论是否启用 DoH，拨号都不绑定单个解析结果。主机名解析出的全部 IP 先经 SSRF 过滤，再**按顺序逐个尝试**，直到某个 IP 建连成功。典型场景是本机 IPv6 不通时回退 IPv4。

全部候选失败时返回聚合错误，消息中携带尝试过的地址数（如 `connection failed after trying 2 address(es): ...`）。

- 每个候选 IP 的拨号各自受 `Dial` 超时（默认 10s）约束：候选越多，最坏情况下建连总耗时越长。IPv6 环境异常导致的缓慢失败，应优先排查 DNS/路由，而非调大超时。
- 标准 DNS 路径的解析超时取 `min(Dial, 10s)`，且派生自请求上下文——请求取消会立即中断解析；DoH 路径天然遵循上下文。

### 空闲连接管理

- **`IdleConn`（默认 90s）**：空闲连接在传输层超时后自动关闭。调大可提高连接复用率，调小可更快释放对端资源。高频短连接场景需注意 TIME_WAIT 堆积。
- **代理轮换时的主动清理**：启用 `ProxyRotatePerRequest` 或状态码轮换的重试路径会**自动关闭全部空闲连接**，强制下一次请求重新选择代理。否则 HTTP/2 经 CONNECT 隧道的连接复用会绕过代理选择，使轮换失效。代理配置与轮换策略详见[代理与代理池](./proxy)。
- **`client.Close()`**：关闭全部空闲连接、DoH 解析器与内部资源；此后继续请求返回 `ErrClientClosed`。
- **超过 `MaxIdleConns` 全局上限**：连接空闲归还时，最久未使用的空闲连接会被立即淘汰（LRU）。因此空闲连接不一定能存活到 `IdleConn` 超时。
- **TLS 会话恢复降低重建成本**：空闲连接过期后重建时，内置的 TLS 会话票据缓存（LRU，容量 256）允许跳过完整握手，重建快于首次建连，与调大 `IdleConn` 互补。

### 响应解压的特别处理

传输层**禁用了标准库自动解压**，由 HTTPC 在响应处理层手动处理 `gzip` / `deflate`：解压受 `Security.MaxDecompressedBodySize`（默认 100MB）约束，防御解压炸弹攻击。

标准路径只解压这两种编码。响应为 `br`、`zstd` 或未知 `Content-Encoding` 时，标准路径直接报错。`br` / `zstd` 仅在 `Security.TLSFingerprint` 路径可用，该路径通告 `gzip, deflate, br, zstd`。`Result.RawBody()` 返回的是解压后的字节。

## DNS-over-HTTPS

启用 DoH 后，DNS 解析走加密的 HTTPS 通道，防止运营商劫持与 DNS 投毒，并内置多提供商容灾：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // 传 0 也回退 5 分钟
```

默认 DoH 提供商（按尝试顺序排列）：

| 提供商 | 地址 |
|--------|------|
| Cloudflare | `1.1.1.1/dns-query` |
| Google | `dns.google/resolve` |
| AliDNS | `dns.alidns.com/resolve` |

### 工作机制

- **A + AAAA 并发查询**：每次解析同时查询 IPv4 与 IPv6 记录并合并结果。
- **双格式解析**：按响应 `Content-Type` 选择 JSON（`application/dns-json` / `application/json`）或 RFC 1035 wire 格式（`application/dns-message` / `application/dns-wire`）解析，与提供商身份无关。`Content-Type` 缺失或无法识别时先试 JSON 再试 wire，兼容配置异常的服务器。
- **并发合并**：同一主机的并发缓存未命中会合并为一次网络往返（singleflight），避免缓存击穿导致提供商过载。
- **独立内部客户端**：DoH 请求走独立的 HTTP 客户端（5s 超时、启用 HTTP/2），不占用业务连接池与请求超时预算。

### 降级链

```text
Cloudflare (1.1.1.1) → Google (dns.google) → AliDNS → 系统 DNS 解析器
```

任一提供商成功即返回；全部失败时自动回退系统 DNS 解析器，并把两层错误合并进错误信息。单个提供商故障不会导致请求失败。

### 缓存

| 项 | 值 |
|----|-----|
| TTL | `DoHCacheTTL`（默认 5 分钟） |
| 容量上限 | 1000 条；满时先淘汰过期条目，再淘汰最临近过期的条目 |
| 响应大小上限 | 64KB（防恶意 DNS 响应占用过多内存） |

### 与 SSRF 防护的联动

DoH 解析出的 IP 会先经 SSRF 过滤（剔除私有/保留地址，尊重 `SSRFExemptCIDRs`），然后**直接拨号到已验证的 IP**。校验与拨号之间不存在第二次 DNS 解析，因此 DNS rebinding 攻击无法生效。

代理地址不经过 DoH 解析：代理由开发者显式配置，直接拨代理主机（见[代理与代理池](./proxy)）。详见 [SSRF 防护](../security/ssrf)。

## HTTP/2

默认启用 HTTP/2（需要 TLS）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // 禁用 HTTP/2
```

HTTP/2 特性：

- **多路复用**：单连接处理多个并发请求
- **头部压缩**：减少重复头传输
- **服务端推送**

禁用时传输层不再尝试 HTTP/2 协商（含自定义 TLS 配置场景的强制尝试），明文 HTTP/2（h2c）不受支持。

HTTP/2 多路复用会让同一主机的并发请求共享一条连接，这正是代理轮换场景需要关闭空闲连接的原因（见[代理与代理池](./proxy)的每请求轮换）。

一个例外：多代理轮换池（`ProxyPool` 多于 1 条且未设 `ProxyURL`）激活时，HTTP/2 会被**自动禁用**，强制走 HTTP/1.1。这样共享的 h2 连接池不会把请求固定到单一代理隧道、绕过轮换。

该场景需要多路复用时，可设 `Connection.EnableProxyPoolHTTP2 = true`（前提 `EnableHTTP2`，默认已开启），详见[代理与代理池](./proxy#代理池与-http-2-enableproxypoolhttp2)。

## 对象池复用

HTTPC 内部对引擎响应对象与字符串构建器复用 sync.Pool，减少 GC 压力；Result 则每次请求新建、由 GC 自动回收。

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result 每次请求新建，GC 自动回收，无需手动释放
```

池化对象的清单与容量防护见[性能优化](./performance#内存优化机制)。

## 并发请求模式

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| TIME_WAIT 数量高 | 空闲连接超时太短 | 增大 `IdleConn` 超时 |
| 连接被拒 | 每主机连接数不够 | 增大 `MaxConnsPerHost` |
| 请求排队等待 | 连接池太小 | 增大 `MaxIdleConns` |
| 想控制每主机空闲连接数 | 无独立配置字段 | 由 `MaxConnsPerHost` 派生（÷2，夹在 2–10 之间） |
| 请求报 `connection pool exhausted` | 单客户端同时打开的连接（活跃 + 空闲）达到内部上限 1000 | 见[连接池何时耗尽与如何缓解](#连接池何时耗尽与如何缓解)；拆分客户端、缩短 `IdleConn` 或控制并发 |
| 启用 DoH 后解析失败 | 所有 DoH 提供商不可达/超时 | 已内置回退系统 DNS；检查出口网络或保持默认 |
| 代理不生效或频繁熔断 | 代理配置与连接复用的交互 | 见[代理与代理池](./proxy)常见问题 |

完整的性能反模式和优化建议见 [性能优化](./performance)。

## 下一步

- [性能优化](./performance) - 性能调优指南
- [代理与代理池](./proxy) - 单代理、系统代理与代理池轮换熔断
- [配置 API](../api-reference/client-config/config) - 连接配置字段参考
- [安全概述](../security/) - SSRF 和 TLS 安全
