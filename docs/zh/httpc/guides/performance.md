---
sidebar_label: "性能优化"
title: "性能优化 - CyberGo HTTPC | 预设与并发"
description: "HTTPC 性能优化指南：Default/Secure/Performance/Testing/Minimal 五种预设对比与选型、连接池空闲连接自动推导、并发模型与信号量限流、超时预算分层、零分配热路径、对象池与 resultBundle 及性能反模式。"
sidebar_position: 110
---

# 性能优化

HTTPC 的性能来自四项机制：连接池复用、HTTP/2 多路复用、对象池化、结果对象单次分配。预设配置已为这些机制设定参数；需要进一步调优时，先理解下列机制，再定位到具体参数。

## 预设配置对比

HTTPC 提供 5 种预设配置，各自对应一类使用场景。下表按类别列出关键字段的精确值，供对照选型。

### 超时配置

| 字段 | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `TimeoutConfig.Request` | 180s | 15s | 60s | 180s | 180s |
| `TimeoutConfig.Dial` | 10s | 5s | 15s | 5s | 5s |
| `TimeoutConfig.TLSHandshake` | 10s | 5s | 15s | 5s | 5s |
| `TimeoutConfig.ResponseHeader` | 0（禁用） | 10s | 0（禁用） | 0（禁用） | 0（禁用） |
| `TimeoutConfig.IdleConn` | 90s | 30s | 120s | 30s | 30s |

### 连接配置

| 字段 | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxIdleConns` | 50 | 20 | 100 | 10 | 10 |
| `MaxConnsPerHost` | 10 | 5 | 20 | 5 | 2 |
| `EnableHTTP2` | 开启 | 开启 | 开启 | **关闭** | 开启 |
| `EnableCookies` | 关闭 | 关闭 | 开启 | 开启 | 关闭 |
| `EnableDoH` | 关闭 | 关闭 | 关闭 | 关闭 | 关闭 |

### 安全配置

| 字段 | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxResponseBodySize` | 10MB | 5MB | 50MB | 10MB | 1MB |
| `MaxDecompressedBodySize` | 100MB | 100MB | 100MB | 100MB | 100MB |
| `ValidateURL` | 开启 | 开启 | 开启 | **关闭** | 开启 |
| `ValidateHeaders` | 开启 | 开启 | 开启 | **关闭** | 开启 |
| `StrictContentLength` | 开启 | 开启 | 关闭 | 开启 | 开启 |
| `AllowPrivateIPs` | false | false | false | **true** | false |
| `InsecureSkipVerify` | false | false | false | **true** | false |

### 重试配置

| 字段 | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `MaxRetries` | 3 | 1 | 3 | 1 | 0 |
| `Delay` | 1s | 2s | 500ms | 100ms | 0 |
| `BackoffFactor` | 2.0 | 2.0 | 1.5 | 2.0 | 1.0 |
| `MaxRetryDelay` | 30s | 30s | 30s | 30s | 30s |
| `EnableJitter` | 开启 | 开启 | 开启 | 关闭 | 关闭 |

### 请求默认值

| 字段 | Default | Secure | Performance | Testing | Minimal |
|------|---------|--------|-------------|---------|---------|
| `FollowRedirects` | 开启 | **关闭** | 开启 | 开启 | **关闭** |
| `MaxRedirects` | 10 | 10 | 10 | 10 | 10 |
| `UserAgent` | `httpc/1.0` | `httpc/1.0` | `httpc/1.0` | `httpc-test/1.0` | `httpc/1.0` |

:::warning TestingConfig 禁止用于生产
`TestingConfig()` 关闭了 URL/Header 校验、TLS 证书验证和 SSRF 防护，仅限本地开发和测试使用。在非测试环境中调用时会输出安全警告。生产环境请使用 `SecureConfig()` 或 `DefaultConfig()`。
:::

## 场景选型

| 场景 | 推荐预设 | 调整建议 |
|------|----------|----------|
| 通用 Web 服务 | Default | — |
| 处理不可信 URL | Secure | — |
| 内部微服务高并发 | Performance | 按后端数量调大 `MaxIdleConns` |
| 一次性脚本 | Minimal | — |
| 文件下载服务 | Performance | 增大 `MaxResponseBodySize` |
| 金融/医疗 API | Secure + 自定义 | 增加审计中间件 |
| 本地开发/单元测试 | Testing | 切勿部署到生产 |

<!-- check-code: skip -->
```go
// 高吞吐场景直接使用预设
client, _ := httpc.New(httpc.PerformanceConfig())

// 在预设基础上微调单个字段
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## 并发模型：一个 Client 服务所有 goroutine

HTTPC 的 `Client` 与 `DomainClient` 都是**并发安全**的：任意方法可被多个 goroutine 同时调用。库内设有专门的并发安全集成测试（`internal/concurrency`），在高并发场景下覆盖公共 API。

因此并发模式只有一条：多个 goroutine 共享同一个 `Client`。

```text
全局/服务级创建 1 个 Client
        │
        ├── goroutine 1 ──┐
        ├── goroutine 2 ──┼── 共享同一个连接池与对象池
        └── goroutine N ──┘
```

并发容量与连接池的关系：

| 场景 | 行为 |
|------|------|
| 并发数 ≤ `MaxConnsPerHost`（HTTP/1.1） | 每个请求独占一条连接，互不排队 |
| 并发数 > `MaxConnsPerHost`（HTTP/1.1） | 多余请求在传输层**排队等待**空闲连接（不报错，延迟上升） |
| HTTP/2 开启（默认） | 同一主机的请求共享单连接多路复用，连接数不随请求数增长 |

:::tip 并发上限的两种调整方式
- **控制客户端侧**：把 `Connection.MaxConnsPerHost` 调到 ≥ 峰值并发数（HTTP/1.1 场景）；
- **控制调用侧**：用带缓冲 channel 作信号量限制并发（下面的完整示例），主动保护下游服务。

两者常配合使用：信号量按下游承受力限流，连接池按信号量上限配置连接数。
:::

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 本地模拟服务器：每个请求固定耗时 50ms
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // 允许连接 127.0.0.1 本地测试服务器
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	const (
		total       = 20
		maxInFlight = 5 // 信号量：同时在途的请求最多 5 个
	)

	sem := make(chan struct{}, maxInFlight)
	var wg sync.WaitGroup
	var okCount int64
	start := time.Now()

	for i := 0; i < total; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}        // 获取信号量
			defer func() { <-sem }() // 释放信号量

			result, err := client.Get(server.URL)
			if err != nil {
				return
			}
			if result.IsSuccess() {
				atomic.AddInt64(&okCount, 1)
			}
		}()
	}
	wg.Wait()

	fmt.Printf("%d/%d 成功，耗时 %v（串行约需 %v）\n",
		okCount, total, time.Since(start), total*50*time.Millisecond)
	// 输出示例：20/20 成功，耗时约 250ms（串行约需 1s）——5 路并发带来约 5 倍吞吐
}
```

批量拉取独立 URL 时，另一种常用模式是 **worker pool**：固定数量的 worker goroutine 从 jobs channel 消费任务，并发上限即 worker 数，无需信号量。完整实现见[高级示例](../examples/advanced-usage)。

## 连接池调优原理

连接池决定 HTTP 客户端的连接复用能力。HTTPC 的连接池基于 Go 标准库的 `http.Transport`，并在其上增加了自动计算逻辑和安全默认值。

### 空闲连接自动计算

`MaxIdleConnsPerHost`（每主机空闲连接上限）无需手动设置，HTTPC 根据 `MaxConnsPerHost` 自动推导：

```text
空闲连接数 = MaxConnsPerHost / 2，限制在 [2, 10] 区间
```

具体规则（`calculateIdleConnsPerHost`）：

| MaxConnsPerHost | 自动空闲连接数 | 说明 |
|-----------------|---------------|------|
| 0（无限制） | 10 | 使用上限默认值 |
| 1 | 1 | 先取下限 2，再被「不超过最大连接数」拉回 1 |
| 2 | 2 | 恰好等于下限 |
| 5 | 2 | 一半取下限 |
| 10 | 5 | Default 预设 |
| 20 | 10 | Performance 预设，取上限 |
| 100 | 10 | 超出上限取 10 |

:::tip 为什么是 MaxConnsPerHost / 2
空闲连接是已建立、暂时未使用的连接，可视为连接缓存。设为最大连接数的一半，是在「复用已有连接」（缓存命中）与「新建连接」（缓存未命中时重新握手）之间取平衡。取值过高时，空闲连接会占用更多服务端资源。
:::

### TCP Keep-Alive

HTTPC 的连接池固定使用 30 秒 TCP keep-alive 间隔（`defaultKeepAlive = 30 * time.Second`）。连接建立后，操作系统按此间隔发送 keep-alive 探测包，用于检测死连接。

`IdleConn` 超时控制空闲连接在池中的存活时间（Default 为 90s），两者独立生效。

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 微服务高 QPS 场景：调大连接池
	cfg := httpc.PerformanceConfig()
	cfg.Connection.MaxIdleConns = 200         // 全局空闲连接上限
	cfg.Connection.MaxConnsPerHost = 50       // 每主机最大连接（空闲自动计算为 10）
	cfg.Timeouts.IdleConn = 300 * time.Second // 空闲连接存活更久，提高复用率

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 热路径请求直接复用连接池中的连接
	for i := 0; i < 100; i++ {
		result, err := client.Get("https://api.example.com/data")
		if err != nil {
			log.Printf("请求 %d 失败: %v", i, err)
			continue
		}
		fmt.Printf("请求 %d: %d\n", i, result.StatusCode())
	}
}
```

## HTTP/2 性能优势

HTTP/2 默认开启（`EnableHTTP2 = true`），带来三项性能特性：

| 特性 | HTTP/1.1 | HTTP/2 |
|------|----------|--------|
| 多路复用 | 每个请求独占连接 | 多个请求共享单连接 |
| 头部压缩 | 明文重复发送 | HPACK 压缩头部 |
| 连接复用 | Keep-alive 串行 | 并行流（stream） |

:::tip HTTP/2 与连接池的关系
HTTP/2 的多路复用让单个 TCP 连接同时承载多个请求，减少连接建立开销。对同一主机高并发时，HTTP/2 的吞吐量高于 HTTP/1.1。

仅在三处回退到 HTTP/1.1：

- 使用 `TestingConfig()`（显式关闭 HTTP/2）；
- 连接不支持 ALPN 协商；
- 多代理轮换池激活时被自动强制（设 `EnableProxyPoolHTTP2` 可恢复，见[代理与代理池](./proxy#代理池与-http-2-enableproxypoolhttp2)）。
:::

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 默认配置已启用 HTTP/2
	cfg := httpc.DefaultConfig()
	cfg.Connection.EnableHTTP2 = true // 默认即 true，显式声明更清晰

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 对支持 HTTP/2 的站点（如大多数 CDN/云服务）发起并发请求
	// 单个 TCP 连接即可复用，无需为每个请求新建连接
	start := time.Now()
	for i := 0; i < 10; i++ {
		result, err := client.Get("https://http2.golang.org/")
		if err != nil {
			log.Printf("请求 %d 失败: %v", i, err)
			continue
		}
		// Proto() 返回协议版本，如 "HTTP/2.0"
		fmt.Printf("请求 %d: %s, 状态码 %d\n", i, result.Proto(), result.StatusCode())
	}
	fmt.Printf("10 个请求耗时: %v\n", time.Since(start))
}
```

## 内存优化机制

HTTPC 在内存管理上做了多层优化，目标有二：减少堆分配、复用对象。

### resultBundle 单次分配

每次请求返回的 `*Result` 携带三个嵌套结构体：`RequestInfo`（请求信息）、`ResponseInfo`（响应信息）、`RequestMeta`（元数据如耗时）。分别分配 `Result` 与三个嵌套结构体需要四次堆分配。

HTTPC 将它们打包进一个 `resultBundle`，一次堆分配即可完成：

```text
传统方式：4 次独立分配（Result + RequestInfo + ResponseInfo + RequestMeta）
HTTPC：1 次分配（resultBundle），Result 的三个指针指向同一块内存
```

调用方拿到的是 `*Result`，其 `Request`、`Response`、`Meta` 字段（指针）指向 bundle 内的对应结构体，这一过程对调用方透明。

调用方持有 `*Result` 的时长不受引擎约束，因此不适用对象池（池化会导致数据竞争），由 GC 自动回收。

### 引擎对象池

HTTPC 引擎层使用 `sync.Pool` 复用短生命周期对象，以降低 GC 压力：

| 池化对象 | 用途 | 说明 |
|----------|------|------|
| `engine.Response` | 响应对象 | 请求完成后归还池，下次请求复用 |
| `engine.Request` | 请求对象 | 同上 |
| `strings.Builder` | 字符串构建 | URL 构建、错误格式化、Config 序列化 |
| `http.Header` | HTTP 头 map | 请求/响应头处理 |
| `bytes.Buffer` | JSON/multipart 编码 | 按初始容量预分配 |
| `time.Timer` | 重试定时器 | 避免频繁创建定时器 |
| gzip/flate reader | 解压 | 复用解压器 |

:::tip 对象池与 resultBundle 的分工
池化适用于请求内部完成 borrow-return 的短生命周期对象；`*Result` 的持有期由调用方决定，因此采用单次分配 + GC 回收（原因见上一节）。
:::

### 低分配热路径

除对象池外，请求热路径上还有以下去分配优化：

| 优化点 | 机制 |
|--------|------|
| 头部深拷贝批量分配 | `CloneHeader` 先统计全部值数量，一次分配共享底层数组——把「每个头部一次分配（N 次）」降为 1 次 |
| 查询参数转义零分配 | 无需转义的字符串**原样返回**（零分配）；需要转义时用池化缓冲区逐字节写出 |
| 数值查询参数直写 | `int`/`float64`/`bool` 等数值经 `strconv.Append*` 直接写入构建器，不产生中间字符串 |
| 请求头所有权转移 | 普通请求与下载路径把引擎 Response 上的 header map **所有权转移**给 `Result`，而非克隆一份 |
| 重定向链内联数组 | 前 8 次重定向记录在池化对象的内联定长数组中，超过 8 次才分配溢出切片，因此重定向链不超过 8 跳时不产生额外分配 |
| 重试休眠定时器复用 | 重试退避用的 `time.Timer` 池化复用，高频重试场景避免反复建 Timer |
| 池容量防护 | 超过阈值的对象**不归还**池（如 header map > 64 条、query builder 容量 > 4096），避免大对象长期滞留池中，占用更多内存 |

### 内部指标与健康度

引擎内部以**纯原子操作**（无锁）收集每请求指标，包括三项：总请求数、成功/失败数、平滑延迟。平滑延迟按滑动平均公式 `新平均 = (旧平均×9 + 本次延迟) / 10` 维护；错误率低于 10% 视为健康。

这些指标用于引擎自身的健康判断，**不作为公开 API 暴露**。

应用层的请求指标使用 `MetricsMiddleware`（见[中间件](../api-reference/client-config/middleware)），它按方法/URL/状态码/耗时回调，可直接对接 Prometheus 等监控系统。

### 对调用方的透明性

以上优化对调用方透明。调用方按常规方式使用 API 即可，连接复用、对象池化、单次分配均在内部完成：

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
	defer client.Close()

	// Result 每次请求新建，GC 自动回收，无需手动释放
	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}

	// 热路径中优先用 RawBody() 而非 Body()
	// RawBody() 返回原始字节切片；Body() 返回预存字符串；String() 是调试格式化（开销最大）
	data := result.RawBody()
	fmt.Printf("响应大小：%d 字节\n", len(data))
	fmt.Printf("请求耗时: %v\n", result.Meta.Duration)
}
```

## 工作负载调优示例

### 超时预算

四个传输层超时（`Dial`、`TLSHandshake`、`ResponseHeader`、隐含的 body 传输）共同受 `Timeouts.Request` 这个**总预算**约束。

调整预设时保持「分项之和 ≤ 总预算」的层级关系，避免出现拨号超时长于总超时这类无效配置：

```text
Timeouts.Request（总预算，默认 180s）
 ├── Timeouts.Dial          拨号（默认 10s）
 ├── Timeouts.TLSHandshake  TLS 握手（默认 10s）
 ├── Timeouts.ResponseHeader 响应头等待（Default/Performance 为 0=不设传输层限制）
 └── 响应体传输             剩余时间全部可用
```

| 工作负载 | Request | Dial/TLS | 说明 |
|----------|---------|----------|------|
| 内网微服务 | 5–10s | 1–2s | 快速失败，把错误交给上游重试/熔断 |
| 公网 API | 30s | 5s | 兼顾跨网延迟与偶发慢响应 |
| AI/长任务 | 300s+ | 10s | 长响应体占满剩余预算 |
| 下载大文件 | 0（用 context 控制） | 15s | 用 `Download` 的 ctx 管总时长，`WithTimeout` 管单请求 |

:::warning ResponseHeader 与 WithTimeout 的相互作用
`Default`/`Performance` 预设把 `ResponseHeader` 设为 0，由 `WithTimeout()` 控制长响应；`Secure` 预设设为 10s，用于对抗 slowloris 类攻击。手动调窄 `ResponseHeader` 时注意：当它小于 `WithTimeout` 时，会先截断慢响应。
:::

### AI API 长轮询

AI 推理 API 的响应时间可达数分钟，需放宽超时限制：

<!-- check-code: skip -->
```go
// AI API 可能需要 5-15 分钟响应，不要被默认 180s 超时截断
result, err := httpc.Post("https://api.ai.example.com/v1/completions",
    httpc.WithJSON(payload),
    httpc.WithTimeout(900*time.Second), // 15 分钟
)
```

:::warning Default 预设的 ResponseHeader 为 0 的原因
`TimeoutConfig.ResponseHeader = 0` 表示不在传输层强制响应头超时，由 context 级超时统一控制；设计原因与替代方案见[配置 API](../api-reference/client-config/config#timeoutconfig)。如需对抗 slowloris 攻击的传输层防御，使用 `SecureConfig()`（设为 10s）。
:::

### 微服务高 QPS

内部微服务之间的高频调用需要较大的连接池：

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.PerformanceConfig()
	// 连接池按后端实例数量调优
	cfg.Connection.MaxIdleConns = 300   // 总空闲连接
	cfg.Connection.MaxConnsPerHost = 30 // 每个后端实例
	// 微服务响应通常很快，缩短超时快速失败
	cfg.Timeouts.Request = 10 * time.Second
	cfg.Retry.Delay = 200 * time.Millisecond
	cfg.Retry.BackoffFactor = 2.0
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start := time.Now()
	// 高频请求复用连接池，无需重建 TCP/TLS
	for i := 0; i < 50; i++ {
		result, err := client.Get("http://user-service:8080/api/users")
		if err != nil {
			log.Printf("请求 %d 失败: %v", i, err)
			continue
		}
		_ = result
	}
	fmt.Printf("50 个请求耗时: %v\n", time.Since(start))
}
```

### 大文件下载（流式）

大文件下载使用 `Download()`：它在内部启用流式模式，响应体从网络直接写入磁盘，内存占用与文件大小无关，并支持断点续传与校验和：

```go
package main

import (
	"context"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.PerformanceConfig()
	cfg.Security.MaxResponseBodySize = 500 * 1024 * 1024 // 500MB 上限

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	dcfg := httpc.DefaultDownloadConfig()
	dcfg.FilePath = "/tmp/large-file.zip"
	dcfg.ResumeDownload = true // 断点续传

	result, err := client.Download(
		context.Background(),
		"https://example.com/large-file.zip",
		dcfg,
	)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("下载完成：%d 字节", result.BytesWritten)
}
```

:::warning 不要对普通请求方法使用 WithStreamBody
`WithStreamBody(true)` 只对 `Download` 这类直接消费引擎响应的路径有效。对 `Get`/`Post`/`Request` 等普通方法设置时返回 `ErrStreamBodyRequiresDownload`。消费大响应体的入口是 `Download`（详见[文件上传与下载](./file-transfer)）。
:::

### 爬虫与代理池

爬虫场景通过代理池轮换 IP。HTTPC 会自动提高重试次数，确保每个代理至少尝试一次（详见 [重试与容错](./retry-fault-tolerance#代理池与重试交互)）：

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
    "http://proxy4:8080",
    "http://proxy5:8080",
}
cfg.Connection.ProxyRotateOnStatus = []int{403} // 403 触发换代理
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
// MaxRetries 自动提高到 4（代理数 -1），确保 5 个代理都尝试一次
```

## 性能反模式

| 反模式 | 原因 | 正确做法 |
|--------|------|----------|
| 每请求新建 Client | 连接无法复用，每次重新 TCP/TLS 握手 | 进程内复用单个 Client 实例 |
| 过大 `MaxResponseBodySize` | 超出实际需要的内存上限 | 按实际响应大小设定 |
| 热路径用 `result.String()` | 额外字符串构建开销 | 用 `result.Body()` 或 `result.RawBody()` |
| 连接池过小 | 高并发时连接不够用，排队等待 | `MaxConnsPerHost` 按并发数调 |
| 对普通请求用 `WithStreamBody` | 普通方法不支持流式响应体，返回 `ErrStreamBodyRequiresDownload` | 大响应体改用 `Download` |
| 关闭 HTTP/2 | 退化为 HTTP/1.1 串行请求 | 默认保持开启 |
| 忽略 `Close()` | 连接泄漏 | `defer client.Close()` |
| 全局共享后忘记复用 | 反复创建/销毁 Client | 一次创建、长期持有 |
| 不限并发地启动 goroutine | 并发不受限，下游过载并触发 429/熔断 | 信号量或 worker pool 控制在途请求数 |

:::warning Client 必须复用
HTTP 性能的根基是连接复用。每请求新建 Client 意味着每次都走 TCP 三次握手 + TLS 握手，延迟从亚毫秒级增加到数十毫秒级。

在微服务场景下，将 Client 作为单例注入到服务结构体中，随服务生命周期存活。
:::

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// 反模式演示：每请求新建 Client
func main() {
	start := time.Now()

	for i := 0; i < 5; i++ {
		// ❌ 每次循环新建 Client——连接无法复用
		client, err := httpc.NewDefault()
		if err != nil {
			log.Fatal(err)
		}
		result, err := client.Get("https://httpbin.org/get")
		client.Close() // 每次都关闭，连接池清空
		if err != nil {
			log.Printf("请求 %d 失败: %v", i, err)
			continue
		}
		_ = result
	}
	// 5 个请求的耗时远高于复用 Client 的方案
	fmt.Printf("反模式耗时: %v\n", time.Since(start))

	// ✅ 正确做法：复用 Client
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	start = time.Now()
	for i := 0; i < 5; i++ {
		result, err := client.Get("https://httpbin.org/get")
		if err != nil {
			log.Printf("请求 %d 失败: %v", i, err)
			continue
		}
		_ = result
	}
	fmt.Printf("复用模式耗时: %v\n", time.Since(start))
}
```

## 下一步

- [连接池与 DNS](./connection-pool) — 连接池参数详解与 DoH 解析
- [代理与代理池](./proxy) — 代理池配置与轮换策略
- [错误处理](./error-handling) — 超时分层策略与错误分类
- [重试与容错](./retry-fault-tolerance) — 退避算法详解与重试预算
- [安全概述](../security/) — 安全与性能的平衡
