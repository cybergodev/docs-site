---
title: "审计系统实战 - HTML"
description: "CyberGo HTML 审计系统实战指南，从基础启用到构建多层级审计管道，涵盖审计事件类型详解、内置 Sink 选择对比、LevelFilteredSink 级别过滤、自定义 Sink 实现、FilteredSink 事件过滤，以及生产环境审计监控最佳实践，帮助建立完善的安全审计体系。"
---

# 审计系统实战

审计系统记录 HTML 处理过程中的安全事件，帮助你监控和排查潜在风险。

## 快速启用

最简配置，3 行代码启用审计：

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

p, _ := html.New(cfg)
defer p.Close()
```

启用后，安全事件会输出到标准错误，格式为 `[AUDIT] JSON`。

## 审计事件类型

| 事件 | 常量 | 级别 | 触发条件 |
|------|------|------|----------|
| 阻止标签 | `blocked_tag` | warning | 危险标签被移除（如 `<script>`） |
| 阻止属性 | `blocked_attr` | warning | 危险属性被移除（如 `onclick`） |
| 阻止 URL | `blocked_url` | warning | 危险 URL 被拦截 |
| 输入违规 | `input_violation` | critical | 输入超出大小限制 |
| 深度违规 | `depth_violation` | warning | DOM 嵌套超过限制 |
| 处理超时 | `timeout` | warning | 单次处理超时 |
| 编码问题 | `encoding_issue` | info | 编码检测失败 |
| 路径穿越 | `path_traversal` | critical | 文件路径包含 `..` |

## 审计级别

```text
info < warning < critical
```

- **info**：信息性事件（编码问题），无需告警
- **warning**：需要关注的异常（超时、深度违规）
- **critical**：安全威胁（输入违规、路径穿越）

## 内置 Sink 类型

### LoggerAuditSink（默认）

输出到标准错误，带 `[AUDIT]` 前缀：

```go
// 默认输出到 stderr
sink := html.NewLoggerAuditSink()

// 输出到自定义 Writer
sink := html.NewLoggerAuditSinkWithWriter(os.Stdout)
```

### WriterAuditSink

将 JSON Lines 写入 `io.Writer`，适合文件持久化：

```go
file, _ := os.Create("audit.jsonl")
defer file.Close()

sink := html.NewWriterAuditSink(file)
```

输出格式（每行一条 JSON）：

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

### ChannelAuditSink

异步发送到 channel，适合集成外部系统：

```go
sink := html.NewChannelAuditSink(100)

// 消费审计事件
go func() {
    for entry := range sink.Channel() {
        sendToSIEM(entry)
    }
}()

// 检查丢失的事件（channel 满时自动丢弃）
fmt.Printf("丢弃: %d\n", sink.DroppedCount())
```

### MultiSink

扇出到多个 Sink：

```go
sink := html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)
```

### FilteredSink

按条件过滤事件：

```go
// 只记录 critical 级别事件
sink := html.NewFilteredSink(
    fileSink,
    func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    },
)
```

### LevelFilteredSink

按最低级别过滤：

```go
// 只记录 warning 及以上
sink := html.NewLevelFilteredSink(fileSink, html.AuditLevelWarning)
```

## 构建审计管道

### 场景一：文件持久化

```go
func newAuditPipeline() html.AuditSink {
    file, _ := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    return html.NewWriterAuditSink(file)
}

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = newAuditPipeline()
```

### 场景二：分级路由

critical 事件发送到告警系统，其他事件写入文件：

```go
func newTieredPipeline() html.AuditSink {
    file, _ := os.Create("audit.jsonl")

    return html.NewMultiSink(
        // 所有事件写入文件
        html.NewWriterAuditSink(file),
        // critical 事件额外发送告警
        html.NewFilteredSink(
            html.NewChannelAuditSink(50),
            func(e html.AuditEntry) bool {
                return e.Level == html.AuditLevelCritical
            },
        ),
    )
}
```

### 场景三：高安全模式

使用 `HighSecurityConfig` 和 `HighSecurityAuditConfig`：

```go
cfg := html.HighSecurityConfig()
cfg.Audit = html.HighSecurityAuditConfig()
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)

p, _ := html.New(cfg)
```

高安全模式的审计特点：
- 自动启用审计
- 记录所有事件类型
- 包含原始值（`IncludeRawValues = true`），便于取证分析
- 原始值最大长度 500 字符

## 查询审计日志

通过 Processor 方法查询已收集的事件：

```go
p, _ := html.New(cfg)
defer p.Close()

// 处理内容
p.Extract(data)

// 获取审计日志
entries := p.GetAuditLog()
for _, entry := range entries {
    fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

// 清除日志
p.ClearAuditLog()
```

:::tip 内存中的日志仅限 Processor 实例
`GetAuditLog()` 返回的是 Processor 内存中收集的事件。如果要持久化，请配置 Sink。
:::

## 自定义 Sink

实现 `AuditSink` 接口，将审计事件发送到任意目标：

```go
type slackSink struct {
    webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
    if entry.Level != html.AuditLevelCritical {
        return // 只发送 critical
    }
    msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
    http.Post(s.webhook, "text/plain", strings.NewReader(msg))
}

func (s *slackSink) Close() error {
    return nil
}
```

## 下一步

- [API 参考：审计系统](../api-reference/audit) - 完整 API 签名
- [安全](../security/) - 安全功能概述
- [生产检查清单](../security/production-checklist) - 部署前检查
