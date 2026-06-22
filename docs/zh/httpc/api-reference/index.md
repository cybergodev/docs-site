---
title: "API 参考 - CyberGo HTTPC | API 总索引"
description: "HTTPC API 参考索引：按核心、请求响应、高级功能三组分类导航，涵盖包级 HTTP 函数、28 个 WithXxx 请求选项、Config 配置系统与五种预设、八个内置中间件、域名客户端、文件下载与错误类型的完整查阅入口，帮助快速定位所需 API。"
---

# API 参考

HTTPC 提供 28 个请求选项函数、5 个配置预设、8 个内置中间件和完整的下载支持。

## 核心架构

```text
httpc 包
├── Client 接口 - 主客户端，支持所有 HTTP 方法
├── DomainClienter 接口 - 域名作用域客户端，内置会话管理
├── Config - 配置系统（超时/连接/安全/重试/中间件）
├── RequestOption - 28 个请求选项函数
├── MiddlewareFunc - 中间件链
├── Result - 响应结果（含请求元数据）
└── 包级函数 - 无需创建客户端即可使用
```

## 模块导航

### 核心

| 模块 | 说明 |
|------|------|
| [包函数](./functions) | Get/Post/Put/Patch/Delete 等包级函数、客户端方法和辅助函数 |
| [配置](./config) | Config 结构体、5 种预设配置、验证函数和 Cookie 安全 |
| [接口](./interfaces) | Client、Doer、DomainClienter、RetryPolicy 等核心接口 |
| [Result](./result) | Result、RequestInfo、ResponseInfo、RequestMeta 类型和所有方法 |

### 请求与响应

| 模块 | 说明 |
|------|------|
| [请求选项](./options) | 28 个 WithXxx 请求选项函数（请求头、请求体、认证、Cookie、回调等） |
| [中间件](./middleware) | Chain 组合、8 个内置中间件工厂和审计事件类型 |
| [错误类型](./errors) | ClientError、12 种 ErrorType 枚举和 12 个错误变量 |

### 高级功能

| 模块 | 说明 |
|------|------|
| [域名客户端](./domain-client) | DomainClient 创建、HTTP 方法、下载方法和 URL 拼接规则 |
| [会话管理](./session) | SessionManager 的 Cookie/请求头管理和安全验证 |
| [文件下载](./download) | 下载函数、DownloadConfig、断点续传和安全保护 |
| [常量与类型](./constants) | BodyKind 枚举、FormData/FileData 和审计上下文键 |

## 快速参考

### 创建客户端

```go
client, err := httpc.New()                    // 默认配置
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
