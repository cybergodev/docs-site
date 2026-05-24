---
title: "接口定义 - HTTPC"
description: "HTTPC 核心接口 API 参考：Client 全功能接口含七种 HTTP 方法与四种下载、Doer 最小执行接口、DomainClienter 域名客户端含会话管理、RetryPolicy 重试策略、RequestMutator/ResponseMutator 中间件接口与 Handler/MiddlewareFunc 定义。"
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
    DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
    DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // 生命周期
    Close() error
}
```

主客户端接口，通过 `New()` 创建。详见 [包函数](./functions)。

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

域名作用域客户端，自动管理 Cookie 和请求头。详见 [域名客户端](./domain-client) 和 [会话管理](./session)。

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
`ShouldRetry` 的 `resp` 参数类型 `ResponseReader` 是内部接口（位于 `internal/types` 包），外部代码无法直接引用，因此 `RetryPolicy` 仅可在同一模块内实现。大多数场景可通过 `RetryConfig` 配置和 `WithMaxRetries` 选项满足重试需求。如需自定义策略，请在项目内部包中实现 `RetryPolicy` 接口。
:::

以下示例展示 `RetryPolicy` 的实现模式。注意 `ResponseReader` 是内部类型 — 此代码仅能在 `httpc` 模块内部编译：

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

中间件中使用，提供请求的读写访问。由内部接口 `RequestReader` 和 `RequestWriter` 组合而成。

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

中间件中使用，提供响应的读写访问。由内部接口 `ResponseReader` 和 `ResponseWriter` 组合而成。

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

## 相关页面

| 类型 | 详细参考 |
|------|----------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](./result) |
| `SessionManager` 方法 | [会话管理](./session) |
| `DomainClient` 实现 | [域名客户端](./domain-client) |
| `DownloadConfig` / `DownloadResult` | [文件下载](./download) |
| `ClientError` / `ErrorType` / 错误变量 | [错误类型](./errors) |
| `FormData` / `FileData` / `BodyKind` | [常量与类型](./constants) |
