---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo HTTPC | 核心接口"
description: "HTTPC 核心接口 API 参考：Client 全功能接口、Doer 最小执行接口、DomainClienter 域名客户端、RetryPolicy 重试策略与 RequestMutator/ResponseMutator 中间件接口定义。"
sidebar_position: 10
---

# 接口定义

## 接口总览

| 接口/类型 | 类别 | 实现方 | 扩展点用途 |
|-----------|------|--------|-----------|
| `Client` | 主客户端接口 | `clientImpl`（`New`/`NewDefault` 返回） | 作为消费方的参数类型约束 |
| `Doer` | 最小执行接口 | `clientImpl`；也可由用户自行实现 | mock 测试、装饰器包装 |
| `DomainClienter` | 域名客户端接口 | `DomainClient`（`NewDomain`/`NewDomainDefault` 返回） | 域名作用域的会话管理 |
| `RequestMutator` | 请求变更器接口 | `*engine.Request`（内部） | 中间件读写请求 |
| `ResponseMutator` | 响应变更器接口 | `*engine.Response`（内部） | 中间件读写响应 |
| `Handler` | 请求处理函数类型 | `finalHandler`、中间件包装产物 | 自定义中间件的核心签名 |
| `MiddlewareFunc` | 中间件函数类型 | 内置 7 个中间件工厂、用户自定义 | 拦截/改写请求与响应 |
| `RetryPolicy` | 重试策略接口 | 用户实现（任意外部包均可，见下方说明） | 自定义重试决策 |
| `CertificatePinner` | 证书锁定接口 | `NewSPKIHashPinner` 等构造器、用户自定义 | 自定义锁定策略 |
| `RequestOption` | 请求选项函数类型 | `WithXxx` 工厂函数 | 逐请求配置 |

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

最小接口，仅包含核心方法 `Doer.Request`（即上面的 `Request`）。适合自定义实现——任何满足此单一方法的类型都可作为 `Doer` 注入接受它的代码。

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

三个方法对应的接口定义为 `RetryPolicy.ShouldRetry`、`RetryPolicy.GetDelay` 与 `RetryPolicy.MaxRetries`。

:::tip 类型已公开导出
`ShouldRetry` 的 `resp` 参数类型 `ResponseReader` 已由 `httpc` 包通过公开类型别名导出（`httpc.ResponseReader`，定义见 `types.go`），外部包可直接引用。自定义 `RetryPolicy` 因此可在任何业务包中实现，不限于 httpc 模块内部。多数场景仍可通过 `RetryConfig` 配置和 `WithMaxRetries` 选项满足重试需求。
:::

以下示例展示 `RetryPolicy` 的实现模式，可在任何导入 `httpc` 的业务包中直接编译使用：

```go
// ResponseReader 已由 httpc 包公开导出（httpc.ResponseReader）。
// 本示例可在任何导入 github.com/cybergodev/httpc 的业务包中直接编译。

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp httpc.ResponseReader, err error, attempt int) bool {
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

中间件中使用，提供请求的读写访问。由 `RequestReader` 与 `RequestWriter` 两个分体接口组合而成，两者均已由 `httpc` 包作为公开类型别名导出（`httpc.RequestReader` / `httpc.RequestWriter`）。完整方法契约与读写示例见 [请求与响应变更器](../handler/mutators)。

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

中间件中使用，提供响应的读写访问。由 `ResponseReader` 与 `ResponseWriter` 两个分体接口组合而成，两者均已由 `httpc` 包作为公开类型别名导出（`httpc.ResponseReader` / `httpc.ResponseWriter`）。完整方法契约见 [请求与响应变更器](../handler/mutators)。

### 读写分体接口：RequestReader / RequestWriter / ResponseReader / ResponseWriter

`RequestMutator` 与 `ResponseMutator` 各自由一对读写分体接口组合而成：`RequestMutator = RequestReader + RequestWriter`，`ResponseMutator = ResponseReader + ResponseWriter`。四个接口的方法集定义在 `internal/types/interfaces.go`，`httpc` 包在 `types.go` 中将它们全部以公开类型别名导出，外部包可直接引用（如 `httpc.ResponseReader`）。

四个接口是中间件与重试策略的底层读写面：只需检视不需修改时声明 `*Reader`，只需修改不需检视时声明 `*Writer`——`RetryPolicy.ShouldRetry` 的 `resp` 参数即取只读的 `ResponseReader`。日常开发使用组合接口 `RequestMutator` / `ResponseMutator` 即可；方法契约的分组说明与读写示例见 [请求与响应变更器](../handler/mutators)。

#### RequestReader

只读访问请求数据：

| 方法 | 签名 | 说明 |
|------|------|------|
| `Method` | `Method() string` | HTTP 方法 |
| `URL` | `URL() string` | 请求 URL |
| `Headers` | `Headers() map[string]string` | 全部请求头（键→单值） |
| `QueryParams` | `QueryParams() map[string]any` | 查询参数 |
| `Body` | `Body() any` | 请求体 |
| `Timeout` | `Timeout() time.Duration` | 请求超时 |
| `MaxRetries` | `MaxRetries() int` | 最大重试次数 |
| `Context` | `Context() context.Context` | 请求上下文 |
| `Cookies` | `Cookies() []http.Cookie` | 请求 Cookie |
| `FollowRedirects` | `FollowRedirects() *bool` | 是否跟随重定向（nil 表示用默认值） |
| `MaxRedirects` | `MaxRedirects() *int` | 最大重定向次数（nil 表示用默认值） |
| `StreamBody` | `StreamBody() bool` | 是否流式传输请求体 |

#### RequestWriter

只写访问请求数据，与 `RequestReader` 的读方法一一对应：

| 方法 | 签名 | 说明 |
|------|------|------|
| `SetMethod` | `SetMethod(string)` | 设置 HTTP 方法 |
| `SetURL` | `SetURL(string)` | 设置 URL |
| `SetHeaders` | `SetHeaders(map[string]string)` | 设置全部请求头（整体替换） |
| `SetHeader` | `SetHeader(key, value string)` | 设置单个请求头（增/改，键名规范化） |
| `SetQueryParams` | `SetQueryParams(map[string]any)` | 设置查询参数 |
| `SetBody` | `SetBody(any)` | 设置请求体 |
| `SetTimeout` | `SetTimeout(time.Duration)` | 设置超时 |
| `SetMaxRetries` | `SetMaxRetries(int)` | 设置最大重试次数 |
| `SetContext` | `SetContext(context.Context)` | 设置上下文 |
| `SetCookies` | `SetCookies([]http.Cookie)` | 设置 Cookie |
| `SetFollowRedirects` | `SetFollowRedirects(*bool)` | 设置是否跟随重定向 |
| `SetMaxRedirects` | `SetMaxRedirects(*int)` | 设置最大重定向次数 |
| `SetStreamBody` | `SetStreamBody(bool)` | 设置是否流式传输 |

#### ResponseReader

只读访问响应数据，也是 `RetryPolicy.ShouldRetry` 的参数类型：

| 方法 | 签名 | 说明 |
|------|------|------|
| `StatusCode` | `StatusCode() int` | 状态码 |
| `Status` | `Status() string` | 状态文本（如 `"200 OK"`） |
| `Proto` | `Proto() string` | 协议版本（如 `"HTTP/1.1"`） |
| `Headers` | `Headers() http.Header` | 响应头 |
| `Body` | `Body() string` | 响应体（字符串） |
| `RawBody` | `RawBody() []byte` | 响应体（字节） |
| `ContentLength` | `ContentLength() int64` | 内容长度 |
| `Duration` | `Duration() time.Duration` | 请求耗时 |
| `Attempts` | `Attempts() int` | 尝试次数（含重试） |
| `Cookies` | `Cookies() []*http.Cookie` | 响应 Cookie |
| `RedirectChain` | `RedirectChain() []string` | 重定向链（每跳的 URL） |
| `RedirectCount` | `RedirectCount() int` | 重定向次数 |
| `RequestHeaders` | `RequestHeaders() http.Header` | 实际发送的请求头 |
| `RequestURL` | `RequestURL() string` | 实际请求 URL（含重定向后的最终 URL） |
| `RequestMethod` | `RequestMethod() string` | 请求方法 |

#### ResponseWriter

只写访问响应数据：

| 方法 | 签名 | 说明 |
|------|------|------|
| `SetStatusCode` | `SetStatusCode(int)` | 设置状态码 |
| `SetStatus` | `SetStatus(string)` | 设置状态文本 |
| `SetProto` | `SetProto(string)` | 设置协议版本 |
| `SetHeaders` | `SetHeaders(http.Header)` | 设置响应头（整体替换） |
| `SetBody` | `SetBody(string)` | 设置响应体 |
| `SetRawBody` | `SetRawBody([]byte)` | 设置响应体（字节） |
| `SetContentLength` | `SetContentLength(int64)` | 设置内容长度 |
| `SetDuration` | `SetDuration(time.Duration)` | 设置耗时 |
| `SetAttempts` | `SetAttempts(int)` | 设置尝试次数 |
| `SetCookies` | `SetCookies([]*http.Cookie)` | 设置 Cookie |
| `SetRedirectChain` | `SetRedirectChain([]string)` | 设置重定向链 |
| `SetRedirectCount` | `SetRedirectCount(int)` | 设置重定向次数 |
| `SetRequestHeaders` | `SetRequestHeaders(http.Header)` | 设置请求头 |
| `SetRequestURL` | `SetRequestURL(string)` | 设置请求 URL |
| `SetRequestMethod` | `SetRequestMethod(string)` | 设置请求方法 |
| `SetHeader` | `SetHeader(key string, values ...string)` | 设置单个响应头（增/改） |

:::tip ResponseWriter 的 SetHeader 不规范化键名
`ResponseWriter.SetHeader` 的键名**按原样存储、不做规范化**（与请求侧 `RequestWriter.SetHeader` 不同）：写入 `content-type` 与服务端发来的规范 `Content-Type` 会成为两个独立条目。替换已有响应头时，请传入 `http.CanonicalMIMEHeaderKey` 拼写。
:::

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

请求处理函数签名。

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

中间件函数签名，接收下一个 Handler 并返回包装后的 Handler。`Handler`/`MiddlewareFunc` 均为内部 `types` 包同名类型的别名（`types.go`），管线组装与自定义规范见 [Handler 管线](../handler/handler-chain)。

### RequestOption

```go
type RequestOption = engine.RequestOption
```

请求选项函数类型，是内部 `engine.RequestOption`（底层为 `func(*engine.Request) error`）的类型别名（`types.go`）。用户不直接构造该函数，而是使用 `WithHeader`、`WithJSON`、`WithOnRequest` 等 `WithXxx` 工厂。全部选项的逐项参考见 [请求选项](../core/options)。

## 证书锁定

证书锁定（Certificate Pinning）在 TLS 握手阶段校验服务器证书是否匹配预先固定的公钥/证书。即使受信任的 CA 被攻破，握手也会被拒绝，从而防御中间人攻击。

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

证书锁定器接口，是内部 `security.CertificatePinner` 的类型别名。方法集：

<!-- check-code: skip -->
```go
type CertificatePinner interface {
    // Pin 返回锁定值的字符串表示，用于日志与调试
    Pin() string

    // VerifyPeerCertificate 校验对端证书链是否匹配锁定值。
    // rawCerts 为 ASN.1 DER 编码的证书；verifiedChains 为已验证的证书链
    // （若常规验证被跳过则可能为 nil）
    VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error
}
```

`VerifyPeerCertificate` 的签名与 `crypto/tls.Config.VerifyPeerCertificate` 回调一致，自定义实现可直接接入 TLS 握手流程。

| 方法 | 签名 | 说明 |
|------|------|------|
| `Pin` | `Pin() string` | 返回锁定值的字符串表示，用于日志与调试（`CertificatePinner.Pin`） |
| `VerifyPeerCertificate` | `VerifyPeerCertificate(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error` | 校验对端证书链是否匹配锁定值（`CertificatePinner.VerifyPeerCertificate`） |

通过下方构造函数创建后赋值给 `SecurityConfig.CertificatePinner` 字段（经 `Config.Security` 访问）：

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
