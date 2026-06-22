---
title: "错误类型 - CyberGo HTTPC | ClientError 详解"
description: "HTTPC 错误类型 API 参考：ClientError 结构体八字段及 Code、IsRetryable、Unwrap 等方法、ErrorTypeNetwork 等十二种错误分类枚举、ErrNilConfig 等哨兵错误变量与 errors.Is/As 匹配示例。"
---

# 错误类型

## ClientError

```go
type ClientError = engine.ClientError
```

分类的 HTTP 客户端错误，通过 `errors.As` 提取。

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `Type` | `ErrorType` | 错误分类，用于 switch 判断 |
| `Message` | `string` | 错误描述信息 |
| `Cause` | `error` | 底层错误，可通过 `Unwrap()` 获取 |
| `URL` | `string` | 请求 URL（凭据已脱敏） |
| `Method` | `string` | HTTP 方法（GET、POST 等） |
| `Attempts` | `int` | 已重试次数 |
| `StatusCode` | `int` | HTTP 状态码（非 HTTP 错误时为 0） |
| `Host` | `string` | 请求主机名 |

### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `Error()` | `string` | 格式化为 `METHOD URL: Message: Cause (attempt N)` |
| `Code()` | `string` | 可读错误码，如 `"NETWORK_ERROR"`、`"TIMEOUT"` |
| `IsRetryable()` | `bool` | 是否可重试 |
| `Unwrap()` | `error` | 解包底层错误 |
| `WithType(t ErrorType)` | `*ClientError` | 返回设置错误类型的副本（不修改原始） |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("错误类型:", clientErr.Code())
    fmt.Println("请求 URL:", clientErr.URL)
    fmt.Println("重试次数:", clientErr.Attempts)
    fmt.Println("可重试:", clientErr.IsRetryable())
    fmt.Println("底层错误:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

错误分类枚举。

| 常量 | 说明 | 可重试 |
|------|------|--------|
| `ErrorTypeUnknown` | 未知/未分类错误 | 否 |
| `ErrorTypeNetwork` | 网络错误（连接拒绝、DNS 失败等） | 视情况 |
| `ErrorTypeTimeout` | 请求超时 | 是 |
| `ErrorTypeContextCanceled` | 上下文取消 | 否 |
| `ErrorTypeResponseRead` | 响应体读取错误 | 视情况 |
| `ErrorTypeTransport` | 传输层错误 | 是 |
| `ErrorTypeRetryExhausted` | 重试耗尽 | 否 |
| `ErrorTypeTLS` | TLS 错误 | 否 |
| `ErrorTypeCertificate` | 证书验证错误 | 否 |
| `ErrorTypeDNS` | DNS 解析错误 | 视情况 |
| `ErrorTypeValidation` | 请求验证错误 | 否 |
| `ErrorTypeHTTP` | HTTP 层错误 | 视情况 |

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
            log.Println("网络错误")
        case httpc.ErrorTypeTLS:
            log.Println("TLS 错误")
        case httpc.ErrorTypeCertificate:
            log.Println("证书验证失败")
        case httpc.ErrorTypeDNS:
            log.Println("DNS 解析失败")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("重试耗尽")
        case httpc.ErrorTypeContextCanceled:
            log.Println("请求已取消")
        case httpc.ErrorTypeValidation:
            log.Println("请求验证失败")
        }
    }
}
```

## 错误变量

### 配置错误

| 变量 | 说明 |
|------|------|
| `ErrNilConfig` | 配置为 nil |
| `ErrInvalidTimeout` | 超时值无效 |
| `ErrInvalidRetry` | 重试配置无效 |
| `ErrInvalidConnection` | 连接配置无效 |
| `ErrInvalidSecurity` | 安全配置无效 |
| `ErrInvalidMiddleware` | 中间件配置无效 |

### 请求错误

| 变量 | 说明 |
|------|------|
| `ErrInvalidHeader` | 请求头验证失败 |

### 响应错误

| 变量 | 说明 |
|------|------|
| `ErrResponseBodyEmpty` | 响应体为空 |
| `ErrResponseBodyTooLarge` | 响应体超出大小限制 |

### 文件错误

| 变量 | 说明 |
|------|------|
| `ErrEmptyFilePath` | 文件路径为空 |
| `ErrFileExists` | 文件已存在 |

### 客户端错误

| 变量 | 说明 |
|------|------|
| `ErrClientClosed` | 客户端已关闭 |

### 变量匹配

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // 客户端已关闭
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // 响应体为空
}
```

## 另见

- [错误处理](../advanced/error-handling) - 完整错误处理指南
- [常量与枚举](./constants) - BodyKind 等常量参考
- [重试与容错](../guides/retry-fault-tolerance) - 重试策略指南
