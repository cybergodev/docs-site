---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo html | 上线安全核对"
description: "CyberGo html 生产部署安全核对清单：按 P0/P1/P2 优先级分级检查 HighSecurityConfig 预设、基础配置、Processor 生命周期、审计监控、context 超时控制、错误处理、文件路径沙箱与资源释放等上线必查项，附自检脚本、运行时监控指标与配置速查矩阵。"
sidebar_position: 3
---

# 生产检查清单

把 html 库带上生产前，按本清单逐项核对。每条标记了优先级，方便你判断哪些必须做、哪些可以后续补：

- 🔴 **必须（P0）**：不做到会有安全漏洞或资源泄漏
- 🟡 **推荐（P1）**：强烈建议，影响可靠性与可观测性
- 🟢 **可选（P2）**：锦上添花

:::tip 先用预设，再按业务微调
`HighSecurityConfig()` 已经把所有限制收紧到安全档位并启用完整审计。绝大多数面向不可信输入的场景，直接用它再按需放宽即可，不必从零拼装配置。
:::

## 基础配置

- [ ] 🔴 使用 `HighSecurityConfig()` 或自定义安全配置作为起点
- [ ] 🔴 设置合理的 `MaxInputSize`（根据业务需求，硬上限 50MB）
- [ ] 🔴 设置 `ProcessingTimeout` 防止长时间阻塞（建议 10–30s）
- [ ] 🟡 配置 `MaxDepth` 限制 DOM 深度（默认 500，高安全建议 100）
- [ ] 🟡 保持 `EnableSanitization = true`（默认已开，不要关）
- [ ] 🟢 根据并发量调整 `WorkerPoolSize`（默认 4，上限 256）

**为什么**：

- `MaxInputSize` 是第一道内存防线。它同时受 `maxConfigInputSize`（50MB）硬约束——即便误配也不会放大到危险值。峰值内存粗估为 `MaxInputSize × WorkerPoolSize`，面向公网的 Web API 建议收紧到 10MB。
- `WorkerPoolSize` 决定批量提取的并发度。设成 CPU 核心数通常够用；设过大（接近 256 上限）会在高并发下产生大量 goroutine 与内存压力。
- `CacheTTL`（默认 1h）与 `CacheCleanup`（默认 5min）控制结果缓存的生命周期与后台清扫节奏。`MaxCacheEntries` 设 0 可完全禁用缓存；缓存命中只省 CPU 不省内存，缓存项本身也占内存（上限 100000 条）。

## Processor 生命周期

- [ ] 🔴 使用 `defer p.Close()` 确保 Processor 正确释放
- [ ] 🔴 不要在 `Close()` 后继续调用任何提取方法（会返回 `ErrProcessorClosed`）
- [ ] 🟡 用单例 Processor 跨请求复用，而不是每次请求新建

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

**为什么**：

- `Processor` 是并发安全的，创建后可被多个 goroutine 共享，内部缓存与统计计数器都做了同步保护。把它做成应用级单例（例如 HTTP handler 持有一个全局 `*html.Processor`），既能复用缓存又能避免重复初始化的开销。
- **不要每次请求都 `html.New()`**：每个 Processor 都会启动后台缓存清扫 goroutine、分配缓存与审计结构，频繁创建既浪费资源又增加 GC 压力。
- 包级便捷函数（`html.Extract`、`html.ExtractWithContext` 等）内部用 `sync.Pool` 复用临时 Processor，但**不缓存提取结果**——跨调用无法命中缓存。需要缓存复用的场景请显式持有 Processor 实例。

## 审计与监控

- [ ] 🔴 启用审计系统（`Audit.Enabled = true`）
- [ ] 🟡 配置 `WriterAuditSink` 把审计日志持久化到文件
- [ ] 🟡 监控 `GetStatistics()` 中的 `ErrorCount` 与 `CacheHits`
- [ ] 🟡 对 critical 级事件（输入违规、路径穿越）配置实时告警
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

**分级审计管道**——critical 事件实时告警，其余写入文件留档：

```go
// critical 事件推入 channel，由独立 goroutine 发送告警
alertSink := html.NewChannelAuditSink(50)
go func() {
    for entry := range alertSink.Channel() {
        sendAlert(entry) // 接入 PagerDuty / Slack / 短信
    }
}()

// 文件留档 + critical 告警，两路并行不互相阻塞
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(auditFile),
    html.NewFilteredSink(alertSink, func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    }),
)
```

**ChannelAuditSink 的丢弃监控**：当 channel 缓冲满时事件会被丢弃，用 `DroppedCount()` 巡检：

```go
if n := alertSink.DroppedCount(); n > 0 {
    log.Printf("告警 channel 丢弃了 %d 条审计事件，请扩容缓冲或加快消费", n)
}
```

更多管道构建模式（按级别路由、自定义 Sink、高安全取证）见[审计系统实战](./audit-pipeline)。

## 上下文与超时

- [ ] 🔴 所有提取操作使用 `ExtractWithContext` 版本而非裸 `Extract`
- [ ] 🔴 设置合理的上下文超时
- [ ] 🟡 批量操作使用带取消的上下文，能在出错时及时中止剩余任务

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := p.ExtractWithContext(ctx, data)
```

**为什么**：

- 库有两层超时：`Config.ProcessingTimeout`（默认 30s，对单文档生效）和调用方传入的 `context.Context`。两者**叠加生效**——先到期的先生效。即便不传超时 context，`ProcessingTimeout` 也会兜底；传了更短的 context 则以 context 为准。
- 批量提取（`ExtractBatch`）应为整批设一个总超时 context，避免某一批耗时失控。单项失败不应阻塞整批——批量方法内部对每项独立 recover。
- 超时机制通过独立 goroutine + context deadline 实现，全局受 `maxTimeoutGoroutines`（1000）保护。极高并发下若超限，新请求会直接返回 `ErrProcessingTimeout` 而不是无限堆积 goroutine。

## 错误处理

- [ ] 🔴 用 `errors.Is` 区分业务错误与安全错误
- [ ] 🔴 对 `*FileError` 用 `SafePath()` 输出，而非原始错误字符串
- [ ] 🟡 记录所有 `ErrInputTooLarge` 和 `ErrMaxDepthExceeded`（可能是攻击探测）
- [ ] 🟡 监控 `ErrInternalPanic` 频率（出现即应排查并上报 issue）
- [ ] 🟢 对 `ErrProcessorClosed` 做优雅降级而非崩溃

```go
_, err := p.Extract(data)
switch {
case errors.Is(err, html.ErrInputTooLarge):
    log.Printf("输入超限，疑似攻击探测")
case errors.Is(err, html.ErrMaxDepthExceeded):
    log.Printf("深度违规，疑似递归炸弹")
case errors.Is(err, html.ErrInternalPanic):
    // panic 已被 recover，但这是库的 bug，应上报
    log.Printf("内部 panic 已恢复: %v", err)
case errors.Is(err, html.ErrFileNotFound),
    errors.Is(err, html.ErrInvalidFilePath):
    var fe *html.FileError
    if errors.As(err, &fe) {
        log.Printf("文件错误: %s", fe.SafePath()) // 只输出文件名，不泄露全路径
    }
}
```

**为什么**：

- `FileError.Error()` 已经内置脱敏（只显示文件名，不显示完整路径），但 `FileError.Path` 字段保留原始路径。日志里**务必走 `SafePath()`**，避免把服务端目录结构泄露到日志聚合系统。
- `ErrInternalPanic` 理论上不该出现——它表示恶意输入触发了库未预期的 panic。一旦监控到，应保留触发输入并上报。库的 panic 恢复保证进程不崩，但不应长期依赖它。

## 资源管理

- [ ] 🔴 批量操作单批不超过 10000 条
- [ ] 🟡 合理配置 `WorkerPoolSize`（建议等于 CPU 核心数）
- [ ] 🟡 监控内存使用与缓存命中率
- [ ] 🟢 长期运行的实例定期调用 `ClearCache()` 释放缓存

**为什么**：

- **峰值内存估算**：`MaxInputSize × WorkerPoolSize` 大致是批量处理时的内存峰值（每个 worker 同时处理一份输入）。例如 `10MB × 8 = 80MB`。据此预留容器内存。
- **缓存与内存**：`MaxCacheEntries`（默认 2000）每条缓存项按提取结果大小占用内存。长跑服务若内存吃紧，可调小 entries 或缩短 `CacheTTL`；`CacheCleanup` 越短，过期项回收越及时。
- **分批策略**：单批过大既占内存又放大失败代价。建议把大批任务切成每批 1000–5000 条的小批，每批用独立的带超时 context，一批失败不影响后续批次。

## 文件处理

- [ ] 🔴 验证文件路径来源（不要让用户直接控制完整路径）
- [ ] 🔴 设置 `AllowedBaseDir` 限制文件读取目录
- [ ] 🟡 处理前用 `os.Stat` 预检查文件大小（库内部已做，外层再做一道更稳）
- [ ] 🟢 对上传文件做类型/扩展名白名单校验

**为什么**：

- `AllowedBaseDir` 是文件读取的沙箱。它通过 **OS 文件句柄解析真实路径**，能拦截 `filepath.EvalSymlinks` 无法处理的 Windows junction/reparse points 与跨平台 symlink 逃逸。留空 = 仅保留 `..` 遍历检测、不启用沙箱——只要路径来自用户输入就必须显式设置。
- 库内部已经在 `io.ReadAll` 载入内存前用 `os.Stat` 预检查文件大小并拒绝超限文件，关闭了「先读完再发现超限」的内存峰值窗口。外层业务再加一道大小预检属于纵深防御。

## 部署前自检脚本

上线前跑一遍这个自检程序，验证配置合法、Processor 能正常创建与提取：

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
	fmt.Printf("提取成功，文本长度: %d\n", len(result.Text))

	fmt.Println("✓ 配置自检通过")
}
```

:::tip 自检只验证「能跑通」
自检脚本确认配置合法、链路通畅，但**不替代**真实流量下的监控。上线后仍需持续观察运行时指标。
:::

## 运行时监控要点

部署后持续关注以下指标，异常时及时告警：

| 指标 | 获取方式 | 告警阈值 | 可能原因 |
|------|----------|----------|----------|
| 错误率 | `Statistics.ErrorCount / TotalProcessed` | > 5% | 输入质量差、配置过严、上游异常 |
| 缓存命中率 | `Statistics.CacheHits / TotalProcessed` | < 30% | 输入去重不足、缓存 TTL 过短 |
| 平均处理时间 | `Statistics.AverageProcessTime` | 超业务基线 | 恶意输入、超时配置不当 |
| critical 审计事件 | `GetAuditLog()` 过滤 `AuditLevelCritical` | 任意一条 | 输入违规、路径穿越攻击 |
| ChannelAuditSink 丢弃数 | `sink.DroppedCount()` | > 0 | 缓冲不足、消费方过慢 |

```go
// 定期采集指标（例如每分钟由 Prometheus 拉取）
stats := p.GetStatistics()
var errorRate float64
if stats.TotalProcessed > 0 {
    errorRate = float64(stats.ErrorCount) / float64(stats.TotalProcessed)
}

hitRate := 0.0
if stats.TotalProcessed > 0 {
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
`GetStatistics()` 返回的计数器从 Processor 创建起累加，不会因 `ClearCache()` 重置。需要按窗口统计时，定期调 `ResetStatistics()` 归零，或自己做差值。
:::

## 配置速查矩阵

按部署环境快速选择配置值：

| 环境 | MaxInputSize | ProcessingTimeout | MaxDepth | WorkerPoolSize | 审计 | 推荐预设 |
|------|-------------|-------------------|----------|----------------|------|----------|
| 内部工具 | 50MB（默认） | 30s（默认） | 500（默认） | 4（默认） | 可选 | `DefaultConfig()` |
| Web API | 10MB | 10s | 200 | CPU 核心数 | 推荐 | `DefaultConfig()` 微调 |
| 高安全 | 10MB | 10s | 100 | 2 | 必须 | `HighSecurityConfig()` |
| 批量爬虫 | 50MB | 30s | 500 | 8–16 | 推荐 | `DefaultConfig()` 微调 |

:::tip 爬虫场景的特殊考量
批量爬虫面向不可信网页但吞吐优先。建议保持 `EnableSanitization = true`，把 `WorkerPoolSize` 调到 8–16 提升吞吐，同时为每批任务设独立的总超时 context，防恶意页面拖垮整批。
:::

## 相关文档

- [安全概述](./) — 深度防御架构与各防护层详解
- [审计系统实战](./audit-pipeline) — 8 种事件类型、内置 Sink 对比、分级路由管道
- [API 参考：安全防护](../../api-reference/modules/security) — 安全相关 API 签名
- [API 参考：常量与错误](../../api-reference/types/constants) — 默认值常量与哨兵错误
