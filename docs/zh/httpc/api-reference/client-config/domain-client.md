---
sidebar_label: "域名客户端"
title: "域名客户端 - CyberGo HTTPC | NewDomain 与会话"
description: "HTTPC 域名客户端 API 参考：NewDomain 创建函数、七种 HTTP 方法与 Request 通用方法、URL 自动拼接规则、DomainClienter 接口的 SetHeader/SetCookie 会话管理与 Close 生命周期。"
sidebar_position: 20
---

# 域名客户端

域名客户端（`DomainClient`）管理针对特定域名的请求，并维护会话 Cookie 与会话请求头。普通 `Client` 在多请求间需手动传递认证头、追踪 Cookie。`DomainClient` 把这些状态放入会话：请求前注入会话状态，响应后捕获 Cookie。

```text
DomainClient 架构
├── client         底层 Client（复用连接池、中间件链）
├── baseURL        域名作用域（如 https://api.example.com/v1）
├── parsedURL      缓存解析结果（避免每次请求重复 url.Parse）
├── domain         主机名（不含端口）
└── SessionManager 会话状态
      ├── headers  map[string]string      会话级请求头
      └── cookies  map[string]*http.Cookie 会话级 Cookie
```

## DomainClienter 接口

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

`DomainClienter` 同时实现 `Client` 接口（含 `Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options`/`Request`/`Download`/`Close`）和会话管理方法。测试与替换实现时，使用接口类型比具体类型更方便。

### 完整方法表

#### HTTP 请求方法（继承自 Client）

| 方法 | 签名 | 说明 |
|------|------|------|
| `Get` | `(path string, opts ...RequestOption) (*Result, error)` | GET 请求 |
| `Post` | `(path string, opts ...RequestOption) (*Result, error)` | POST 请求 |
| `Put` | `(path string, opts ...RequestOption) (*Result, error)` | PUT 请求 |
| `Patch` | `(path string, opts ...RequestOption) (*Result, error)` | PATCH 请求 |
| `Delete` | `(path string, opts ...RequestOption) (*Result, error)` | DELETE 请求 |
| `Head` | `(path string, opts ...RequestOption) (*Result, error)` | HEAD 请求 |
| `Options` | `(path string, opts ...RequestOption) (*Result, error)` | OPTIONS 请求 |
| `Request` | `(ctx, method, path string, opts ...RequestOption) (*Result, error)` | 带上下文的通用请求 |
| `Download` | `(ctx, path string, cfg *DownloadConfig, opts ...RequestOption) (*DownloadResult, error)` | 文件下载 |
| `Close` | `() error` | 关闭客户端释放资源 |

具体类型 `*DomainClient` 实现了上表全部方法，方法名与接口签名一一对应，完整方法名为 `DomainClient.Get`、`DomainClient.Post`、`DomainClient.Put`、`DomainClient.Patch`、`DomainClient.Delete`、`DomainClient.Head`、`DomainClient.Options`、`DomainClient.Request`、`DomainClient.Download`、`DomainClient.Close`。`Download` 与 `Close` 详见下文专节。

#### URL 访问方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `URL` | `URL() string` | 基础 URL（构造时传入的 `baseURL`） |
| `Domain` | `Domain() string` | 域名（主机名，不含端口） |
| `Session` | `Session() *SessionManager` | 底层会话管理器 |

三者在接口上定义为 `DomainClienter.URL`、`DomainClienter.Domain`、`DomainClienter.Session`，由 `DomainClient.URL`、`DomainClient.Domain`、`DomainClient.Session` 实现。

`URL()` / `Domain()` / `Session()` / `Close()` 均为 nil 接收者安全：接收者为 nil 时分别返回 `""`、`""`、`nil`、`nil`。

#### 会话头管理

| 方法 | 签名 | 说明 |
|------|------|------|
| `SetHeader` | `(key, value string) error` | 设置单个会话头（校验 CRLF 安全性） |
| `SetHeaders` | `(headers map[string]string) error` | 批量设置会话头 |
| `DeleteHeader` | `(key string)` | 删除单个会话头 |
| `ClearHeaders` | `()` | 清空全部会话头 |
| `GetHeaders` | `() map[string]string` | 获取会话头副本 |

五个方法在接口上定义为 `DomainClienter.SetHeader`、`DomainClienter.SetHeaders`、`DomainClienter.DeleteHeader`、`DomainClienter.ClearHeaders`、`DomainClienter.GetHeaders`。

实现委托给内嵌的 `SessionManager`（见[会话管理](./session)）。

#### 会话 Cookie 管理

| 方法 | 签名 | 说明 |
|------|------|------|
| `SetCookie` | `(cookie *http.Cookie) error` | 设置单个会话 Cookie |
| `SetCookies` | `(cookies []*http.Cookie) error` | 批量设置会话 Cookie |
| `DeleteCookie` | `(name string)` | 按名称删除 Cookie |
| `ClearCookies` | `()` | 清空全部 Cookie |
| `GetCookies` | `() []*http.Cookie` | 获取全部 Cookie 副本 |
| `GetCookie` | `(name string) *http.Cookie` | 按名称获取 Cookie 副本 |

对应接口方法定义在 `DomainClienter` 上，完整方法名为 `DomainClienter.SetCookie`、`DomainClienter.SetCookies`、`DomainClienter.DeleteCookie`、`DomainClienter.ClearCookies`、`DomainClienter.GetCookies`、`DomainClienter.GetCookie`；实现同样委托给 `SessionManager`。

## NewDomain

```go
func NewDomain(baseURL string, cfg Config) (DomainClienter, error)
```

创建域名作用域客户端。该客户端内置 `SessionManager`，会话 Cookie 由其独立存储与回放。传入 `Config` 值，或使用 `NewDomainDefault(baseURL)` 作为零参快捷方式。

```go
// 使用默认配置（或调用 NewDomainDefault 效果相同）
dc, err := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 使用自定义配置
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**参数说明：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `baseURL` | `string` | 基础 URL（必须包含 scheme 和 host） |
| `cfg` | `Config` | 配置值（推荐用 `DefaultConfig()` 或预设函数获取） |

**返回：** `DomainClienter` 接口（非具体类型 `*DomainClient`）。

**错误条件：**

| 条件 | 错误信息 |
|------|----------|
| `baseURL` 无法解析 | `invalid base URL: ...` |
| `baseURL` 缺少 scheme 或 host | `base URL must include scheme and host` |
| 配置校验失败（含 `SSRFExemptCIDRs` 非法 CIDR） | `invalid configuration: ...` |
| 底层客户端 / 会话创建失败 | `failed to create domain client: ...` / `failed to create session: ...` |

:::tip Cookie 会话由 SessionManager 维护
`NewDomain` 创建的 DomainClient 内置一个 `SessionManager`：请求前注入会话头与 Cookie，响应后回写 `Set-Cookie`。该会话存储独立于 `Connection.EnableCookies`；`NewDomain` 不修改 `cfg.Connection.EnableCookies`。
:::

:::tip 配置在构造时固化
与 `New()` 一致，`NewDomain` 对传入的 Config 做深拷贝，构造完成后再修改原 `cfg` 不影响该客户端。`DomainClient` 不提供运行时改配置的方法；超时等按请求控制请使用 [`WithTimeout`](../core/options#withtimeout) 等请求选项。
:::

## NewDomainDefault

```go
func NewDomainDefault(baseURL string) (DomainClienter, error)
```

便捷构造，等价于 `NewDomain(baseURL, DefaultConfig())`。

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

## HTTP 方法

所有方法接受相对路径或绝对 URL。便捷方法内部使用 `context.Background()`；需要超时或取消控制时改用 [`Request`](#request) 并显式传入 ctx：

```go
// 相对路径：自动拼接 baseURL
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// 绝对 URL：直接使用
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

带上下文的通用请求方法，支持超时和取消控制。`DomainClient` 通过实现此方法满足 `Client` 接口。

## URL 拼接规则详解

`buildURL` 方法负责将请求路径与 `baseURL` 拼接。规则如下：

```text
buildURL(pathStr):

  ① pathStr 为空 → 返回 baseURL
  ② pathStr 以 http:// 或 https:// 开头 → 绝对 URL，直接返回
  ③ 否则 → 相对路径拼接：
       a. 克隆缓存的 parsedURL（避免修改原始）
       b. 解析 pathStr 分离 path / query / fragment
       c. result.Path = path.Join(basePath, parsedPath)
       d. 尾斜杠保留：原路径以 / 结尾则拼接结果也以 / 结尾
       e. 路径穿越防护：结果必须在 base 路径作用域内
       f. 查询参数合并：base 查询参数 + path 查询参数
       g. fragment 透传
```

### 拼接示例

| 输入路径 | 拼接结果（baseURL = `https://api.example.com/v1`） |
|----------|------|
| `""` | `https://api.example.com/v1` |
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users/` | `https://api.example.com/v1/users/`（尾斜杠保留） |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `?page=2` | `https://api.example.com/v1?page=2`（仅查询参数，路径为空） |
| `search?q=go` | `https://api.example.com/v1/search?q=go` |
| `https://other.com/api` | `https://other.com/api`（绝对 URL 直接使用） |

若 baseURL 本身以 `/` 结尾（如 `https://api.example.com/v1/`）：相对路径经 `path.Join` 规范化拼接（`users` → `.../v1/users`）；请求路径为空或仅含查询参数时保留 base 的尾斜杠（`""` → `.../v1/`，`?page=2` → `.../v1/?page=2`）。

### 查询参数合并

当 `baseURL` 自带查询参数时，请求路径的查询参数会**追加**到其后：

```text
baseURL  = https://api.example.com/v1?lang=zh
path     = /users?page=1
拼接结果 = https://api.example.com/v1/users?lang=zh&page=1
```

### 路径穿越防护

`buildURL` 检查拼接后的路径是否在 base 路径作用域内，防止路径穿越攻击：

```text
baseURL = https://api.example.com/v1
path    = ../admin/delete       ← path.Join 清理后为 /admin/delete

检查：/admin/delete 是否在 /v1 作用域内？
结果：否 → 返回错误 "path escapes base URL scope"
```

:::warning 绝对 URL 识别
只有 `http://` 和 `https://` 开头的路径会被识别为绝对 URL（前缀比较大小写不敏感，`HTTP://host` 同样按绝对 URL 处理）。其他协议（如 `ftp://`）不会被识别为绝对路径，而会按相对路径拼接，请求因此失败。base 路径为空或 `/` 时不做作用域检查。
:::

## 会话自动管理

域名客户端的会话管理分为三个环节：

```text
请求生命周期中的会话管理：

  ① prepareOptions(fullURL)（发送前）
     从 SessionManager 读取会话头和 Cookie
     → 转为 RequestOption 注入到请求中（Cookie 按 RFC 6265 作用域回放）

  ② captureFromOptions()（发送前）
     从用户传入的 RequestOption 中提取 Cookie 和头
     → 存入 SessionManager（有则更新，无则跳过）

  ③ UpdateFromResult()（发送后）
     从响应中提取 Set-Cookie
     → 存入 SessionManager
```

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")

// 会话头：注入到每个后续请求
dc.SetHeader("Authorization", "Bearer token-abc")
dc.SetHeader("Accept-Language", "zh-CN")

// 登录后响应的 Set-Cookie 自动捕获
dc.Post("/login", httpc.WithJSON(loginData))
// 后续请求自动携带登录 Cookie

// 也可手动设置 Cookie
dc.SetCookie(&http.Cookie{Name: "session", Value: "xyz"})

// 查询会话状态
dc.GetCookie("session")  // → *http.Cookie 副本
dc.GetCookies()          // → []*http.Cookie 副本（已过期的条目不返回）
dc.GetHeaders()          // → map[string]string 副本

// 登出：删除单个 Cookie，或清空全部会话状态
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::warning 跨源请求不携带会话凭据
会话头与 Cookie 的作用域是 base origin（host:port，比较大小写不敏感）。当某次调用传入指向其他主机的绝对 URL 时，会话头与 Cookie **既不注入也不捕获**——base 域的凭据不会泄漏给第三方源。重定向同理：仅当最终响应仍落在 base origin 时，其 `Set-Cookie` 才回填会话。
:::

:::tip 线程安全
`SessionManager` 内部使用 `sync.RWMutex` 保护，`SetHeader`/`SetCookie`/`GetCookie` 等方法可安全并发调用。`prepareOptions` 采用读后写的非原子序列：会话状态设计为最终一致，并发请求会在 `prepareOptions` 时交错，但每个请求在 `prepareOptions` 时刻捕获到一致快照。
:::

## 选项执行与会话捕获

请求选项在 `DomainClient` 上**只执行一次**：捕获阶段不执行选项闭包，执行发生在 `client.Request` 阶段。

会话捕获由 `SessionManager` 内部完成，方式是**静态类型断言**：它按具体选项类型提取头与 Cookie，从不调用 `apply`。因此只有内置的命名选项类型会被识别——`WithHeader`、`WithHeaderMap`、`WithCookies`、`WithCookieMap`、`WithCookieString`；这些头与 Cookie 会持久化进会话，对后续请求持续生效。

```text
prepareSessionOptions(fullURL, options):
  ① managedOptions = prepareOptions(fullURL)  ← 读取会话状态（Cookie 按 fullURL 作用域回放）
  ② allOptions = managedOptions + options     ← 合并
  ③ captureFromOptions(options)              ← 静态断言取头/Cookie，不执行闭包
  ④ return allOptions → client.Request()     ← 唯一的执行点
```

::: warning 自定义选项里的头与 Cookie 不进会话
`RequestOptionFunc` 等自定义选项里调用的 `SetHeader`/`SetCookies` **不会被捕获**——静态断言识别不了它们。需要持久化会话状态时用 `dc.SetHeader`/`dc.SetCookie`（或 `SessionManager` 的对应方法）。

由于选项只执行一次，`WithOnRequest`/`WithOnResponse` 回调也只会触发一次。
:::

## Download 方法

```go
func (dc *DomainClient) Download(ctx context.Context, path string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

下载文件到 `cfg.FilePath`，`path` 相对于 `baseURL` 拼接。签名与包级 `Download`、`Client.Download` 一致：`Download` 是贯穿三者的唯一规范下载入口。`cfg` 不能为 nil，`cfg.FilePath` 必须设置（否则返回 `ErrEmptyFilePath`）。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := dc.Download(ctx, "/files/report.pdf", cfg)
```

下载的响应 Cookie 会自动捕获到会话中（经 `UpdateFromCookies`）。选项同样只执行一次；响应 Cookie 仅在最终 URL（重定向后）仍落在 base origin 时回填会话。

## 与 Client 接口的关系

`DomainClient` 通过编译时断言**同时实现**两个接口：

```go
var _ Client = (*DomainClient)(nil)           // 实现 Client 接口
var _ DomainClienter = (*DomainClient)(nil)   // 实现 DomainClienter 接口
```

```text
接口层级：
  Doer                                    ← 最小接口（仅 Request）
    └── Client                             ← + HTTP 方法 + Download + Close
          └── DomainClienter               ← + URL/Domain/Session + 会话头/Cookie 管理
                └── *DomainClient          ← 具体实现
```

`DomainClienter` 内嵌 `Client`，因此任何接受 `Client` 参数的函数也能接受 `DomainClienter`。`DomainClient` 因此可直接用于需要 `Client` 的位置，并额外提供会话管理能力。

## 完整 REST API 客户端封装示例

以下示例展示如何用 `DomainClient` 封装一个 GitHub API 客户端，自动管理认证头和分页查询参数。

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// GitHubClient 封装 GitHub REST API
type GitHubClient struct {
	dc httpc.DomainClienter
}

// NewGitHubClient 创建 GitHub API 客户端
func NewGitHubClient(token string) (*GitHubClient, error) {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second

	dc, err := httpc.NewDomain("https://api.github.com", cfg)
	if err != nil {
		return nil, err
	}

	// 设置会话级请求头
	if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
		return nil, fmt.Errorf("set auth header: %w", err)
	}
	if err := dc.SetHeader("Accept", "application/vnd.github+json"); err != nil {
		return nil, fmt.Errorf("set accept header: %w", err)
	}
	if err := dc.SetHeader("X-GitHub-Api-Version", "2022-11-28"); err != nil {
		return nil, fmt.Errorf("set api version: %w", err)
	}

	return &GitHubClient{dc: dc}, nil
}

// Close 释放资源
func (g *GitHubClient) Close() error { return g.dc.Close() }

// GetUser 获取用户信息（相对路径自动拼接 baseURL）
func (g *GitHubClient) GetUser(username string) (*httpc.Result, error) {
	return g.dc.Get(fmt.Sprintf("/users/%s", username))
}

// ListUserRepos 列出用户仓库（带分页参数）
func (g *GitHubClient) ListUserRepos(username string, page, perPage int) (*httpc.Result, error) {
	return g.dc.Get(fmt.Sprintf("/users/%s/repos?page=%d&per_page=%d", username, page, perPage))
}

func main() {
	client, err := NewGitHubClient("ghp_your_token_here")
	if err != nil {
		panic(err)
	}
	defer client.Close()

	// 每个请求自动携带 Authorization、Accept、X-GitHub-Api-Version 头
	result, err := client.GetUser("torvalds")
	if err != nil {
		panic(err)
	}
	fmt.Printf("状态码：%d\n", result.StatusCode())

	// 经 Unmarshal 解析 JSON 响应
	var user struct {
		Login string `json:"login"`
	}
	if err := result.Unmarshal(&user); err != nil {
		panic(err)
	}
	fmt.Printf("用户名: %s\n", user.Login)

	repos, err := client.ListUserRepos("torvalds", 1, 5)
	if err != nil {
		panic(err)
	}
	fmt.Printf("仓库列表状态码：%d\n", repos.StatusCode())
	// 输出示例：
	// 状态码：200
	// 用户名：torvalds
	// 仓库列表状态码：200
}
```

:::tip 接口返回值
`NewDomain` 和 `NewDomainDefault` 返回 `DomainClienter` 接口而非 `*DomainClient` 具体类型，方便在测试中用 mock 替换。需要访问具体类型时做类型断言即可。
:::

## 另见

- [会话管理](./session) — SessionManager 详细参考
- [域名客户端与会话](../../guides/domain-session) — 使用指南
- [接口定义](../types/interfaces) — Client、Doer、DomainClienter 接口定义
- [文件下载](./download) — DownloadConfig 与 DownloadResult 详情
