---
sidebar_label: "Handler 与中间件链"
title: "Handler 与中间件链 - CyberGo HTTPC | 请求处理管线"
description: "HTTPC Handler 管线架构详解：双层设计中 Layer 1 包级方法如何组装 MiddlewareFunc 洋葱链并执行 Handler，Chain 组合器原理、clientImpl.middlewareChain 实现机制与自定义中间件编写示例。"
sidebar_position: 1
---

# Handler 与中间件链

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

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

请求处理的核心函数签名。接收上下文与请求变更器，返回响应变更器或错误。链的末端 Handler（`finalHandler`）负责把中间件改写后的请求字段转发给底层引擎真正发出网络请求。

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

中间件函数签名，接收「下一个 Handler」并返回包装后的 Handler。中间件可在调用 `next` 前后插入逻辑（改写请求、记录响应、捕获 panic 等），形成洋葱模型：第一个中间件最外层、最先进入最后退出。

```text
请求进入方向 →

[Middleware A] → [Middleware B] → [Middleware C] → finalHandler → 引擎
                                                                ↓
响应返回方向 ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ↓
```

中间件在 `MiddlewareConfig.Middlewares` 中按切片顺序配置，切片中**靠前**的中间件处于链的**外层**。

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

将多个中间件组合为单个中间件。返回的组合器接收最终 Handler，按传入顺序从外到内嵌套：切片第一个中间件包在最外层（最先执行），最后一个紧贴最终 Handler。HTTPC 内部正是用它把 `MiddlewareConfig.Middlewares` 组装成链。

```go
// 三段等价：Chain 组合后一次性注入，与逐层手动嵌套结果相同
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// 等价于手动嵌套
chain := mwA(mwB(mwC(finalHandler)))
```

## 自定义中间件示例

一个完整的计时中间件：在请求前后记录耗时，通过 `MiddlewareConfig.Middlewares` 注入客户端。

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware 记录每个请求的耗时
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// 调用下一个 Handler，请求继续沿链传递
			resp, err := next(ctx, req)
			fmt.Printf("%s %s -> 耗时 %v\n", req.Method(), req.URL(), time.Since(start))
			return resp, err
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				timingMiddleware(),
			},
		},
	})
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.StatusCode())
	// 输出示例:
	// GET https://httpbin.org/get -> 耗时 123.456ms
	// 200
}
```

:::tip
中间件返回的 `resp` 必须原样（或经后续 `next`）传回，否则会泄漏引擎对象池中的响应。返回 `(nil, error)` 且持有未释放响应会导致池泄漏。
:::

## 另见

- [内置中间件](../client-config/middleware) — Recovery/Logging/Timeout 等 8 个开箱即用的中间件工厂
- [请求与响应变更器](./mutators) — `RequestMutator`/`ResponseMutator` 完整方法契约
- [接口定义](../types/interfaces) — `Handler`/`MiddlewareFunc` 的类型别名定义
