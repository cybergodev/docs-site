---
sidebar_label: "域名客户端与会话"
title: "域名客户端与会话 - CyberGo HTTPC | 会话与域名管理"
description: "HTTPC 域名客户端与会话管理指南：NewDomain 与 NewDomainDefault 创建域名作用域客户端、URL 拼接规则与路径穿越防护、SetHeader 会话头、Cookie 自动捕获与选项自动持久化、CookieSecurity 验证、并发语义与 REST 客户端封装实战。"
sidebar_position: 5
---

# 域名客户端与会话

域名客户端（DomainClient）是针对同一域名的会话管理客户端，自动维护 Cookie 和请求头。

三个组件各司其职：

| 组件 | 职责 | 适用场景 |
|------|------|----------|
| `Client` | 通用 HTTP 客户端：配置、连接池、重试、中间件 | 请求分散在多个域名、无需跨请求状态 |
| `DomainClient` | 域名作用域客户端：URL 自动拼接 + 内置会话 | 固定某个 API 域名、需要跨请求维护头/Cookie |
| `SessionManager` | 线程安全的会话状态存储（头 + Cookie），可独立使用 | 自行管理会话状态、与任意 Client 组合 |

## 创建域名客户端

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie 自动启用
dc.SetHeader("Authorization", "Bearer "+token)

// 使用相对路径发送请求
result, err := dc.Get("/users")
```

:::tip
`NewDomain` 会自动启用 Cookie 管理（`EnableCookies = true`），无需手动配置。
:::

创建时有三件事自动发生：

1. **baseURL 校验**：必须包含 scheme 和 host（如 `https://api.example.com`），否则返回错误
2. **强制启用 Cookie**：忽略传入配置中的 `Connection.EnableCookies`，域名客户端始终带 Cookie 管理
3. **创建会话**：内部创建一个 `SessionManager`（默认 `DefaultSessionConfig`），头与 Cookie 都存在这里

`NewDomain` 也接受完整 Config，用于自定义超时、重试等（此时 `dc.Get` 等方法与普通客户端行为一致）：

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 15 * time.Second
	cfg.Retry.MaxRetries = 2
	cfg.Defaults.UserAgent = "my-app/1.0"

	dc, err := httpc.NewDomain("https://api.github.com", cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	if err := dc.SetHeader("Accept", "application/vnd.github+json"); err != nil {
		log.Fatal(err)
	}

	result, err := dc.Get("/repos/golang/go")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200
}
```

## URL 拼接规则

`Get`/`Post` 等方法的第一个参数是相对 base URL 的路径，拼接规则：

| 传入 path | 结果 | 规则 |
|-----------|------|------|
| `/users` | `{base}/users` | 相对路径拼接到 base 路径 |
| `/users/` | `{base}/users/` | 尾部斜杠保留 |
| `https://other.com/data` | 原样使用 | 以 `http://`/`https://` 开头的完整 URL 跳过拼接 |
| `/users?page=2` | `{base}/users?page=2` | 查询串保留；base 自带查询参数时二者合并 |
| `""` | `{base}` | 空路径返回 base 本身 |

:::warning 路径穿越防护
若 base URL 带路径前缀（如 `https://example.com/api/v1`），拼接结果必须落在该前缀之内；`..` 等试图逃逸的路径会返回 `path escapes base URL scope` 错误，不会发出请求。
:::

## 会话头管理

```go
// 设置会话头（所有后续请求自动携带）
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 批量设置
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// 删除和清空
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// 查询
headers := dc.GetHeaders()
```

所有键值会做与 `WithHeader` 相同的 CRLF 注入校验，非法键值返回错误。`GetHeaders()` 返回的是**副本**，修改它不影响会话。

单次请求可用选项覆盖会话头（选项排在会话头之后应用）：

```go
dc.SetHeader("X-API-Version", "v1")

// 本次请求发送 v2
result, _ := dc.Get("/data", httpc.WithHeader("X-API-Version", "v2"))
```

注意：如下一节所述，`v2` 会写回会话，后续请求也将发送 `v2`。

## Cookie 管理

```go
// 设置 Cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// 批量设置
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "zh"},
})

// 响应 Cookie 自动捕获
result, _ := dc.Get("/login")
// 服务器返回的 Set-Cookie 自动存储到会话

// 查询
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// 删除和清空
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
每次请求后，服务器返回的 Cookie 会自动更新到会话中，无需手动处理。
:::

Cookie 的自动维护覆盖三条路径：

- **响应回填**：每次请求结束后，响应中的 `Set-Cookie` 自动写入会话（下载用的 `Download` 方法同样会捕获响应 Cookie）
- **校验**：写入前做与 `WithCookies` 相同的合法性校验；配置了 Cookie 安全策略（见下方「Cookie 安全验证」）时，不合规的 Cookie 会被**静默跳过**，不影响其余 Cookie
- **副本语义**：`GetCookie`/`GetCookies` 返回 Cookie 的副本，修改返回值不会污染会话内部状态

### 请求选项自动持久化

通过**请求选项**传入的 Cookie 和请求头也会被捕获进会话，对后续请求持续生效：

```go
// 第一次请求：选项传入的 Cookie 与请求头……
_, err := dc.Get("/login",
    httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}),
    httpc.WithHeader("X-Client", "mobile"),
)
if err != nil {
    log.Fatal(err)
}

// ……已写入会话：
fmt.Println(dc.GetCookie("session").Value) // 输出：abc
fmt.Println(dc.GetHeaders()["X-Client"])   // 输出：mobile

// 之后的请求即使不带选项也自动携带；再次用选项传同名项会覆盖会话值
_, err = dc.Get("/profile")
```

:::warning 临时头请勿用选项传
选项中的头/Cookie 会持久化到会话，对**所有后续请求**生效。每次取值都不同的一次性头（如递增的 trace ID、随机 nonce）用完后记得 `DeleteHeader`/`DeleteCookie` 移除，或改用底层 `Client` 发送该请求。
:::

## 请求方式

```go
// 相对路径
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// 带上下文
result, _ := dc.Request(ctx, "GET", "/users")

// 绝对 URL（跳过 base URL 拼接）
result, _ := dc.Get("https://other-api.com/data")
```

:::warning 请求选项会应用两次
域名客户端在内部对请求选项**应用两次**（一次捕获会话状态、一次实际请求）。避免使用带副作用的选项（如计数器、nonce 生成）；如需此类选项请改用底层 `Client`。
:::

`Download` 方法与 `Client.Download` 签名一致，路径同样相对于 base URL 解析，完成后会把响应 Cookie 捕获进会话：

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "data.json"
dlCfg.Overwrite = true

result, err := dc.Download(ctx, "/export/data", dlCfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.FilePath, result.BytesWritten)
```

## 会话访问

```go
// 获取基础信息
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"（host 去掉端口）

// 访问底层 SessionManager
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

`DomainClient` 通过内嵌 `SessionManager` 暴露全部会话方法，因此 `dc.SetHeader(...)` 与 `dc.Session().SetHeader(...)` 完全等价。

### 独立使用 SessionManager

`SessionManager` 可以脱离 `DomainClient` 单独创建，作为线程安全的头/Cookie 存取器：

```go
session, err := httpc.NewSessionManagerDefault()
if err != nil {
    log.Fatal(err)
}

// 写入状态
if err := session.SetHeader("Authorization", "Bearer my-token"); err != nil {
    log.Fatal(err)
}
if err := session.SetCookies([]*http.Cookie{{Name: "session_id", Value: "abc123"}}); err != nil {
    log.Fatal(err)
}

// 从响应回填 Cookie
result, err := client.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}
session.UpdateFromResult(result)     // 从 Result 捕获响应 Cookie
session.UpdateFromCookies(cookies)   // 从 []*http.Cookie 批量更新
```

配合普通 `Client` 使用时，需自行读取 `GetHeaders()`/`GetCookies()` 并转成 `WithHeaderMap`/`WithCookies` 选项附加到请求（`DomainClient` 内部正是这样把会话状态注入每个请求的）。

## 并发语义

- **SessionManager 并发安全**：所有读写方法由 `sync.RWMutex` 保护，多 goroutine 同时调用 `SetHeader`/`GetCookies` 无需额外加锁
- **会话快照最终一致**：每个请求「读取会话快照 → 发出请求 → 回写响应 Cookie」的序列不是原子的——并发请求可能读到稍旧的快照（例如另一个请求刚收到的登录 Cookie 尚未对你可见），这是设计上的取舍；单个请求拿到的快照始终一致
- **DomainClient 可并发使用**：方法本身无额外锁，可被多个 goroutine 共享

:::tip
登录、刷新 Token 等会显著改变会话状态的操作，建议避免与业务请求并发执行，或在其完成后再发起依赖新状态的请求。
:::

## Cookie 安全验证

可配置 Cookie 安全策略，仅接受符合安全标准的 Cookie：

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")

// 设置严格 Cookie 安全
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// 要求：Secure=true, HttpOnly=true, SameSite=Strict

// 不符合安全要求的 Cookie 会导致 SetCookie 返回错误
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // 缺少 Secure, HttpOnly → 被拒绝
}); err != nil {
    log.Println("Cookie 被拒绝：", err)
}
```

两种校验入口的行为差异：

| 入口 | 不合规时的行为 |
|------|----------------|
| `SetCookie` / `SetCookies`（显式写入） | 返回错误，Cookie 不入会话 |
| 响应回填 / 选项捕获（自动写入） | **静默跳过**该 Cookie，其余照常处理 |

策略在 `SetCookieSecurity` 之后对所有后续写入生效。独立创建 `SessionManager` 时可通过 `SessionConfig.CookieSecurity` 预配置（`NewDomain` 内部使用默认会话配置，需创建后调用 `SetCookieSecurity`）。宽松起点用 `DefaultCookieSecurityConfig()`（默认不强制任何属性），再按需收紧字段。

## 生命周期与复用

```go
// 推荐：进程内长驻一个 DomainClient，跨请求复用连接池与会话
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 会话失效（如 Token 过期）时重置会话并重新登录
dc.ClearCookies()
dc.DeleteHeader("Authorization")
// ……重新执行登录流程，SetCookie/SetHeader 恢复状态……
```

- `Close()` 关闭底层 Client（连接池、传输层），**不会**清除会话头/Cookie（它们存在 SessionManager 里）；关闭后继续请求返回 `ErrClientClosed`
- 不要每个请求新建 `DomainClient`——会失去连接复用与会话累积，还可能耗尽连接
- 整客户端换安全策略等需求直接建新实例，旧实例 `Close` 后丢弃

## 完整示例：REST API 客户端

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 创建域名客户端
	dc, err := httpc.NewDomainDefault("https://api.example.com")
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	// 登录获取 Token
	loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
		"username": "admin",
		"password": "secret",
	}))
	if err != nil {
		log.Fatal(err)
	}

	// 从响应中解析 Token
	var loginResp struct {
		Token string `json:"token"`
	}
	if err := loginResult.Unmarshal(&loginResp); err != nil {
		log.Fatal(err)
	}

	// 设置会话头
	if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
		log.Fatal(err)
	}

	// 后续请求自动携带 Token 和 Cookie
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	users, err := dc.Request(ctx, "GET", "/users")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(users.StatusCode()) // 200
}
```

## 下一步

- [域名客户端 API](../api-reference/client-config/domain-client) - 完整 API 参考
- [会话管理 API](../api-reference/client-config/session) - SessionManager 参考
- [请求与响应](./request-response) - 基本请求指南
