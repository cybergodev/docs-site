---
sidebar_label: "请求与响应变更器"
title: "请求与响应变更器 - CyberGo HTTPC | Mutator 接口"
description: "HTTPC 中间件读写契约详解：RequestMutator 与 ResponseMutator 是 httpc 暴露给中间件的两个公开组合接口，分别提供请求与响应的全部读取方法与写入方法，附经变更器改写请求头与读取响应状态码的可编译示例。"
sidebar_position: 2
---

# 请求与响应变更器

中间件不直接操作底层请求/响应对象，而是通过**变更器（Mutator）**接口读写。中间件收到的始终是完整的读写变更器（`RequestMutator` / `ResponseMutator`）；下文按「读取方法」「写入方法」分组列出，仅是为了便于阅读，并非独立的导出接口。

```text
RequestMutator  =  读取方法  +  写入方法
ResponseMutator =  读取方法  +  写入方法
        ↑                                    ↑
  中间件经 RequestMutator 改写请求     中间件经 ResponseMutator 读取/改写响应
```

`Handler` 的签名 `func(ctx, RequestMutator) (ResponseMutator, error)` 正是把这两个变更器作为中间件的入口与出口。

## 请求变更器

### 读取方法

下列方法读取请求数据。中间件仅需**检视**请求属性时调用这些方法。

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `Method()` | `string` | HTTP 方法 |
| `URL()` | `string` | 请求 URL |
| `Headers()` | `map[string]string` | 全部请求头 |
| `QueryParams()` | `map[string]any` | 查询参数 |
| `Body()` | `any` | 请求体 |
| `Timeout()` | `time.Duration` | 请求超时 |
| `MaxRetries()` | `int` | 最大重试次数 |
| `Context()` | `context.Context` | 请求上下文 |
| `Cookies()` | `[]http.Cookie` | 请求 Cookie |
| `FollowRedirects()` | `*bool` | 是否跟随重定向 |
| `MaxRedirects()` | `*int` | 最大重定向次数 |
| `StreamBody()` | `bool` | 是否流式传输请求体 |

### 写入方法

下列方法修改请求数据。中间件仅需**修改**请求属性时调用这些方法。

| 方法 | 说明 |
|------|------|
| `SetMethod(string)` | 设置 HTTP 方法 |
| `SetURL(string)` | 设置 URL |
| `SetHeaders(map[string]string)` | 设置全部请求头 |
| `SetHeader(key, value string)` | 设置单个请求头 |
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

`RequestMutator` 是 httpc 暴露的读写请求变更器接口，涵盖上方「读取方法」与「写入方法」两张表的全部方法。其内部的读/写分体接口位于 `internal/types` 包，未单独导出，外部统一以 `RequestMutator` 引用。中间件在请求发出前经它检视并改写请求属性。

## 响应变更器

### 读取方法

下列方法读取响应数据。

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `StatusCode()` | `int` | 状态码 |
| `Status()` | `string` | 状态文本 |
| `Proto()` | `string` | 协议版本 |
| `Headers()` | `http.Header` | 响应头 |
| `Body()` | `string` | 响应体（字符串） |
| `RawBody()` | `[]byte` | 响应体（字节） |
| `ContentLength()` | `int64` | 内容长度 |
| `Duration()` | `time.Duration` | 请求耗时 |
| `Attempts()` | `int` | 尝试次数（含重试） |
| `Cookies()` | `[]*http.Cookie` | 响应 Cookie |
| `RedirectChain()` | `[]string` | 重定向链 |
| `RedirectCount()` | `int` | 重定向次数 |
| `RequestHeaders()` | `http.Header` | 请求头 |
| `RequestURL()` | `string` | 请求 URL |
| `RequestMethod()` | `string` | 请求方法 |

### 写入方法

下列方法修改响应数据。

| 方法 | 说明 |
|------|------|
| `SetStatusCode(int)` | 设置状态码 |
| `SetStatus(string)` | 设置状态文本 |
| `SetProto(string)` | 设置协议版本 |
| `SetHeaders(http.Header)` | 设置响应头 |
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
| `SetHeader(key string, values ...string)` | 设置单个响应头 |

### ResponseMutator

`ResponseMutator` 是 httpc 暴露的读写响应变更器接口，涵盖上方「读取方法」与「写入方法」两张表的全部方法。其内部的读/写分体接口位于 `internal/types` 包，未单独导出，外部统一以 `ResponseMutator` 引用。中间件在请求完成后经它读取或改写响应，常用于响应缓存、内容转换（如 JSON 美化）、编解码与响应过滤。

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
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				authMiddleware("my-secret-token"),
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
	fmt.Println(result.IsSuccess())
	// 输出示例:
	// 发送 GET 请求
	// 收到状态码 200
	// true
}
```

## 另见

- [Handler 与中间件链](./handler-chain) — 双层架构与洋葱模型总览
- [内置中间件](../client-config/middleware) — HeaderMiddleware 等就是经变更器工作的现成范例
- [接口定义](../types/interfaces) — 变更器的类型别名定义
