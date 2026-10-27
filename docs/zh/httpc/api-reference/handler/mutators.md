---
sidebar_label: "请求与响应变更器"
title: "请求与响应变更器 - CyberGo HTTPC | Mutator 接口"
description: "HTTPC 中间件读写契约详解：RequestMutator 与 ResponseMutator 两个公开组合接口的请求与响应全部读写方法，WithOnRequest/WithOnResponse 回调选项用法，附经变更器改写请求头与读取响应状态码的可编译示例。"
sidebar_position: 20
---

# 请求与响应变更器

中间件不直接操作底层请求/响应对象，而是通过**变更器（Mutator）**接口读写。中间件收到的始终是完整的读写变更器（`RequestMutator` / `ResponseMutator`）；下文按「读取方法」「写入方法」分组列出，仅为便于阅读。

```text
RequestMutator  =  读取方法  +  写入方法
ResponseMutator =  读取方法  +  写入方法
        ↑                                    ↑
  中间件经 RequestMutator 改写请求     中间件经 ResponseMutator 读取/改写响应
```

`Handler` 的签名 `func(ctx, RequestMutator) (ResponseMutator, error)` 把这两个变更器分别作为中间件的入口与出口。

## 请求变更器

### 读取方法

下列方法读取请求数据。中间件仅需**检视**请求属性时调用这些方法。

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `Method()` | `string` | HTTP 方法 |
| `URL()` | `string` | 请求 URL |
| `Headers()` | `map[string]string` | 全部请求头（键→单值） |
| `QueryParams()` | `map[string]any` | 查询参数 |
| `Body()` | `any` | 请求体 |
| `Timeout()` | `time.Duration` | 请求超时 |
| `MaxRetries()` | `int` | 最大重试次数 |
| `Context()` | `context.Context` | 请求上下文 |
| `Cookies()` | `[]http.Cookie` | 请求 Cookie |
| `FollowRedirects()` | `*bool` | 是否跟随重定向（nil 表示用默认值） |
| `MaxRedirects()` | `*int` | 最大重定向次数（nil 表示用默认值） |
| `StreamBody()` | `bool` | 是否流式传输请求体 |

### 写入方法

下列方法修改请求数据。中间件仅需**修改**请求属性时调用这些方法。

| 方法 | 说明 |
|------|------|
| `SetMethod(string)` | 设置 HTTP 方法 |
| `SetURL(string)` | 设置 URL |
| `SetHeaders(map[string]string)` | 设置全部请求头（整体替换） |
| `SetHeader(key, value string)` | 设置单个请求头（增/改） |
| `SetQueryParams(map[string]any)` | 设置查询参数 |
| `SetBody(any)` | 设置请求体 |
| `SetTimeout(time.Duration)` | 设置超时 |
| `SetMaxRetries(int)` | 设置最大重试次数 |
| `SetContext(context.Context)` | 设置上下文 |
| `SetCookies([]http.Cookie)` | 设置 Cookie |
| `SetFollowRedirects(*bool)` | 设置是否跟随重定向 |
| `SetMaxRedirects(*int)` | 设置最大重定向次数 |
| `SetStreamBody(bool)` | 设置是否流式传输 |

### RequestMutator

`RequestMutator` 是 httpc 暴露的读写请求变更器接口，涵盖上方「读取方法」与「写入方法」两张表的全部方法。中间件在请求发出前经 `RequestMutator` 检视并改写请求属性。

该接口由 `RequestReader` 与 `RequestWriter` 两个分体接口组合而成，两者均由 `httpc` 包作为公开类型别名导出（`httpc.RequestReader` / `httpc.RequestWriter`，完整方法清单见 [读写分体接口](../types/interfaces)）。

## 中间件中 RequestMutator 的典型操作

| 操作场景 | 方法组合 | 说明 |
|----------|----------|------|
| 修改请求头 | `SetHeader(key, val)` / `Headers()` + `SetHeader` | 注入认证头、追踪 ID、API 版本号 |
| 修改查询参数 | `QueryParams()` → 增删 → SetQueryParams | 追加公共查询参数 |
| 修改请求体 | `Body()` → 转换 → SetBody | 请求体压缩、签名注入 |
| 设置超时 | `SetTimeout(d)` | 按请求路径动态调整超时 |
| 设置上下文 | `SetContext(ctx)` | 中间件级超时（`TimeoutMiddleware` 的工作原理） |

```go
// 典型：读取已有请求头，追加自定义头后回写
headers := req.Headers()
headers["X-Trace-ID"] = generateTraceID()
req.SetHeaders(headers)

// 等价写法（更简洁）
req.SetHeader("X-Trace-ID", generateTraceID())
```

## 响应变更器

### 读取方法

下列方法读取响应数据。

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `StatusCode()` | `int` | 状态码 |
| `Status()` | `string` | 状态文本（如 `"200 OK"`） |
| `Proto()` | `string` | 协议版本（如 `"HTTP/1.1"`） |
| `Headers()` | `http.Header` | 响应头 |
| `Body()` | `string` | 响应体（字符串） |
| `RawBody()` | `[]byte` | 响应体（字节） |
| `ContentLength()` | `int64` | 内容长度 |
| `Duration()` | `time.Duration` | 请求耗时 |
| `Attempts()` | `int` | 尝试次数（含重试） |
| `Cookies()` | `[]*http.Cookie` | 响应 Cookie |
| `RedirectChain()` | `[]string` | 重定向链（每跳的 URL） |
| `RedirectCount()` | `int` | 重定向次数 |
| `RequestHeaders()` | `http.Header` | 实际发送的请求头 |
| `RequestURL()` | `string` | 实际请求 URL（含重定向后的最终 URL） |
| `RequestMethod()` | `string` | 请求方法 |

### 写入方法

下列方法修改响应数据。

| 方法 | 说明 |
|------|------|
| `SetStatusCode(int)` | 设置状态码 |
| `SetStatus(string)` | 设置状态文本 |
| `SetProto(string)` | 设置协议版本 |
| `SetHeaders(http.Header)` | 设置响应头（整体替换） |
| `SetBody(string)` | 设置响应体 |
| `SetRawBody([]byte)` | 设置响应体（字节） |
| `SetContentLength(int64)` | 设置内容长度 |
| `SetDuration(time.Duration)` | 设置耗时 |
| `SetAttempts(int)` | 设置尝试次数 |
| `SetCookies([]*http.Cookie)` | 设置 Cookie |
| `SetRedirectChain([]string)` | 设置重定向链 |
| `SetRedirectCount(int)` | 设置重定向次数 |
| `SetRequestHeaders(http.Header)` | 设置请求头 |
| `SetRequestURL(string)` | 设置请求 URL |
| `SetRequestMethod(string)` | 设置请求方法 |
| `SetHeader(key string, values ...string)` | 设置单个响应头（增/改） |

### ResponseMutator

`ResponseMutator` 是 httpc 暴露的读写响应变更器接口，涵盖上方「读取方法」与「写入方法」两张表的全部方法。中间件在请求完成后经 `ResponseMutator` 读取或改写响应，常见用途包括响应缓存、内容转换（如 JSON 美化）、编解码与响应过滤。

该接口由 `ResponseReader` 与 `ResponseWriter` 两个分体接口组合而成，两者均由 `httpc` 包作为公开类型别名导出（`httpc.ResponseReader` / `httpc.ResponseWriter`，完整方法清单见 [读写分体接口](../types/interfaces)）。

## 中间件中 ResponseMutator 的典型操作

| 操作场景 | 方法组合 | 说明 |
|----------|----------|------|
| 读取状态码 | `StatusCode()` | 条件日志、错误分类 |
| 读取响应头 | `Headers()` | 提取 `X-Request-ID`、`Content-Type` |
| 计算指标 | `Duration()` + `Attempts()` | 上报耗时、重试次数 |
| 追踪重定向 | `RedirectChain()` + `RedirectCount()` | 审计重定向路径 |
| 修改响应头 | `SetHeader(key, vals...)` | 追加追踪头、安全头 |

## 类型断言：访问引擎特有方法

中间件收到的 `RequestMutator` 在运行时实际是引擎的具体请求类型 `*engine.Request`。`finalHandler` 通过类型断言读取其上**不在公开接口上**的引擎特有字段，并连同接口字段一并转发给引擎。

:::warning 接口边界
OnRequest/OnResponse 回调、`AllowPrivateIPs`、NoTimeout 与 `RetryNonIdempotent` 不在 `RequestMutator` 接口上：它们的签名引用内部包 `engine` 的类型（`*engine.Request`/`*engine.Response`），暴露到公开接口会造成循环导入。

类型断言是**库内部机制**：`internal/engine` 对模块外不可导入，外部包无法命名 `*engine.Request`，因此也无法做该断言。调用方经公开请求选项使用这些能力——[`WithOnRequest`](../core/options#withonrequest)/[`WithOnResponse`](../core/options#withonresponse)/[`WithAllowPrivateIPs`](../core/options#withallowprivateips)/[`WithNoTimeout`](../core/options#withnotimeout)/[`WithRetryNonIdempotent`](../core/options#withretrynonidempotent)。
:::

这些引擎特有方法包括：

| 方法（仅在 `*engine.Request` 上） | 说明 |
|-------------------------------------|------|
| `OnRequest() func(*engine.Request) error` | 请求发出前回调 |
| `OnResponse() func(*engine.Response) error` | 响应收到后回调 |
| `AllowPrivateIPs() *bool` | 每请求 SSRF 覆盖 |
| `SetOnRequest(func)` / `SetOnResponse(func)` | 设置回调 |
| `SetAllowPrivateIPs(*bool)` | 设置 SSRF 覆盖 |

编写中间件的常规读写无需关心这些钩子：`RequestMutator`/`ResponseMutator` 接口已涵盖常用读写操作，逐请求回调与 SSRF/超时/重试覆盖经请求选项设置。

## 请求选项回调：WithOnRequest / WithOnResponse

除中间件外，还有一对与变更器直接相关的请求选项：`WithOnRequest` 在请求发出前回调，参数为 `RequestMutator`；`WithOnResponse` 在响应收到后回调，参数为 `ResponseMutator`。不编写中间件也能拿到变更器做检视或轻量改写。

<!-- check-code: skip -->
```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

| 选项 | 回调时机 | 回调参数 | 错误行为 |
|------|---------|---------|---------|
| `WithOnRequest` | 请求发出前 | `RequestMutator` | 任一回调返回错误则请求中止 |
| `WithOnResponse` | 响应收到后 | `ResponseMutator` | 任一回调返回错误则请求以该错误失败 |

多个回调可链式注册，按添加顺序依次执行。传入 nil 回调会在应用选项时返回错误（`"onRequest callback cannot be nil"` / `"onResponse callback cannot be nil"`）。

:::tip 回调与中间件的取舍
回调没有 `next`，因此不能短路请求，也不能在响应阶段做包装；它只适合「检视 + 轻量改写」。需要控制执行顺序、短路返回或包装响应时，应编写中间件（见 [Handler 与中间件链](./handler-chain)）。
:::

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

	result, err := client.Get("https://httpbin.org/get",
		// 请求发出前：经 RequestMutator 检视请求并注入头
		httpc.WithOnRequest(func(req httpc.RequestMutator) error {
			fmt.Printf("发送 %s %s\n", req.Method(), req.URL())
			req.SetHeader("X-Trace-ID", "trace-42")
			return nil
		}),
		// 响应收到后：经 ResponseMutator 读取状态
		httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
			fmt.Printf("收到状态码 %d\n", resp.StatusCode())
			return nil
		}),
	)
	if err != nil {
		log.Fatalf("请求失败: %v", err)
	}
	fmt.Println("成功：", result.IsSuccess())
	// 输出示例：
	// 发送 GET https://httpbin.org/get
	// 收到状态码 200
	// 成功：true
}
```

全部请求选项的逐项参考见 [请求选项](../core/options)。

## SanitizedURL 缓存

多个中间件都需要记录脱敏 URL（移除凭据信息的 URL）时，重复计算会产生开销。HTTPC 因此把脱敏结果缓存在请求对象上，供同一请求的多个中间件共享。

```text
getOrComputeSanitizedURL(req):
  ① req 是否实现了 sanitizedURLer 接口（SanitizedURL/SetSanitizedURL）？
     - *engine.Request 实现了此接口
  ② 已缓存？ → 直接返回缓存值
  ③ 未缓存？ → 计算 SanitizeURL(req.URL())，缓存后返回
```

内置的 `LoggingMiddleware`、`MetricsMiddleware` 和 `AuditMiddleware` 都使用 `getOrComputeSanitizedURL` 共享脱敏结果，URL 脱敏在整个链路中**只计算一次**。自定义中间件记录 URL 时也应使用该机制，而非直接调用 `req.URL()`（其结果含凭据）。

:::tip URL 脱敏
日志/指标中间件中记录 URL 时，不能直接使用 `req.URL()`。若 URL 含有 `user:pass@host` 形式的凭据，凭据会泄漏到日志中。内置中间件经 `getOrComputeSanitizedURL` 自动移除凭据部分。
:::

## 示例：经变更器读写请求响应

一个认证中间件：经 `RequestMutator` 的 `SetHeader` 方法注入认证头，经 `ResponseMutator` 的 `StatusCode` 方法读取响应状态码。

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// authMiddleware 经 RequestMutator 注入认证头，并经 ResponseMutator 读取状态码
func authMiddleware(token string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// 写：经 RequestMutator 设置请求头
			req.SetHeader("Authorization", "Bearer "+token)
			// 读：经 RequestMutator 检查请求方法
			fmt.Printf("发送 %s 请求\n", req.Method())

			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// 读：经 ResponseMutator 读取状态码
			fmt.Printf("收到状态码 %d\n", resp.StatusCode())
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		authMiddleware("my-secret-token"),
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
	fmt.Println(result.IsSuccess())
	// 输出示例：
	// 发送 GET 请求
	// 收到状态码 200
	// true
}
```

## 实战示例：请求/响应日志中间件

一个完整的日志中间件，同时展示 `RequestMutator` 与 `ResponseMutator` 的读写能力：经变更器读取请求方法/URL 和响应状态码/耗时/重试信息，统一格式化输出。

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// loggingMiddleware 经变更器读取请求与响应的完整信息并格式化输出
func loggingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()

			// 请求阶段：读取请求信息
			log.Printf("[REQ] %s %s", req.Method(), req.URL())

			resp, err := next(ctx, req)
			duration := time.Since(start)

			if err != nil {
				// 错误响应：读取不到状态码
				log.Printf("[ERR] %s %s -> %v (%v)",
					req.Method(), req.URL(), err, duration)
				return nil, err
			}

			// 响应阶段：读取状态码、耗时、重试次数、重定向链
			log.Printf("[RESP] %s %s -> %d (%v, attempts=%d, redirects=%d)",
				req.Method(),
				req.URL(),
				resp.StatusCode(),
				duration,
				resp.Attempts(),
				resp.RedirectCount(),
			)
			return resp, nil
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		loggingMiddleware(),
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
	fmt.Println("状态码：", result.StatusCode())
	// 输出示例：
	// [REQ] GET https://httpbin.org/get
	// [RESP] GET https://httpbin.org/get -> 200 (123.456ms, attempts=1, redirects=0)
	// 状态码：200
}
```

## 另见

- [Handler 与中间件链](./handler-chain) — 双层架构与洋葱模型总览
- [内置中间件](../client-config/middleware) — HeaderMiddleware 等就是经变更器工作的现成范例
- [请求选项](../core/options) — WithOnRequest/WithOnResponse 与全部 WithXxx 选项
- [接口定义](../types/interfaces) — 变更器的类型别名定义
