---
title: "从 net/http 迁移 - CyberGo HTTPC | 迁移指南"
description: "从 net/http 平滑迁移到 CyberGo HTTPC：完整 API 对照表（http.Get、http.Client、Transport、CookieJar 到 httpc 对应项）、错误模型差异、五级超时体系与迁移陷阱清单，帮助已有标准库经验的开发者快速切换。"
sidebar_label: "从 net/http 迁移"
sidebar_position: 2
---

# 从 net/http 迁移

已经熟悉 `net/http`？这篇指南把你已有的标准库经验逐项映射到 HTTPC：哪些写法可以机械替换、哪些语义发生了变化、哪些默认行为需要重新审视。所有行为描述以源码为准。

## 兼容性总览：构建在 net/http 之上

HTTPC 不是 `net/http` 的替代品，而是构建在其传输层之上的增强层。底层引擎仍是 `http.Client` 与 `http.Transport`——连接复用、HTTP/2 协商、TLS 会话、代理隧道全部由标准库执行；HTTPC 在外层叠加安全校验、重试引擎、中间件链与 `Result` 转换（详见[「HTTPC 和 net/http 是什么关系？」](../faq/#httpc-和-net-http-是什么关系)）。

**迁移时保持不变的部分：**

- **传输层行为** — 连接池复用、HTTP/2 协商、TLS 会话恢复与标准库一致，性能特征不会因迁移而劣化；
- **类型直接复用** — `http.Cookie`、`tls.Config`、`context.Context`、`io.Reader`、`http.Header` 原样使用，无需适配层；
- **心智模型** — 包级函数对应 `http.Get`，Client 实例对应 `http.Client`，context 传递方式相同（见[核心概念](../getting-started/concepts)的双层 API 架构）。

**迁移后额外获得的部分：**

- 强制 TLS 1.2+、SSRF 防护、CRLF 注入校验、响应体大小防线（默认安全）；
- 指数退避智能重试（尊重 `Retry-After`，超时预算跨重试共享）；
- 洋葱模型中间件链（日志/指标/审计/请求 ID）；
- 一站式 `Result` 封装——响应体生命周期自动管理，无需 `Close()`。

同一个请求，迁移前后的对比：

```go
package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close() // 必须手动关闭，否则连接泄漏

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}

	fmt.Println(resp.StatusCode) // 200
	fmt.Println(len(body))       // 响应字节数
}
```

```go
package main

import (
	"fmt"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/get")
	if err != nil {
		panic(err) // 仅网络层错误
	}

	fmt.Println(result.StatusCode())   // 200
	fmt.Println(len(result.RawBody())) // 响应字节数（已读入内存，无需关闭）
}
```

迁移后代码更短，且默认带上了 TLS 策略、SSRF 防护与最多 3 次智能重试。

## API 对照表

### 客户端与请求

| net/http 写法 | HTTPC 对应 | 差异要点 |
|---------------|------------|----------|
| `http.Get(url)` | `httpc.Get(url)` | 同为包级函数 + 共享默认实例（惰性初始化） |
| `http.Post(url, ct, body)` | `httpc.Post(url, httpc.WithJSON(data))` | 请求体改由 `With*` 选项声明，Content-Type 自动设置 |
| `http.PostForm(url, values)` | `httpc.Post(url, httpc.WithForm(m))` | `WithForm` 接受 `map[string]string`；`url.Values` 用 `WithBody(values, httpc.BodyForm)` |
| `http.Head(url)` | `httpc.Head(url)` | 一一对应；`Put/Patch/Delete/Options` 同理 |
| `client := &http.Client{...}` | `httpc.New(cfg)` / `httpc.NewDefault()` | 返回 `Client` 接口；持有连接池，需 `Close()` 释放 |
| `http.DefaultClient` | 包级函数内部的默认客户端 | 惰性单例；`SetDefaultClient` 接管、`CloseDefaultClient` 释放后自动重建 |
| `http.NewRequest` + `client.Do(req)` | `client.Get(url, opts...)` 等动词方法 | 无需构建 `*http.Request`；方法与 URL 直接传参 |
| `http.NewRequestWithContext` + `Do` | `client.Request(ctx, method, url, opts...)` | 通用形态，任意方法字符串 |
| `req.Header.Set(k, v)` | `httpc.WithHeader(k, v)` / `WithHeaderMap(m)` | 头键值经 CRLF 注入校验，非法值返回 `ErrInvalidHeader` |
| `req.Header.Set("User-Agent", ua)` | `httpc.WithUserAgent(ua)` | 实例级默认用 `cfg.Defaults.UserAgent` |
| `req.SetBasicAuth(u, p)` | `httpc.WithBasicAuth(u, p)` | 带格式校验 |
| `req.AddCookie(&http.Cookie{...})` | `httpc.WithCookies([]http.Cookie{{...}})` | 接受 Cookie 切片（单个也传单元素切片）；仅 name-value 用 `WithCookieMap`、原始头字符串用 `WithCookieString` |
| `req.URL.Query()` 拼接查询串 | `httpc.WithQuery(k, v)` / `WithQueryMap(m)` | 值支持常见标量与 `fmt.Stringer`，自动编码合并进 URL |
| `jar, _ := cookiejar.New(nil)` 挂到 `client.Jar` | `cfg.Connection.EnableCookies = true` | 或用 `DomainClient` 自动维护 Cookie 与公共头（见[域名会话](./domain-session)） |
| `client.CheckRedirect = func(...)` | `cfg.Defaults.FollowRedirects` / `MaxRedirects` | 请求级 `WithFollowRedirects(false)`；重定向域名白名单 `Security.RedirectWhitelist`（见[重定向](./redirects)） |
| 代理：`Transport.Proxy` | `cfg.Connection.ProxyURL` / `ProxyPool` / `EnableSystemProxy` | 三种方式按优先级生效，详见[代理与代理池](./proxy) |

### 响应处理

| net/http 写法 | HTTPC 对应 | 差异要点 |
|---------------|------------|----------|
| `resp.StatusCode` | `result.StatusCode()` | nil 安全访问器；状态判断用 `IsSuccess()` / `IsClientError()` / `IsServerError()` / `IsRedirect()` |
| `resp.Status` / `resp.Proto` | `result.Response.Status` / `result.Proto()` | 协议版本如 `HTTP/1.1` |
| `resp.Header.Get(k)` | `result.Response.Headers.Get(k)` | 仍是标准 `http.Header`，大小写不敏感 |
| `io.ReadAll(resp.Body)` | `result.Body()` / `result.RawBody()` | 响应体已被读入内存并复制，解压自动完成 |
| `defer resp.Body.Close()` | 无对应 | **不要**寻找关闭入口——连接由连接池管理，`Result` 交给 GC |
| `json.NewDecoder(resp.Body).Decode(&v)` | `result.Unmarshal(&v)` | 空体返回哨兵错误 `ErrResponseBodyEmpty`（非 `io.EOF`，见下文） |
| `resp.Cookies()` | `result.ResponseCookies()` / `result.GetCookie(name)` | 另有 `GetRequestCookie` 查看实际发出的 Cookie |
| `resp.ContentLength` | `result.Response.ContentLength` | — |
| `resp.Request`（重定向后最终请求） | `result.Request` | 含 `URL` / `Method` / `Headers` / `Cookies` |
| `io.Copy(f, resp.Body)` 落盘 | `result.SaveToFile(path)` | 大文件改用 `Download`（流式、断点续传，见[文件传输](./file-transfer)） |
| （无对应） | `result.Meta` | HTTPC 新增：`Duration` / `Attempts` / `RedirectChain` / `ProxyURL` |
| `resp.Trailer` | 无对应 | `Result` 不暴露 trailer，依赖 trailer 的场景暂不支持 |

## 错误模型差异

这是迁移时**最容易踩坑**的部分。先说一致的地方：两个库都不把 4xx/5xx 当作 `error`——`err` 只表示请求未能成功完成。真正的差异在于 `err` 的形态、响应体的生命周期与重试行为：

| 维度 | net/http | HTTPC |
|------|----------|-------|
| 错误形态 | `*url.Error` 包装的原始传输错误 | `*ClientError` 分类错误（12 类 `ErrorType` 枚举） |
| 分类手段 | 类型断言（`net.Error`、`net.DNSError`、`x509.UnknownAuthorityError`…）或字符串匹配 | `errors.As` 提取后读 `Code()` / `IsRetryable()` / `Attempts`；哨兵错误用 `errors.Is` |
| `err != nil` 时的响应 | `resp` 可能非 nil（`CheckRedirect` 返回错误时带最后响应） | `result` 恒为 nil，无需判空响应 |
| 响应体读取错误 | 在 `io.ReadAll` / `Decode` 时才出现（`io.EOF`、`unexpected EOF`） | 已在请求阶段读取完毕，读取失败作为 `ClientError`（`ErrorTypeResponseRead`）随 `err` 返回 |
| 空响应体 + JSON 解码 | `Decode` 返回 `io.EOF` | `Unmarshal` 返回 `ErrResponseBodyEmpty` |
| 重试 | 无——错误直接抛给调用方 | 超时/传输错误与 408/429/500/502/503/504 自动重试；网络错误耗尽返回 `error`，可重试状态码耗尽返回**最后一次响应** |
| 错误信息中的 URL | 原样输出（可能带凭据） | 自动脱敏（凭据 `***:***`、敏感参数 `[REDACTED]`） |

迁移前的典型错误处理：

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("https://api.example.com/users/42")
	if err != nil {
		// *url.Error：连接失败、超时、TLS 错误都从这里出来，
		// 进一步分类要靠类型断言或字符串匹配
		panic(err)
	}
	defer resp.Body.Close()

	// 4xx/5xx 不是 error：走正常路径，需手动检查状态码
	if resp.StatusCode != http.StatusOK {
		fmt.Println("HTTP 错误：", resp.StatusCode)
		return
	}

	var user map[string]any
	// 空响应体时 Decode 返回 io.EOF——常见的遗漏分支
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil && !errors.Is(err, io.EOF) {
		panic(err)
	}
	fmt.Println(user["name"])
}

// 输出（取决于服务端响应）：
// HTTP 错误： 404
```

迁移后：

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://api.example.com/users/42")
	if err != nil {
		// 网络层错误：已分类为 ClientError（12 类），带短码与可重试性
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			log.Printf("错误类型: %s, 可重试: %v, 尝试次数: %d",
				clientErr.Code(), clientErr.IsRetryable(), clientErr.Attempts)
		}
		panic(err)
	}

	// 4xx/5xx 不是 error：通过 Result 的状态判断方法检查
	if !result.IsSuccess() {
		fmt.Println("HTTP 错误：", result.StatusCode())
		return
	}

	var user map[string]any
	// 空响应体返回哨兵错误 ErrResponseBodyEmpty，errors.Is 精确判断
	if err := result.Unmarshal(&user); err != nil {
		if errors.Is(err, httpc.ErrResponseBodyEmpty) {
			fmt.Println("(空响应体)")
			return
		}
		panic(err)
	}
	fmt.Println(user["name"])
}

// 输出（取决于服务端响应）：
// HTTP 错误： 404
```

常见的错误分类场景对照（`clientErr` 为 `errors.As` 提取的 `*httpc.ClientError`）：

| 想判断的情况 | net/http 写法 | HTTPC 写法 |
|--------------|---------------|------------|
| 超时 | `var ne net.Error` + `ne.Timeout()` | `clientErr.Type == httpc.ErrorTypeTimeout` |
| DNS 失败 | `var de *net.DNSError` + `errors.As` | `httpc.ErrorTypeDNS` |
| 证书校验失败 | `var ce x509.UnknownAuthorityError` + `errors.As` | `httpc.ErrorTypeCertificate` |
| TLS 协议错误 | 字符串匹配 `"tls:"` | `httpc.ErrorTypeTLS` |
| 连接拒绝/重置 | `var oe *net.OpError` + `errors.As` | `httpc.ErrorTypeNetwork` |
| 上下文取消/截止 | `errors.Is(err, context.Canceled)` | `httpc.ErrorTypeContextCanceled`（恒不重试） |

错误分类、可重试性与哨兵错误的完整说明见[错误处理](./error-handling)与[错误类型](../api-reference/types/errors)。

## 请求体、头部与上下文迁移

`net/http` 里「构建请求 → 逐项设置 → Do」的三段式，在 HTTPC 中收敛为「动词方法 + 声明式选项」。

<!-- check-code: skip -->
```go
// net/http：手动序列化、手动设置头、手动拼查询串
payload, _ := json.Marshal(map[string]any{"name": "test"})
req, err := http.NewRequest("POST", "https://api.example.com/orders", bytes.NewReader(payload))
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Content-Type", "application/json")
req.Header.Set("Authorization", "Bearer "+token)

q := req.URL.Query()
q.Set("page", "2")
req.URL.RawQuery = q.Encode()

resp, err := client.Do(req)
```

<!-- check-code: skip -->
```go
// HTTPC：选项即请求，Content-Type 自动设置，查询参数自动编码
result, err := client.Post("https://api.example.com/orders",
    httpc.WithJSON(map[string]any{"name": "test"}),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 2),
)
```

标准库操作到请求选项的映射：

| 标准库操作 | HTTPC 选项 |
|------------|------------|
| `json.Marshal` + `bytes.NewReader` + Content-Type | `WithJSON(data)`（等价 `WithBody(data, BodyJSON)`） |
| `xml.Marshal` | `WithXML(data)` |
| `url.Values` 表单编码 | `WithForm(m)` / `WithBody(values, httpc.BodyForm)` |
| `multipart.Writer` 手写边界 | `WithFile(field, name, content)` / `WithFormData(form)` |
| `bytes.NewReader(raw)` 原始体 | `WithBody(raw)`（类型自动检测）/ `WithBinary(data, ct...)` |
| `req.Header.Set(k, v)` | `WithHeader(k, v)` / `WithHeaderMap(m)` |
| `req.SetBasicAuth` / 手拼 Bearer | `WithBasicAuth(u, p)` / `WithBearerToken(t)` |
| `req.AddCookie` | `WithCookies(cs)` / `WithCookieMap(m)` / `WithCookieString(s)` |
| `io.Reader` 流式请求体 | `WithBody(reader)`（原样透传；**绕过大小校验**，用 `io.LimitReader` 包一层） |

上下文用法与标准库一致——`context.Context` 仍然是超时与取消的载体，只是传递位置不同：

<!-- check-code: skip -->
```go
// net/http：把 ctx 塞进请求对象
req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
resp, err := client.Do(req)
```

<!-- check-code: skip -->
```go
// HTTPC：ctx 直接作为第一个参数传入
result, err := client.Request(ctx, "GET", url)

// 便捷方法（Get/Post 等）不接受 ctx，用 WithContext 换入：
result, err = client.Get(url, httpc.WithContext(ctx))
```

完整的选项清单见[请求与响应](./request-response)与[请求选项 API](../api-reference/core/options)。

## 超时体系对照

`http.Client.Timeout` 是一个覆盖全过程的单一超时；HTTPC 将其拆解为五级独立配置，并提供请求级覆盖：

| net/http | HTTPC 字段 | 默认值 | 作用域 |
|----------|-----------|--------|--------|
| `http.Client.Timeout` | `Timeouts.Request` | 180s | 请求总超时，**含所有重试与退避等待** |
| `Transport.DialContext`（`net.Dialer{Timeout}`） | `Timeouts.Dial` | 10s | TCP 连接建立 |
| `Transport.TLSHandshakeTimeout` | `Timeouts.TLSHandshake` | 10s | TLS 握手（仅 HTTPS） |
| `Transport.ResponseHeaderTimeout` | `Timeouts.ResponseHeader` | 0（禁用） | 等待响应头；设正值则为传输级硬上限 |
| `Transport.IdleConnTimeout` | `Timeouts.IdleConn` | 90s | 空闲连接保持时长 |
| （无请求级覆盖） | `WithTimeout(d)` | — | 请求级覆盖总预算；上限 30 分钟 |

<!-- check-code: skip -->
```go
// net/http：单一超时覆盖全过程（无重试）
client := &http.Client{Timeout: 30 * time.Second}
```

<!-- check-code: skip -->
```go
// HTTPC：实例级总预算 + 请求级覆盖
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 30 * time.Second // 含所有重试的总预算
client, _ := httpc.New(cfg)

result, err := client.Get(url, httpc.WithTimeout(30*time.Second)) // 本次请求覆盖
```

三点语义差异需要留意：

- **总预算跨重试共享** — `Timeouts.Request` / `WithTimeout` 覆盖所有重试尝试与退避等待，不是每次尝试重新计时；
- **`ResponseHeader` 特殊** — 默认 0（禁用），由总预算全权控制；设为正值后作用于共享同一 client 的**所有请求**，且更短时会覆盖 `WithTimeout`（防 slowloris 的纵深防御，`SecureConfig()` 已配好）；
- **长响应场景** — AI API 等需要长等待的接口用 `WithTimeout` 给足预算即可，默认不存在「响应头超时掐断慢响应」的问题。

详见[请求与响应](./request-response)的超时部分与[常见问题「超时怎么选？」](../faq/#超时怎么选)。

## Transport 定制迁移

标准库里常见的 `http.Transport` 调优字段，在 HTTPC 中全部映射到 `Config` 的对应子结构：

| `http.Transport` / `http.Client` 字段 | HTTPC 配置 | 默认值 |
|----------------------------------------|-----------|--------|
| `MaxIdleConns` | `Connection.MaxIdleConns` | 50 |
| `MaxConnsPerHost` / `MaxIdleConnsPerHost` | `Connection.MaxConnsPerHost` | 10 |
| `Proxy: http.ProxyFromEnvironment` | `Connection.EnableSystemProxy` | false |
| 自定义 `Proxy` 函数 | `Connection.ProxyURL`（单代理）/ `ProxyPool`（池轮换） | 空 |
| `TLSClientConfig` | `Security.TLSConfig` | nil |
| `ForceAttemptHTTP2` | `Connection.EnableHTTP2` | true |
| `ResponseHeaderTimeout` | `Timeouts.ResponseHeader` | 0（禁用） |
| `MaxResponseHeaderBytes` | `Connection.MaxResponseHeaderBytes` | 0（标准库默认 10MB） |
| `CheckRedirect` | `Defaults.FollowRedirects` / `MaxRedirects` + `Security.RedirectWhitelist` | true / 10 |
| 自定义 `DialContext`（拨号器） | 无直接入口 | SSRF 校验包装在拨号层 |

已有的 `tls.Config` 知识（mTLS、自定义 CA、密码套件）可原样迁入：

```go
package main

import (
	"crypto/tls"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// 已有的 tls.Config（自定义 CA、密码套件、mTLS 客户端证书）原样迁入
	tlsCfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
		MaxVersion: tls.VersionTLS13,
	}

	cfg := httpc.DefaultConfig()
	cfg.Security.TLSConfig = tlsCfg
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err) // 网络层错误
	}
	fmt.Println(result.StatusCode()) // 200
}
```

:::warning 注意
`Security.TLSConfig` 一旦设置，`MinTLSVersion` / `MaxTLSVersion` 字段即被忽略——TLS 版本策略以你传入的 `tls.Config` 为准（记得自己设 `MinVersion`，不要低于 TLS 1.2）。
:::

两个边界需要知道：

- **无自定义 Transport 注入入口** — HTTPC 自行创建并管理 `*http.Transport`（SSRF 校验包装在拨号函数中、重定向策略经 `CheckRedirect` 注入），`Config` 不暴露整只 Transport。需要极端定制拨号行为的场景，先查 `Config.Connection` / `Config.Security` 是否已覆盖。
- **需要替换整个实现时用 `Doer`** — 测试 mock 或替换实现只需实现单方法接口 `Doer`（`Request(ctx, method, url, opts...)`），无需对接完整 `Client` 接口，见[测试](./testing)。

## 迁移陷阱清单

从 `net/http` 迁移时，以下行为差异最容易出问题：

**1. `resp.Body` 不需要（也不能）手动关闭**

`Result` 持有的是已读取并复制的字节，HTTPC 在内部完成读取、排空与关闭，底层连接由连接池管理。迁移时**删除所有 `defer resp.Body.Close()`**，也不要寻找关闭入口。详见[常见问题「响应 Body 需要手动关闭吗？」](../faq/#响应-body-需要手动关闭吗)。

**2. 默认开启重试——非幂等 POST 可能重复提交**

`net/http` 从不重试；HTTPC 默认对超时/传输错误与 408/429/500/502/503/504 自动重试最多 3 次，**不区分请求方法**。下单、扣款类接口必须处理：

<!-- check-code: skip -->
```go
// 危险：默认最多重试 3 次，POST 同样参与重试
result, err := client.Post("https://api.example.com/orders", httpc.WithJSON(order))

// 安全（一）：非幂等接口请求级关闭重试
result, err = client.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithMaxRetries(0),
)

// 安全（二）：服务端幂等键去重（推荐）
result, err = client.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithHeader("Idempotency-Key", orderID),
)
```

缓解策略详见[常见问题「重试会导致 POST 重复提交吗？」](../faq/#重试会导致-post-重复提交吗)。

**3. SSRF 防护默认开启——内网与 localhost 会被拦截**

从 `net/http` 迁移后，访问 `127.0.0.1`、`10.x`、`192.168.x` 等私有/保留地址会直接报错（`net/http` 无此限制）。本地联调按影响面从小到大选择：

<!-- check-code: skip -->
```go
// 请求级豁免（推荐，影响面最小）
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// 客户端级精确豁免 CIDR（如 VPC / Tailscale）
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

完整策略见[SSRF 防护](../security/ssrf)。

**4. 默认客户端是惰性单例，长期服务请用显式实例**

包级函数共享一个内部管理的默认客户端（关闭后自动重建）。生产服务应创建显式实例控制配置与生命周期，`Close()` 后再请求返回 `ErrClientClosed`：

<!-- check-code: skip -->
```go
// 长期服务：显式实例，进程内共享，用完 Close
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

// 需要让包级函数使用你的配置：接管默认客户端（旧实例自动关闭）
custom, err := httpc.New(httpc.SecureConfig())
if err != nil {
    log.Fatal(err)
}
if err := httpc.SetDefaultClient(custom); err != nil {
    log.Fatal(err)
}
```

**5. 哨兵错误用 `errors.Is` / `errors.As`，不要字符串匹配**

`ErrClientClosed`、`ErrResponseBodyEmpty`、`ErrResponseBodyTooLarge`、`ErrInvalidHeader` 等哨兵错误应使用 `errors.Is` 判断；分类错误用 `errors.As` 提取 `*ClientError`。错误链可穿透到底层原因（`Cause`）。

**6. 响应体有默认上限**

普通请求默认响应体上限 10MB、解压后上限 100MB（防内存耗尽与解压炸弹），超过报错。用 `http.Get` + `io.Copy` 下载大文件的旧代码请改用 `Download`（流式写盘、断点续传、进度回调）。上限可通过 `Security.MaxResponseBodySize` / `MaxDecompressedBodySize` 调整。

**7. 重定向行为可预期但也有默认值**

默认跟随重定向（上限 10 次）。注意 `WithMaxRedirects(0)` / `MaxRedirects = 0` 是「未设置」哨兵值而非禁用——要禁止跟随用 `WithFollowRedirects(false)` 或 `Defaults.FollowRedirects = false`。详见[重定向](./redirects)。

## 分步迁移检查清单

按顺序执行，每步都可独立验证：

1. **安装依赖** — `go get github.com/cybergodev/httpc`，把 `"net/http"` 的客户端调用处换上 `"github.com/cybergodev/httpc"`（`http.Cookie` 等类型仍从标准库导入）。
2. **机械替换请求调用** — `http.Get` → `httpc.Get`、`client.Do(req)` → `client.Get/Post/...`；`http.Client` 字面量 → `httpc.New(cfg)`。
3. **删除资源管理代码** — 移除 `defer resp.Body.Close()`、`io.ReadAll`；改用 `result.Body()` / `result.RawBody()` / `result.Unmarshal(&v)`。
4. **改造错误处理** — `err` 分支按需加 `errors.As` 提取 `ClientError`；状态码检查改为 `result.IsSuccess()` 系列；`io.EOF` 空体分支改为 `errors.Is(err, httpc.ErrResponseBodyEmpty)`。
5. **映射超时** — `http.Client.Timeout` → `cfg.Timeouts.Request`；请求级差异用 `WithTimeout`；原 Transport 级超时按[超时体系对照](#超时体系对照)落位。
6. **迁移 Transport 调优** — 池大小、代理、TLS、HTTP/2 按上表落位到 `Config.Connection` / `Config.Security`；`tls.Config` 迁入 `Security.TLSConfig`。
7. **处理安全默认值** — 内网/localhost 调用加 SSRF 豁免；确认响应体上限满足接口的返回体量。
8. **审视重试影响** — 非幂等 POST 加幂等键或 `WithMaxRetries(0)`；确认重试预算与业务超时匹配。
9. **收尾生命周期** — 长期服务用显式实例 + `defer client.Close()`；确认没有在请求路径上重复创建客户端。
10. **回归验证** — 跑既有集成测试；重点覆盖错误路径（断网/超时/4xx/5xx）与大响应体场景。

## 下一步

- **[实战教程](./tutorial)** - 30 分钟构建一个完整的 GitHub API 客户端，覆盖迁移后的典型写法
- **[请求与响应](./request-response)** - 完整的请求选项与 `Result` 响应处理
- **[核心概念](../getting-started/concepts)** - 双层 API 架构、配置体系与请求生命周期
- **[常见问题](../faq/)** - 重试、超时、代理、Cookie 等高频问题的源码级解答
