---
title: "重定向 - CyberGo HTTPC | 跟随控制与安全白名单"
description: "HTTPC 重定向指南：默认自动跟随与 10 次上限、WithFollowRedirects 与 WithMaxRedirects 请求级控制、RedirectChain 链路追踪、301/302/303/307/308 方法语义、跨域凭据自动剥离与 RedirectWhitelist 域名白名单防开放重定向。"
sidebar_label: "重定向"
sidebar_position: 4
---

# 重定向

HTTPC 默认自动跟随 HTTP 重定向（最多 10 次），并记录完整的重定向链。本页覆盖跟随控制、次数限制、链路追踪、状态码方法语义、跨域凭据剥离、环形重定向检测、域名白名单以及与 SSRF 防护的联动。

## 默认行为

不进行任何配置时，客户端自动跟随重定向，直到到达最终响应或达到次数上限：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/redirect/2")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode())       // 200（最终响应的状态码）
	fmt.Println(result.Meta.RedirectCount) // 2（实际跟随的重定向次数）
}
```

引擎自动跟随 301/302/303/307/308 五种重定向状态码，方法语义遵循 HTTP 规范：

| 状态码 | 方法处理 |
|--------|----------|
| 301 / 302 / 303 | 可能将 POST 改写为 GET（规范允许） |
| 307 / 308 | 保持原方法与请求体重发 |

### 状态码语义（301/302/303/307/308）

五种状态码在「方法改写」与「请求体」上的差异如下：

| 状态码 | 含义 | 方法处理 | 请求体 | 典型用途 |
|--------|------|----------|--------|----------|
| 301 | 永久移动 | GET/HEAD 不变；POST 等改写为 GET | 丢弃 | 域名迁移、URL 规范化 |
| 302 | 临时移动（Found） | 同 301（沿用事实标准行为） | 丢弃 | 临时跳转、登录后转向 |
| 303 | 参见其他（See Other） | 一律改为 GET | 丢弃 | POST 后跳转结果页 |
| 307 | 临时重定向 | 保持原方法 | 保留重发 | 需重发 body 的临时跳转 |
| 308 | 永久重定向 | 保持原方法 | 保留重发 | 需重发 body 的永久跳转 |

:::warning 带请求体的 307/308 不会自动跟随
307/308 要求按原方法**重放请求体**。底层 net/http 只有在请求体可重放（设置了 `GetBody`）时才会跟随，而 HTTPC 构建请求时未设置该函数——因此携带非空请求体的请求收到 307/308 时**不自动跟随，3xx 响应原样返回**（不报错）。需要跟随这类跳转时，用 `WithFollowRedirects(false)` 手动循环处理，或让服务端改用 302/303。
:::

:::tip 300/304 与其他 3xx 不在跟随范围
即使携带 `Location` 头，引擎也只跟随 301/302/303/307/308；300（Multiple Choices）、304（Not Modified）及其他 3xx 响应原样返回，由调用方自行处理。注意 `Result.IsRedirect()` 判断的是整个 300–399 区间，与是否自动跟随无关。
:::

:::tip 超出上限即报错
重定向次数超过 `MaxRedirects` 时请求以错误结束（错误信息形如 `stopped after 3 redirects`），不会无限循环。`MaxRedirects` 合法范围 0-50，越界会在配置校验时报错。
:::

## 控制跟随

重定向配置分布在三个层级，作用范围从大到小：

| 层级 | 配置 | 作用范围 |
|------|------|----------|
| 客户端级 | `Config.Defaults.FollowRedirects` / `MaxRedirects` | 整个客户端的所有请求 |
| 请求级 | `WithFollowRedirects(bool)` / `WithMaxRedirects(n)` | 单次请求，覆盖客户端配置 |
| 预设 | `SecureConfig()`、`MinimalConfig()`（均置 `FollowRedirects=false`） | 安全/极简场景默认不跟随 |

### 客户端级

`Config.Defaults`（`RequestDefaults`）为整个客户端设置重定向策略：

```go
cfg := httpc.DefaultConfig()
cfg.Defaults.FollowRedirects = true  // 默认：跟随
cfg.Defaults.MaxRedirects = 5        // 默认：10

client, err := httpc.New(cfg)
```

### 请求级

`WithFollowRedirects` / `WithMaxRedirects` 覆盖单次请求的客户端配置：

```go
// 仅这一次请求禁止跟随，直接拿到 3xx 响应
result, err := httpc.Get("https://httpbin.org/redirect/1",
    httpc.WithFollowRedirects(false),
)
if result.IsRedirect() {
    fmt.Println(result.Response.Headers.Get("Location")) // 重定向目标地址
}

// 仅这一次请求限制跟随 3 次
result, err = httpc.Get(url, httpc.WithMaxRedirects(3))
```

:::warning MaxRedirects(0) 不是禁用
`0` 是「未设置」哨兵值——引擎回退到默认值 10，而不是禁止重定向。要禁止跟随，用 `WithFollowRedirects(false)` 或 `Config.Defaults.FollowRedirects = false`。
:::

:::tip SecureConfig 默认禁止重定向
`SecureConfig()` 预设将 `FollowRedirects` 置为 `false`，防止借助重定向把请求导向内部地址（重定向型 SSRF）。安全细节见 [SSRF 防护](../security/ssrf)。
:::

## 追踪重定向链

`Result.Meta` 记录每次请求的重定向信息：

| 字段 | 说明 |
|------|------|
| `Meta.RedirectCount` | 实际跟随的重定向次数 |
| `Meta.RedirectChain` | 重定向过程中经过的 URL 序列 |

两个字段的精确语义：

- `RedirectChain` 记录的是每一跳的**来源 URL**：第一项是初始请求 URL，之后依次是各中间 URL；**最终目标 URL 不在链中**。需要最终地址时读 `result.Request.URL`（跟随完成后的最终请求 URL）。
- `RedirectCount` 恒等于 `len(RedirectChain)`。

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/redirect/3")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("跟随 %d 次重定向\n", result.Meta.RedirectCount)
	for i, u := range result.Meta.RedirectChain {
		fmt.Printf("  %d. %s\n", i+1, u)
	}
	fmt.Println("最终地址：", result.Request.URL)
	// 输出：
	//   1. https://httpbin.org/redirect/3
	//   2. https://httpbin.org/redirect/2
	//   3. https://httpbin.org/redirect/1
	// 最终地址： https://httpbin.org/get
}
```

## 跨域凭据自动剥离

跟随重定向时，引擎在每一跳检查目标主机名：与**初始请求**的主机名不一致（跨域跳转）时，自动删除敏感请求头，防止凭据泄露给重定向目标：

| 请求头 | 目标主机 = 初始请求主机 | 目标主机 ≠ 初始请求主机 |
|--------|------------------------|------------------------|
| `Authorization` | 保留 | 删除 |
| `Proxy-Authorization` | 保留 | 删除 |
| `Cookie` | 保留 | 删除 |
| 其他自定义头 | 保留 | 保留 |

判定细节：

- 比较基准是**初始请求**的主机名（第一跳的 `via[0]`），不是上一跳。`api.example.com → www.example.com` 属于跨域（精确主机名比较，子域不同也算）；`A → B → A` 回到初始主机则不剥离。
- 剥离独立于 cookie jar：即使未启用 `EnableCookies`，手工设置的 `Cookie` 请求头在跨域跳转时同样被删除。

配合 `WithBasicAuth` / `WithBearerToken` 使用时无需额外处理——令牌只发往原始主机，不会随跳转带给第三方域。

## 环形重定向检测

除次数上限外，引擎还检测**环形重定向**（跳转目标此前已在链路中出现过）。命中时请求立即以错误结束，不必等次数用尽：

```text
A → B → A     环形：报错 circular redirect detected: A
A → A → A     连续同 URL：不算环形（服务器可能每次返回不同响应）
```

环形检测与 `MaxRedirects` 次数上限互为补充：次数上限兜住一切循环，环形检测把「明显绕圈」的链路提前识破，减少无谓的请求。

## 重定向错误归类

跟随被拒绝（超限、环形、白名单、SSRF 拦截）时，请求以 `ClientError` 结束，Type 统一为 `ErrorTypeValidation`：

| 底层错误信息 | Message 字段 | 触发条件 |
|--------------|--------------|----------|
| `stopped after N redirects` | `redirect limit exceeded` | 跳转次数达到 `MaxRedirects`（或默认 10） |
| `circular redirect detected: <URL>` | `circular redirect detected` | 目标 URL 早已出现在跳转链中 |
| `redirect blocked by whitelist: ...` | `redirect blocked by policy` | 目标域名不在 `RedirectWhitelist` 内 |
| `redirect blocked: ...` | `redirect blocked by policy` | 目标主机被 SSRF 防护拦截 |

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Defaults.MaxRedirects = 2 // 只允许跟随 2 次

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// /redirect/5 需要跟随 5 次，必然超过上限
	_, err = client.Get("https://httpbin.org/redirect/5")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) && clientErr.Type == httpc.ErrorTypeValidation {
			fmt.Println("重定向被拒绝：", clientErr.Message)
			// 输出：重定向被拒绝： redirect limit exceeded
		}
	}
}
```

重定向目标的 SSRF 校验还包含两条硬性规则：**只允许 http/https 协议**（`ftp://`、自定义协议的 `Location` 被拒绝）与**目标主机不得为空**。校验阶段不做 DNS 解析——完整的 IP 验证与 DNS rebinding 防护在连接建立时由拨号器执行（详见 [SSRF 防护](../security/ssrf)）。

## 域名白名单

`Security.RedirectWhitelist` 将重定向目标限制在受信域名内，防御开放重定向攻击：

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "*.cdn.example.com", // 通配符：匹配严格子域，不含裸域
}

client, err := httpc.New(cfg)
```

匹配规则细节：

- **精确匹配**：`api.example.com` 只匹配自身。
- **通配符**：`*.cdn.example.com` 匹配**严格子域**（如 `img.cdn.example.com`），不匹配裸域 `cdn.example.com`；两者都要放行需同时列出。
- 比较对象是 `Location` 目标的**主机名**（不含端口与协议），比较前做归一化：忽略首尾空白、大小写不敏感。

设置后，重定向到白名单之外域名的请求会被拒绝；重定向目标同时经过 SSRF IP 验证。处理用户提供的 URL 时，建议配合 `SecureConfig` 或白名单使用。

## 手动处理重定向

需要逐跳检查、按条件跟随或自定义日志时，禁止自动跟随并循环处理。注意两点：`Location` 可能是**相对地址**，需按当前 URL 解析成绝对地址；手动循环不经过白名单检查，但每一跳建连时连接层的 SSRF IP 校验照常生效。

```go
package main

import (
	"fmt"
	"log"
	"net/url"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Defaults.FollowRedirects = false

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	currentURL := "https://httpbin.org/redirect/3"
	base, err := url.Parse(currentURL)
	if err != nil {
		log.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		result, err := client.Get(currentURL)
		if err != nil {
			log.Fatal(err)
		}
		if !result.IsRedirect() {
			fmt.Println("到达最终地址：", currentURL)
			break
		}

		location := result.Response.Headers.Get("Location")
		if location == "" {
			fmt.Println("重定向响应缺少 Location 头，停止跟随")
			break
		}

		// 相对地址按当前 URL 解析为绝对地址
		next, err := base.Parse(location)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("第 %d 跳：%s\n", i+1, next.String())

		currentURL = next.String()
		base = next
	}
}
```

:::tip 手动循环中的安全责任
自动跟随时的白名单与重定向目标预检不会作用于手动循环。处理不可信来源的 `Location` 时，建议在循环里自行校验目标域名（或复用白名单逻辑）；连接层的 SSRF 校验仍然兜底，但域级控制需要自己做。
:::

## 常见问题

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| POST 收到 307/308 未跟随 | 请求体不可重放（未设置 `GetBody`），按规范不自动跟随 | 手动循环处理，或让服务端改用 302/303 |
| `WithMaxRedirects(0)` 没有禁用跟随 | `0` 是「未设置」哨兵值，回退默认 10 | 用 `WithFollowRedirects(false)` |
| 带 `Location` 的 300/399 没有跳转 | 引擎只跟随 301/302/303/307/308 | 用 `IsRedirect()` + `Location` 自行处理 |
| 跳转后查询参数「丢失」 | 目标查询串完全由 `Location` 决定，客户端不合并原请求参数 | 服务端在 `Location` 中带上需要的参数 |
| 想知道最终落在哪个域名 | `RedirectChain` 不含最终 URL | 读 `result.Request.URL` |
| 跨域跳转后请求 401 | `Authorization`/`Cookie` 被跨域剥离（安全设计） | 对新域名重新认证，或让服务端同域跳转 |

## 下一步

- [请求与响应](./request-response) - 请求选项与响应处理
- [SSRF 防护](../security/ssrf) - 重定向中的 SSRF 检查详解
- [错误处理](./error-handling) - ErrorType 分类与错误匹配
- [配置 API](../api-reference/client-config/config) - RequestDefaults 与安全字段参考
