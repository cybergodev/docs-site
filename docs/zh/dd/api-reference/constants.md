---
title: "常量与错误 - CyberGo DD | LogLevel、Format、SentinelErrors"
description: "CyberGo DD 常量定义与错误类型完整文档，包括 LogLevel 日志级别常量（Debug/Info/Warn/Error/Fatal）、Format 输出格式常量和 SentinelErrors 哨兵错误定义，用于精确控制日志行为和错误处理，是理解 DD 日志库配置体系的核心基础。"
---

# 常量与错误

DD 定义了丰富的常量和错误类型，用于日志级别控制、格式化和错误处理。

## 日志级别

```go
type LogLevel int8 // 日志级别类型
```

| 常量 | 值 | 说明 |
|------|----|------|
| `LevelDebug` | 0 | 调试级别 |
| `LevelInfo` | 1 | 信息级别（默认） |
| `LevelWarn` | 2 | 警告级别 |
| `LevelError` | 3 | 错误级别 |
| `LevelFatal` | 4 | 致命级别 |

## 日志格式

```go
type LogFormat int8 // 输出格式类型
```

| 常量 | 说明 |
|------|------|
| `FormatText` | 文本格式 |
| `FormatJSON` | JSON 格式 |

## 字段验证模式

```go
type FieldValidationMode int // 字段键验证模式
```

| 常量 | 值 | 说明 |
|------|----|------|
| `FieldValidationNone` | 0 | 禁用验证（默认） |
| `FieldValidationWarn` | 1 | 验证失败时警告但仍接受 |
| `FieldValidationStrict` | 2 | 严格模式，验证失败时记录错误 |

## 字段命名约定

```go
type FieldNamingConvention int // 字段键命名约定
```

| 常量 | 值 | 说明 |
|------|----|------|
| `NamingConventionAny` | 0 | 接受任何格式（默认） |
| `NamingConventionSnakeCase` | 1 | snake_case（如 user_id） |
| `NamingConventionCamelCase` | 2 | camelCase（如 userId） |
| `NamingConventionPascalCase` | 3 | PascalCase（如 UserId） |
| `NamingConventionKebabCase` | 4 | kebab-case（如 user-id） |

## 哈希算法

```go
type HashAlgorithm int // 完整性签名哈希算法
```

| 常量 | 说明 |
|------|------|
| `HashAlgorithmSHA256` | SHA-256 算法 |

## 默认值

| 常量 | 值 | 说明 |
|------|----|------|
| `DefaultTimeFormat` | `"2006-01-02T15:04:05Z07:00"` | ISO 8601 时间格式 |
| `DefaultLogPath` | `"logs/app.log"` | 默认日志文件路径 |
| `DefaultMaxSizeMB` | `100` | 默认文件大小限制（MB） |
| `DefaultMaxBackups` | `10` | 默认备份数量 |
| `DefaultMaxAge` | `30 * 24 * time.Hour` | 默认保留天数（30天） |

## 上下文键

| 常量 | 类型 | 值 |
|------|------|----|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## 错误码

`LoggerError.Code` 字段包含机器可读的错误码字符串，用于精细匹配错误类型。错误码为内部实现细节，建议使用哨兵错误进行匹配。

## 哨兵错误

每个错误码对应一个哨兵错误变量：

```go
var (
    ErrNilConfig          = errors.New("config cannot be nil")
    ErrNilWriter          = errors.New("writer cannot be nil")
    ErrNilFilter          = errors.New("filter cannot be nil")
    ErrNilHook            = errors.New("hook cannot be nil")
    ErrNilExtractor       = errors.New("context extractor cannot be nil")
    ErrLoggerClosed       = errors.New("logger is closed")
    ErrWriterNotFound     = errors.New("writer not found")
    ErrInvalidLevel       = errors.New("invalid log level")
    ErrInvalidFormat      = errors.New("invalid log format")
    ErrMaxWritersExceeded = errors.New("maximum writer count exceeded")
    ErrEmptyFilePath      = errors.New("file path cannot be empty")
    ErrPathTooLong        = errors.New("file path too long")
    ErrPathTraversal      = errors.New("path traversal detected")
    ErrNullByte           = errors.New("null byte in input")
    ErrInvalidPath        = errors.New("invalid file path")
    ErrSymlinkNotAllowed  = errors.New("symlinks not allowed")
    ErrHardlinkNotAllowed = errors.New("hardlinks not allowed")
    ErrOverlongEncoding   = errors.New("UTF-8 overlong encoding detected")
    ErrMaxSizeExceeded    = errors.New("maximum size exceeded")
    ErrMaxBackupsExceeded = errors.New("maximum backup count exceeded")
    ErrBufferSizeTooLarge = errors.New("buffer size too large")
    ErrInvalidPattern     = errors.New("invalid regex pattern")
    ErrEmptyPattern       = errors.New("pattern cannot be empty")
    ErrPatternTooLong     = errors.New("pattern length exceeds maximum")
    ErrReDoSPattern       = errors.New("pattern contains dangerous nested quantifiers that may cause ReDoS")
    ErrPatternFailed      = errors.New("failed to add pattern")
    ErrConfigValidation   = errors.New("configuration validation failed")
    ErrWriterAdd          = errors.New("failed to add writer")
    ErrMultipleConfigs    = errors.New("multiple configs provided, expected 0 or 1")
    ErrNilMultiWriter     = errors.New("multiwriter is nil")
)
```

### 错误检查

```go
if errors.Is(err, dd.ErrLoggerClosed) {
    // 日志记录器已关闭
}

if errors.Is(err, dd.ErrPathTraversal) {
    // 检测到路径遍历攻击
}
```

## 错误类型

### LoggerError

```go
type LoggerError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}
```

方法：`Error()`、`Unwrap()`、`Is(target)`、`WithContext(key, value)`、`WithField(key, value)`

```go
// LoggerError 包含错误码、消息、原因和上下文
// 通过 errors.Is 检查哨兵错误
if errors.Is(err, dd.ErrLoggerClosed) {
    // 日志记录器已关闭
}
```

### WriterError

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

方法：`Error()`、`Unwrap()`

### MultiWriterError

```go
type MultiWriterError struct {
    Errors []WriterError
}
```

方法：`Error()`、`Unwrap()`、`HasErrors()`、`ErrorCount()`、`FirstError()`

## 下一步

- [包函数](./functions) -- 错误处理函数
- [安全过滤](./security) -- 路径安全验证
- [钩子系统](./hooks) -- OnError 钩子
