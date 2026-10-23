---
title: "代理与代理池 - CyberGo HTTPC | 代理配置与轮换熔断"
description: "HTTPC 代理与代理池完整指南：HTTP/HTTPS/SOCKS5 单代理配置、系统代理与 NO_PROXY 绕过、代理池轮询与随机策略、ProxyRotateOnStatus 按状态码换 IP、EnableProxyPoolHTTP2 代理池 HTTP/2 多路复用、每请求轮换与熔断恢复详解。"
sidebar_label: "代理与代理池"
sidebar_position: 100
---

# 代理与代理池

无论是穿越企业网络、为采集任务轮换出口 IP，还是规避目标站点的 IP 封锁，代理都是 HTTP 客户端的高频需求。HTTPC 内置四种代理模式——单代理、系统代理检测、代理池轮换、状态码触发轮换——覆盖从「固定出口」到「每请求换 IP」的完整谱系，并与 SSRF 防护、TLS 校验、重试引擎协同工作。全部代理配置集中在 `ConnectionConfig`。

## 代理模式总览

四种模式按优先级自动生效，同时配置多种时只有最高优先级者生效：

| 优先级 | 配置 | 行为 | 典型场景 |
|--------|------|------|----------|
| 1（最高） | `ProxyURL` | 始终使用指定代理（单代理模式） | 企业网络出口、本地 VPN 端口 |
| 2 | `ProxyPool` | 在代理池中轮换，含熔断与恢复 | 采集、负载分散、IP 轮换 |
| 3 | `EnableSystemProxy` | 自动检测系统代理设置 | 桌面应用跟随用户配置 |
| 4（最低） | 无 | 直连 | 默认行为 |

:::tip
若同时设置 `ProxyURL` 和 `ProxyPool`，`ProxyURL` 生效。要用代理池，请清空 `ProxyURL`。
:::

## 单代理配置

`ProxyURL` 指定一个固定代理，支持四种协议：

| 协议 | 写法 | 说明 |
|------|------|------|
| HTTP | `http://proxy:8080` | 最常见；HTTPS 请求经 CONNECT 隧道转发 |
| HTTPS | `https://proxy:8443` | 与代理服务器本身也走 TLS |
| SOCKS5 | `socks5://proxy:1080` | 本地解析目标域名后经代理连接 |
| SOCKS5h | `socks5h://proxy:1080` | 域名解析交给代理端，规避本地 DNS 污染 |

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// 输出：状态：200, 代理：socks5://proxy.example.com:1080
	log.Printf("状态: %d, 代理: %s", result.StatusCode(), result.Meta.ProxyURL)
}
```

### 认证与脱敏

代理凭据直接写在 URL 的 userinfo 部分：

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip 凭据自动脱敏
`Config.String()` 会把代理 URL 中的用户名和密码替换为 `***:***`；错误信息与日志中的 URL 同样自动脱敏（凭据与敏感查询参数打码）。凭据不会泄漏进日志，但配置本身仍需妥善保管。
:::

## 系统代理检测与 NO_PROXY

启用后自动检测操作系统的代理设置，无需手动指定 `ProxyURL`：

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true
```

### 平台差异

| 平台 | 检测来源 |
|------|----------|
| Windows | 注册表 Internet Settings（`ProxyEnable` / `ProxyServer`） |
| macOS | `networksetup` 命令读取首选网络服务的 Web/Secure Web Proxy |
| Linux | 环境变量 `HTTP_PROXY` / `HTTPS_PROXY` |

:::tip Meta.ProxyURL 不含系统代理
系统代理的选择不记录到 `Result.Meta.ProxyURL`（该字段仅在显式 `Connection.ProxyURL` 或 `ProxyPool` 下有值，直连与系统代理均为空）。需要逐请求确认出口代理时，请改用显式配置。
:::

### 检测顺序与细节

1. **环境变量优先**（全平台）：先读 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`（大小写均识别），有值则直接使用，不再查系统设置。
2. **平台检测兜底**：无环境变量时读取平台设置。Linux 桌面（GNOME/KDE）的代理通常已由会话导出为环境变量，引擎不直接读 gsettings/dconf。
3. **请求分流**：HTTPS 请求优先用 `HTTPS_PROXY`，未设置回退 `HTTP_PROXY`；HTTP 请求只用 `HTTP_PROXY`，未设置时也回退 `HTTPS_PROXY`——与 net/http 的解析顺序一致。
4. **CGI 环境直连**：来自环境变量的代理在 CGI 环境（`REQUEST_METHOD` 已设置）下不生效，与 net/http 行为一致。
5. **裸地址自动补全**：`HTTP_PROXY=proxy:8080` 这类无协议头的值自动按 `http://` 处理。
6. **缓存**：检测结果在客户端生命周期内缓存，不随环境变量变化热更新；需要感知变化时新建客户端。

### NO_PROXY 绕过规则

`NO_PROXY` 指定不走代理的主机，语义与 net/http 的 httpproxy 包一致：

| 规则 | 示例 | 匹配范围 |
|------|------|----------|
| 全部绕过 | `*` | 所有主机直连 |
| 域名后缀 | `example.com` 或 `.example.com` | 该域名及其全部子域 |
| 通配子域 | `*.example.com` | 等价于 `.example.com` |
| IP 字面量 | `10.0.0.5` | 精确匹配该 IP |
| CIDR 网段 | `10.0.0.0/8` | 网段内全部 IP |
| 主机 + 端口 | `example.com:443` | 主机匹配且端口精确一致 |

多个规则用逗号分隔；`localhost` 始终直连，无需写入 `NO_PROXY`。

```bash
# Linux/macOS 设置示例
export HTTPS_PROXY=http://proxy.corp.example.com:8080
export NO_PROXY=localhost,127.0.0.1,.internal.corp.com,10.0.0.0/8
```

```powershell
# Windows (PowerShell) 设置示例
$env:HTTPS_PROXY = "http://proxy.corp.example.com:8080"
$env:NO_PROXY = "localhost,127.0.0.1,.internal.corp.com"
```

:::warning 动态 localhost 代理的限制
系统代理模式下，SSRF 豁免名单只在客户端构建时探测一次。若运行期间系统代理切换到新的内网/回环地址（如 `127.0.0.1`），该地址可能被 SSRF 防护拦截。动态场景请显式设置 `Connection.ProxyURL`（代理地址始终豁免 SSRF 校验）或配置 `SSRFExemptCIDRs`。
:::

## 代理池

当需要跨多个代理 IP 分发请求（采集、负载分散、IP 轮换），代理池提供自动轮换、被动熔断与按状态码换代理——无需任何外部组件。

### 基本用法

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin // 默认值，可省略

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// 输出：状态：200, 代理：http://proxy1:8080（下一次请求自动轮到 proxy2）
	log.Printf("状态: %d, 代理: %s", result.StatusCode(), result.Meta.ProxyURL)
}
```

池内条目支持 `http`、`https`、`socks5`、`socks5h` 协议，可以混用。

### 配置字段

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `ProxyPool` | `[]string` | `nil` | 代理 URL 列表 |
| `ProxyPoolStrategy` | `ProxyStrategy` | `ProxyStrategyRoundRobin` | 选择策略 |
| `ProxyFailureThreshold` | `int` | `3`（0 回退） | 连续连接失败熔断阈值 |
| `ProxyCooldown` | `time.Duration` | `30s`（0 回退） | 熔断代理冷却时间 |
| `ProxyRotatePerRequest` | `bool` | `false` | 每次独立请求强制换代理（关闭空闲连接复用） |
| `ProxyRotateOnStatus` | `[]int` | `nil` | 触发换代理重试的状态码（每项须在 100–599） |

### 选择策略

| 策略 | 常量 | 说明 |
|------|------|------|
| 轮询（默认） | `ProxyStrategyRoundRobin` | 按顺序循环选择，每次选择推进游标 |
| 随机 | `ProxyStrategyRandom` | 从健康代理中均匀随机选取 |

:::tip 轮询 + 重试 = 自动换 IP
轮询策略在每次选择时推进游标，因此重试再次触发选择时天然落到下一个代理，无需任何额外配置。
:::

### 被动熔断

代理池内置被动健康检查。只有**连接层失败**（dial/TLS）才会触发熔断，HTTP 状态码不会：

```text
代理连接失败
    ↓
失败计数 +1
    ↓
连续失败 ≥ ProxyFailureThreshold → 熔断（移出轮换）
    ↓
等待 ProxyCooldown → 半开探测（恢复轮换）
    ↓
成功 → 重置计数，关闭熔断
首次失败 → 重新熔断
```

<!-- check-code: skip -->
```go
cfg.Connection.ProxyFailureThreshold = 5        // 更宽容，容忍偶发抖动
cfg.Connection.ProxyCooldown = 60 * time.Second // 冷却更久
```

当所有代理都被熔断时，返回冷却时间最短（最接近恢复）的代理作为兜底，而非直接失败。

### 状态码轮换

用于 Cloudflare/WAF 等 IP 封锁场景——返回特定状态码时自动换代理重试：

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotateOnStatus = []int{403} // 收到 403 时换代理重试
	cfg.Retry.MaxRetries = 3                        // 必须启用重试

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://protected-site.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// 输出：状态：200, 代理：http://proxy2:8080, 尝试：2
	log.Printf("状态: %d, 代理: %s, 尝试: %d",
		result.StatusCode(), result.Meta.ProxyURL, result.Meta.Attempts)
}
```

:::warning 状态码轮换 ≠ 熔断
`ProxyRotateOnStatus` 触发的轮换**不会**熔断代理——IP 封锁往往目标特定（一个代理在 A 站被封，在 B 站可能正常）。熔断仅由连接层失败触发。需 `Retry.MaxRetries > 0` 才生效。

当 `ProxyRotateOnStatus` 设置且代理池有多个代理时，重试预算自动提升至 `len(ProxyPool) - 1`（受 `MaxRetries` 上限 10 约束），确保每个代理都有机会被尝试。
:::

### 每请求轮换

`ProxyRotatePerRequest` 解决的是**连接复用**导致代理隧道固化的问题：HTTP 连接池会复用已建立的 TCP 连接，包括其代理隧道。这意味着对同一主机的连续请求会复用前一次请求的代理，即使 `ProxyPoolStrategy` 已轮换选择器游标。

启用后，每次请求开始时关闭所有空闲连接，强制 Transport 重新评估代理池——代价是无连接复用（每次请求新建连接 + 代理隧道），但保证按请求轮换：

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotatePerRequest = true // 每次请求换代理

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	for i := 0; i < 3; i++ {
		result, err := client.Get("https://api.example.com/data")
		if err != nil {
			log.Fatal(err)
		}
		// 输出（依次）：http://proxy1:8080 / http://proxy2:8080 / http://proxy3:8080
		log.Printf("第 %d 次请求经由: %s", i+1, result.Meta.ProxyURL)
	}
}
```

:::tip 适用场景
适用于对同一主机的采集——每次请求的源 IP 不同，降低被目标站点 IP 封锁的风险。对于不同主机的请求，连接复用不会绑定同一代理，通常无需启用。
:::

与 `ProxyRotateOnStatus` 一样，`ProxyRotatePerRequest` 也会在代理池有多个代理时自动提升重试预算至 `len(ProxyPool) - 1`（上限 10），确保每个代理至少被尝试一次。

### 确定性轮换

状态码轮换的重试与普通重试不同：引擎为每个请求预留一个**基准代理索引**，第 N 次重试固定使用「基准 + N」对应的代理，带来三个保证：

- **重试必换代理**：同一请求内，第 N 次重试与第 N-1 次必然落在不同代理上；
- **重定向链不脱轨**：同一次尝试内的多次跳转共享同一索引，不会因跟随重定向多消费了几次代理选择而错位；
- **跨请求持续轮换**：不同请求的基准索引递增，整体保持轮询/随机分布。

此外，代理本身的连接失败（拨号/TLS 失败）在轮换激活时**总是可重试**——即使常规分类判定不可重试（如永久性地址错误），下一次也会换代理再试，配合被动熔断把坏代理自然淘汰。重试侧细节见[重试与容错](./retry-fault-tolerance)。

### 代理池与 HTTP/2 (`EnableProxyPoolHTTP2`)

多代理池激活（`ProxyPool` 多于 1 条且未设 `ProxyURL`）时，HTTP/2 会被**自动禁用**、强制走 HTTP/1.1。原因在 net/http 的连接复用模型：h2 连接池只按目标主机键控，多个代理共用一个池时，所有请求会被钉死在第一个建立隧道的代理上——轮换与负载分散被静默绕过，且难以察觉。HTTP/1 下每条新连接都会重新咨询代理池，轮换因此可靠。

`Connection.EnableProxyPoolHTTP2 = true` 为代理池恢复 HTTP/2：每个代理获得**独立传输**（各自的 h2 连接池），由每请求分发器路由。轮换、`ProxyRotateOnStatus`、熔断与 `Meta.ProxyURL` 上报与默认 HTTP/1 模式完全一致；唯一差异是路由到**同一代理**的并发请求在一条 HTTP/2 隧道上多路复用，而不是各自新开一条 HTTP/1 连接。

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	// EnableHTTP2 已默认 true（DefaultConfig），是本字段的前提
	cfg.Connection.EnableProxyPoolHTTP2 = true

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// 输出：状态：200, 代理：http://proxy1:8080, 协议：HTTP/2.0
	log.Printf("状态: %d, 代理: %s, 协议: %s",
		result.StatusCode(), result.Meta.ProxyURL, result.Proto())
}
```

:::warning 两个权衡
- **请求关联性**：路由到同一代理的请求共享该代理的连接——**包括并发请求**（在途隧道会被下一个同代理请求加入），网络层可将它们关联起来。要求请求间不可关联时保持关闭；`ProxyRotatePerRequest` **不能**防止这种共享——轮换索引每池大小次请求就重复一次，其空闲连接排空也只触及不再在途的连接。
- **连接限额放大**：`MaxConnsPerHost` 与派生的每主机空闲连接上限按每代理传输独立计算，进程级上限 = 限额 × 池大小（全部拨号总数仍受引擎级全局上限约束）。
:::

校验与例外：该字段需 `Connection.EnableHTTP2 = true`（默认即 true），否则 `New()` 直接返回 `ErrInvalidConnection`；`Security.TLSFingerprint` 路径忽略此字段——指纹栈自带每代理后端，本就支持 HTTP/2。字段级参考见[配置 API](../api-reference/client-config/config#代理池与-http-2-enableproxypoolhttp2)。

## 查询本次请求使用的代理

代理池场景常需要审计「这次请求到底用了哪个出口」。两个工具配合：

- **`Result.Meta.ProxyURL`**：报告产生最终响应的那次尝试所使用的代理；直连时为空字符串，系统代理（`EnableSystemProxy`）同样不记录（仍为空）。轮换场景下每次重试可能用不同代理，该字段对应**最终那次**尝试。
- **`WithOnResponse` 回调**：每次尝试（含换代理的重试）都会触发，可观察逐次尝试的状态码与尝试次数。

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotateOnStatus = []int{403}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://protected-site.example.com/data",
		httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
			log.Printf("第 %d 次尝试收到 %d", resp.Attempts(), resp.StatusCode())
			return nil
		}),
	)
	if err != nil {
		log.Fatal(err)
	}

	// 输出：最终代理：http://proxy2:8080, 总尝试：2
	log.Printf("最终代理: %s, 总尝试: %d", result.Meta.ProxyURL, result.Meta.Attempts)
}
```

:::tip 回调按尝试执行，中间件按请求执行
`WithOnResponse` 在引擎内部触发，每次尝试（含重试）都会执行；中间件链则包裹整个重试周期，一个逻辑请求只执行一次。逐次尝试的观测用回调，整请求粒度的审计用[中间件](./middleware-chain)。
:::

## 代理与重试的交互

代理轮换与重试引擎深度联动，两条规则值得记住。

**1. 重试预算自动提升。** 设置 `ProxyRotateOnStatus` 或 `ProxyRotatePerRequest` 且代理池多于 1 个时：

```text
有效 MaxRetries = max(配置的 MaxRetries, len(ProxyPool) - 1)（上限 10）
```

例如 5 个代理、配置 `MaxRetries = 3`：预算提升为 4（= 5 - 1），首次请求用 proxy1，收到 403 后依次换 proxy2…proxy5，每个代理各尝试一次。

**2. 代理连接失败强制重试。** 轮换激活时，代理本身的连接失败（拨号失败、TLS 失败）绕过常规可重试分类，直接进入下一次重试并换到下一个代理——永久失效的代理（端口错误、主机不可达）无需人工预先剔除，强制重试 + 连续失败熔断会自然淘汰它们。

重试条件、退避数学与跨重试共享的总超时预算详见[重试与容错](./retry-fault-tolerance)。

## 代理场景的安全注意

代理相关功能自动处理以下安全细节，无需手动配置：

- **SSRF 豁免**：代理主机地址（`ProxyURL` 与 `ProxyPool` 全部条目）自动加入 SSRF 豁免列表，不会被私有 IP 检查阻断——本地代理（如 `127.0.0.1:7890`）也能正常工作。
- **去重**：代理池中相同 `host:port` 的条目自动合并，避免轮换偏斜和重复计数。
- **URL 验证**：所有代理 URL 经安全校验（协议白名单 http/https/socks5/socks5h、host 非空、注入防护），非法值在 `New()` 即返回错误而非静默忽略。

与 TLS 的关系：HTTPS 请求经 HTTP 代理的 CONNECT 隧道仍是**端到端 TLS**——证书校验、最低 TLS 版本、证书固定均针对目标站点照常生效，代理只能转发密文。担心本地 DNS 污染时优先用 `socks5h`（域名解析交给代理端）；启用 DoH 时业务域名走加密解析，但代理地址本身不经过 DoH（代理由开发者显式配置，直接拨代理主机）。SSRF 防护全貌见 [SSRF 防护](../security/ssrf)。

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 代理不生效 | `ProxyURL` 与 `ProxyPool` 同时设置，`ProxyURL` 优先 | 清空 `ProxyURL`，仅用 `ProxyPool` |
| 对同一主机连续请求出口 IP 不变 | 连接复用绑定了上一次的代理隧道 | 启用 `ProxyRotatePerRequest` |
| 代理频繁熔断 | `ProxyFailureThreshold` 太低 | 增大阈值或 `ProxyCooldown` |
| 状态码轮换没生效 | `Retry.MaxRetries = 0`，或代理池只有 1 个代理 | 设 `MaxRetries > 0`；池内至少 2 个代理 |
| 全部代理熔断会怎样 | 全池连续失败 | 引擎兜底返回最接近恢复的代理，不会直接失败；检查代理可用性与阈值 |
| 系统代理没被检测到 | 环境变量缺失且平台设置未开启 | 确认 `HTTP_PROXY`/`HTTPS_PROXY` 或系统代理开关 |
| localhost 代理被 SSRF 拦截 | 系统代理的豁免名单只在构建时探测一次 | 显式设置 `Connection.ProxyURL`（始终豁免）或配置 `SSRFExemptCIDRs` |
| 收到 403 换代理后代理被熔断了吗 | 误以为状态码会触发熔断 | 不会——状态码轮换不熔断代理，仅连接层失败才熔断 |
| 代理池下为什么走了 HTTP/1.1 | 多代理池默认强制 HTTP/1，防止共享 h2 连接池把所有请求钉死在第一个代理上 | 需要多路复用时设 `Connection.EnableProxyPoolHTTP2 = true`（需 `EnableHTTP2`），见[代理池与 HTTP/2](#代理池与-http-2-enableproxypoolhttp2) |
| `Meta.ProxyURL` 一直为空 | 仅系统代理生效——`EnableSystemProxy` 不记录到该字段 | 需要观测出口时改用显式 `ProxyURL` 或 `ProxyPool` |

完整的字段说明见 [配置 API — 代理池](../api-reference/client-config/config#代理池)。

## 最佳实践

| 场景 | 建议配置 |
|------|----------|
| 企业固定出口 | `ProxyURL`（http/https/socks5 按需） |
| 跟随用户系统设置 | `EnableSystemProxy` + `NO_PROXY` 放行内网段 |
| 多代理负载分散 | `ProxyPool` + 默认轮询策略 |
| 同一主机的采集 | `ProxyPool` + `ProxyRotatePerRequest` |
| CF/WAF IP 封锁 | `ProxyPool` + `ProxyRotateOnStatus: []int{403}` |
| 代理质量参差 | 增大 `ProxyFailureThreshold`（容忍抖动）与 `ProxyCooldown` |
| 需要审计出口 IP | 读取 `Result.Meta.ProxyURL`，配合 `WithOnResponse` 观察逐次尝试 |
| 代理凭据管理 | 写在 URL userinfo，日志自动脱敏；配置文件单独保管 |

:::warning 轮换的性能代价
`ProxyRotatePerRequest` 与状态码轮换的重试路径都会关闭空闲连接，牺牲连接复用换取出口轮换。对性能敏感且无轮换需求的场景保持默认（复用连接）即可，空闲连接管理详见[连接池与 DNS](./connection-pool)。
:::

## 下一步

- [连接池与 DNS](./connection-pool) - 连接复用与代理轮换的交互、DoH 解析
- [重试与容错](./retry-fault-tolerance) - 重试条件、退避算法与代理池联动
- [性能优化](./performance) - 代理轮换的性能代价与整体调优
- [配置 API](../api-reference/client-config/config) - ConnectionConfig 代理字段参考
