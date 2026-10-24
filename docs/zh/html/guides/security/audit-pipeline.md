---
sidebar_label: "审计系统实战"
title: "审计系统实战 - CyberGo html | 管道构建指南"
description: "CyberGo html 审计系统实战：8 种事件类型与 info/warning/critical 三级过滤，7 个内置 Sink 构造函数（Logger、Writer、Channel、Multi、Filtered）与分级路由管道的搭建与接入实践。"
sidebar_position: 20
---

# 审计系统实战

审计系统把安全事件（被拦截的标签、属性与 URL，以及输入违规、深度违规、超时、编码问题、路径穿越）写入可插拔的 Sink。本页从最小配置讲到分级路由管道；事件常量与 Sink 的完整签名见[审计系统参考](../../api-reference/modules/audit)。

## 最小配置

`DefaultConfig()` 已经带 `DefaultAuditConfig()`，启用审计只需打开开关：

```go
cfg := html.DefaultConfig()
cfg.Audit.Enabled = true // 默认配置里 Enabled 为 false
```

启用后 `Sink` 为 `nil`，事件走默认的 `LoggerAuditSink`，输出到标准错误，格式为 `[AUDIT] JSON`。

## 事件类型与级别

三个级别按严重度递增，`LevelFilteredSink` 与告警路由都以它为依据：

```text
info < warning < critical
```

| 事件 | 常量值 | 级别 | 触发条件 |
|------|--------|------|----------|
| 阻止标签 | `blocked_tag` | warning | 危险标签被移除（如 `<script>`） |
| 阻止属性 | `blocked_attr` | warning | 危险属性被移除（如 `onclick`） |
| 阻止 URL | `blocked_url` | warning | 危险 URL 被拦截 |
| 输入违规 | `input_violation` | critical | 输入超出大小限制 |
| 深度违规 | `depth_violation` | warning | DOM 嵌套超过 `MaxDepth` |
| 处理超时 | `timeout` | warning | 库内 `ProcessingTimeout` 到期 |
| 编码问题 | `encoding_issue` | info | 编码检测或转换失败 |
| 路径穿越 | `path_traversal` | critical | 路径含 `..` 组件，或 `AllowedBaseDir` 模式下经 OS 句柄解析后越界 |

`info` 无需告警；`warning` 关注趋势；`critical` 对应攻击特征（输入违规、路径穿越），应直接触发告警。

## 内置 Sink

7 个构造函数覆盖 6 类 Sink：

| 构造函数 | 输出目标 | 关键行为 |
|----------|----------|----------|
| `NewLoggerAuditSink()` | 标准错误 | 带 `[AUDIT]` 前缀；默认 Sink |
| `NewLoggerAuditSinkWithWriter(w)` | 任意 `io.Writer` | `w` 为 `nil` 时回退标准错误 |
| `NewWriterAuditSink(w)` | 任意 `io.Writer` | JSON Lines，适合文件持久化 |
| `NewChannelAuditSink(size)` | 带缓冲 channel | 缓冲满时丢弃并计数，不阻塞 |
| `NewMultiSink(sinks...)` | 多个 Sink | `Close` 用 `errors.Join` 聚合子 Sink 错误 |
| `NewFilteredSink(sink, filter)` | 谓词过滤 | `filter` 返回 `true` 才写入下游；`filter` 为 `nil` 时全部放行 |
| `NewLevelFilteredSink(sink, minLevel)` | 级别过滤 | 条目级别达到 `minLevel` 才写入下游 |

`WriterAuditSink` 的每条记录是一行 JSON：

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

`ChannelAuditSink` 由消费方在独立 goroutine 中读取，适合接入外部系统：

```go
sink := html.NewChannelAuditSink(100)

go func() {
	for entry := range sink.Channel() {
		sendToSIEM(entry)
	}
}()

// channel 满时事件被丢弃而非阻塞
fmt.Printf("丢弃：%d\n", sink.DroppedCount())
```

## 构建管道

### 场景一：文件持久化

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

cfg := html.DefaultConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewWriterAuditSink(file)
```

`WriterAuditSink.Close` 是 no-op，不会关闭底层文件；句柄由调用方自己负责关闭，所以文件要在 Sink 之外打开。

### 场景二：分级路由

所有事件落文件，`critical` 额外进告警通道：

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

alertSink := html.NewChannelAuditSink(50)
go func() {
	for entry := range alertSink.Channel() {
		sendAlert(entry) // 接入 PagerDuty / Slack / 短信
	}
}()

cfg := html.DefaultConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(file),
	html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
		return e.Level == html.AuditLevelCritical
	}),
)
```

`MultiSink` 按顺序写入各子 Sink；两路互不阻塞的前提是每个子 Sink 的 `Write` 自身非阻塞，内置 Sink 都满足这一点。

### 场景三：高安全模式

`HighSecurityConfig()` 已把 `Audit` 设为 `HighSecurityAuditConfig()`，只需替换 Sink：

```go
file, err := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
if err != nil {
	log.Fatal(err)
}
defer file.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(file),
	html.NewLoggerAuditSink(),
)

p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

高安全审计配置的取值：`Enabled = true`、8 类事件全部记录、`IncludeRawValues = true`、`MaxRawValueLength = 500`。原始值便于取证，但日志里会落入攻击载荷原文——只在确认下游对日志做了转义或隔离时开启。

## 查询审计日志

Processor 会把条目同时留在内存中，便于在同一进程内查询：

```go
p, err := html.New(cfg)
if err != nil {
	log.Fatal(err)
}
defer p.Close()

if _, err := p.Extract(data); err != nil {
	log.Printf("提取失败: %v", err)
}

entries := p.GetAuditLog()
for _, entry := range entries {
	fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

p.ClearAuditLog()
```

:::tip `GetAuditLog` 只返回内存中的条目
内存保留量由 `AuditConfig.MaxEntries` 控制（默认 10000，上限 100000），达到上限时丢弃最旧的一半，只留最近事件。需要完整留存时配置 Sink，而不是依赖 `GetAuditLog`。
:::

## 自定义 Sink

实现 `AuditSink` 的两个方法即可接入任意目的地。`Write` 会在提取路径上同步调用，因此必须非阻塞且并发安全：

```go
type slackSink struct {
	webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
	if entry.Level != html.AuditLevelCritical {
		return // 只发送 critical
	}
	msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
	if _, err := http.Post(s.webhook, "text/plain", strings.NewReader(msg)); err != nil {
		log.Printf("发送审计告警失败: %v", err)
	}
}

func (s *slackSink) Close() error {
	return nil
}
```

上面的写法在 `Write` 里同步发 HTTP 请求，会拖慢提取路径；生产上应写入 channel 或队列后异步发送。另外两点由库保证，无需自己处理：Sink 自身 panic 不会传播给调用方（SEC-003），`Processor.Close()` 会调用 Sink 的 `Close()` 并把其错误返回。

## 下一步

- [生产检查清单](./production-checklist) — 部署前安全核对
- [API 参考：审计系统](../../api-reference/modules/audit) — 完整 API 签名
- [错误处理](../performance/error-handling) — 安全错误的分类与处理
