---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo HTTPC | 核心接口"
description: "HTTPC 核心接口 API 参考：Client 全功能接口、Doer 最小执行接口、DomainClienter 域名客户端、RetryPolicy 重试策略与 RequestMutator/ResponseMutator 中间件接口定义。"
sidebar_position: 1
---

# 接口定义

## Client

```go
type Client interface {
    Doer

    // HTTP 方法
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // 文件下载
    Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // 生命周期
    Close() error
}
```

主客户端接口，通过 `New()` 创建。详见 [包级函数与客户端方法](../core/functions)。

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

最小接口，仅包含核心 `Request` 方法。适合自定义实现。

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // 自定义实现
    return nil, nil
}
```

## DomainClienter

```go
type DomainClienter interface {
    Client

    // URL 访问
    URL() string
    Domain() string

    // 会话头管理
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // 会话 Cookie 管理
    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    // 会话访问
    Session() *SessionManager
}
```

域名作用域客户端，自动管理 Cookie 和请求头。详见 [域名客户端](../client-config/domain-client) 和 [会话管理](../client-config/session)。

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

自定义重试策略接口。

| 方法 | 说明 |
|------|------|
| `ShouldRetry(resp, err, attempt)` | 判断是否重试，`attempt` 从 0 开始 |
| `GetDelay(attempt)` | 返回下次重试前的等待时间 |
| `MaxRetries()` | 返回最大重试次数 |

:::warning 内部类型限制
ShouldRetry 的 `resp` 参数类型 ResponseReader 是内部接口（位于 `internal/types` 包），外部代码无法直接引用，因此 `RetryPolicy` 仅可在同一模块内实现。大多数场景可通过 `RetryConfig` 配置和 `WithMaxRetries` 选项满足重试需求。如需自定义策略，请在项目内部包中实现 `RetryPolicy` 接口。
:::

以下示例展示 `RetryPolicy` 的实现模式。注意 ResponseReader 是内部类型 — 此代码仅能在 `httpc` 模块内部编译：

```go
// 注意：ResponseReader 是内部类型（internal/types 包）。
// 此代码无法在 httpc 模块外部编译。
// 大多数用户应通过 RetryConfig 和 WithMaxRetries 配置重试。

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxRetries {
        return false
    }
    if err != nil {
        return true
    }
    return resp.StatusCode() >= 500
}

func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(1<<attempt)
}

func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxRetries
}
```

## 核心类型

### RequestMutator

```go
type RequestMutator interface {
    // 读取方法
    Method() string
    URL() string
    Headers() map[string]string
    QueryParams() map[string]any
    Body() any
    Timeout() time.Duration
    MaxRetries() int
    Context() context.Context
    Cookies() []http.Cookie
    FollowRedirects() *bool
    MaxRedirects() *int
    StreamBody() bool

    // 写入方法
    SetMethod(string)
    SetURL(string)
    SetHeaders(map[string]string)
    SetHeader(key, value string)
    SetQueryParams(map[string]any)
    SetBody(any)
    SetTimeout(time.Duration)
    SetMaxRetries(int)
    SetContext(context.Context)
    SetCookies([]http.Cookie)
    SetFollowRedirects(*bool)
    SetMaxRedirects(*int)
    SetStreamBody(bool)
}
```

中间件中使用，提供请求的读写访问。由内部接口 RequestReader 和 RequestWriter 组合而成。完整方法契约与读写示例见 [请求与响应变更器](../handler/mutators)。

### ResponseMutator

```go
type ResponseMutator interface {
    // 读取方法
    StatusCode() int
    Status() string
    Proto() string
    Headers() http.Header
    Body() string
    RawBody() []byte
    ContentLength() int64
    Duration() time.Duration
    Attempts() int
    Cookies() []*http.Cookie
    RedirectChain() []string
    RedirectCount() int
    RequestHeaders() http.Header
    RequestURL() string
    RequestMethod() string

    // 写入方法
    SetStatusCode(int)
    SetStatus(string)
    SetProto(string)
    SetHeaders(http.Header)
    SetBody(string)
    SetRawBody([]byte)
    SetContentLength(int64)
    SetDuration(time.Duration)
    SetAttempts(int)
    SetCookies([]*http.Cookie)
    SetRedirectChain([]string)
    SetRedirectCount(int)
    SetRequestHeaders(http.Header)
    SetRequestURL(string)
    SetRequestMethod(string)
    SetHeader(key string, values ...string)
}
```

中间件中使用，提供响应的读写访问。由内部接口 ResponseReader 和 ResponseWriter 组合而成。完整方法契约见 [请求与响应变更器](../handler/mutators)。

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

请求处理函数签名。

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

中间件函数签名，接收下一个 Handler 并返回包装后的 Handler。

## 证书锁定

证书锁定（Certificate Pinning）在 TLS 握手阶段校验服务器证书是否匹配预先固定的公钥/证书。即使受信任的 CA 被攻破，握手也会被拒绝，从而防御中间人攻击。

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

证书锁定器接口。通过下方构造函数创建后赋值给 `SecurityConfig.CertificatePinner` 字段（经 `Config.Security` 访问）：

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 当前密钥
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 备用密钥（轮换）
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
Pinner 实现并发安全，可被同一 `Config` 创建的多个客户端共享（深拷贝时按引用传递，不复制）。高级用户也可直接实现该接口以支持自定义锁定策略（如固定完整证书而非公钥）。
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

从一个或多个 base64 编码的 SHA-256 哈希值（针对 DER 编码的 SubjectPublicKeyInfo/SPKI）创建证书锁定器。这是最常用的锁定格式（HPKP 采用），也是推荐方案。

传入多个哈希可支持密钥轮换——只要对端公钥匹配**任意一个**固定哈希，握手即成功。

用以下命令从证书生成哈希：

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

未提供有效哈希，或哈希非合法 base64 时返回错误。

### NewPublicKeyPinner

```go
func NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)
```

从一个或多个 DER 编码的 PKIX 公钥（由 `x509.MarshalPKIXPublicKey` 返回）创建证书锁定器。内部对每个公钥计算 SHA-256 哈希；当你已持有原始公钥字节时，这是比 `NewSPKIHashPinner` 更便捷的选择。

未提供有效公钥时返回错误。

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

将多个锁定器组合为一个。只要**任意一个**被包装的锁定器接受该证书，证书即被接受。用于同时支持多种锁定策略，或组合用不同构造函数构建的轮换密钥。

::: warning 零参行为：放行所有证书
不传参数时返回一个空链，**空链不校验任何证书**（校验逻辑直接返回 `nil`）——即**放行所有证书，等价于未启用证书锁定**（源码 `internal/security/certpin.go` 注释为 "No pinners means no pinning"）。这与「无 pinner 即拒绝」的直觉相反，请始终至少传入一个有效 pinner，勿依赖零参行为。
:::

:::tip 深入阅读
证书锁定的完整指南（哈希生成、密钥轮换策略、生产部署）见 [TLS 证书锁定](../../security/tls-certpin)。
:::

## 相关页面

| 类型 | 详细参考 |
|------|----------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](../core/result) |
| `SessionManager` 方法 | [会话管理](../client-config/session) |
| `DomainClient` 实现 | [域名客户端](../client-config/domain-client) |
| `DownloadConfig` / `DownloadResult` | [文件下载](../client-config/download) |
| `ClientError` / `ErrorType` / 错误变量 | [错误类型](./errors) |
| `FormData` / `FileData` / `BodyKind` | [常量与类型](./constants) |
