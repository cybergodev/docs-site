---
title: "常量与错误 - HTML"
description: "CyberGo HTML 库常量和错误类型 API 参考，包括 DefaultMaxInputSize（50MB）等默认值常量、ErrInputTooLarge 等哨兵错误，以及 InputError、ConfigError、FileError 结构化错误类型，均支持 errors.Is/As 判断，便于精准定位和处理各类运行时异常情况。"
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
审计系统的详细用法和 Sink 类型详见 [审计系统](./audit)。
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
func (e *InputError) Unwrap() error // → InputErr（非 nil 时）或 ErrInputTooLarge
```

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
```

:::tip 安全路径
`FileError.Error()` 和 `SafePath()` 都返回截断后的安全路径（仅文件名），防止路径泄露。内部调试需要完整路径时可直接访问 `Path` 字段。
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
