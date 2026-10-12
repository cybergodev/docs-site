---
sidebar_label: "概览"
title: "API 参考 - CyberGo HTTPC | API 总索引"
description: "HTTPC API 参考总索引：核心函数、请求选项、Result、Config 配置、中间件、类型与错误等九组完整 API 地图，覆盖 29 个 WithXxx 选项、5 个配置预设、7 个内置中间件与 17 个错误变量，附快速上手示例。"
sidebar_position: 10
---

# API 参考

HTTPC 提供 29 个请求选项函数、5 个配置预设、7 个内置中间件和完整的下载支持。

## 核心架构

HTTPC 采用双层设计：Layer 1 的方法 API 是薄封装，真正处理请求的引擎是 Layer 2 的 Handler 管线。

```text
HTTPC 双层架构
├── Layer 1  方法 API（薄封装）
│     包级函数 httpc.Get/Post/... + Client 方法 + 请求选项 → Result
│
└── Layer 2  Handler 管线（请求处理引擎）
      MiddlewareFunc(Handler) 洋葱链
      → 组装 clientImpl.middlewareChain
      → 执行（每个请求 = 组装并执行一条 Handler 链）
```

## 模块导航

### 核心

| 模块 | 说明 |
|------|------|
| [包级函数与客户端方法](./core/functions) | Get/Post/Put/Patch/Delete 等包级函数、客户端方法和辅助函数 |
| [配置](./client-config/config) | Config 结构体、5 种预设配置、验证函数和 Cookie 安全 |
| [接口](./types/interfaces) | Client、Doer、DomainClienter、RetryPolicy 等核心接口 |
| [Result](./core/result) | Result、RequestInfo、ResponseInfo、RequestMeta 类型和所有方法 |
| [处理器](./handler/handler-chain) | Handler 管线、MiddlewareFunc 洋葱链、Chain 组合器与 Mutator 契约 |
| [变更器](./handler/mutators) | RequestMutator/ResponseMutator 的读写方法与类型断言 |

### 请求与响应

| 模块 | 说明 |
|------|------|
| [请求选项](./core/options) | 29 个 WithXxx 请求选项函数（请求头、请求体、认证、Cookie、回调等） |
| [内置中间件](./client-config/middleware) | Chain 组合、7 个内置中间件工厂和审计事件类型 |
| [错误类型](./types/errors) | ClientError、12 种 ErrorType 枚举和 17 个错误变量 |

### 高级功能

| 模块 | 说明 |
|------|------|
| [域名客户端](./client-config/domain-client) | DomainClient 创建、HTTP 方法、下载方法和 URL 拼接规则 |
| [会话管理](./client-config/session) | SessionManager 的 Cookie/请求头管理和安全验证 |
| [文件下载](./client-config/download) | 下载函数、DownloadConfig、断点续传和安全保护 |
| [常量与类型](./types/constants) | BodyKind 枚举、FormData/FileData 和审计上下文键 |

## API 地图

按符号类型分组的完整索引，与 `github.com/cybergodev/httpc` 包的导出面一一对应，点击跳转到对应详情页。

### 客户端与包级函数

| 符号 | 说明 |
|------|------|
| [`New`](./core/functions#new) / [`NewDefault`](./core/functions#newdefault) | 创建客户端（自定义 / 默认配置） |
| [`Get`](./core/functions#get) / `Post` / `Put` / `Patch` / `Delete` / `Head` / `Options` / [`Request`](./core/functions#request) | 包级 HTTP 方法（共享内部默认客户端） |
| [`Download`](./core/functions#download) | 统一文件下载入口（包级函数 / Client / DomainClient 三处同名同签名） |
| [`SetDefaultClient`](./core/functions#setdefaultclient) / [`CloseDefaultClient`](./core/functions#closedefaultclient) | 默认客户端替换与关闭 |
| [`NewDomain`](./core/functions#newdomain) / [`NewDomainDefault`](./core/functions#newdomaindefault) | 域名作用域客户端 |
| [`SetSecurityWarnOutput`](./core/functions#setsecuritywarnoutput) | 安全警告输出重定向 |
| [`FormatBytes`](./core/functions#formatbytes) / [`FormatSpeed`](./core/functions#formatspeed) | 字节数 / 速率格式化 |

### 请求选项（29 个）

| 分组 | 选项 |
|------|------|
| 请求头（3） | `WithHeader`、`WithHeaderMap`、`WithUserAgent` |
| 认证（2） | `WithBasicAuth`、`WithBearerToken` |
| 请求体（7） | `WithJSON`、`WithXML`、`WithForm`、`WithFormData`、`WithFile`、`WithBinary`、`WithBody` |
| 查询参数（2） | `WithQuery`、`WithQueryMap` |
| Cookie（4） | `WithCookies`、`WithCookieMap`、`WithCookieString`、`WithSecureCookie` |
| 请求控制（9） | `WithContext`、`WithTimeout`、`WithNoTimeout`、`WithMaxRetries`、`WithRetryNonIdempotent`、`WithFollowRedirects`、`WithMaxRedirects`、`WithAllowPrivateIPs`、`WithStreamBody` |
| 回调（2） | `WithOnRequest`、`WithOnResponse` |

全部选项的签名、校验规则与覆盖的 Config 默认值见[请求选项](./core/options)。

### Result 家族

| 分类 | 符号 |
|------|------|
| 类型 | `Result`（17 个 nil 安全方法） |
| 状态与协议 | `StatusCode`、`Proto`、`IsSuccess`、`IsRedirect`、`IsClientError`、`IsServerError` |
| 请求体访问 | `Body`、`RawBody` |
| 解析与保存 | `Unmarshal`、`SaveToFile`、`String` |
| Cookie | `ResponseCookies`、`GetCookie`、`HasCookie`、`RequestCookies`、`GetRequestCookie`、`HasRequestCookie` |
| 子类型 | `RequestInfo`、`ResponseInfo`、`RequestMeta`（含 `ProxyURL` 代理字段） |

详见 [Result](./core/result)。

### 配置

| 分类 | 符号 |
|------|------|
| 主类型 | `Config`（`Timeouts` / `Connection` / `Security` / `Retry` / `Middleware` / `Defaults` 六组） |
| 子配置类型 | `TimeoutConfig`、`ConnectionConfig`、`SecurityConfig`、`RetryConfig`、`MiddlewareConfig`、`RequestDefaults` |
| 预设（5 个） | `DefaultConfig`、`SecureConfig`、`PerformanceConfig`、`TestingConfig`、`MinimalConfig` |
| 校验与输出 | `ValidateConfig`、`Config.String` |
| Cookie 安全 | `CookieSecurityConfig`、`DefaultCookieSecurityConfig`、`StrictCookieSecurityConfig` |
| 下载配置 | `DownloadConfig`、`DefaultDownloadConfig`、`DownloadResult`、`DownloadProgressCallback`、`ChecksumAlgorithm` |
| 会话配置 | `SessionConfig`、`DefaultSessionConfig`、`NewSessionManager`、`NewSessionManagerDefault` |

详见 [配置](./client-config/config)、[文件下载](./client-config/download)、[会话管理](./client-config/session)。

### Handler、中间件与变更器

| 分类 | 符号 |
|------|------|
| 管线类型 | `Handler`、`MiddlewareFunc`、`Chain` |
| 中间件工厂（7 个） | `LoggingMiddleware`、`RecoveryMiddleware`、`RequestIDMiddleware`、`TimeoutMiddleware`、`HeaderMiddleware`、`MetricsMiddleware`、`AuditMiddleware` |
| 中间件配置 | `LoggingConfig`、`RequestIDConfig`、`TimeoutMiddlewareConfig`、`HeaderConfig`、`MetricsConfig`、`AuditConfig`（各配 `Default*Config()` 构造函数） |
| 变更器 | `RequestMutator`、`ResponseMutator`（中间件读写请求/响应的契约） |

详见 [处理器](./handler/handler-chain)、[内置中间件](./client-config/middleware)、[变更器](./handler/mutators)。

### 接口与类型

| 分类 | 符号 |
|------|------|
| 核心接口 | `Client`、`Doer`、`DomainClienter`、`RetryPolicy` |
| 类型别名 | `RequestOption`、`ClientError`、`ErrorType`、`CertificatePinner`、`ProxyStrategy` |
| 证书固定 | `NewSPKIHashPinner`、`NewPublicKeyPinner`、`NewCertificatePinnerChain` |
| 会话与域名 | `SessionManager`、`DomainClient`（建议以 `DomainClienter` 接口使用） |
| 数据类型 | `FormData`、`FileData`、`AuditEvent` |

详见 [接口](./types/interfaces)、[域名客户端](./client-config/domain-client)、[会话管理](./client-config/session)、[常量与类型](./types/constants)。

### 错误与常量

| 分类 | 符号 |
|------|------|
| 错误类型 | `ClientError`、`ErrorType`（12 种错误类别枚举） |
| 哨兵错误（17 个） | `ErrClientClosed`、`ErrNilConfig`、`ErrInvalidHeader`、`ErrInvalidTimeout`、`ErrInvalidRetry`、`ErrInvalidMaxRedirects`、`ErrInvalidCredentials`、`ErrInvalidConnection`、`ErrInvalidSecurity`、`ErrInvalidMiddleware`、`ErrEmptyFilePath`、`ErrFileExists`、`ErrResponseBodyEmpty`、`ErrResponseBodyTooLarge`、`ErrStreamBodyRequiresDownload`、`ErrDownloadInProgress`、`ErrProxyConnectionFailed` |
| BodyKind（6 常量） | `BodyAuto`、`BodyJSON`、`BodyXML`、`BodyForm`、`BodyBinary`、`BodyMultipart` |
| 其他常量 | `ProxyStrategyRoundRobin` / `ProxyStrategyRandom`、`ChecksumSHA256`、审计上下文键 |

详见 [错误类型](./types/errors)、[常量与类型](./types/constants)。

## 快速参考

### 创建客户端

```go
client, err := httpc.NewDefault()             // 默认配置
client, err := httpc.New(httpc.SecureConfig()) // 安全预设
client, err := httpc.New(customConfig)         // 自定义配置
```

### 发送请求

```go
// 包级函数
result, err := httpc.Get(url, options...)

// 客户端方法
result, err := client.Get(url, options...)

// 带上下文
result, err := client.Request(ctx, "GET", url, options...)
```

### 处理响应

```go
result.StatusCode()           // 状态码
result.Body()                 // 响应体（字符串）
result.RawBody()              // 响应体（字节）
result.Unmarshal(&data)       // JSON 解析
result.IsSuccess()            // 是否 2xx
result.Meta.Duration          // 请求耗时
result.Meta.Attempts          // 重试次数
```

## 版本兼容性

- **Go 版本**：要求 Go 1.26 及以上（`go.mod` 声明 `go 1.26.0`）。
- **导入路径**：`github.com/cybergodev/httpc`（包名 `httpc`，无需别名）。
- **直接依赖**：仅 `golang.org/x/sys`（用于各平台系统代理检测，覆盖 Linux/macOS/Windows），无其他第三方依赖。
- **API 状态**：当前全部导出符号均无 `Deprecated` 标记，处于活跃维护状态。
