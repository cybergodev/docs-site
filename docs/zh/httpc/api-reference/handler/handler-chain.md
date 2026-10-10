---
sidebar_label: "Handler 与中间件链"
title: "Handler 管线与自定义中间件 - CyberGo HTTPC | 请求处理管线"
description: "HTTPC Handler 管线架构详解：双层设计中 Layer 1 方法 API 如何组装 MiddlewareFunc 洋葱链并执行 Handler，Chain 组合器原理、clientImpl.middlewareChain 实现机制与自定义中间件编写示例。"
sidebar_position: 10
---

# Handler 与中间件链

## 管线导出符号总览

Handler 管线相关的全部导出符号及其在本参考中的位置：

| 导出符号 | 类别 | 说明 | 详细参考 |
|----------|------|------|----------|
| `Handler` | 函数类型别名 | 请求处理核心签名 | 本文 [Handler](#handler) |
| `MiddlewareFunc` | 函数类型别名 | 中间件签名 | 本文 [MiddlewareFunc](#middlewarefunc) |
| `Chain` | 组合函数 | 将多个中间件组合为单个中间件 | 本文 [Chain](#chain) |
| `RecoveryMiddleware` / `LoggingMiddleware` / `RequestIDMiddleware` / `TimeoutMiddleware` / `HeaderMiddleware` / `MetricsMiddleware` / `AuditMiddleware` | 中间件工厂（7 个） | 开箱即用的内置中间件 | [内置中间件](../client-config/middleware) |
| `LoggingConfig`/`DefaultLoggingConfig`、`RequestIDConfig`/`DefaultRequestIDConfig`、`TimeoutMiddlewareConfig`/`DefaultTimeoutMiddlewareConfig`、`HeaderConfig`/`DefaultHeaderConfig`、`MetricsConfig`/`DefaultMetricsConfig` | 配置结构体与默认值构造（5 组） | 各中间件的配置与默认值 | [内置中间件](../client-config/middleware) |
| `AuditEvent`（含 `MarshalJSON` 方法）、`AuditConfig`/`DefaultAuditConfig` | 审计类型与配置 | 安全审计事件与配置 | [常量与类型](../types/constants) |
| `SourceIPKey` / `UserIDKey` | 上下文键常量 | 审计事件的源 IP 与用户 ID 键 | [常量与类型](../types/constants) |

## 双层架构

HTTPC 的请求处理由两层协作完成：Layer 1 的方法 API 是**薄封装**，真正处理请求的引擎是 Layer 2 的 Handler 管线。每个请求的执行都归结为「组装并执行一条 Handler 链」。

```text
HTTPC 双层架构
├── Layer 1  方法 API（薄封装）
│     包级函数 httpc.Get/Post/... + Client 方法 + 请求选项
│     → 内部统一走 client.Request → executeRequest
│
└── Layer 2  Handler 管线（请求处理引擎）
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      MiddlewareFunc(Handler) 洋葱链 → 组装 → 执行
```

当客户端配置了中间件时，`executeRequest` 会把请求选项应用到一个 `RequestMutator` 上，再交由 `clientImpl.middlewareChain` 执行；若未配置中间件，则直接走引擎发请求。这条链就是 `buildMiddlewareChain` 在 `New()` 时一次性组装、缓存在 `clientImpl.middlewareChain` 字段上的 Handler。

## 执行流程详解

一次请求从 Layer 1 到 Layer 2 的完整路径如下：

```text
httpc.Get(url, opts...)              ← Layer 1 包级函数
  → withDefault(ctx, "GET", url, opts)
    → clientImpl.Request(ctx, "GET", url, opts...)   ← 默认客户端单例
      → clientImpl.executeRequest(ctx, "GET", url, opts)
          │
          ├─ 已关闭？ → ErrClientClosed
          │
          ├─ 无中间件？
          │     → c.engine.Request(ctx, method, url, opts...)   ← 直连引擎
          │
          └─ 有中间件？
                → engineReq = acquireMiddlewareRequest()         ← 从对象池获取
                → engineReq.SetMethod/SetURL/SetContext          ← 写入初始状态
                → 逐个应用 opts(engineReq)                       ← 请求选项生效
                → c.middlewareChain(ctx, engineReq)              ← 进入洋葱链
                → Chain 逐层包装 → finalHandler → c.engine.Request
                → defer releaseMiddlewareRequest(engineReq)      ← 归还对象池
```

关键细节：

- **对象池复用**：有中间件时，`executeRequest` 从引擎的共享对象池获取一个 `*engine.Request`（经 `acquireMiddlewareRequest()`），应用完请求选项后作为 `RequestMutator` 传给中间件链。整个链**同步执行**完毕后，`defer` 将请求对象归还对象池。
- **无中间件直连**：未配置任何中间件时跳过池化和链组装，请求选项直接传给引擎——零开销的快速路径。
- **默认 panic 安全网**：`clientImpl.Request` 自带 `recover`，将执行路径中任何意外的 panic 转为 error 返回，而不是崩溃调用方。这与 `RecoveryMiddleware` 形成双重保障。

## 中间件链组装过程

`buildMiddlewareChain` 在 `New()` 时**一次性组装**整条链并缓存到 `clientImpl.middlewareChain` 字段。组装过程分两步：

```text
buildMiddlewareChain(middlewares):

  ① 构造 finalHandler（终端处理器）
     finalHandler: func(ctx, req) → 从 req 读取中间件修改后的全部字段
                                    → 经单一 option closure 转发给引擎
                                    → 返回 *engine.Response

  ② Chain(middlewares...)(finalHandler)
     从后往前逐层包装：final = mw[i](final)
     切片 [mwA, mwB, mwC] → mwA(mwB(mwC(finalHandler)))
```

切片顺序与执行顺序的对应关系：切片中**靠前**的中间件处于链的**最外层**（最先进入、最后退出）；**靠后**的中间件紧贴 `finalHandler`（最内层）。`Chain` 组合器从切片末尾开始反向遍历（`for i := len-1; i >= 0; i--`），将每个中间件依次包在前一层外面。

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

请求处理的核心函数签名，是内部 `types.Handler` 的类型别名（定义于 `types.go`）。接收上下文与请求变更器，返回响应变更器或错误。链的末端 Handler（`finalHandler`）负责把中间件改写后的请求字段转发给底层引擎真正发出网络请求。

| 参数/返回值 | 类型 | 说明 |
|-------------|------|------|
| `ctx` | `context.Context` | 链路上下文；`finalHandler` 优先使用 `req.Context()`，为 nil 时回退到它 |
| `req` | `RequestMutator` | 请求变更器，中间件经它读写请求字段（方法契约见[请求与响应变更器](./mutators)） |
| 返回 `resp` | `ResponseMutator` | 响应变更器；`nil` 表示请求未产生响应（出错或短路返回） |
| 返回 `err` | `error` | 非 nil 时请求失败，沿链向外层传递直至调用方 |

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

中间件函数签名，是内部 `types.MiddlewareFunc` 的类型别名（定义于 `types.go`）。接收「下一个 Handler」并返回包装后的 Handler。中间件可在调用 `next` 前后插入逻辑（改写请求、记录响应、捕获 panic 等），形成洋葱模型：第一个中间件最外层、最先进入最后退出。

## 洋葱模型执行顺序

```text
请求进入方向 →

  ┌─ Middleware A (外层，最先执行) ─────────────────────┐
  │  ┌─ Middleware B (中层) ───────────────────────┐  │
  │  │  ┌─ Middleware C (内层，最后执行) ───────┐  │  │
  │  │  │                                         │  │  │
  │  │  │  finalHandler → engine.Request → 网络   │  │  │
  │  │  │                                         │  │  │
  │  │  └──────────────── 响应 ←────────────────┘  │  │
  │  └──────────────────── 响应 ←──────────────────┘  │
  └──────────────────────── 响应 ←────────────────────┘

  ← 响应返回方向

  请求阶段：A → B → C → finalHandler（外→内）
  响应阶段：finalHandler → C → B → A（内→外）
```

中间件在 `MiddlewareConfig.Middlewares` 中按切片顺序配置，切片中**靠前**的中间件处于链的**外层**。

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

将多个中间件组合为单个中间件。返回的组合器接收最终 Handler，按传入顺序从外到内嵌套：切片第一个中间件包在最外层（最先执行），最后一个紧贴最终 Handler。HTTPC 内部正是用它把 `MiddlewareConfig.Middlewares` 组装成链。

`Chain` 是 HTTPC 唯一导出的链式组装 API——没有 `Append`/`Use` 之类的可变链构建器。整条链在 `New()` 时经 `buildMiddlewareChain` 一次性组装并缓存在 `clientImpl.middlewareChain` 字段上，之后不可再增删中间件；运行期需要动态行为时，应在中间件内部用条件逻辑实现，而非修改链结构。

```go
// 三段等价：Chain 组合后一次性注入，与逐层手动嵌套结果相同
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// 等价于手动嵌套
chain := mwA(mwB(mwC(finalHandler)))
```

:::tip Chain 的用途
`Chain` 主要供 HTTPC 内部在 `buildMiddlewareChain` 中使用，但你也可以在自定义中间件内部用它把多个子中间件打包成单个中间件，实现中间件复用与组合。
:::

## finalHandler 终端处理器

`finalHandler` 是中间件链的**终端 Handler**——所有中间件执行完毕后，由它把中间件修改过的请求字段转发给底层引擎真正发出网络请求。它是双层架构中 Layer 2 与引擎之间的桥梁。

finalHandler 的工作分三步：

```text
finalHandler(ctx, req):

  ① 解析上下文：req.Context() 优先，nil 时回退到链路 ctx

  ② 类型断言到 *engine.Request，提取引擎特有钩子：
       - OnRequest 回调（请求发出前回调）
       - OnResponse 回调（响应收到后回调）
       - AllowPrivateIPs（每请求 SSRF 覆盖）
     这三个钩子不在 RequestMutator 接口上（签名引用内部类型，
     暴露会造成循环导入），故经类型断言读取

  ③ 调用 c.engine.Request(ctx, method, url, optionClosure)
     optionClosure 将 req 的全部可变字段一次性转发给新引擎请求：
       headers / queryParams / body / timeout / maxRetries /
       cookies / followRedirects / maxRedirects / allowPrivateIPs /
       streamBody / onRequest / onResponse
```

:::warning 类型断言的边界
回调（OnRequest/OnResponse）和每请求 SSRF 覆盖（`AllowPrivateIPs`）存在于具体类型 `*engine.Request` 上，而非 `RequestMutator` 接口上。`finalHandler` 经类型断言读取这些钩子。如果自定义中间件将 `req` **替换**为非 `*engine.Request` 类型，类型断言失败，这些钩子会被**静默跳过**。所有内置中间件都是就地修改请求（不替换），因此断言总是成功。
:::

## 内置中间件

HTTPC 内置 7 个开箱即用的中间件工厂，通过 `MiddlewareConfig.Middlewares` 注入客户端。每个工厂接受一个 `*XxxConfig` 指针，传 `nil` 时使用默认配置。

| 中间件 | 工厂签名 | 作用 |
|--------|----------|------|
| Recovery | `RecoveryMiddleware()` | 捕获链中 panic，转为含堆栈的 error |
| Logging | `LoggingMiddleware(config *LoggingConfig)` | 记录方法/脱敏 URL/状态码/耗时 |
| RequestID | `RequestIDMiddleware(config *RequestIDConfig)` | 注入 `X-Request-ID` 头（crypto/rand） |
| Timeout | `TimeoutMiddleware(config *TimeoutMiddlewareConfig)` | 中间件级超时控制 |
| Header | `HeaderMiddleware(config *HeaderConfig)` | 为每个请求添加静态请求头 |
| Metrics | `MetricsMiddleware(config *MetricsConfig)` | 请求完成后回调指标数据 |
| Audit | `AuditMiddleware(config *AuditConfig)` | 安全审计事件（金融/医疗/政务） |

各中间件的配置结构体、默认构造函数和详细用法见 [内置中间件](../client-config/middleware)。

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),                          // 最外层：兜底 panic
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}),
}
```

## 自定义中间件完整规范

自定义中间件是一个返回 `MiddlewareFunc` 的工厂函数，共三层闭包：最外层捕获配置参数（创建中间件时执行一次），中间层包装 Handler（组装链时执行一次），最内层处理请求（每个请求执行一次）。

<!-- check-code: skip -->
```go
func myMiddleware(/* 外层：捕获配置参数 */) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler { // 中层：包装 Handler
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// ① 前置阶段：调用 next 之前，经 req 检视/改写请求
			resp, err := next(ctx, req) // ② 执行：同步走完内层链直至发出网络请求
			if err != nil {
				return nil, err
			}
			// ③ 后置阶段：next 返回之后，经 resp 读取/改写响应
			return resp, nil
		}
	}
}
```

### 两阶段语义

| 阶段 | 位置 | 可操作对象 | 典型用途 |
|------|------|-----------|---------|
| 前置（请求阶段） | 调用 `next` 之前 | `req` 的全部写方法（SetHeader/SetURL/SetBody/SetTimeout/SetContext…） | 注入认证头/追踪 ID、改写 URL 与查询参数、按路径动态设置超时 |
| 执行 | `next(ctx, req)` 调用点 | —— | 同步执行内层链，直至 `finalHandler` 发出网络请求并返回 |
| 后置（响应阶段） | `next` 返回之后 | `resp` 的全部读写方法、`err` | 记录状态码/耗时/重试次数、追加响应头、按错误类型上报 |
| 短路 | 不调用 `next` | 自行构造返回值 | 缓存命中直接返回、策略拒绝提前退出（需自备 `ResponseMutator` 实现，见[响应缓存中间件（概念）](#响应缓存中间件-概念)） |

### 错误语义

- **前置阶段返回错误**：请求不再发出，`(nil, err)` 沿链向外层中间件传递，最终交给调用方。
- **后置阶段返回错误**：错误同样向外传递。若中间件既持有 `next` 返回的响应又返回错误，`executeRequest` 的安全网会代为释放该响应（防止对象池泄漏），但不应依赖此行为。
- **上下文传递**：`finalHandler` 优先使用 `req.Context()`（nil 时回退链路 `ctx`）。中间件派生超时/取消上下文时必须经 `req.SetContext` 写回——`TimeoutMiddleware` 正是先 `SetContext` 再调用 `next` 的。

## 自定义中间件示例

### 示例 1：请求头注入中间件

为每个请求注入 API 密钥头。演示 `next(ctx, req)` **之前**的请求预处理模式。

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// apiKeyMiddleware 为每个请求注入 X-API-Key 认证头
func apiKeyMiddleware(key string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// 经 RequestMutator.SetHeader 注入认证头（next 之前 = 请求预处理）
			req.SetHeader("X-API-Key", key)
			// 调用 next 继续链路；修改后的请求会沿链传递到 finalHandler
			return next(ctx, req)
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		apiKeyMiddleware("my-secret-api-key"),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.StatusCode())
	// 输出: 200
}
```

### 示例 2：响应头注入中间件

在响应中追加处理耗时。演示 `next(ctx, req)` **之后**的响应后处理模式——经 `ResponseMutator` 读取并修改响应。

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// responseTimeMiddleware 在响应头中追加处理耗时
func responseTimeMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// 先调用 next 让请求继续
			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// next 之后 = 响应后处理：经 ResponseMutator.SetHeader 追加耗时
			resp.SetHeader("X-Response-Time-Ms",
				fmt.Sprintf("%d", time.Since(start).Milliseconds()))
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		responseTimeMiddleware(),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Response.Headers.Get("X-Response-Time-Ms"))
	// 输出示例: 156
}
```

### 响应缓存中间件（概念）

响应缓存是 `ResponseMutator` 的典型高级用例：对 GET 请求命中缓存时短路返回，不调用 `next`。但构造完整的缓存响应需自定义类型实现 `ResponseMutator` 的全部方法（31 个读写方法），代码量较大。核心模式如下：

<!-- check-code: skip -->
```go
func cacheMiddleware(cache Cache) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// 仅缓存 GET 请求
			if req.Method() == "GET" {
				if cached, ok := cache.Get(req.URL()); ok {
					return cached, nil // 命中缓存：短路，不调用 next
				}
			}
			// 未命中：执行请求
			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// 缓存响应（需自定义 ResponseMutator 实现）
			cache.Set(req.URL(), resp)
			return resp, nil
		}
	}
}
```

## 中间件执行合约

编写自定义中间件时须遵守以下合约，否则会导致资源泄漏或请求丢失：

| 合约 | 说明 |
|------|------|
| **必须调用 `next()`** | 不调用 `next` 则请求永远不会发出（短路中间件除外，如缓存命中）。`next` 返回的响应是后续链路与引擎的最终结果。 |
| **响应必须返回或释放** | `next` 返回的 `resp` 必须原样返回（或经后续 `next` 传回），否则会泄漏引擎对象池中的响应。返回 `(nil, error)` 且持有未释放响应会导致池泄漏（`executeRequest` 的安全网会代为释放「同时返回 resp 与 err」的响应，但不应依赖此行为）。 |
| **panic 被 RecoveryMiddleware 捕获** | 中间件中的 panic 会被 `RecoveryMiddleware`（若配置）或 `clientImpl.Request` 的默认安全网捕获并转为 error，不会传播给调用方。 |
| **同步执行** | 中间件链**同步执行**——`next` 返回时整个内层链已完成。不支持异步中间件；若引入异步，对象池复用模式会产生数据竞争。 |
| **不替换请求对象** | 自定义中间件应**就地修改** `req`（经 SetHeader/SetBody 等），不要用新对象替换 `req`。替换会导致 `finalHandler` 的类型断言失败，回调与 SSRF 覆盖被静默跳过。 |

:::warning 对象池泄漏风险
`executeRequest` 从引擎对象池获取 `*engine.Request` 传给中间件链，链返回后经 `defer` 归还。如果中间件返回了 `next` 给的响应但额外持有了一份引用（例如存入全局缓存），该响应会在归还对象池后被复用，导致跨请求数据泄漏。缓存中间件必须深拷贝响应数据。
:::

## 另见

- [内置中间件](../client-config/middleware) — Recovery/Logging/Timeout 等 7 个开箱即用的中间件工厂
- [请求与响应变更器](./mutators) — `RequestMutator`/`ResponseMutator` 完整方法契约
- [接口定义](../types/interfaces) — `Handler`/`MiddlewareFunc` 的类型别名定义
