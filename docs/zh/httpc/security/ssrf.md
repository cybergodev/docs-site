---
sidebar_label: "SSRF 防护"
title: "SSRF 防护 - CyberGo HTTPC | 私有 IP 与元数据"
description: "HTTPC SSRF 防护详解：默认阻止 IPv4/IPv6 私有 IP 与云元数据端点、SSRFExemptCIDRs 精确豁免、AllowPrivateIPs 危险对比、DNS 重绑定防护、WithAllowPrivateIPs 请求级覆盖与 RedirectWhitelist 重定向白名单。"
sidebar_position: 20
---

# SSRF 防护

SSRF（Server-Side Request Forgery，服务端请求伪造）是攻击者诱导服务器向内网发起请求的攻击方式。危害包括：窃取云实例元数据凭据（IAM 角色 token）、扫描内网端口与服务、访问无鉴权的内部管理接口、绕过防火墙访问受保护资源。HTTPC 默认开启 SSRF 防护，阻止连接私有/保留 IP 段。

## 默认行为

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false（默认）→ 阻止所有私有/保留 IP
```

`AllowPrivateIPs` 默认为 `false`，拨号器层面的 SSRF 验证完全开启。这与仅验证 URL 中的主机名不同——HTTPC 在实际建立 TCP 连接时验证解析后的 IP，可防御 DNS 重绑定（见下文）。

## 验证在哪里执行：三层防线

SSRF 校验分布在三个层级，任何一层被绕过都有下一层兜底：

| 防线 | 执行时机 | 行为 | 实现位置 |
|------|----------|------|----------|
| 1. 预检校验层 | 请求发出前 | 解析 URL 后按**主机名**快查：`localhost` 及变体、IP 字面量、传统十进制/十六进制/八进制记法（不解析 DNS，零网络开销） | `internal/security/validator.go` → `internal/validation/netutil.go` |
| 2. 重定向层 | 每一跳 30x | 对重定向目标主机名重复校验（先查域名白名单，再做 SSRF 校验） | `internal/engine/transport.go` |
| 3. 连接层（拨号器） | 建立 TCP 连接前 | **解析 DNS → 逐个校验 IP → 过滤私有地址 → 直连已验证 IP**，防 DNS 重绑定 | `internal/connection/pool.go` |

预检层按主机名形态给出的典型拒绝（请求根本不会发起连接）：

| 目标主机 | 拒绝原因 |
|----------|----------|
| `localhost`、`LOCALHOST`、`localhost.localdomain` | localhost 主机名检查（大小写不敏感） |
| `127.0.0.1`、`::1`、`0.0.0.0`、`::` | localhost 主机名检查（精确匹配） |
| `10.0.0.1`、`192.168.1.1`、`169.254.169.254` | 私有/保留 IP 阻止 |
| `2130706433`、`0x7f000001`、`0177.0.0.1` | 传统 IP 字面量记法阻止 |

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
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()

	// 回环地址在预检层即被拒绝——没有任何网络连接发生
	_, err = client.Get("http://127.0.0.1:9/")
	if err != nil {
		fmt.Println("请求被拦截（未拨号）")
	}
	// 输出：请求被拦截（未拨号）
}
```

连接层是最终防线：即使 `ValidateURL = false` 关闭了预检层，拨号器仍会解析域名并校验真实 IP——域名解析结果全部为私有地址时返回 `domain resolves only to blocked addresses` 类错误。DNS 解析超时为 `min(10s, Timeouts.Dial)`。

:::tip
预检层有 URL 级缓存（1024 条，超限淘汰最旧的 25%），重复请求同一 URL 不会重复解析校验。使用 `WithAllowPrivateIPs` 按请求覆盖时自动绕过缓存（同一 URL 的校验结果不再稳定，不能复用）。
:::

## 被阻止的 IP 范围

HTTPC 阻止所有不适合公网通信的 IP 地址，覆盖 IPv4、IPv6 及其绕过变体。

### IPv4 阻止范围

| 范围 | CIDR | 说明 |
|------|------|------|
| 回环 | `127.0.0.0/8` | localhost（含 127.x.x.x 全段） |
| A 类私有 | `10.0.0.0/8` | 内网（RFC 1918） |
| B 类私有 | `172.16.0.0/12` | 内网（RFC 1918） |
| C 类私有 | `192.168.0.0/16` | 内网（RFC 1918） |
| 链路本地 | `169.254.0.0/16` | 自动配置（含 AWS/Azure 元数据） |
| CGNAT | `100.64.0.0/10` | 运营商级 NAT（含阿里云元数据 `100.100.100.200`） |
| E 类保留 | `240.0.0.0/4` | 保留地址（`ip4[0] >= 240`） |
| "本网络" | `0.0.0.0/8` | 本网络标识（`ip4[0] == 0`） |
| IETF 协议分配 | `192.0.0.0/24` | 特殊用途 |
| TEST-NET-1 | `192.0.2.0/24` | 文档用途（RFC 5737） |
| TEST-NET-2 | `198.51.100.0/24` | 文档用途（RFC 5737） |
| TEST-NET-3 | `203.0.113.0/24` | 文档用途（RFC 5737） |
| 6to4 中继 | `192.88.99.0/24` | 已废弃任播 |

此外，IPv6 回环（`::1`）、唯一本地（`fc00::/7`）、链路本地（`fe80::/10`）等范围同样被阻止——HTTPC 的 IP 校验覆盖回环、私有、链路本地单播/多播、多播、未指定等全部保留类别。

### IPv6 阻止范围

| 范围 | CIDR | 说明 |
|------|------|------|
| 回环 | `::1/128` | localhost |
| 唯一本地 | `fc00::/7` | 内网（对应 IPv4 私有） |
| 链路本地 | `fe80::/10` | 自动配置 |
| 文档前缀 | `2001:db8::/32` | 文档用途（RFC 3849） |
| NAT64 | `64:ff9b::/96` | 会递归校验内嵌 IPv4 |

### 绕过防护

HTTPC 额外阻止以下常见 SSRF 绕过手法：

| 手法 | 示例 | 防护 |
|------|------|------|
| IPv4-mapped IPv6 | `::ffff:127.0.0.1` | 归一化为 IPv4 后校验 |
| 十进制整数 | `2130706433`（= 127.0.0.1） | 识别为传统 IP 字面量并阻止 |
| 十六进制 | `0x7f000001`、`0x7f.0.0.1` | 识别 `0x` 前缀并阻止 |
| 八进制 | `0177.0.0.1` | 识别前导零并阻止 |
| NAT64 内嵌 | `64:ff9b::7f00:1` | 递归校验内嵌 IPv4 |

:::tip
这些绕过防护在 cgo 构建下尤为重要：`getaddrinfo` 可能接受传统 IP 字面量并映射到私有 IP。HTTPC 在 DNS 解析前即拦截这些形式。
:::

## 云元数据端点防护

各云平台的实例元数据服务（IMDS）是 SSRF 攻击的高价值目标——一旦访问即可窃取临时凭据。HTTPC 默认阻止这些地址：

| 平台 | 元数据地址 | 阻止机制 |
|------|-----------|----------|
| AWS EC2 | `169.254.169.254` | 链路本地 `169.254.0.0/16` 阻止 |
| Azure | `169.254.169.254` | 同上（链路本地阻止） |
| GCP | `metadata.google.internal` | DNS 解析后 IP 验证 |
| 阿里云 | `100.100.100.200` | CGNAT `100.64.0.0/10` 阻止 |

:::warning
AWS 元数据 IMDSv2 虽要求 token，但 SSRF 仍可能先获取 token 再访问数据。HTTPC 的 IP 级阻止比 IMDSv2 更底层，直接拦截连接。建议两者并用：HTTPC 阻止 + 启用 IMDSv2 纵深防御。
:::

:::warning
阿里云元数据（`100.100.100.200`）位于 CGNAT 范围（`100.64.0.0/10`），HTTPC **默认阻止该范围**。若因 Tailscale/WireGuard 等 VPN 或内部路由确需访问 `100.64.0.0/10`，须显式通过 `SSRFExemptCIDRs: []string{"100.64.0.0/10"}` 豁免——豁免后该范围内的阿里云元数据也将可达，请评估风险。
:::

## DNS 重绑定防护

DNS 重绑定（DNS Rebinding）是绕过 SSRF 校验的经典手法。攻击者控制域名的 DNS 服务器，让首次解析返回公网 IP（通过校验），实际连接时返回 `127.0.0.1`（绕过校验）。

HTTPC 采用「解析 - 验证 - 直连」模式防御此类攻击：

1. **解析**：将域名解析为 IP 列表
2. **验证**：逐一校验每个 IP 是否为私有/保留地址
3. **过滤**：移除被阻止的 IP，仅保留允许的 IP
4. **直连**：直接拨号到已验证的 IP，不再重新解析域名

```go
// 攻击场景：
// 1. 攻击者控制 evil.com 的 DNS
// 2. 校验阶段解析返回公网 IP（通过验证）
// 3. 标准 net/http 会再次解析域名（此时返回 127.0.0.1，绕过验证）
//
// HTTPC 防御：拨号时直接使用已验证的 IP，不重新解析域名
```

:::tip
「Split-Horizon DNS」（同一域名解析到公网与内网 IP）环境下，HTTPC 会自动过滤掉私有 IP，仅用公网 IP 建立连接，而非直接拒绝整个域名。
:::

启用 DoH（`Connection.EnableDoH = true`）时走同一条防线：DoH 解析结果先经同样的 IP 过滤，全部被阻止时报 `SSRF protection: domain resolves only to blocked addresses`，然后才逐个尝试拨号允许的 IP。DNS 解析超时从请求 context 派生并封顶 10s（`min(10s, Timeouts.Dial)`），请求取消会即时中止解析。

## SSRFExemptCIDRs 精确豁免

微服务环境中常需访问 VPC、Kubernetes Service 或 VPN 内的服务。`SSRFExemptCIDRs` 允许精确豁免特定 CIDR 范围，保留对其他私有 IP 的阻止——这是推荐的内部服务访问方式。

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
client, _ := httpc.New(cfg)
```

### 典型豁免用例

| 场景 | CIDR | 说明 |
|------|------|------|
| VPC 内部服务 | `10.0.0.0/8` | AWS/GCP/Azure 默认 VPC |
| Tailscale VPN | `100.64.0.0/10` | Tailscale 网段（RFC 6598） |
| Kubernetes | `172.20.0.0/16` 等 | Pod/Service CIDR |
| WireGuard | `10.13.0.0/16` 等 | 自定义 VPN 网段 |

无效 CIDR 会导致 `httpc.New()` 返回错误（如 `SSRFExemptCIDRs: invalid CIDR "10.0.0/8"`），配置在启动期即失败，而非运行时静默放过。

:::warning
豁免 CIDR 应尽量精确。避免使用过大的范围（如 `0.0.0.0/0`），否则等于完全禁用 SSRF 防护。即便是 `10.0.0.0/8` 也应评估是否可收窄到实际使用的子网。
:::

## AllowPrivateIPs vs SSRFExemptCIDRs 对比

两者都能放行内部服务，但安全语义截然不同：

| 维度 | `AllowPrivateIPs = true` | `SSRFExemptCIDRs` |
|------|--------------------------|--------------------|
| 防护状态 | **完全绕过** SSRF 验证 | 仅豁免指定 CIDR，其余仍阻止 |
| 覆盖范围 | 所有私有/保留/回环/链路本地 IP | 仅列出的 CIDR |
| localhost | 允许 | 始终阻止——主机名检查先于豁免匹配，`SSRFExemptCIDRs` 无法放行回环地址（见下文「已知边界」） |
| 云元数据 | **可达**（危险） | 默认仍阻止 |
| 风险等级 | 高——攻击面等于禁用 SSRF | 低——精确放行 |
| 推荐度 | 仅测试/全内网客户端 | 生产推荐 |

:::danger
`AllowPrivateIPs = true` 完全绕过拨号器层面的 SSRF 验证（不仅仅是「允许私有 IP」），包括 localhost 检查、链路本地检查、所有保留地址检查。生产环境处理任何不可信 URL 时绝不可用。如需访问内部服务，优先使用 `SSRFExemptCIDRs`。
:::

## 按请求豁免私有 IP

若客户端整体使用安全默认（`AllowPrivateIPs = false`），仅个别请求需访问内网（如 `localhost` 健康检查端点），可用 `WithAllowPrivateIPs` 请求选项按请求放行，不必全局放松安全策略：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// 默认客户端阻止私有 IP；此调用按请求放行
	result, err := httpc.Get("http://localhost:8080/health",
		httpc.WithAllowPrivateIPs(true),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("健康检查状态：%d\n", result.StatusCode())
}
```

:::warning
仅对**可信且非来自用户输入**的 URL 启用 `WithAllowPrivateIPs(true)`。SSRF 防护的目的是防止攻击者诱导你的进程访问内网端点；按请求禁用会为该次调用重新引入此风险。若整个客户端都需要访问内部服务，请在 `Config` 上设置 `Security.AllowPrivateIPs = true`。
:::

反向用法同样有效：客户端配置了 `AllowPrivateIPs = true`（如纯内网客户端），但单个请求需强制开启 SSRF 校验，可用 `WithAllowPrivateIPs(false)`。

## 重定向中的 SSRF 检查

重定向是 SSRF 攻击的重要载体：公开服务可能 302 跳转到 `http://169.254.169.254/`（云元数据）或内网地址。HTTPC 对重定向目标同样执行 SSRF IP 验证。

| 客户端配置 | 重定向到私有 IP 的行为 |
|-----------|----------------------|
| `AllowPrivateIPs = false`（默认） | 阻止——重定向目标 IP 验证失败 |
| `AllowPrivateIPs = true` | 允许——绕过 SSRF（含重定向） |
| `WithAllowPrivateIPs(true)` 按请求 | 允许该请求的重定向到私有 IP |
| `SSRFExemptCIDRs` 命中 | 允许重定向到豁免 CIDR |

```go
// 场景：请求 public-api.com，服务端 302 跳转到 http://169.254.169.254/
// HTTPC 验证重定向目标的 IP，阻止对云元数据服务的访问
```

每一跳重定向按以下顺序检查（任一步失败即拒绝该跳，实现见 `internal/engine/transport.go` 的 `checkRedirect`）：

1. **域名白名单**（若配置 `RedirectWhitelist`）
2. **协议检查**：仅允许 http/https（拒绝 `file://`、`gopher://` 等）
3. **SSRF 主机校验**：目标主机名按私网/回环/保留规则校验
4. **跨域剥除敏感头**：目标主机不同于起始主机时，移除 `Authorization`、`Cookie`、`Proxy-Authorization`——即使重定向被允许，凭据也不会被带去第三方域
5. **循环重定向检测**：A→B→A 式环路报错（连续同 URL 的 A→A 除外）
6. **次数上限**：默认 10 次，配置硬上限 50

重定向层只做主机名快查（不解析 DNS，避免与拨号层重复解析引入新的 TOCTOU 窗口）；目标域名的真实 IP 由拨号层在连接时再次校验——两层配合，重定向无法绕过 DNS 重绑定防护。

`WithAllowPrivateIPs` 的按请求覆盖同样作用于重定向校验：覆盖值经 context 传播到重定向验证器与拨号器（`internal/connection/ssrf_context.go`），该请求的重定向目标也按覆盖后的策略判断。

### 重定向域名白名单

`RedirectWhitelist` 在 IP 验证之上叠加域名级控制，防止开放重定向漏洞：

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com", // 通配符：匹配严格子域
}
// 非白名单域名的重定向被阻止
```

通配符 `*.example.com` 匹配 `api.example.com`、`static.cdn.example.com` 等严格子域，但**不匹配**裸域 `example.com`（需单独列出）。白名单为 `nil` 时全部允许（默认行为）。

## 配置示例

### 安全配置（处理用户 URL）

处理用户提供的 URL 时，使用 `SecureConfig()` 获得最严格的 SSRF 防护：

```go
cfg := httpc.SecureConfig()
// AllowPrivateIPs = false（严格 SSRF）
// FollowRedirects = false（阻止重定向 SSRF）
// MaxResponseBodySize = 5MB
client, _ := httpc.New(cfg)
```

### 内部服务配置（访问 VPC）

访问 VPC/Kubernetes 内部服务，用 `SSRFExemptCIDRs` 精确放行：

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",     // VPC
    "172.20.0.0/16",  // Kubernetes Service
}
client, _ := httpc.New(cfg)
```

### 混合配置（公网 + 内网）

同一客户端需访问公网 API 与内部服务，且内部服务网段已知：

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.50.0.0/16",   // 内部服务专用子网（精确）
}
cfg.Security.RedirectWhitelist = []string{
    "api.public.com",
    "*.internal.corp", // 仅允许跳转到内部可信域
}
client, _ := httpc.New(cfg)
```

## 完全禁用 SSRF 防护

仅在测试环境使用。两种方式：

```go
// 方式一：TestingConfig（同时禁用 TLS 验证等多项安全特性）
client, _ := httpc.New(httpc.TestingConfig())

// 方式二：手动配置
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
client, _ := httpc.New(cfg)
```

`TestingConfig()` 在非测试环境会向 `stderr` 打印安全警告（见 [安全概述](./)）。

:::danger
生产环境永远不要设置 `AllowPrivateIPs = true`。这等于完全放弃 SSRF 防护，攻击者可借此访问云元数据、内网服务、管理接口。
:::

## 已知边界与绕过面

以源码为准，SSRF 防护有以下已知边界，配置前应知悉：

### localhost 无法通过 CIDR 豁免

预检层的 `isLocalhost` 主机名检查**先于** CIDR 豁免匹配执行（`internal/validation/netutil.go` 的 `ValidateSSRFHost`：先查 localhost，再查 IP 豁免）。因此把 `127.0.0.0/8` 加入 `SSRFExemptCIDRs` 并不能放行 `localhost` 或 `127.x.x.x`——请求仍在预检层被拒绝。确需访问回环地址时，使用 `WithAllowPrivateIPs(true)`（请求级）或 `AllowPrivateIPs = true`（客户端级）。

### 显式配置的代理不做 SSRF 校验

`ProxyURL` 与 `ProxyPool` 中的代理主机地址视为**开发者配置的基础设施**，拨号时跳过 SSRF 校验与 DoH 解析（`internal/connection/pool.go`）。这是有意设计：能配置代理的开发者本就可以直连任意地址，拦截代理主机不增加实质安全。但系统代理有一个限制：`EnableSystemProxy` 只在客户端构建时探测一次代理地址（用于 SSRF 豁免）；若此后环境变量才解析出 localhost 代理（如 `127.0.0.1:7890`），该代理可能被 SSRF 防护阻止。动态变化的本地代理请显式设置 `ProxyURL`。

### localhost.\* 任意子域按普通域名处理

`localhost.example.com` 这类 `localhost.*` 子域**不**按 localhost 处理——它们可能是合法的公网域名。但若其 DNS 解析到回环 IP，仍会被连接层拦截，只是不再享受预检层的免解析快查。

### 关闭 ValidateURL 后由重定向层与连接层兜底

关闭 URL 验证（不建议，`TestingConfig` 之外几乎没有正当理由）后，预检层不再运行；重定向层与连接层仍然有效。此时 URL 中的 `localhost` 字面量要等 DNS 解析出回环 IP 后才在拨号层被拦截，错误信息也不同（`domain resolves only to blocked addresses`），且传统 IP 字面量快查随之失效。

### 传统 IP 字面量在 DNS 解析前拦截

`2130706433`、`0x7f000001`、`0177.0.0.1` 等记法被 `net.ParseIP` 拒绝，却在 cgo 构建的 `getaddrinfo` 解析器中可能被接受并映射到私有 IP。HTTPC 在预检层用 `looksLikeLegacyIPLiteral` 识别并拦截这些形式（识别规则：`0x` 前缀、纯数字无点、多点形式中的前导零八进制或十六进制段），不依赖平台解析器行为。

### 198.18.0.0/15 保留段默认放行

RFC 2544 基准测试段 `198.18.0.0/15` 虽属保留地址，但被**特意放行**而非拦截：Clash/Surge 类代理工具把 fake-IP 池分配在该段，拦截它会导致这类代理环境下的正常请求被 SSRF 防护误杀（见 `internal/validation/netutil.go` 中 `isPrivateOrReservedIP` 的注释与 `netutil_test` 的对应用例）。若你的环境不使用 fake-IP 代理且需要收紧该段，须在调用方或自定义中间件层自行校验目标 IP。

## 最佳实践

1. 使用 `SecureConfig()` 作为处理不可信 URL 的安全基线
2. 仅用 `SSRFExemptCIDRs` 精确豁免必要的 CIDR 范围，避免 `AllowPrivateIPs`
3. 配置 `RedirectWhitelist` 限制重定向目标域名
4. 处理用户 URL 时禁用重定向（`FollowRedirects = false`）
5. 定期审计 `SSRFExemptCIDRs` 配置，移除不再使用的网段
6. 使用 `AuditMiddleware` 记录所有请求，便于事后追溯 SSRF 攻击尝试

## 下一步

- [TLS 与证书固定](./tls-certpin) - TLS 安全配置与证书固定
- [安全概述](./) - 安全特性总览
- [生产检查清单](./production-checklist) - 上线前 SSRF 核查项
