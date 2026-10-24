---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo html | 上线安全核对"
description: "CyberGo html 上线安全核对清单：按 P0/P1/P2 分级逐项检查 HighSecurityConfig 预设、Processor 生命周期、审计监控、超时错误语义、错误分类处理与 AllowedBaseDir 文件沙箱，附部署前自检脚本与运行时监控指标。"
sidebar_position: 30
---

# 生产检查清单

上线前逐项核对。优先级含义：

- 🔴 **必须（P0）**：不做到会有安全漏洞或资源泄漏
- 🟡 **推荐（P1）**：影响可靠性与可观测性
- 🟢 **可选（P2）**：有余力再做

:::tip 从预设出发，按业务放宽
`HighSecurityConfig()` 已把各项限制收紧到安全档位并启用完整审计。面向不可信输入时直接用它，再按需放宽单个字段。
:::

## 基础配置

- [ ] 🔴 使用 `HighSecurityConfig()` 或自定义安全配置作为起点
- [ ] 🔴 设置合理的 `MaxInputSize`（硬上限 50MB）
- [ ] 🔴 设置 `ProcessingTimeout` 防止长时间阻塞（建议 10–30s）
- [ ] 🟡 配置 `MaxDepth` 限制 DOM 深度（默认 500，高安全建议 100）
- [ ] 🟡 保持 `EnableSanitization = true`（默认已开）
- [ ] 🟢 根据并发量调整 `WorkerPoolSize`（默认 4，上限 256）

**为什么**

- `MaxInputSize` 是第一道内存防线，且受 `maxConfigInputSize`（50MB）硬约束，误配也放不大。批量处理的峰值内存大致按 `MaxInputSize × WorkerPoolSize` 估算，公网 API 建议收到 10MB。
- `WorkerPoolSize` 决定批量提取的并发度，一般取 CPU 核心数。接近 256 上限会带来明显的 goroutine 与内存压力。
- `MaxDepth` 只有低于解析器阈值才有效：`golang.org/x/net/html` 在约 512 个未闭合元素时先返回 `ErrInvalidHTML`，库的 `MaxDepth` 校验发生在解析成功之后。

## Processor 生命周期

- [ ] 🔴 用 `defer p.Close()` 释放 Processor
- [ ] 🔴 `Close()` 之后不再调用任何提取方法（会返回 `ErrProcessorClosed`）
- [ ] 🟡 跨请求复用同一个 Processor，而不是每次请求新建

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
	log.Fatal(err)
}
defer p.Close()
```

**为什么**

- `Processor` 并发安全，内部缓存与统计计数器都做了同步保护，可做成应用级单例（如 handler 持有一个全局 `*html.Processor`）。
- 每次 `html.New()` 都要分配缓存与审计结构，`CacheTTL` 与 `CacheCleanup` 均大于 0 时还会启动后台清扫 goroutine；逐请求新建既浪费资源又增加 GC 压力。
- 包级函数（`html.Extract` 等）内部用 `sync.Pool` 复用临时 Processor，但池化实例每次归还都会清空缓存，跨调用不会命中——需要缓存就显式持有实例。

## 审计与监控

- [ ] 🔴 启用审计（`Audit.Enabled = true`）
- [ ] 🟡 用 `WriterAuditSink` 把审计日志持久化到文件
- [ ] 🟡 监控 `GetStatistics()` 的 `ErrorCount` 与 `CacheHits`
- [ ] 🟡 对 critical 事件（输入违规、路径穿越）配置实时告警
- [ ] 🟢 用 `ChannelAuditSink` 把审计流接入外部 SIEM

```go
auditFile, err := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
if err != nil {
	log.Fatal(err)
}
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

**分级审计管道**：critical 事件实时告警，其余写入文件留档。

```go
alertSink := html.NewChannelAuditSink(50)
go func() {
	for entry := range alertSink.Channel() {
		sendAlert(entry) // 接入 PagerDuty / Slack / 短信
	}
}()

cfg.Audit.Sink = html.NewMultiSink(
	html.NewWriterAuditSink(auditFile),
	html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
		return e.Level == html.AuditLevelCritical
	}),
)
```

**丢弃监控**：channel 缓冲满时事件被丢弃而不是阻塞，用 `DroppedCount()` 巡检。

```go
if n := alertSink.DroppedCount(); n > 0 {
	log.Printf("告警 channel 丢弃了 %d 条审计事件，请扩容缓冲或加快消费", n)
}
```

更多管道模式见[审计系统实战](./audit-pipeline)。

## 上下文与超时

- [ ] 🔴 提取操作使用 `ExtractWithContext`，而不是裸 `Extract`
- [ ] 🔴 设置合理的 context 超时
- [ ] 🟡 批量操作使用可取消的 context，出错时能中止剩余任务

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := p.ExtractWithContext(ctx, data)
```

**为什么**

- 库有两层超时：`Config.ProcessingTimeout`（默认 30s，单文档生效）与调用方 context。两者同时存在时，先到期的先生效。
- 错误类型按触发源区分：库内 `ProcessingTimeout` 到期返回 `ErrProcessingTimeout`；调用方 context 到期原样返回 `context.DeadlineExceeded`，**不**归一化；`cancel()` 返回 `context.Canceled`。日志与告警应分别统计。
- 超时通过独立 goroutine + context deadline 实现，进程级上限 `maxTimeoutGoroutines`（1000）。超限时新请求直接返回 `ErrTooManyConcurrentOps`，不会无界堆积 goroutine。

## 错误处理

- [ ] 🔴 用 `errors.Is` 区分业务错误与安全错误
- [ ] 🔴 对 `*FileError` 用 `SafePath()` 输出，而非原始错误字符串
- [ ] 🟡 记录所有 `ErrInputTooLarge` 与深度类错误（可能是攻击探测）
- [ ] 🟡 监控 `ErrInternalPanic` 频率（出现即应排查并上报 issue）
- [ ] 🟢 对 `ErrProcessorClosed` 做优雅降级而非崩溃

```go
_, err := p.Extract(data)
switch {
case errors.Is(err, html.ErrInputTooLarge):
	log.Printf("输入超限，疑似攻击探测")
case errors.Is(err, html.ErrMaxDepthExceeded):
	log.Printf("深度违规，疑似递归炸弹")
case errors.Is(err, html.ErrInvalidHTML):
	// 约 512 层未闭合标签会先被解析器拒绝，此时看到的不是深度错误
	log.Printf("解析失败: %v", err)
case errors.Is(err, html.ErrInternalPanic):
	log.Printf("内部 panic 已恢复: %v", err)
case errors.Is(err, html.ErrFileNotFound),
	errors.Is(err, html.ErrInvalidFilePath):
	var fe *html.FileError
	if errors.As(err, &fe) {
		log.Printf("文件错误: %s", fe.SafePath()) // 只输出文件名，不泄露全路径
	}
}
```

**为什么**

- `FileError.Error()` 已内置脱敏（只显示文件名），但 `FileError.Path` 字段保留原始路径，日志一律走 `SafePath()`。
- 深度问题有两个来源：`ErrMaxDepthExceeded` 来自库的校验，`ErrInvalidHTML` 来自解析器自身的约 512 层上限。只统计前者会漏掉更深的一批输入。
- `ErrInternalPanic` 表示恶意输入触发了库未预期的 panic。一旦出现，保留触发输入并上报；不要长期依赖恢复机制。

## 资源管理

- [ ] 🔴 批量操作单批不超过 10000 条
- [ ] 🟡 合理配置 `WorkerPoolSize`（建议等于 CPU 核心数）
- [ ] 🟡 监控内存使用与缓存命中率
- [ ] 🟢 长期运行的实例定期调用 `ClearCache()`

**为什么**

- 单批过大既占内存又放大失败代价。大批任务切成每批 1000–5000 条，每批独立超时 context，一批失败不影响后续批次。
- `MaxCacheEntries`（默认 2000，上限 100000）决定缓存占用；长跑服务内存吃紧时调小条目数或缩短 `CacheTTL`。
- 缓存命中只省 CPU 不省内存：命中率高才有收益，否则缓存条目只占内存并带来哈希开销。

## 文件处理

- [ ] 🔴 验证文件路径来源（不要让用户直接控制完整路径）
- [ ] 🔴 设置 `AllowedBaseDir` 限制可读目录
- [ ] 🟡 处理前用 `os.Stat` 预检查文件大小（库内已做，外层再加一道）
- [ ] 🟢 对上传文件做类型/扩展名白名单校验

**为什么**

- `AllowedBaseDir` 通过 **OS 文件句柄解析真实路径**做包含性判断，能拦截 `filepath.EvalSymlinks` 处理不了的 Windows junction/reparse points 与跨平台 symlink 逃逸。
- 留空 = 只保留 `..` 组件检测、不启用沙箱。路径来自用户输入时必须显式设置。
- 库在 `io.ReadAll` 载入内存前已用 `os.Stat` 拒绝超限文件；外层再加一道大小预检属于纵深防御。

## 部署前自检脚本

上线前跑一遍，验证配置合法、Processor 能创建并完成一次提取：

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()

	// 1. 配置合法性校验（New 内部会调 Validate）
	p, err := html.New(cfg)
	if err != nil {
		log.Fatalf("配置非法: %v", err)
	}
	defer p.Close()

	// 2. 关键配置项核对
	fmt.Printf("MaxInputSize      = %d bytes\n", cfg.MaxInputSize)
	fmt.Printf("MaxDepth          = %d\n", cfg.MaxDepth)
	fmt.Printf("ProcessingTimeout = %v\n", cfg.ProcessingTimeout)
	fmt.Printf("WorkerPoolSize    = %d\n", cfg.WorkerPoolSize)
	fmt.Printf("Audit.Enabled     = %v\n", cfg.Audit.Enabled)

	// 3. 实际提取测试
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sample := []byte("<html><body><h1>自检</h1><p>生产就绪</p></body></html>")
	result, err := p.ExtractWithContext(ctx, sample)
	if err != nil {
		log.Fatalf("提取失败: %v", err)
	}
	fmt.Printf("提取成功，文本长度：%d\n", len(result.Text))

	fmt.Println("✓ 配置自检通过")
}
```

:::tip 自检只验证链路能跑通
自检确认配置合法、提取可完成，但**不替代**真实流量下的监控。上线后仍需持续观察运行时指标。
:::

## 运行时监控要点

部署后持续关注以下指标：

| 指标 | 获取方式 | 告警阈值 | 常见原因 |
|------|----------|----------|----------|
| 错误率 | `Statistics.ErrorCount / TotalProcessed` | > 5% | 输入质量差、配置过严、上游异常 |
| 缓存命中率 | `Statistics.CacheHits / TotalProcessed` | < 30% | 输入去重不足、缓存 TTL 过短 |
| 平均处理时间 | `Statistics.AverageProcessTime` | 超业务基线 | 恶意输入、超时配置不当 |
| critical 审计事件 | `GetAuditLog()` 过滤 `AuditLevelCritical` | 任意一条 | 输入违规、路径穿越攻击 |
| ChannelAuditSink 丢弃数 | `sink.DroppedCount()` | > 0 | 缓冲不足、消费方过慢 |

```go
// 定期采集指标（例如每分钟由 Prometheus 拉取）
stats := p.GetStatistics()
var errorRate, hitRate float64
if stats.TotalProcessed > 0 {
	errorRate = float64(stats.ErrorCount) / float64(stats.TotalProcessed)
	hitRate = float64(stats.CacheHits) / float64(stats.TotalProcessed)
}

log.Printf("已处理=%d 错误率=%.2f%% 缓存命中=%.1f%% 平均耗时=%v",
	stats.TotalProcessed, errorRate*100, hitRate*100, stats.AverageProcessTime)

// critical 事件巡检
for _, e := range p.GetAuditLog() {
	if e.Level == html.AuditLevelCritical {
		log.Printf("[告警] critical 审计事件: %s - %s", e.EventType, e.Message)
	}
}
```

:::warning Statistics 是累计值
`GetStatistics()` 的计数器从 Processor 创建起累加，`ClearCache()` 不会重置。需要按窗口统计时，定期调 `ResetStatistics()` 归零，或自己算差值。
:::

## 配置速查矩阵

| 环境 | MaxInputSize | ProcessingTimeout | MaxDepth | WorkerPoolSize | 审计 | 推荐预设 |
|------|-------------|-------------------|----------|----------------|------|----------|
| 内部工具 | 50MB（默认） | 30s（默认） | 500（默认） | 4（默认） | 可选 | `DefaultConfig()` |
| Web API | 10MB | 10s | 200 | CPU 核心数 | 推荐 | `DefaultConfig()` 微调 |
| 高安全 | 10MB | 10s | 100 | 2 | 必须 | `HighSecurityConfig()` |
| 批量爬虫 | 50MB | 30s | 500 | 8–16 | 推荐 | `DefaultConfig()` 微调 |

:::tip 爬虫场景的取舍
批量爬虫面向不可信网页但吞吐优先：保持 `EnableSanitization = true`，把 `WorkerPoolSize` 调到 8–16，并为每批任务设独立的总超时 context，防恶意页面拖垮整批。
:::

## 相关文档

- [安全概述](./) — 深度防御架构与各防护层
- [审计系统实战](./audit-pipeline) — 8 种事件类型、内置 Sink、分级路由
- [API 参考：安全防护](../../api-reference/modules/security) — 安全相关 API 签名
- [API 参考：常量与错误](../../api-reference/types/constants) — 默认值常量与哨兵错误
