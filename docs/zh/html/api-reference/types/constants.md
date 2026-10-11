---
sidebar_label: "常量与错误"
title: "常量与错误 - CyberGo html | 默认值与错误类型"
description: "CyberGo html 常量与错误类型参考：汇总默认值常量（MaxInputSize、CacheTTL 等）、八种审计事件常量与三级审计级别、十个哨兵错误及 InputError、ConfigError、FileError 结构化错误的字段定义，支持 errors.Is 与 errors.As 精准判断，并解读批量上限等内部限制常量。"
sidebar_position: 3
---

# 常量与错误

## 默认配置常量

| 常量 | 类型 | 值 | 说明 |
|------|------|----|------|
| `DefaultMaxInputSize` | `int` | `52428800` | 最大输入大小 (50MB) |
| `DefaultMaxCacheEntries` | `int` | `2000` | 缓存最大条目 |
| `DefaultWorkerPoolSize` | `int` | `4` | 工作池大小 |
| `DefaultCacheTTL` | `time.Duration` | `1h` | 缓存过期时间 |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | 缓存清理间隔 |
| `DefaultMaxAuditEntries` | `int` | `10000` | 内存审计条目上限默认值（`AuditConfig.MaxEntries` 为 0 时使用） |
| `DefaultMaxDepth` | `int` | `500` | 最大 DOM 深度 |
| `DefaultProcessingTimeout` | `time.Duration` | `30s` | 处理超时时间 |

## 审计常量

### 审计事件类型

| 常量 | 值 | 说明 |
|------|------|------|
| `AuditEventBlockedTag` | `"blocked_tag"` | 被阻止的标签 |
| `AuditEventBlockedAttr` | `"blocked_attr"` | 被阻止的属性 |
| `AuditEventBlockedURL` | `"blocked_url"` | 被阻止的 URL |
| `AuditEventInputViolation` | `"input_violation"` | 输入违规 |
| `AuditEventDepthViolation` | `"depth_violation"` | 深度违规 |
| `AuditEventTimeout` | `"timeout"` | 处理超时 |
| `AuditEventEncodingIssue` | `"encoding_issue"` | 编码问题 |
| `AuditEventPathTraversal` | `"path_traversal"` | 路径遍历尝试 |

### 审计级别

| 常量 | 类型 | 值 | 说明 |
|------|------|------|------|
| `AuditLevelInfo` | `AuditLevel` | `"info"` | 信息级别 |
| `AuditLevelWarning` | `AuditLevel` | `"warning"` | 警告级别 |
| `AuditLevelCritical` | `AuditLevel` | `"critical"` | 严重级别 |

:::info
审计系统的详细用法和 Sink 类型详见 [审计系统](../modules/audit)。
:::

## 哨兵错误

| 错误 | 消息 | 说明 |
|------|------|------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | 输入超过大小限制 |
| `ErrInvalidHTML` | `html: invalid HTML` | 无效 HTML 内容 |
| `ErrProcessorClosed` | `html: processor closed` | 处理器已关闭 |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | 超过最大深度 |
| `ErrInvalidConfig` | `html: invalid config` | 无效配置 |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | 处理超时 |
| `ErrFileNotFound` | `html: file not found` | 文件未找到 |
| `ErrInvalidFilePath` | `html: invalid file path` | 无效文件路径 |
| `ErrInternalPanic` | `html: internal panic recovered` | 内部恐慌已恢复 |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | 最多一个 Config |

## 错误类型

### InputError

输入相关错误，携带大小信息。

```go
type InputError struct {
    Op       string // 操作名
    Size     int    // 实际大小
    MaxSize  int    // 最大限制
    InputErr error  // 原始错误
}

func (e *InputError) Error() string
func (e *InputError) Unwrap() []error // InputErr 非 nil 时 → [InputErr, ErrInputTooLarge]，否则 → [ErrInputTooLarge]
```

| 成员 | 类型 | 说明 |
|------|------|------|
| `InputError.Op` | `string` | 失败的操作名（如 `"Extract"`、`"ExtractFromFile"`） |
| `InputError.Size` | `int` | 实际输入大小 |
| `InputError.MaxSize` | `int` | 配置的大小上限 |
| `InputError.InputErr` | `error` | 底层错误（可为 `nil`） |

| 方法 | 说明 |
|------|------|
| `InputError.Error` | 格式化错误消息（含实际/限制大小） |
| `InputError.Unwrap` | `InputErr` 非 nil 时 → `[InputErr, ErrInputTooLarge]`，否则 → `[ErrInputTooLarge]` |

`Unwrap` 返回**错误切片**而非单个错误：无论是否携带底层错误，`ErrInputTooLarge` 恒在列表中——`errors.Is(err, ErrInputTooLarge)` 对任意 `*InputError` 都成立。

### ConfigError

配置验证错误，携带字段信息。

```go
type ConfigError struct {
    Field   string // 字段名
    Value   any    // 无效值
    Message string // 错误描述
}

func (e *ConfigError) Error() string
func (e *ConfigError) Unwrap() error // → ErrInvalidConfig
```

| 成员 | 类型 | 说明 |
|------|------|------|
| `ConfigError.Field` | `string` | 无效的配置字段名（如 `"MaxInputSize"`） |
| `ConfigError.Value` | `any` | 被拒绝的字段值 |
| `ConfigError.Message` | `string` | 错误描述（如 `"must be positive"`） |

| 方法 | 说明 |
|------|------|
| `ConfigError.Error` | 格式化为 `html: invalid config: 字段=值, 描述` |
| `ConfigError.Unwrap` | 返回 `ErrInvalidConfig` |

### FileError

文件操作错误，自动截断路径防止泄露。

```go
type FileError struct {
    Op      string // 操作名
    Path    string // 文件路径
    FileErr error  // 原始错误
}

func (e *FileError) Error() string        // 安全输出（截断路径）
func (e *FileError) SafePath() string     // 仅返回文件名
func (e *FileError) Unwrap() error        // → ErrFileNotFound | 原始错误 | ErrInvalidFilePath
func (e *FileError) MarshalJSON() ([]byte, error) // 专为 HTTP API 响应场景：序列化为 JSON 返回客户端时经 SafePath() 截断 Path，防止文件系统路径泄露
```

| 成员 | 类型 | 说明 |
|------|------|------|
| `FileError.Op` | `string` | 失败的操作名（如 `"ExtractFromFile"`、`"ReadFile"`） |
| `FileError.Path` | `string` | 完整文件路径（仅内部调试用，勿直接输出） |
| `FileError.FileErr` | `error` | 底层文件系统错误 |

| 方法 | 说明 |
|------|------|
| `FileError.Error` | 安全输出（路径截断为文件名，底层错误消息同步脱敏） |
| `FileError.SafePath` | 仅返回文件名（无分隔符时原样返回） |
| `FileError.Unwrap` | → `ErrFileNotFound` \| 原始错误 \| `ErrInvalidFilePath` |
| `FileError.MarshalJSON` | 序列化为 `{op, path, message}`，`path` 经 `SafePath()` 截断，防止文件系统路径泄露 |

:::tip 安全路径
`FileError.Error()` 和 `SafePath()` 都返回截断后的安全路径（仅文件名），防止路径泄露。内部调试需要完整路径时可直接访问 `Path` 字段。
:::

## 内部限制常量

以下常量定义了库的运行时硬上限。它们**非导出**（小写开头），不可直接引用，但影响运行时行为——了解这些值有助于理解库的边界条件和错误场景。

### 配置上限

| 常量 | 值 | 说明 |
|------|----|------|
| `maxConfigInputSize` | `52428800` (50MB) | `MaxInputSize` 配置上限；即便设置更大值也会被 `Validate()` 拒绝 |
| `maxConfigWorkerSize` | `256` | `WorkerPoolSize` 配置上限 |
| `maxConfigDepth` | `500` | `MaxDepth` 配置上限 |
| `maxConfigCacheEntries` | `100000` | `MaxCacheEntries` 配置上限（≈100MB，按每条 1KB 估算） |
| `maxConfigAuditEntries` | `100000` | `Audit.MaxEntries` 配置上限（`GetAuditLog` 内存保留条目数上限） |

### 处理限制

| 常量 | 值 | 说明 |
|------|----|------|
| `maxBatchSize` | `10000` | 单次批量最大项数；超限整批返回错误（非 panic） |
| `maxTimeoutGoroutines` | `1000` | 全局并发超时 goroutine 上限；超限新请求直接返回 `ErrProcessingTimeout` |
| `maxHTMLForRegex` | `1000000` (1MB) | 媒体 URL 正则扫描的 HTML 大小上限；超过此值跳过正则兜底（防 ReDoS） |
| `maxRegexMatches` | `1000` | 单次正则扫描的最大匹配数；防止媒体密集页面产生过量分配 |

### 缓存 Key 生成

| 常量 | 值 | 说明 |
|------|----|------|
| `maxCacheKeySize` | `65536` (64KB) | 完整哈希的内容大小阈值；超出此值切换到 5 点采样 |
| `cacheKeySample` | `4096` | 大文档采样的总字节预算（5 点 × ~819 字节/点） |

:::tip 为什么需要了解这些
这些常量解释了一些「为什么」：为什么超过 1MB 的 HTML 不再提取裸视频链接（ReDoS 防护）、为什么批量超过 10000 项整批失败（OOM 防护）、为什么 64KB 是缓存 Key 策略的分界线（哈希成本 vs 碰撞风险）。
:::

## 错误处理模式

```go
result, err := html.Extract(data)
if err != nil {
    var inputErr *html.InputError
    var configErr *html.ConfigError
    var fileErr *html.FileError

    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 输入过大
    case errors.Is(err, html.ErrInvalidHTML):
        // 无效 HTML
    case errors.Is(err, html.ErrFileNotFound):
        // 文件不存在
    case errors.As(err, &inputErr):
        fmt.Printf("大小 %d 超过限制 %d\n", inputErr.Size, inputErr.MaxSize)
    case errors.As(err, &configErr):
        fmt.Printf("配置字段 %s 无效: %s\n", configErr.Field, configErr.Message)
    case errors.As(err, &fileErr):
        fmt.Printf("文件: %s\n", fileErr.SafePath())
    }
}
```
