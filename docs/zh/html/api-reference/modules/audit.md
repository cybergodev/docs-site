---
sidebar_label: "审计系统"
title: "审计系统 - CyberGo html | 可插拔审计 API"
description: "CyberGo html 审计 API 参考：AuditConfig 字段与默认、高安全预设，8 种事件类型、3 个级别、AuditEntry 结构，以及 Logger、Writer、Channel、Multi、Filtered、LevelFiltered 六种 Sink 与 7 个构造函数。"
sidebar_position: 40
---

# 审计系统

审计系统把安全事件（被拦截的标签、属性、URL，以及超时、路径遍历等）记录为 `AuditEntry`，再经可插拔的 `Sink` 发往一个或多个目的地。行为由 `AuditConfig` 控制。

## AuditConfig

```go
type AuditConfig struct {
	Enabled            bool      `json:"enabled"`              // 启用审计
	LogBlockedTags     bool      `json:"log_blocked_tags"`     // 记录被阻止的标签
	LogBlockedAttrs    bool      `json:"log_blocked_attrs"`    // 记录被阻止的属性
	LogBlockedURLs     bool      `json:"log_blocked_urls"`     // 记录被阻止的 URL
	LogInputViolations bool      `json:"log_input_violations"` // 记录输入违规
	LogDepthViolations bool      `json:"log_depth_violations"` // 记录深度违规
	LogTimeouts        bool      `json:"log_timeouts"`         // 记录超时
	LogEncodingIssues  bool      `json:"log_encoding_issues"`  // 记录编码问题
	LogPathTraversal   bool      `json:"log_path_traversal"`   // 记录路径遍历尝试
	Sink               AuditSink `json:"-"`                    // 审计输出目标（不参与 JSON 序列化）
	IncludeRawValues   bool      `json:"include_raw_values"`   // 包含原始值
	MaxRawValueLength  int       `json:"max_raw_value_length"` // 原始值最大长度
	MaxEntries         int       `json:"max_entries"`          // 内存审计条目上限
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `AuditConfig.Enabled` | `bool` | 是否启用审计 |
| `AuditConfig.LogBlockedTags` | `bool` | 记录被移除的危险标签 |
| `AuditConfig.LogBlockedAttrs` | `bool` | 记录被移除的危险属性 |
| `AuditConfig.LogBlockedURLs` | `bool` | 记录被阻止的危险 URL |
| `AuditConfig.LogInputViolations` | `bool` | 记录输入大小与校验违规 |
| `AuditConfig.LogDepthViolations` | `bool` | 记录嵌套深度超限 |
| `AuditConfig.LogTimeouts` | `bool` | 记录处理超时事件 |
| `AuditConfig.LogEncodingIssues` | `bool` | 记录编码检测问题 |
| `AuditConfig.LogPathTraversal` | `bool` | 记录路径遍历尝试 |
| `AuditConfig.Sink` | `AuditSink` | 审计输出目标；启用审计且为 `nil` 时默认使用 `LoggerAuditSink` |
| `AuditConfig.IncludeRawValues` | `bool` | 日志中包含原始属性/URL 值（可能含恶意内容，谨慎启用） |
| `AuditConfig.MaxRawValueLength` | `int` | 原始值最大记录长度，超出截断；`0` 使用默认值 `DefaultMaxRawValueLength`（200） |
| `AuditConfig.MaxEntries` | `int` | `GetAuditLog` 内存保留条目上限（`0` 使用默认 10000） |

## 预设审计配置

### DefaultAuditConfig

`DefaultAuditConfig` 返回默认审计配置（默认禁用，所有日志标志为 `true`）。

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
| `MaxEntries` | `10000`（`DefaultMaxAuditEntries`） |

### HighSecurityAuditConfig

`HighSecurityAuditConfig` 返回高安全审计配置，启用所有日志和原始值记录。

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
| `MaxEntries` | `10000`（`DefaultMaxAuditEntries`） |

:::info MaxEntries 的行为
`MaxEntries` 限制 `GetAuditLog` 在内存中保留的条目数。设为 `0` 时使用默认值 `DefaultMaxAuditEntries`（10000）；负数或超过 `100000`（`maxConfigAuditEntries`）会被 `Config.Validate` 拒绝。条目数达到上限时丢弃最旧的一半，始终保留最近的事件。需要不受内存上限约束的留存时，接入 `AuditSink`。
:::

## 类型定义

```go
type AuditEventType string  // 审计事件类型
type AuditLevel string      // 审计严重级别
```

`AuditEventType` 标识审计事件的类别（取值见下表常量），`AuditLevel` 标识事件的严重级别，二者均为 `string` 类型别名。

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
	Timestamp time.Time      `json:"timestamp"`           // 事件时间
	EventType AuditEventType `json:"event_type"`          // 事件类型
	Level     AuditLevel     `json:"level"`               // 审计级别
	Message   string         `json:"message"`             // 事件描述
	Tag       string         `json:"tag,omitempty"`       // 相关标签
	Attribute string         `json:"attribute,omitempty"` // 相关属性
	URL       string         `json:"url,omitempty"`       // 相关 URL
	InputSize int            `json:"input_size,omitempty"` // 输入大小
	MaxSize   int            `json:"max_size,omitempty"`  // 大小限制
	Depth     int            `json:"depth,omitempty"`     // DOM 深度
	MaxDepth  int            `json:"max_depth,omitempty"` // 深度限制
	Path      string         `json:"path,omitempty"`      // 文件路径
	RawValue  string         `json:"raw_value,omitempty"` // 原始值
	Metadata  map[string]any `json:"metadata,omitempty"`  // 附加元数据
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `AuditEntry.Timestamp` | `time.Time` | 事件记录时间（UTC） |
| `AuditEntry.EventType` | `AuditEventType` | 事件类别（如 `blocked_tag`、`timeout`） |
| `AuditEntry.Level` | `AuditLevel` | 严重级别（`info` / `warning` / `critical`） |
| `AuditEntry.Message` | `string` | 人类可读的事件描述 |
| `AuditEntry.Tag` | `string` | 触发事件的 HTML 标签名（适用时） |
| `AuditEntry.Attribute` | `string` | 触发事件的属性名（适用时） |
| `AuditEntry.URL` | `string` | 触发事件的资源 URL（适用时） |
| `AuditEntry.InputSize` | `int` | 输入违规事件的实际输入大小 |
| `AuditEntry.MaxSize` | `int` | 输入违规事件配置的大小上限 |
| `AuditEntry.Depth` | `int` | 深度违规事件的实际嵌套深度 |
| `AuditEntry.MaxDepth` | `int` | 深度违规事件配置的深度上限 |
| `AuditEntry.Path` | `string` | 路径遍历事件的文件路径（脱敏为文件名） |
| `AuditEntry.RawValue` | `string` | 触发事件的原始属性/URL 值（仅 `IncludeRawValues=true` 时填充） |
| `AuditEntry.Metadata` | `map[string]any` | 事件相关的附加键值对 |

:::tip 字段填充约定
`Timestamp`、`EventType`、`Level`、`Message` 对每条记录恒有值；`Tag`、`Attribute`、`URL` 仅在对应事件（阻止标签/属性/URL）时填充；`InputSize`/`MaxSize` 与 `Depth`/`MaxDepth` 分别随输入违规与深度违规事件填充；`RawValue` 仅在 `IncludeRawValues=true` 时保留；`Metadata` 承载事件特定的附加键值对。
:::

## AuditSink 接口

```go
type AuditSink interface {
	Write(entry AuditEntry)
	Close() error
}
```

实现方提供两个方法：`Write` 写入单条 `AuditEntry`（约定**非阻塞且并发安全**），`Close` 释放资源。内置 Sink 共 7 个构造函数，覆盖 6 种 Sink 类型。

## Sink 类型

### LoggerAuditSink

`LoggerAuditSink` 通过标准库 `log.Logger` 输出，带 `[AUDIT]` 前缀。`NewLoggerAuditSink` 默认写入标准错误（`os.Stderr`）；要重定向到文件或网络连接，用 `NewLoggerAuditSinkWithWriter(w)` 指定任意 `io.Writer`（`w` 为 `nil` 时回退到标准错误）。

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

| 方法 | 说明 |
|------|------|
| `LoggerAuditSink.Write` | 将条目序列化为 JSON 后写入 logger（`[AUDIT]` 前缀） |
| `LoggerAuditSink.Close` | no-op，始终返回 `nil` |

### ChannelAuditSink

`ChannelAuditSink` 把条目发送到缓冲 channel，适合异步处理或对接外部日志系统。用 `NewChannelAuditSink(bufferSize)` 创建，消费者从 `Channel()` 返回的只读 channel 接收。`Write` **非阻塞**：缓冲区满时丢弃该条目并递增丢弃计数（不阻塞、不报错），丢弃数量可用 `DroppedCount()` 查询，可据此告警或扩容。

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink
```

`bufferSize` 为负数时按 `0` 处理（无缓冲 channel）；超过 `100000` 时按 `100000` 处理，避免一次性分配超大 channel。

| 方法 | 签名 | 说明 |
|------|------|------|
| `ChannelAuditSink.Channel` | `func (s *ChannelAuditSink) Channel() <-chan AuditEntry` | 返回只读接收 channel |
| `ChannelAuditSink.DroppedCount` | `func (s *ChannelAuditSink) DroppedCount() int64` | 返回因缓冲满而被丢弃的条目数 |
| `ChannelAuditSink.Write` | `func (s *ChannelAuditSink) Write(entry AuditEntry)` | 非阻塞写入；缓冲满时丢弃并计数 |
| `ChannelAuditSink.Close` | `func (s *ChannelAuditSink) Close() error` | 关闭 channel（幂等：仅首次真正关闭） |

```go
sink := html.NewChannelAuditSink(100)
go func() {
	for entry := range sink.Channel() {
		log.Println(entry.Message)
	}
}()
```

### WriterAuditSink

`WriterAuditSink` 以 JSON Lines 格式写入 `io.Writer`，用 `NewWriterAuditSink(w)` 创建。

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

| 方法 | 说明 |
|------|------|
| `WriterAuditSink.Write` | 将条目序列化为 JSON 后写入底层 writer |
| `WriterAuditSink.Close` | no-op，始终返回 `nil` |

### MultiSink

`MultiSink` 把条目扇出到多个 Sink，用 `NewMultiSink(sinks...)` 创建。`Close` 用 `errors.Join` **聚合所有子 Sink 的关闭错误**，而不是只保留最后一个——丢弃早期 Sink 的交付失败会掩盖真实问题。

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

| 方法 | 说明 |
|------|------|
| `MultiSink.Write` | 将条目写入全部子 Sink（跳过 `nil`） |
| `MultiSink.Close` | 关闭全部子 Sink，用 `errors.Join` 聚合错误 |

### FilteredSink

`FilteredSink` 用谓词函数过滤条目，用 `NewFilteredSink(sink, filter)` 创建。

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

| 方法 | 说明 |
|------|------|
| `FilteredSink.Write` | 谓词返回 `true`（或谓词为 `nil`）时写入底层 Sink |
| `FilteredSink.Close` | 关闭底层 Sink |

### LevelFilteredSink

`LevelFilteredSink` 按最低级别过滤，用 `NewLevelFilteredSink(sink, minLevel)` 创建。

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

| 方法 | 说明 |
|------|------|
| `LevelFilteredSink.Write` | 条目级别达到 `minLevel` 及以上时写入底层 Sink |
| `LevelFilteredSink.Close` | 关闭底层 Sink |

## 示例

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/cybergodev/html"
)

func main() {
	auditFile, err := os.Create("audit.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	defer auditFile.Close()

	// 多层管道：warning 及以上写入文件，所有事件另发一份到 stderr
	writerSink := html.NewWriterAuditSink(auditFile)
	levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
	multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

	cfg := html.DefaultConfig()
	cfg.Audit.Enabled = true
	cfg.Audit.Sink = multiSink

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body><script>alert(1)</script><p>正文</p></body></html>`)
	if _, err := p.Extract(data); err != nil {
		log.Fatal(err)
	}

	// 内存中的审计条目
	for _, e := range p.GetAuditLog() {
		fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
	}
	// 输出（节选）：[warning] blocked_tag: Blocked dangerous HTML tag: script
}
```

## 相关文档

- [审计系统实战](../../guides/security/audit-pipeline) — 审计管道构建指南
- [安全概述](../../guides/security/) — 安全特性的概念介绍与最佳实践
- [生产检查清单](../../guides/security/production-checklist) — 上线安全核对
