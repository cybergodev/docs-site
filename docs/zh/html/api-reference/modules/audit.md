---
sidebar_label: "审计系统"
title: "审计系统 - CyberGo html | 可插拔审计 API"
description: "CyberGo html 可插拔审计 API：AuditConfig 配置、8 种审计事件、3 个级别、AuditEntry 结构、六种内置 Sink 与级别过滤管道。"
sidebar_position: 4
---

# 审计系统

HTML 库内置可插拔的审计管道，记录安全事件和处理异常。

## AuditConfig

```go
type AuditConfig struct {
    Enabled            bool       `json:"enabled"`             // 启用审计
    LogBlockedTags     bool       `json:"log_blocked_tags"`    // 记录被阻止的标签
    LogBlockedAttrs    bool       `json:"log_blocked_attrs"`   // 记录被阻止的属性
    LogBlockedURLs     bool       `json:"log_blocked_urls"`    // 记录被阻止的 URL
    LogInputViolations bool       `json:"log_input_violations"` // 记录输入违规
    LogDepthViolations bool       `json:"log_depth_violations"` // 记录深度违规
    LogTimeouts        bool       `json:"log_timeouts"`        // 记录超时
    LogEncodingIssues  bool       `json:"log_encoding_issues"` // 记录编码问题
    LogPathTraversal   bool       `json:"log_path_traversal"`  // 记录路径遍历尝试
    Sink               AuditSink  `json:"-"`                   // 审计输出目标（不参与 JSON 序列化）
    IncludeRawValues   bool       `json:"include_raw_values"`  // 包含原始值
    MaxRawValueLength  int        `json:"max_raw_value_length"` // 原始值最大长度
}
```

## 预设审计配置

### DefaultAuditConfig

默认审计配置（默认禁用，所有日志标志为 true）。

```go
func DefaultAuditConfig() AuditConfig
```

| 字段 | 默认值 |
|------|--------|
| `Enabled` | `false` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `false` |
| `MaxRawValueLength` | `200` |

### HighSecurityAuditConfig

高安全审计配置，启用所有日志和原始值记录。

```go
func HighSecurityAuditConfig() AuditConfig
```

| 字段 | 默认值 |
|------|--------|
| `Enabled` | `true` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `true` |
| `MaxRawValueLength` | `500` |

## 类型定义

```go
type AuditEventType string  // 审计事件类型
type AuditLevel string      // 审计严重级别
```

## 审计事件类型

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

## 审计级别

| 常量 | 值 | 说明 |
|------|------|------|
| `AuditLevelInfo` | `"info"` | 信息级别 |
| `AuditLevelWarning` | `"warning"` | 警告级别 |
| `AuditLevelCritical` | `"critical"` | 严重级别 |

## AuditEntry

审计日志条目。

```go
type AuditEntry struct {
    Timestamp time.Time      `json:"timestamp"`          // 事件时间
    EventType AuditEventType `json:"event_type"`         // 事件类型
    Level     AuditLevel     `json:"level"`              // 审计级别
    Message   string         `json:"message"`            // 事件描述
    Tag       string         `json:"tag,omitempty"`      // 相关标签
    Attribute string         `json:"attribute,omitempty"` // 相关属性
    URL       string         `json:"url,omitempty"`      // 相关 URL
    InputSize int            `json:"input_size,omitempty"` // 输入大小
    MaxSize   int            `json:"max_size,omitempty"` // 大小限制
    Depth     int            `json:"depth,omitempty"`    // DOM 深度
    MaxDepth  int            `json:"max_depth,omitempty"` // 深度限制
    Path      string         `json:"path,omitempty"`     // 文件路径
    RawValue  string         `json:"raw_value,omitempty"` // 原始值
    Metadata  map[string]any `json:"metadata,omitempty"` // 附加元数据
}
```

## AuditSink 接口

所有 Sink 类型均实现此接口。

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

## Sink 类型

### LoggerAuditSink

通过标准库 `log.Logger` 输出，带 `[AUDIT]` 前缀。`NewLoggerAuditSink()` **默认输出到标准错误**（`os.Stderr`）；如需重定向到文件、网络连接等，用 `NewLoggerAuditSinkWithWriter(w)` 指定任意 `io.Writer`。

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

### ChannelAuditSink

发送到缓冲 channel，适合异步处理或与外部日志系统集成。`Write` 是**非阻塞**的：当缓冲区已满时，会**丢弃该条目**并递增丢弃计数（不阻塞、不报错），调用方通过 `DroppedCount()` 查询被丢弃的数量，可在监控中据此触发告警或扩容。

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink

func (s *ChannelAuditSink) Channel() <-chan AuditEntry
func (s *ChannelAuditSink) DroppedCount() int64
func (s *ChannelAuditSink) Close() error // 幂等：可安全多次调用，仅首次真正关闭 channel
```

```go
sink := html.NewChannelAuditSink(100)
go func() {
    for entry := range sink.Channel() {
        log.Println(entry.Message)
    }
}()
```

### WriterAuditSink

以 JSON Lines 格式写入 `io.Writer`。

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

### MultiSink

扇出到多个 Sink。`Close` 用 Go 1.20+ 的 `errors.Join` **聚合所有子 Sink 返回的关闭错误**（而非只保留最后一个）——对审计子系统而言，丢弃早期 Sink 的交付失败会掩盖真实问题。

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

### FilteredSink

使用谓词函数过滤条目。

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

### LevelFilteredSink

按最低级别过滤。

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

## 示例

```go
// 创建多层审计管道
writerSink := html.NewWriterAuditSink(auditFile)
levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = multiSink

p, _ := html.New(cfg)
defer p.Close()

// 处理后获取审计日志
entries := p.GetAuditLog()
for _, e := range entries {
    fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
}
```
