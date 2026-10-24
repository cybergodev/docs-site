---
sidebar_label: "错误类型"
title: "错误类型 - CyberGo HTTPC | ClientError 详解"
description: "HTTPC 错误类型 API 参考：ClientError 结构体字段与 Code、IsRetryable、Unwrap 等方法、ErrorTypeNetwork 等十二种错误分类枚举、ErrNilConfig 等十七个哨兵错误变量，以及 errors.Is/errors.As 的匹配与分类示例。"
sidebar_position: 30
---

# 错误类型

HTTPC 采用两层错误模型：底层是标准 `error` 接口，上层是分类的 `ClientError` 结构体。网络层的请求失败由 `classifyError` 映射为携带上下文的 `ClientError`，提供错误类型、可重试判断和结构化字段。

HTTP 层错误（4xx/5xx）不返回 error，通过 `Result.StatusCode()` 检查。

## ClientError

```go
type ClientError = engine.ClientError
```

分类的 HTTP 客户端错误，通过 `errors.As` 提取。它是内部 `engine.ClientError` 的类型别名。

### 结构体字段

```go
type ClientError struct {
    Type       ErrorType  // 错误分类
    Message    string     // 错误描述
    Cause      error      // 底层错误
    URL        string     // 请求 URL（脱敏）
    Method     string     // HTTP 方法
    Attempts   int        // 已尝试次数
    StatusCode int        // HTTP 状态码（如适用）
    Host       string     // 主机名（用于断路器）
}
```

| 字段 | 类型 | 说明 | 典型值 |
|------|------|------|--------|
| `ClientError.Type` | `ErrorType` | 错误分类，用于 switch 判断 | `ErrorTypeNetwork`、`ErrorTypeTimeout` |
| `ClientError.Message` | `string` | 错误描述信息 | `"network operation failed"` |
| `ClientError.Cause` | `error` | 底层错误，可通过 `Unwrap()` 获取 | `*net.OpError`、`*net.DNSError` |
| `ClientError.URL` | `string` | 请求 URL（凭据已脱敏） | `"https://example.com/path"` |
| `ClientError.Method` | `string` | HTTP 方法 | `"GET"`、`"POST"` |
| `ClientError.Attempts` | `int` | 已尝试次数（含首次请求） | `1`（首次失败）、`4`（重试 3 次后） |
| `ClientError.StatusCode` | `int` | HTTP 状态码（非 HTTP 错误时为 0） | `0`（网络错误）、`503`（服务端错误） |
| `ClientError.Host` | `string` | 请求主机名（用于断路器） | `"example.com"` |

`Host` 供断路器按主机维度统计失败，`Message` 可直接写入日志，`Cause` 保留底层错误供 `errors.As` 深挖。

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Error` | `func (e *ClientError) Error() string` | 格式化为 `"METHOD url: message: cause (attempt N)"` |
| `Code` | `func (e *ClientError) Code() string` | 返回短错误码，如 `"NETWORK_ERROR"`、`"TIMEOUT"` |
| `IsRetryable` | `func (e *ClientError) IsRetryable() bool` | 返回该错误是否可重试 |
| `Unwrap` | `func (e *ClientError) Unwrap() error` | 返回 `ClientError.Cause`，支持 `errors.Is`/`errors.As` 遍历错误链 |
| `WithType` | `func (e *ClientError) WithType(t ErrorType) *ClientError` | 返回设置了错误类型的**副本**，不修改原始错误 |

五个方法均以 `*ClientError` 指针接收者定义。`ClientError.Error` 实现 `error` 接口；`ClientError.Code` 与 `ClientError.IsRetryable` 供日志分类与重试决策使用；`ClientError.Unwrap` 暴露底层原因；`ClientError.WithType` 返回改写类型后的副本。

### Error() 格式化

`Error()` 方法将错误格式化为可读字符串：

- 同时有 URL 和 Method：`"GET https://example.com: network operation failed: dial tcp ... (attempt 1)"`
- 仅有 `Message`：直接输出 `Message`
- 有 Cause：追加 `": " + Cause.Error()`
- 有 Attempts（>0）：追加 `" (attempt N)"`

URL 在输出前经内部 `validation.SanitizeURL` 脱敏（移除凭据）。引擎分类路径产生的错误已预脱敏（`urlSanitized=true`），因此跳过冗余的 url.Parse 调用以避免分配。

### Code() 错误码

`Code()` 返回标识错误类型的短字符串，用于日志分类与监控告警：

| ErrorType | Code() 返回值 |
|-----------|---------------|
| `ErrorTypeNetwork` | `"NETWORK_ERROR"` |
| `ErrorTypeTimeout` | `"TIMEOUT"` |
| `ErrorTypeContextCanceled` | `"CONTEXT_CANCELED"` |
| `ErrorTypeResponseRead` | `"RESPONSE_READ_ERROR"` |
| `ErrorTypeTransport` | `"TRANSPORT_ERROR"` |
| `ErrorTypeRetryExhausted` | `"RETRY_EXHAUSTED"` |
| `ErrorTypeTLS` | `"TLS_ERROR"` |
| `ErrorTypeCertificate` | `"CERTIFICATE_ERROR"` |
| `ErrorTypeDNS` | `"DNS_ERROR"` |
| `ErrorTypeValidation` | `"VALIDATION_ERROR"` |
| `ErrorTypeHTTP` | `"HTTP_ERROR"` |
| `ErrorTypeUnknown`（及其他） | `"UNKNOWN_ERROR"` |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    log.Printf("错误码: %s, URL: %s, 尝试次数: %d, 可重试: %v",
        clientErr.Code(), clientErr.URL, clientErr.Attempts, clientErr.IsRetryable())
}
```

## IsRetryable 判断逻辑

`IsRetryable()` 判断单个错误是否可重试：先检查上下文错误，再按 `ErrorType` 分发。下表为完整判定规则，重试策略的整体说明见[重试与容错](../../guides/retry-fault-tolerance)。

1. **优先检查上下文错误**：Cause 是 `context.Canceled` 或 `context.DeadlineExceeded` 时直接返回 false，永不重试。
2. **按 ErrorType 分发**：见下表。

| ErrorType | 是否可重试 | 判断逻辑 |
|-----------|:----------:|----------|
| `ErrorTypeNetwork` | 视情况 | 检查 Cause：包装的 ClientError → 递归判断；`*net.OpError` → 超时或可重试 syscall（ECONNREFUSED/ECONNRESET/EPIPE/ETIMEDOUT/ENETUNREACH/EHOSTUNREACH）；`net.Error` → 默认可重试；消息匹配（"connection reset"/"eof"/"broken pipe" 等） |
| `ErrorTypeTimeout` | 是 | 所有传输层超时均可重试 |
| `ErrorTypeTransport` | 是 | HTTP 传输层错误 |
| `ErrorTypeResponseRead` | 视情况 | 仅读操作（`Op == "read"` 或 `"readfrom"`）可重试；写操作不重试 |
| `ErrorTypeDNS` | 视情况 | Cause 是 `*net.DNSError` 时，其 IsTemporary 或 IsTimeout 为 true 才重试 |
| `ErrorTypeHTTP` | 视情况 | StatusCode 命中 `retryableStatusCodes`（408/429/500/502/503/504）可重试 |
| `ErrorTypeContextCanceled` | 否 | 调用方主动取消 |
| `ErrorTypeValidation` | 否 | 请求本身不合法，重试无效 |
| `ErrorTypeTLS` | 否 | TLS 协议错误，重试无效 |
| `ErrorTypeCertificate` | 否 | 证书验证失败，重试无效 |
| `ErrorTypeRetryExhausted` | 否 | 已耗尽重试次数 |
| `ErrorTypeUnknown` | 否 | 未知错误，保守不重试 |

### retryableStatusCodes

```go
var retryableStatusCodes = map[int]bool{
    408: true, // Request Timeout
    429: true, // Too Many Requests
    500: true, // Internal Server Error
    502: true, // Bad Gateway
    503: true, // Service Unavailable
    504: true, // Gateway Timeout
}
```

这是 HTTP 状态码触发重试的唯一真相源，重试逻辑与 `IsRetryable()` 共用此表。

:::tip 超时类型的细微区别
`ErrorTypeTimeout` 可重试，但**由上下文截止触发的超时不可重试**：`context.DeadlineExceeded` 在第 1 步即被拦截并返回 false。只有传输层超时（如 `net.OpError.Timeout()`）才会进入第 2 步被判为可重试，因此 `WithTimeout` 设置的期限不会被重试突破。
:::

## ErrorType

```go
type ErrorType = engine.ErrorType
```

错误分类枚举（`int` 类型）。

| 常量 | 值 | 含义 | 典型触发场景 | 可重试 |
|------|-----|------|-------------|:------:|
| `ErrorTypeUnknown` | 0 | 未知/未分类 | 无法匹配任何已知模式 | 否 |
| `ErrorTypeNetwork` | 1 | 网络层错误 | 连接拒绝、连接重置、网络不可达 | 视情况 |
| `ErrorTypeTimeout` | 2 | 超时 | `net.OpError` 超时、上下文截止¹ | 视情况² |
| `ErrorTypeContextCanceled` | 3 | 上下文取消 | `context.Cancel` 触发 | 否 |
| `ErrorTypeResponseRead` | 4 | 响应体读取错误 | 读取响应体时 EOF/连接中断 | 视情况 |
| `ErrorTypeTransport` | 5 | 传输层错误 | HTTP 协议错误、传输失败 | 是 |
| `ErrorTypeRetryExhausted` | 6 | 重试耗尽 | 达到 MaxRetries 仍未成功 | 否 |
| `ErrorTypeTLS` | 7 | TLS 错误 | TLS 握手失败、协议不匹配 | 否 |
| `ErrorTypeCertificate` | 8 | 证书验证错误 | x509 证书过期/不受信任 | 否 |
| `ErrorTypeDNS` | 9 | DNS 解析错误 | 域名不存在、DNS 超时 | 视情况 |
| `ErrorTypeValidation` | 10 | 请求验证错误 | URL 格式错误、重定向超限、CRLF 注入 | 否 |
| `ErrorTypeHTTP` | 11 | HTTP 层错误 | 4xx/5xx 响应（仅重试场景产生） | 视情况 |

> ¹ 由上下文截止（`WithTimeout`、`TimeoutConfig.Request`）触发的超时**不会**重试；仅传输层超时（如 `net.OpError` 超时）才会重试。
> ² 详见上方 [IsRetryable 判断逻辑](#isretryable-判断逻辑)。

### 类型判断

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("请求超时")
        case httpc.ErrorTypeNetwork:
            log.Println("网络错误：", clientErr.Message)
        case httpc.ErrorTypeTLS:
            log.Println("TLS 错误")
        case httpc.ErrorTypeCertificate:
            log.Println("证书验证失败")
        case httpc.ErrorTypeDNS:
            log.Println("DNS 解析失败")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("重试耗尽，共尝试", clientErr.Attempts, "次")
        case httpc.ErrorTypeContextCanceled:
            log.Println("请求已取消")
        case httpc.ErrorTypeValidation:
            log.Println("请求验证失败")
        }
    }
}
```

## URL 脱敏机制

`ClientError.Error()` 在格式化时调用 `validation.SanitizeURL` 移除 URL 中的凭据（`user:pass@host` → `***:***@host`），避免敏感信息进入日志与错误消息。

```go
// 原始 URL: https://admin:secret@api.example.com/data
// Error() 输出：GET https://***:***@api.example.com/data: ...
```

引擎分类路径（`classifyErrorWithSanitizedURL`）在首次分类时完成脱敏并设置 `urlSanitized=true`，后续 `Error()` 调用跳过冗余的 url.Parse，避免每次日志输出都产生分配。

:::tip 回调中的错误脱敏
在 `MetricsMiddleware`、`LoggingMiddleware` 等中间件的回调中，HTTPC 会额外检查非 `ClientError` 类型的错误消息，把其中的原始 URL 替换为脱敏版本，避免回调泄漏凭据。
:::

## 错误分类流程

`classifyError` 把底层 `error` 映射为 `*ClientError`，按以下顺序逐层判断：

1. **context 错误**：`context.Canceled` → `ErrorTypeContextCanceled`；`context.DeadlineExceeded` → `ErrorTypeTimeout`
2. **连接池耗尽**：`connection.ErrPoolExhausted` → `ErrorTypeNetwork`
3. **`*url.Error` 解包**：HTTP/2 无效头、URL 解析失败 → `ErrorTypeValidation`；否则解包内层错误继续判断
4. **`*net.DNSError`**：`ErrorTypeDNS`，区分超时与失败
5. **`*net.OpError`**：`ErrorTypeNetwork`，区分超时与操作失败
6. **`net.Error`**：超时 → `ErrorTypeTimeout`；其他 → `ErrorTypeNetwork`
7. **消息模式匹配**（fallback）：按错误消息关键词匹配 TLS/certificate/timeout/connection refused 等 20+ 模式
8. **兜底**：`url.Error` 的内层未匹配任何模式时 → `ErrorTypeNetwork`；否则 → `ErrorTypeUnknown`

## 错误变量

### 配置错误

| 变量 | 错误消息 | 触发条件 |
|------|----------|----------|
| `ErrNilConfig` | `"config cannot be nil"` | 传入 nil Config 给 `New`/`ValidateConfig` |
| `ErrInvalidTimeout` | `"invalid timeout"` | 超时值为 0、负数或超过 30 分钟上限（`WithTimeout`）；无超时请用 `WithNoTimeout` |
| `ErrInvalidRetry` | `"invalid retry configuration"` | MaxRetries 不在 0–10、BackoffFactor 不在 1.0–10.0 |
| `ErrInvalidConnection` | `"invalid connection configuration"` | MaxIdleConns/MaxConnsPerHost 超范围、ProxyURL 格式错误 |
| `ErrInvalidSecurity` | `"invalid security configuration"` | 响应体/解压后/请求体大小上限越界、TLS 版本非法或 min>max、`SSRFExemptCIDRs` 含非法 CIDR、`SensitiveHeaders` 键非法、`TLSFingerprint` 未知预设或与 `TLSConfig` 同设 |
| `ErrInvalidMiddleware` | `"invalid middleware configuration"` | `Defaults.UserAgent` 超过 512 字符或含控制字符 |
| `ErrInvalidHeader` | `"invalid header"` | 请求头键值含控制字符或超过大小限制 |

### 请求与响应错误

| 变量 | 错误消息 | 触发条件 |
|------|----------|----------|
| `ErrEmptyFilePath` | `"file path cannot be empty"` | DownloadConfig.FilePath 为空 |
| `ErrFileExists` | `"file already exists"` | 文件已存在且 Overwrite=false 且 ResumeDownload=false |
| `ErrResponseBodyEmpty` | `"response body is empty"` | 对空响应体调用 Unmarshal 等解析方法 |
| `ErrResponseBodyTooLarge` | `"response body too large"` | 响应体超过 MaxResponseBodySize |
| `ErrInvalidMaxRedirects` | `"invalid max redirects"` | [`WithMaxRedirects`](../core/options#withmaxredirects) 传入负数或超过 50，或 `Security.MaxRedirects` 不在 0–50 |
| `ErrInvalidCredentials` | `"invalid credentials"` | [`WithBasicAuth`](../core/options#withbasicauth)/[`WithBearerToken`](../core/options#withbearertoken) 凭据为空、超长或含非法字符 |
| `ErrStreamBodyRequiresDownload` | `"WithStreamBody requires Download; standard request methods buffer the response body"` | [`WithStreamBody`](../core/options#withstreambody)(true) 与标准请求方法（Get/Post/…/Request）搭配；流式仅在 `Download` 路径生效 |

### 下载与代理错误

| 变量 | 错误消息 | 触发条件 |
|------|----------|----------|
| `ErrDownloadInProgress` | `"download already in progress for this file path"` | 同一进程内已有下载在写同一文件路径；第二个调用立即失败而非阻塞，首个下载结束后可重试。互斥锁仅在进程内生效，跨进程协调由调用方负责 |
| `ErrProxyConnectionFailed` | `"proxy connection failed"` | 配置的代理无法拨号（连接失败、地址非法、被拒绝等）；与底层原因一同包装进错误链，可用 `errors.Is` 检测，重试引擎据此换下一个代理 |

### 客户端错误

| 变量 | 错误消息 | 触发条件 |
|------|----------|----------|
| `ErrClientClosed` | `"client is closed"` | 在 Close() 之后使用客户端 |

## 安全警告 API

### SetSecurityWarnOutput

<!-- check-code: skip -->
```go
func SetSecurityWarnOutput(w io.Writer)
```

重定向安全警告的输出目标（默认 `os.Stderr`），定义于 `warnings.go`。传入 `io.Discard` 可抑制全部警告。测试环境的判定依据是可执行文件名（`.test` 后缀）与 `GO_TEST`/`GOTEST` 环境变量。

两类危险配置会在**非测试环境**触发警告，每类每进程至多打印一次（`sync.Once`）：

| 触发条件 | 警告要点 |
|---------|---------|
| `TestingConfig()` 创建的客户端用于非测试环境 | 提示 TLS 证书验证、SSRF 防护、URL/Header 验证均被禁用，应改用 `SecureConfig()` 或 `DefaultConfig()` |
| `Security.InsecureSkipVerify=true` 且非测试环境 | 提示 TLS 证书验证被禁用，仅应在测试中使用，生产应用 `SecureConfig()` |

```go
// 抑制安全警告（仅在已确认配置安全时使用）
httpc.SetSecurityWarnOutput(io.Discard)

// 重定向到自定义日志输出
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning 勿滥用抑制
`SetSecurityWarnOutput(io.Discard)` 会静默吞掉安全警告。仅在已充分审计配置（如确认 `TestingConfig` 只用于测试二进制）时使用，不要在生产部署中用它掩盖警告。安全实践的完整清单见[安全指南](../../security/)。
:::

## 实用匹配模式

### errors.As 提取 ClientError

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        // 访问结构化字段
        fmt.Printf("错误码: %s\n", clientErr.Code())
        fmt.Printf("错误类型：%d\n", clientErr.Type)
        fmt.Printf("请求: %s %s\n", clientErr.Method, clientErr.URL)
        fmt.Printf("尝试次数：%d\n", clientErr.Attempts)
        if clientErr.StatusCode != 0 {
            fmt.Printf("状态码：%d\n", clientErr.StatusCode)
        }
    }
}
```

### errors.Is 匹配哨兵错误

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // 客户端已关闭，需重新创建
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // 响应体为空，跳过解析
}
if errors.Is(err, httpc.ErrFileExists) {
    // 文件已存在，提示用户或设置 Overwrite=true
}
```

### errors.Unwrap 遍历错误链

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    // Cause 是底层错误（如 *net.OpError）
    cause := clientErr.Unwrap()
    if cause != nil {
        var opErr *net.OpError
        if errors.As(cause, &opErr) {
            fmt.Println("操作：", opErr.Op)
            fmt.Println("网络：", opErr.Net)
            fmt.Println("地址：", opErr.Addr)
        }
    }
}
```

:::tip 三种匹配方式的选择
- `errors.As`：需要访问 `ClientError` 的结构化字段（Type/Code/URL/Attempts 等）。
- `errors.Is`：匹配哨兵错误（`ErrClientClosed` 等配置与文件错误）。
- `errors.Unwrap`：需要到达最底层的 net/error 以获取系统级诊断信息。
:::

## 另见

- [错误处理](../../guides/error-handling) - 完整错误处理指南
- [常量与类型](./constants) - BodyKind 等常量参考
- [重试与容错](../../guides/retry-fault-tolerance) - 重试策略指南
- [安全指南](../../security/) - SetSecurityWarnOutput 与安全配置实践
