---
sidebar_label: "会话管理"
title: "会话管理 - CyberGo HTTPC | SessionManager"
description: "HTTPC SessionManager API 参考：NewSessionManager 创建、SessionConfig 配置、SetHeader 头管理、SetCookie 方法与 SetCookieSecurity 验证的完整用法。"
sidebar_position: 30
---

# 会话管理

`SessionManager` 提供线程安全的 Cookie 和请求头存储，由 DomainClient 内部嵌入使用。其存储基于 `sync.RWMutex`：所有读取操作使用读锁，写入操作使用写锁，因此可在高并发场景下跨请求共享会话状态。

:::tip nil 接收者安全
所有方法对 nil 接收者安全，行为分两类：

- 返回 error 的方法（SetHeader/SetHeaders/SetCookie/SetCookies）返回 `"session manager is nil"`。
- 其余方法静默返回零值：GetHeaders/GetCookies/GetCookie 返回 nil；SetCookieSecurity/Delete*/Clear*/UpdateFrom* 直接返回。
:::

:::tip 何时需要直接使用 SessionManager
`NewDomain` 创建的 DomainClient 已自动嵌入一个 SessionManager。仅在以下场景需要手动创建 SessionManager：

- 在多个 DomainClient 之间共享会话。
- 运行时切换 Cookie 安全策略。
- 从响应中批量提取 Cookie。
:::

## SessionConfig

```go
type SessionConfig struct {
    // CookieSecurity 配置 Cookie 安全验证。
    // nil 表示不进行 Cookie 安全验证。
    CookieSecurity *CookieSecurityConfig
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `CookieSecurity` | `*CookieSecurityConfig` | Cookie 安全验证配置，nil 表示不验证 |

```go
func DefaultSessionConfig() SessionConfig
```

返回默认配置（不进行 Cookie 安全验证）。使用方式见下方 [NewSessionManager](#newsessionmanager)。

## NewSessionManager

```go
func NewSessionManager(cfg SessionConfig) (*SessionManager, error)
```

创建会话管理器。传入 `SessionConfig` 值，或使用 `NewSessionManagerDefault()` 作为零参快捷方式。当前实现始终返回 nil error；error 返回值保留用于未来的配置校验扩展。

```go
// 使用默认配置
sm, err := httpc.NewSessionManagerDefault()

// 带配置（启用严格 Cookie 安全验证）
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
sm, err := httpc.NewSessionManager(cfg)
```

### NewSessionManager vs NewSessionManagerDefault

| 构造函数 | 参数 | 适用场景 |
|----------|------|----------|
| `NewSessionManager(cfg)` | 显式 SessionConfig | 需要自定义 CookieSecurity 策略 |
| `NewSessionManagerDefault()` | 无 | 默认配置（无 Cookie 安全验证） |

`NewSessionManagerDefault()` 等价于 `NewSessionManager(DefaultSessionConfig())`，与主客户端的 `NewDefault()` 设计对称。

## NewSessionManagerDefault

```go
func NewSessionManagerDefault() (*SessionManager, error)
```

便捷构造，等价于 `NewSessionManager(DefaultSessionConfig())`。

```go
sm, err := httpc.NewSessionManagerDefault()
```

## 头管理

SessionManager 通过以下方法维护跨请求的请求头。所有方法均为线程安全，写入操作（SetHeader/SetHeaders/DeleteHeader/ClearHeaders）获取写锁，读取操作（GetHeaders）获取读锁。

### SetHeader

```go
func (s *SessionManager) SetHeader(key, value string) error
```

添加或更新单个会话头。所有后续请求自动携带。调用前通过 `validation.ValidateHeaderKeyValue` 校验键值合法性（拦截控制字符、CRLF 注入等），无效时返回包装后的错误。nil 接收者返回 `"session manager is nil"`。

```go
err := sm.SetHeader("Authorization", "Bearer "+token)
if err != nil {
    log.Fatalf("设置请求头失败: %v", err)
}
```

### SetHeaders

```go
func (s *SessionManager) SetHeaders(headers map[string]string) error
```

批量添加或更新会话头。先在锁外逐项校验（任一无效即整批拒绝），再在锁内通过 `maps.Copy` 合并。原子语义：要么全部成功，要么全部不变。

```go
err := sm.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Custom":      "value",
})
```

### DeleteHeader

```go
func (s *SessionManager) DeleteHeader(key string)
```

按 key 删除指定会话头。key 不存在时静默无操作。nil 接收者安全（直接返回）。

### ClearHeaders

```go
func (s *SessionManager) ClearHeaders()
```

清空所有会话头，重新初始化为空 map。

### GetHeaders

```go
func (s *SessionManager) GetHeaders() map[string]string
```

返回所有会话头的**深拷贝**副本（新分配 map + 值拷贝），调用方修改副本不影响内部状态。空会话返回空 map（非 nil）。

### 头管理方法一览

| 方法 | 签名 | 锁 | 说明 |
|------|------|----|------|
| `SetHeader` | `(key, value string) error` | 写锁 | 单个设置，含校验 |
| `SetHeaders` | `(headers map[string]string) error` | 写锁 | 批量设置，原子校验 |
| `DeleteHeader` | `(key string)` | 写锁 | 按 key 删除 |
| `ClearHeaders` | `()` | 写锁 | 清空全部 |
| `GetHeaders` | `() map[string]string` | 读锁 | 返回深拷贝副本 |

完整方法名为 `SessionManager.SetHeader`、`SessionManager.SetHeaders`、`SessionManager.DeleteHeader`、`SessionManager.ClearHeaders`、`SessionManager.GetHeaders`。

## Cookie 管理

SessionManager 通过以下方法维护跨请求的 Cookie。所有写入操作均通过 `validation.ValidateCookie` 校验合法性；若配置了 `CookieSecurity`，还会额外校验安全属性（Secure/HttpOnly/SameSite）。

Cookie 字符串的底层解析遵循 RFC 6265：仅空格与水平制表符被视为合法的可选空白（OWS）。解析按索引裁剪实现零额外字符串分配，结果切片独立分配、不与内部对象池共享。

[`WithCookieString`](../core/options#withcookiestring) 选项与请求 Cookie 头的提取共用同一解析器。

### SetCookie

```go
func (s *SessionManager) SetCookie(cookie *http.Cookie) error
```

添加或更新单个会话 Cookie。校验分三步：① nil cookie 检查；② 基础格式校验；③ 若配置了 CookieSecurity，执行 `validateCookieSecurity`（在写锁内执行以保证线程安全）。任一校验失败返回包装错误，且不修改存储。

```go
err := sm.SetCookie(&http.Cookie{
    Name:     "session",
    Value:    "abc123",
    Secure:   true,
    HttpOnly: true,
    SameSite: http.SameSiteStrictMode,
})
if err != nil {
    log.Fatalf("设置 Cookie 失败: %v", err)
}
```

### SetCookies

```go
func (s *SessionManager) SetCookies(cookies []*http.Cookie) error
```

批量设置 Cookie，采用**两阶段原子写入**：

1. 锁外预校验所有 cookie 的基础合法性（nil 检查 + ValidateCookie）。
2. 锁内逐项执行安全校验；任一失败立即返回错误，已校验的也不会写入。
3. 全部通过后才统一存储。

批量操作因此具备原子性，不会出现「部分写入」的中间状态。

### DeleteCookie

```go
func (s *SessionManager) DeleteCookie(name string)
```

按名称删除 Cookie。name 不存在时静默无操作。

### ClearCookies

```go
func (s *SessionManager) ClearCookies()
```

清空所有 Cookie，重新初始化为空 map。

### GetCookies

```go
func (s *SessionManager) GetCookies() []*http.Cookie
```

返回所有 Cookie 的**深拷贝**副本。实现采用连续 backing array 优化：预分配一个长度为 N 的 `[]http.Cookie` 连续数组，所有 Cookie 结构体在其中连续排列，返回的 `[]*http.Cookie` 指向该数组。

N 次独立堆分配因此降为 2 次（backing array + 指针切片）。空会话返回 nil。

### GetCookie

```go
func (s *SessionManager) GetCookie(name string) *http.Cookie
```

按名称获取 Cookie 的**深拷贝**副本，不存在返回 nil。

### Cookie 管理方法一览

| 方法 | 签名 | 锁 | 校验 |
|------|------|----|------|
| `SetCookie` | `(cookie *http.Cookie) error` | 写锁 | ValidateCookie + 可选 CookieSecurity |
| `SetCookies` | `(cookies []*http.Cookie) error` | 写锁 | 两阶段原子校验 |
| `DeleteCookie` | `(name string)` | 写锁 | 无 |
| `ClearCookies` | `()` | 写锁 | 无 |
| `GetCookies` | `() []*http.Cookie` | 读锁 | 无（返回深拷贝） |
| `GetCookie` | `(name string) *http.Cookie` | 读锁 | 无（返回深拷贝） |

完整方法名为 `SessionManager.SetCookie`、`SessionManager.SetCookies`、`SessionManager.DeleteCookie`、`SessionManager.ClearCookies`、`SessionManager.GetCookies`、`SessionManager.GetCookie`。

## Cookie 安全

### SetCookieSecurity

```go
func (s *SessionManager) SetCookieSecurity(config *CookieSecurityConfig)
```

运行时更新 Cookie 安全验证配置，影响**后续所有** SetCookie/SetCookies/UpdateFromResult/UpdateFromCookies 调用。传 nil 可禁用安全验证。nil 接收者安全。

这是切换安全策略的唯一入口：无需重建 SessionManager，即可在运行时从宽松切换到严格策略，或反向切换。

```go
// 运行时从宽松切换到严格
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())

// 禁用安全验证
sm.SetCookieSecurity(nil)
```

### CookieSecurityConfig 字段

```go
type CookieSecurityConfig struct {
    RequireSecure                bool    // 要求 Secure 属性（仅 HTTPS 传输）
    RequireHttpOnly              bool    // 要求 HttpOnly 属性（防 XSS）
    RequireSameSite              string  // 要求 SameSite 值："Strict"/"Lax"/"None"/""
    AllowSameSiteNone            bool    // 是否允许 SameSite=None
    RequireSecureForSameSiteNone bool    // SameSite=None 时强制要求 Secure
}
```

可用工厂函数：

| 工厂函数 | 说明 |
|----------|------|
| `DefaultCookieSecurityConfig()` | 宽松默认（允许非 HTTPS、允许 JS 访问、允许 SameSite=None） |
| `StrictCookieSecurityConfig()` | 严格策略（要求 Secure + HttpOnly + SameSite=Strict） |

### UpdateFromResult

```go
func (s *SessionManager) UpdateFromResult(result *Result)
```

`SessionManager.UpdateFromResult` 从请求结果（`*Result`）的 Response.Cookies 中提取 Cookie 并存入会话。若配置了 CookieSecurity，不安全的 Cookie 会被**静默跳过**（不返回错误，直接忽略），仅存储通过校验的 Cookie。

result 为 nil、Response 为 nil 或 Cookies 为空时直接返回。DomainClient 的 `Request` 方法在每次请求后自动调用此方法。

### UpdateFromCookies

```go
func (s *SessionManager) UpdateFromCookies(cookies []*http.Cookie)
```

`SessionManager.UpdateFromCookies` 从 Cookie 切片中更新会话 Cookie，语义与 `SessionManager.UpdateFromResult` 一致：不安全的 Cookie 静默跳过。DomainClient 的 Download 方法通过此方法捕获下载响应中的 Cookie。

## 内部机制

### captureFromOptions

```go
func (s *SessionManager) captureFromOptions(options []RequestOption)
```

DomainClient 的 `prepareSessionOptions` 内部调用此方法，从调用方提供的 RequestOptions 中提取 Cookie 和 Header 存入会话。实现细节：

1. 使用对象池中的临时 `engine.Request`（`acquireMiddlewareRequest`/`releaseMiddlewareRequest`）减少热路径分配。
2. 逐个应用 option 到临时请求。**安全措施**：每个 option 应用前后清除 OnRequest/OnResponse 回调，防止 `WithOnRequest`/`WithOnResponse` 的闭包在捕获过程中累积触发副作用。
3. 提取临时请求上的 Cookie 和 Header，经校验后存入会话。
4. 只提取 Cookie 和 Header；其他数据（query params、body、callbacks）被丢弃。

:::warning RequestOptions 执行两次
DomainClient 的 Request/Download 会将 RequestOptions **执行两次**：一次用于会话捕获（captureFromOptions），一次用于实际请求。因此**避免使用有副作用的 option**（如计数器、nonce 生成、随机数）。

需要副作用时，直接使用底层 Client。
:::

### prepareOptions

```go
func (s *SessionManager) prepareOptions() []RequestOption
```

DomainClient 每次请求前调用此方法，将当前会话状态注入为 RequestOptions：

- **Cookie 批量注入**：将所有会话 Cookie 打包到一个闭包 option 中（`r.SetCookies(append(existing, cookies...))`），避免 N 次闭包分配。
- **Header map 注入**：通过 `WithHeaderMap` 一次性注入深拷贝的 header map。

会话为空（无 Cookie 且无 Header）时返回 nil，无额外开销。

### 线程安全模型

`SessionManager` 通过单个 `sync.RWMutex` 保护所有状态：

| 操作类型 | 锁级别 | 方法 |
|----------|--------|------|
| 读取（GetHeaders/GetCookies/GetCookie/prepareOptions） | RLock | 可并发 |
| 写入（Set*/Delete*/Clear*/UpdateFrom*/captureFromOptions/SetCookieSecurity） | Lock | 互斥 |

DomainClient 的 `prepareSessionOptions` 采用「先读后写」的非原子序列：先读快照（prepareOptions），再写捕获（captureFromOptions）。并发请求会在这两步之间交错。

该设计为**最终一致性**：每个请求在 `prepareOptions()` 时刻捕获一致快照，瞬时竞态不影响单次请求的正确性。

## 完整示例：登录会话维持

以下示例展示 DomainClient 如何自动管理登录会话：登录后 Cookie 自动维持，直至登出。

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	ctx := context.Background()

	// 创建 DomainClient，自动启用 Cookie 并嵌入 SessionManager
	dc, err := httpc.NewDomain("https://httpbin.org", httpc.DefaultConfig())
	if err != nil {
		log.Fatalf("创建客户端失败: %v", err)
	}
	defer func() { _ = dc.Close() }()

	// 手动设置会话头（后续所有请求自动携带）
	sm := dc.Session()
	if err := sm.SetHeader("Accept", "application/json"); err != nil {
		log.Fatalf("设置请求头失败: %v", err)
	}
	if err := sm.SetCookie(&http.Cookie{
		Name:  "session",
		Value: "initial",
	}); err != nil {
		log.Fatalf("设置 Cookie 失败: %v", err)
	}

	// 登录：响应的 Set-Cookie 自动由 UpdateFromResult 捕获到会话
	loginCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	_, err = dc.Request(loginCtx, "POST", "/cookies/set?token=abc123")
	cancel()
	if err != nil {
		log.Fatalf("登录失败: %v", err)
	}

	// 后续请求自动携带会话中的 Cookie
	verifyCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	result, err := dc.Request(verifyCtx, "GET", "/cookies")
	cancel()
	if err != nil {
		log.Fatalf("验证失败: %v", err)
	}

	fmt.Println("会话 Cookie 维持成功，响应：")
	fmt.Println(result.String())

	// 登出：清除会话
	sm.ClearCookies()
	sm.ClearHeaders()

	fmt.Println("已登出，会话已清除")
}
```

:::tip 手动管理 SessionManager
也可以独立创建 SessionManager，并在多个 DomainClient 之间共享。DomainClient 的自动管理已覆盖常规用法：每次请求后自动捕获响应 Cookie，请求前自动注入会话状态。
:::

## 另见

- [域名客户端](./domain-client) - DomainClient 参考
- [域名客户端与会话](../../guides/domain-session) - 使用指南
- [接口定义](../types/interfaces) - DomainClienter 接口参考
- [常量与类型](../types/constants) - CookieSecurityConfig 字段参考
