---
sidebar_label: "重试与容错"
title: "重试与容错 - CyberGo HTTPC | 退避与自动重试"
description: "HTTPC 重试与容错指南：指数退避与 ±10% 抖动、408/429/5xx 与网络错误重试条件、Retry-After 自动解析与 60 秒上限、跨重试共享总超时预算、请求体重放缓冲、WithMaxRetries 按请求控制与代理池轮换联动。"
sidebar_position: 70
---

# 重试与容错

网络请求本质上不可靠——连接可能中断、服务器可能临时过载、DNS 解析可能超时。HTTPC 内置智能重试引擎，自动处理瞬时故障，让你专注于业务逻辑。

## 默认重试

HTTPC 的默认重试配置经过精心调优，开箱即用：

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Retry.MaxRetries = 3                   // 最多重试 3 次
	cfg.Retry.Delay = 1 * time.Second          // 初始延迟 1s
	cfg.Retry.BackoffFactor = 2.0              // 指数退避倍数 2x
	cfg.Retry.EnableJitter = true              // 启用抖动
	cfg.Retry.MaxRetryDelay = 30 * time.Second // 单次延迟上限

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("成功: %d", result.StatusCode())
}
```

默认重试延迟序列（不含抖动）：`1s → 2s → 4s`（每次乘以 `BackoffFactor`）。

### 重试条件

默认情况下，以下错误会触发重试：

| 条件 | 重试 | 说明 |
|------|------|------|
| 网络错误（连接拒绝、重置、EOF） | 是 | `ErrorTypeNetwork` + 可重试 syscall/消息模式 |
| 超时错误（拨号、TLS、请求超时） | 是 | `ErrorTypeTimeout` |
| 可重试 DNS 失败（临时/超时） | 是 | `dnsErr.IsTemporary \|\| dnsErr.IsTimeout` |
| 响应体读取网络错误 | 是 | 读取操作的 `net.OpError` |
| 408 Request Timeout | 是 | `retryableStatusCodes` |
| 429 Too Many Requests | 是 | 配合 `Retry-After` 头 |
| 500 Internal Server Error | 是 | `retryableStatusCodes` |
| 502 Bad Gateway | 是 | `retryableStatusCodes` |
| 503 Service Unavailable | 是 | `retryableStatusCodes` |
| 504 Gateway Timeout | 是 | `retryableStatusCodes` |
| 其他 4xx 客户端错误（400/401/403/404…） | 否 | 客户端请求有误，重试无用 |
| `context.Canceled` | 否 | 快速路径直接返回 |
| `context.DeadlineExceeded` | 否 | 快速路径直接返回 |
| TLS/证书错误 | 否 | 非瞬时故障，重试无用 |
| 配置验证错误 | 否 | 本地 bug，需修正代码 |

### 配置校验

`ValidateConfig`（`New` 内部调用）校验重试参数，越界返回 `ErrInvalidRetry`：

| 字段 | 合法范围 | 默认 |
|------|----------|------|
| `MaxRetries` | 0–10 | 3 |
| `Delay` | 0–30min | 1s |
| `BackoffFactor` | 1.0–10.0 | 2.0 |
| `MaxRetryDelay` | 0–30min | 30s |
| `EnableJitter` | 布尔 | true |

`WithMaxRetries(n)` 在请求侧应用同样的 0–10 校验，越界直接报错而不是静默截断。另外，`Delay` / `BackoffFactor` 传 0 或负值时引擎会**回退默认值**（1s / 2.0）而不是报错——显式设置合法值才是可靠做法。

## 退避数学详解

以默认值（`Delay=1s`、`BackoffFactor=2.0`、`MaxRetryDelay=30s`、`EnableJitter=true`）为例，逐次重试的延迟计算如下：

### 基础延迟计算

```text
attempt 0: 1s × 2.0^0 = 1s
attempt 1: 1s × 2.0^1 = 2s
attempt 2: 1s × 2.0^2 = 4s
attempt 3: 1s × 2.0^3 = 8s   （MaxRetries=3 时不会到这里）
attempt 4: 1s × 2.0^4 = 16s
attempt 5: 1s × 2.0^5 = 32s → 触发上限，截断为 30s
```

### 应用 MaxRetryDelay 上限

延迟超过 30s 时被截断：`attempt 5` 的 32s → 30s。

### 应用 Jitter 抖动（±10%）

抖动公式：`result = baseDelay ± 10%`，即 `result ∈ [baseDelay × 0.9, baseDelay × 1.1)`。

| 重试次数 | 基础延迟 | 含抖动范围 |
|----------|----------|------------|
| 第 1 次重试（attempt 0） | 1s | 0.9s ~ 1.1s |
| 第 2 次重试（attempt 1） | 2s | 1.8s ~ 2.2s |
| 第 3 次重试（attempt 2） | 4s | 3.6s ~ 4.4s |
| 第 4 次重试（attempt 3） | 8s | 7.2s ~ 8.8s |
| 第 5 次重试（attempt 4） | 16s | 14.4s ~ 17.6s |
| 第 6 次重试（attempt 5） | 30s（截断后） | 27s ~ 33s |

:::tip 为什么用迭代乘法而非 math.Pow
HTTPC 使用循环乘法（`for i := 0; i < attempt; i++ { delay *= factor }`）而非 `math.Pow`。`math.Pow` 调用超越函数（指数+对数），开销远高于几次浮点乘法。同时循环内检查 `math.IsInf` 防止溢出，溢出时直接回退到 `MaxRetryDelay`。在重试热路径中，这种微优化是有意义的。
:::

:::warning Jitter 应用在上限之后
抖动是在 `MaxRetryDelay` 截断**之后**应用的。因此 `attempt 5` 的实际范围是 27s~33s，可能超过 30s 的上限。这是设计选择——抖动的目的是打散重试时机，略微超过上限无害，但保证不会大幅偏离。
:::

## Retry-After 头自动解析

当服务器返回 429（Too Many Requests）或 503（Service Unavailable）时，通常附带 `Retry-After` 响应头告知客户端何时重试。HTTPC 自动解析这个头，支持两种格式：

### delta-seconds 格式

纯整数值，表示「N 秒后重试」：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 120
```

### HTTP-date 格式

RFC 1123 日期，表示「在指定时间重试」：

```http
HTTP/1.1 503 Service Unavailable
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT
```

HTTPC 同时支持标准 RFC1123（`Fri, 31 Jul 2026 15:00:00 GMT`）和带数字时区的 RFC1123Z（`Fri, 31 Jul 2026 15:00:00 +0800`）。

### 60 秒安全上限

无论服务器指定多长时间，HTTPC 都将 `Retry-After` 延迟截断为最多 60 秒：

```text
Retry-After: 120     →  截断为 60s（而非等待 120s）
Retry-After: 3600    →  截断为 60s
Retry-After: Fri, 31 Jul 2026 15:00:00 GMT（距今 2 小时）→ 截断为 60s
```

:::warning 为什么要截断
恶意或配置错误的服务器可能返回极大的 `Retry-After` 值（如 `Retry-After: 999999`），导致客户端长时间挂起。60 秒上限是安全防御：即使服务器要求等 1 小时，HTTPC 也最多等 60 秒就重试。如果你的服务端有合理的限流策略（如每分钟 60 次），正常的 `Retry-After` 值通常远小于 60s，不受影响。
:::

### 优先级

`Retry-After` 头的优先级**高于**指数退避延迟。当服务器返回了有效的 `Retry-After` 值时，直接使用该值（截断后），跳过指数退避计算。

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Retry.MaxRetries = 3
	// 指数退避延迟：1s → 2s → 4s
	// 但如果服务器返回 Retry-After: 5，则第 1 次重试延迟变为 5s
	// （不超过 60s 安全上限）

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start := time.Now()
	_, err = client.Get("https://api.example.com/rate-limited")
	elapsed := time.Since(start)

	if err != nil {
		log.Printf("重试耗尽，总耗时 %v: %v", elapsed, err)
	} else {
		log.Printf("成功，总耗时 %v", elapsed)
	}
}
```

:::tip Retry-After 对所有可重试状态码生效
`Retry-After` 不限于 429/503，对所有可重试状态码（408/429/500/502/503/504）的响应都生效。只要响应头中包含 `Retry-After`，就会被解析并使用。
:::

## 退避策略

### 指数退避（默认）

最常用的策略，延迟按倍数增长，快速但不过于激进：

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 2.0
// 延迟序列：1s → 2s → 4s → 8s → 16s → 30s（上限）
```

### 温和指数退避

`PerformanceConfig()` 使用 1.5 倍因子，增长更平缓，适合高吞吐场景：

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.5
cfg.Retry.Delay = 500 * time.Millisecond
// 延迟序列：0.5s → 0.75s → 1.125s → 1.6875s → ...
```

### 固定延迟

每次重试间隔相同，适合有明确重试间隔要求的场景：

<!-- check-code: skip -->
```go
cfg.Retry.BackoffFactor = 1.0
// 延迟序列：1s → 1s → 1s → 1s ...
```

### 随机抖动

启用抖动在基础延迟上添加 ±10% 随机偏移，防止「惊群效应」——多个客户端同时失败后同时重试，造成二次过载：

<!-- check-code: skip -->
```go
cfg.Retry.EnableJitter = true
// 5 个客户端的重试时机被打散：
// 客户端 A: 0.93s 后重试
// 客户端 B: 1.07s 后重试
// 客户端 C: 1.01s 后重试
// 客户端 D: 0.96s 后重试
// 客户端 E: 1.08s 后重试
```

:::tip 始终启用 Jitter
除了测试场景（需要确定性的延迟），生产环境应始终启用 `EnableJitter = true`。这是分布式系统的最佳实践，能显著降低重试风暴的风险。
:::

## 自定义 RetryPolicy

实现 `RetryPolicy` 接口可以完全控制重试行为。接口定义三个方法：

<!-- check-code: skip -->
```go
type RetryPolicy interface {
    // 判断是否应该重试。resp 为响应（nil 表示请求出错），err 为错误
    ShouldRetry(resp ResponseReader, err error, attempt int) bool

    // 返回下次重试前的延迟
    GetDelay(attempt int) time.Duration

    // 返回最大重试次数
    MaxRetries() int
}
```

:::warning 内部类型限制
`RetryPolicy.ShouldRetry` 的 `resp` 参数类型 ResponseReader 是内部接口（定义在 `internal/types` 包中），外部包无法直接引用。因此自定义 `RetryPolicy` 只能在 `github.com/cybergodev/httpc` 模块内部实现。大多数场景下，通过 `RetryConfig` 字段和 `ProxyRotateOnStatus` 配置即可满足需求，无需自定义策略。
:::

以下示例展示了仅重试 GET 请求的自定义策略（仅可在模块内部编译）：

<!-- check-code: skip -->
```go
// 注意：ResponseReader 是内部类型（internal/types 包）。
// 此代码仅能在 github.com/cybergodev/httpc 模块内部编译。
// 大多数用户应通过 RetryConfig 和 WithMaxRetries 配置重试。

// GETOnlyRetryPolicy 仅对 GET 请求重试，且仅在网络错误和 502/503/504 时重试
type GETOnlyRetryPolicy struct {
    maxAttempts int
}

func (p *GETOnlyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // 仅 GET 请求重试（通过 err/resp 间接判断——非幂等操作不重试）
    if err != nil {
        return true // 网络错误重试
    }
    if resp == nil {
        return false
    }
    code := resp.StatusCode()
    return code == 502 || code == 503 || code == 504
}

func (p *GETOnlyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1) // 线性增长：1s, 2s, 3s...
}

func (p *GETOnlyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// 应用自定义策略
// cfg := httpc.DefaultConfig()
// cfg.Retry.CustomPolicy = &GETOnlyRetryPolicy{maxAttempts: 5}
```

## 按请求控制

除了客户端级配置，可以通过 `WithMaxRetries` 在单个请求上覆盖重试次数：

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 单个请求重试 5 次（覆盖客户端默认的 3 次）
	_, err = client.Get("https://api.example.com/data", httpc.WithMaxRetries(5))
	if err != nil {
		log.Printf("请求失败: %v", err)
	}

	// 禁用重试（如非幂等的 POST 操作）
	_, err = client.Post("https://api.example.com/create",
		httpc.WithJSON(map[string]string{"name": "test"}),
		httpc.WithMaxRetries(0),
	)

	// 配合上下文超时
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, err = client.Request(ctx, "GET", "https://api.example.com/data",
		httpc.WithMaxRetries(3),
	)
}
```

请求级 `WithMaxRetries` 未设置时，引擎使用客户端配置（或 `CustomPolicy` 的 `MaxRetries()`）——内部以 `-1` 作为「未设置」哨兵值区分「没配置」与「显式配置 0（禁用）」。

## 重试的请求体处理

重试要求请求体可以**重复发送**，引擎对不同类型的 body 处理不同：

| 请求体类型 | 重试行为 |
|------------|----------|
| `[]byte` / `string` / 结构体 / `map` / `*FormData` | 每次尝试重新构建 reader，天然可重放 |
| `io.Reader` | 首次进入重试路径前**整体读入内存**缓冲，之后按字节重放 |
| 超过 100MB 的 `io.Reader` | 直接报错：`retry not supported for streaming bodies exceeding ...` |

:::warning 大流式 body 与重试互斥
`io.Reader` 请求体会在重试路径被缓冲到内存，上限 100MB（防御 OOM）。更大的流要么拆分上传、要么对该请求 `WithMaxRetries(0)` 关闭重试：

<!-- check-code: skip -->
```go
// 大文件上传：关闭重试，避免 100MB 内存缓冲
_, err := client.Post("https://api.example.com/upload",
    httpc.WithBody(largeReader),
    httpc.WithMaxRetries(0),
)
```
:::

每次尝试都是**完整重建的请求**：headers、查询参数、cookies 在尝试间深拷贝隔离，互不污染；`WithOnRequest` 回调在**每次尝试前**都会触发——适合在回调里刷新即将过期的令牌：

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 每次重试尝试前都会执行
	_, err = client.Get("https://api.example.com/data",
		httpc.WithOnRequest(func(req httpc.RequestMutator) error {
			log.Printf("发起尝试: %s %s", req.Method(), req.URL())
			return nil
		}),
	)
	if err != nil {
		log.Printf("请求失败: %v", err)
	}
}
```

## 重试执行流程

引擎执行一次「请求 + 重试」的完整流程：

```text
1. 解析重试预算：请求级 WithMaxRetries 未设置（哨兵 -1）→ 回退 CustomPolicy 或客户端配置
2. 建立总预算 context：取 WithTimeout / Timeouts.Request 与已有 context 截止时间中更早者
   —— 覆盖所有尝试与退避等待，不是每次尝试各拿一份超时
3. io.Reader 请求体 → 内存缓冲（≤100MB，超出直接报错）
4. 循环 attempt = 0 .. MaxRetries：
   a. 每次尝试重新 Build 请求（headers/query/cookies 深拷贝，触发 OnRequest）
   b. 网络错误 → 分类为 ClientError → IsRetryable && ShouldRetry？
      - 不可重试 / 次数用尽 → 返回错误（保留原始类型，Attempts = 已尝试次数）
      - context 取消/超时 → 立即返回，不重试
   c. 收到响应 → ShouldRetry(resp) 且次数未用尽？
      - 是 → 计算延迟（有 Retry-After 用之并截断 60s，否则指数退避）
            → 丢弃中间响应 → 等待 → 下一次尝试
      - 否（含次数用尽）→ 返回响应（状态码原样，不报错）
5. 退避等待期间 context 到期 → 立即终止，返回超时错误
```

:::tip 用 HTTPC_DEBUG 观察重试过程
设置环境变量 `HTTPC_DEBUG=1` 后，引擎把每次尝试的状态码、可重试判定与退避延迟打印到 stderr。排查「为什么没重试 / 为什么重试了这么多次」时不必再加日志中间件。
:::

## 代理池与重试交互

当配置了 `ProxyRotateOnStatus` 或 `ProxyRotatePerRequest` 时，HTTPC 会自动提高 `MaxRetries`，确保代理池中的每个代理至少被尝试一次。这是通过 `calculateMaxRetries` 实现的：

```text
effective MaxRetries = max(配置的 MaxRetries, len(ProxyPool) - 1)
（上限为 maxRetryAttempts = 10）
```

**示例**：5 个代理，配置 `MaxRetries = 3`：

```text
ProxyPool = [proxy1, proxy2, proxy3, proxy4, proxy5]
ProxyRotateOnStatus = [403]   // 或 ProxyRotatePerRequest = true
配置 MaxRetries = 3

→ 自动调整为 4（= 5 - 1），确保 5 个代理各尝试一次
→ 第 1 次请求用 proxy1，失败返回 403
→ 第 2 次请求用 proxy2（轮换），失败返回 403
→ 第 3 次请求用 proxy3，失败返回 403
→ 第 4 次请求用 proxy4，失败返回 403
→ 第 5 次请求用 proxy5，失败返回 403
→ 重试耗尽（共 5 次尝试 = 1 初始 + 4 重试）
```

:::tip 为什么是 len(ProxyPool) - 1
首次请求使用第 1 个代理，不算重试。要尝试全部 N 个代理，需要 N - 1 次重试。`calculateMaxRetries` 将 `MaxRetries` 提高到 `len(ProxyPool) - 1`（如果原配置更小），确保意图（轮换所有代理）被满足。如果用户配置的 `MaxRetries` 已经够大，则保持不变。
:::

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
		"http://proxy4:8080",
		"http://proxy5:8080",
	}
	cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
	cfg.Connection.ProxyRotateOnStatus = []int{403} // 403 触发代理轮换
	cfg.Retry.MaxRetries = 3                        // 自动提高到 4（= 5-1）

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 每次收到 403 自动换代理重试，最多尝试 5 个代理
	result, err := client.Get("https://protected-site.example.com/data")
	if err != nil {
		log.Printf("所有代理均失败: %v", err)
		return
	}
	log.Printf("成功（某个代理通过）: %d", result.StatusCode())
}
```

### 代理连接失败强制重试

启用代理轮换（`ProxyRotateOnStatus` / `ProxyRotatePerRequest`）后，**代理本身的连接失败**（拨号失败、TLS 失败）不再走常规的可重试分类，而是**强制进入下一次重试**并自动换到下一个代理。永久失效的代理（端口错误、主机不可达）无需人工预先剔除——强制重试 + 连续失败熔断会自然淘汰它们。详见[代理与代理池](./proxy)。

## 重试预算考量

重试会延长请求的总耗时。HTTPC 的超时是**跨所有重试共享的总预算**：引擎在首次尝试前创建覆盖整个重试循环的超时 context，网络请求与退避等待都从同一份预算扣减——不会出现「3 次重试各拿一份完整超时」的放大效应。

### 总最坏时间公式

```text
总最坏时间 ≈ min(Timeouts.Request, WithTimeout / context 截止时间)
```

以默认配置为例（`MaxRetries=3`、`Request=180s`、`Delay=1s`、`Backoff=2.0`、`EnableJitter=true`）：无论重试几次、退避多久，整个「初始请求 + 3 次重试 + 全部退避」最多约 180s。预算耗尽后，剩余的尝试立即以 `ErrorTypeTimeout` 失败；退避等待中的请求也会被唤醒并终止，不会傻等。

### 缩短总耗时的方法

| 调整 | 效果 |
|------|------|
| 减小 `MaxRetries` | 减少重试次数，预算留给有效尝试 |
| 减小 `Timeouts.Request` | 直接压缩总预算上限 |
| 减小 `Retry.Delay` | 缩短重试间隔，预算更多用于请求本身 |
| 减小 `BackoffFactor` | 延迟增长更慢，早期重试更快 |
| 用 `context.WithTimeout` 覆盖 | 精确控制该请求的总预算 |

:::warning 总预算对重试次数的影响
总预算是硬性的——预算耗尽时即使重试次数没用完也会立即终止，实际重试次数可能少于 `MaxRetries`。默认 180s 足够容纳 3 次重试加约 7.7s 退避；但若把超时压得很低（如 5s）又保留默认重试，第一次退避（约 1s）之后预算可能已所剩无几。需要「确保重试 N 次」时，按 N+1 次请求耗时加退避总和预留预算：

<!-- check-code: skip -->
```go
// 预留足够时间：3 次重试 + 延迟 + 每次请求时间
ctx, cancel := context.WithTimeout(context.Background(),
    4*requestTimeout + 10*time.Second)
```
:::

## context 取消与重试

HTTPC 的重试引擎对 context 取消有快速路径处理。当请求失败原因是 `context.Canceled` 或 `context.DeadlineExceeded` 时，`isRetryableError` 立即返回 false，跳过完整的错误分类逻辑：

<!-- check-code: skip -->
```go
// 内部实现（retry.go）
func (r *retryEngine) isRetryableError(err error) bool {
    // 快速路径：context 错误不可重试——避免完整分类开销
    if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
        return false
    }
    clientErr := classifyError(err, "", "", 0)
    // ...完整分类逻辑
}
```

这意味着：

- **用户手动取消**（`cancel()`）：立即停止，不重试
- **context 超时**：立即停止，不重试
- **正在进行的请求被取消**：不会因为取消而触发额外重试

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 场景 1：手动取消——不会重试
	ctx1, cancel1 := context.WithCancel(context.Background())
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel1() // 100ms 后手动取消
	}()

	_, err = client.Request(ctx1, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeContextCanceled {
			fmt.Println("请求被手动取消，未触发重试")
		}
	}

	// 场景 2：context 超时——不会重试
	ctx2, cancel2 := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel2()

	_, err = client.Request(ctx2, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeTimeout {
			fmt.Println("请求因 context 超时而终止，未触发重试")
		}
	}
}
```

## 错误处理与重试

网络层错误重试耗尽后，错误通过 `ClientError` 返回——Type **保留最后一次失败的原始分类**（如 `ErrorTypeNetwork`、`ErrorTypeTimeout`），`Attempts` 字段记录总尝试次数：

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	_, err = client.Get("https://api.example.com/flaky")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			log.Printf("失败类型: %s, 尝试次数: %d",
				clientErr.Code(), clientErr.Attempts)
			if clientErr.Attempts > 1 {
				log.Println("（已自动重试但仍失败）")
			}
		}
	}
}
```

:::tip 两种「重试耗尽」的表现不同
- **网络错误耗尽**：以 `ClientError` 返回（上面的示例），`Attempts > 1`。
- **可重试状态码耗尽**（408/429/5xx）：**不报错**，最后一次响应原样返回——`err == nil`、`StatusCode() == 503` 等，调用方按普通响应分支处理即可。

另外，`ErrorTypeRetryExhausted` 只在引擎的防御性兜底路径设置，常规使用中几乎不会遇到——判断「重试后仍失败」用 `Attempts` 字段更可靠。
:::

## 最佳实践

| 场景 | 建议配置 |
|------|----------|
| API 调用 | `MaxRetries=3, Delay=1s, Backoff=2.0`（默认） |
| 微服务通信 | `MaxRetries=2, Delay=500ms, Backoff=2.0`（快速失败） |
| 文件下载 | `MaxRetries=5, Delay=2s, Backoff=2.0`（容忍网络波动） |
| 幂等操作（GET/PUT/DELETE） | 可放心重试 |
| 非幂等操作（POST） | 默认单次执行不重试；确需重试用 [`WithRetryNonIdempotent`](../api-reference/core/options#withretrynonidempotent) 显式开启 |
| 限流 API | 依赖 `Retry-After` 自动解析（已内置） |
| 代理池场景 | 配合 `ProxyRotateOnStatus`，重试次数自动提高 |

:::warning 非幂等 POST 请求的重试
默认情况下，非幂等方法（POST、PATCH 及自定义方法）**单次执行、不重试**——引擎直接清零这类方法的重试预算，因为超时或可重试 5xx 可能在服务端已提交操作后才到达，重放请求体会造成副作用（如重复下单、重复支付）。要为单个请求重开重试，使用 [`WithRetryNonIdempotent(true)`](../api-reference/core/options#withretrynonidempotent)（客户端级开关为 `Retry.RetryNonIdempotent`，请求级选项双向覆盖它）；仅对可容忍重放的端点启用，或以幂等键（Idempotency-Key）保护。注意自定义 `RetryPolicy` 同样只对幂等方法生效，无法单独为 POST 重开重试。
:::

## 下一步

- [错误处理](./error-handling) — 错误分类详解与哨兵错误匹配
- [配置 API](../api-reference/client-config/config) — 重试配置字段参考
- [连接池与 DNS](./connection-pool) — 连接复用与 DoH 解析
- [代理与代理池](./proxy) — 代理池配置与轮换策略
- [接口定义](../api-reference/types/interfaces) — RetryPolicy 接口参考
