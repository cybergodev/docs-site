---
sidebar_label: "常量与错误"
title: "常量与错误 - CyberGo html | 默认值与错误类型"
description: "CyberGo html 常量与错误参考：默认配置常量、8 种审计事件与 3 级审计级别、12 个哨兵错误，以及 InputError、ConfigError、FileError 三个结构化错误的字段、方法与 errors.Is/errors.As 判断用法。"
sidebar_position: 30
---

# 常量与错误

## 默认配置常量

| 常量 | 类型 | 值 | 说明 |
|------|------|----|------|
| `DefaultMaxInputSize` | `int` | `52428800` | 最大输入大小（50MB） |
| `DefaultMaxCacheEntries` | `int` | `2000` | 缓存条目上限 |
| `DefaultWorkerPoolSize` | `int` | `4` | 工作池大小 |
| `DefaultCacheTTL` | `time.Duration` | `1h` | 缓存过期时间 |
| `DefaultCacheCleanup` | `time.Duration` | `5m` | 缓存清理间隔 |
| `DefaultMaxAuditEntries` | `int` | `10000` | 内存审计条目上限（`AuditConfig.MaxEntries` 为 0 时使用） |
| `DefaultMaxRawValueLength` | `int` | `200` | 审计 `RawValue` 字符串长度上限 |
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

审计系统用法与 Sink 类型见 [审计系统](../modules/audit)。

## 哨兵错误

| 错误 | 消息 | 说明 |
|------|------|------|
| `ErrInputTooLarge` | `html: input size exceeds maximum` | 输入超过大小限制 |
| `ErrInvalidHTML` | `html: invalid HTML` | 无效 HTML 内容 |
| `ErrProcessorClosed` | `html: processor closed` | 处理器已关闭 |
| `ErrMaxDepthExceeded` | `html: max depth exceeded` | 超过最大深度 |
| `ErrInvalidConfig` | `html: invalid config` | 无效配置 |
| `ErrProcessingTimeout` | `html: processing timeout exceeded` | 库内处理超时 |
| `ErrFileNotFound` | `html: file not found` | 文件未找到 |
| `ErrInvalidFilePath` | `html: invalid file path` | 无效文件路径 |
| `ErrInternalPanic` | `html: internal panic recovered` | 内部 panic 已恢复 |
| `ErrMultipleConfigs` | `html: at most one Config may be provided` | 传入多个 Config |
| `ErrBatchTooLarge` | `html: batch size exceeds maximum` | 批量项数超过单批上限（10000） |
| `ErrTooManyConcurrentOps` | `html: too many concurrent operations` | 并发超时 watchdog 达全局上限（1000），未发生超时 |

用户 context 的 deadline 到期时返回 `context.DeadlineExceeded`，不会被归一化为 `ErrProcessingTimeout`。

## 错误类型

### InputError

`InputError` 表示输入相关错误，携带大小信息。

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

`Unwrap` 返回**错误切片**而非单个错误。无论是否携带底层错误，`ErrInputTooLarge` 恒在列表中，因此 `errors.Is(err, ErrInputTooLarge)` 对任意 `*InputError` 都成立。

### ConfigError

`ConfigError` 表示配置校验错误，携带字段信息。

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
| `ConfigError.Error` | 格式化为 `html: invalid config: <字段>=<值>, <描述>` |
| `ConfigError.Unwrap` | 返回 `ErrInvalidConfig` |

### FileError

`FileError` 表示文件操作错误，输出时自动截断路径。

```go
type FileError struct {
	Op      string // 操作名
	Path    string // 文件路径
	FileErr error  // 原始错误
}

func (e *FileError) Error() string                // 安全输出（截断路径）
func (e *FileError) SafePath() string             // 仅返回文件名
func (e *FileError) Unwrap() error                // → ErrFileNotFound | 原始错误 | ErrInvalidFilePath
func (e *FileError) MarshalJSON() ([]byte, error) // 序列化时经 SafePath() 截断 Path
```

| 成员 | 类型 | 说明 |
|------|------|------|
| `FileError.Op` | `string` | 失败的操作名（如 `"ExtractFromFile"`、`"ReadFile"`） |
| `FileError.Path` | `string` | 完整文件路径（仅调试用，勿直接输出） |
| `FileError.FileErr` | `error` | 底层文件系统错误 |

| 方法 | 说明 |
|------|------|
| `FileError.Error` | 安全输出（路径截断为文件名，底层错误消息同步脱敏） |
| `FileError.SafePath` | 仅返回文件名（无分隔符时原样返回） |
| `FileError.Unwrap` | → `ErrFileNotFound` \| 原始错误 \| `ErrInvalidFilePath` |
| `FileError.MarshalJSON` | 序列化为 `{op, path, message}`，`path` 经 `SafePath()` 截断 |

:::tip 输出路径时的安全默认值
`FileError.Error()` 与 `SafePath()` 都只返回文件名，可直接写进 HTTP 响应或日志。需要完整路径时读取 `Path` 字段，仅限内部调试。
:::

## 内部限制常量

以下常量定义库的运行时硬上限。它们**非导出**（小写开头），不能直接引用，但决定边界行为。

### 配置上限

| 常量 | 值 | 说明 |
|------|----|------|
| `maxConfigInputSize` | `52428800` (50MB) | `MaxInputSize` 上限，超出即被 `Validate()` 拒绝 |
| `maxConfigWorkerSize` | `256` | `WorkerPoolSize` 上限 |
| `maxConfigDepth` | `500` | `MaxDepth` 上限 |
| `maxConfigCacheEntries` | `100000` | `MaxCacheEntries` 上限（按每条 1KB 估算约 100MB） |
| `maxConfigAuditEntries` | `100000` | `Audit.MaxEntries` 上限，即 `GetAuditLog` 内存保留条目上限 |

### 处理限制

| 常量 | 值 | 说明 |
|------|----|------|
| `maxBatchSize` | `10000` | 单次批量最大项数，超限整批返回错误 |
| `maxTimeoutGoroutines` | `1000` | 全局并发超时 goroutine 上限，超限新请求返回 `ErrTooManyConcurrentOps` |
| `maxHTMLForRegex` | `1000000` (1MB) | 原始 HTML 媒体扫描的大小上限；超过则整段扫描跳过（防 ReDoS） |
| `maxRegexMatches` | `1000` | 单次扫描的最大媒体 URL 匹配数，防止媒体密集页面过量分配 |

这些限制的实际影响：

- HTML 超过 1MB 时，原始 HTML 扫描（`<iframe>`/`<embed>`/`<object>` 的标签属性与裸媒体 URL）不再执行；DOM 遍历对 `<video>`/`<audio>` 的提取不受影响。
- 批量项数超过 10000 时整批失败（返回 `ErrBatchTooLarge`，非 panic），不会只处理前 10000 项。
- 同时进行的带超时调用超过 1000 个时，新调用立即返回 `ErrTooManyConcurrentOps`，需要等待在途操作结束再重试。

## 错误处理模式

```go
result, err := html.Extract(data)
if err != nil {
	var inputErr *html.InputError
	var configErr *html.ConfigError
	var fileErr *html.FileError

	switch {
	case errors.Is(err, html.ErrInvalidConfig):
		// 配置错误：errors.As 可取出具体字段与原因
		if errors.As(err, &configErr) {
			fmt.Printf("配置字段 %s 无效：%s\n", configErr.Field, configErr.Message)
		}
	case errors.Is(err, html.ErrInputTooLarge):
		// 输入过大：errors.As 可取出实际大小与上限
		if errors.As(err, &inputErr) {
			fmt.Printf("大小 %d 超过限制 %d\n", inputErr.Size, inputErr.MaxSize)
		}
	case errors.Is(err, html.ErrInvalidHTML):
		// 无效 HTML
	case errors.Is(err, html.ErrFileNotFound):
		// 文件不存在
	case errors.As(err, &fileErr):
		// 其他文件错误（含路径遍历，它不匹配任何哨兵）
		fmt.Println("文件：", fileErr.SafePath())
	}
}
```
