---
sidebar_label: "日志采样"
title: "日志采样 - CyberGo DD | 高吞吐场景日志降量策略"
description: "CyberGo DD 日志采样配置详解：SamplingConfig 的 Initial、Thereafter、Tick 参数用法，在高吞吐场景下减少日志体积同时保留关键信息，支持运行时动态开关。"
sidebar_position: 1
---

# 日志采样

在高吞吐场景（如 HTTP 请求日志、事件流处理）中，逐条记录所有日志会产生大量数据。DD 的采样功能按比例保留日志，在控制日志体积的同时仍能反映整体趋势。

## 采样原理

DD 采用**计数器采样**策略：

```text
┌─────────────────────────────────────────────────────┐
│  请求 1-100   →  全部记录（Initial 阶段）            │
│  请求 101     →  跳过                                │
│  请求 102     →  跳过                                │
│  ...                                                │
│  请求 110     →  记录（每 Thereafter=10 条记 1 条）   │
│  请求 111     →  跳过                                │
│  ...                                                │
│  请求 120     →  记录                                │
│                                                     │
│  （Tick 到期 → 计数器归零，重新进入 Initial 阶段）     │
└─────────────────────────────────────────────────────┘
```

| 参数 | 说明 | 典型值 |
|------|------|--------|
| `Enabled` | 是否启用采样 | `true` |
| `Initial` | 始终记录的前 N 条 | 100 |
| `Thereafter` | 之后每 N 条记录 1 条 | 10 |
| `Tick` | 计数器重置周期（0 = 不重置） | `1s` / `1m` |

## 快速使用

### 配置时启用

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Sampling = &dd.SamplingConfig{
		Enabled:    true,
		Initial:    100,         // 前 100 条始终记录
		Thereafter: 10,          // 之后每 10 条记录 1 条
		Tick:       time.Second, // 每秒重置计数器
	}

	logger, err := dd.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()

	// 模拟高吞吐日志
	for i := 0; i < 1000; i++ {
		logger.InfoWith("请求处理",
			dd.Int("seq", i),
		)
	}
	// 实际输出：前 100 条 + 后 900 条中的 90 条 = 190 条
}
```

### 推荐起点：DefaultSamplingConfig()

`dd.DefaultSamplingConfig()` 返回推荐默认值：`Initial=100`、`Thereafter=100`、`Tick=1s`——计数器每秒重置，低于 100 条/秒的流量永远不会被采样，仅超出部分降为 1/100：

```go
cfg := dd.DefaultConfig()
sampling := dd.DefaultSamplingConfig()
sampling.Initial = 10 // 按需调整：每秒前 10 条全量，之后 1/10 采样
cfg.Sampling = &sampling
logger, _ := dd.New(cfg)
```

:::warning 赋值即激活
`DefaultSamplingConfig()` 返回的 `Enabled=true`，把它赋给 `Config.Sampling` 会**立即激活采样**。若只想拿它当「模板」逐字段调整、稍后再启用，须手动置 `Enabled=false`：

```go
sampling := dd.DefaultSamplingConfig()
sampling.Enabled = false // 仅作模板：赋给 Config.Sampling 也不会激活采样
// ... 逐字段调整后，需要启用时再置 sampling.Enabled = true
```

:::

### 运行时动态切换

```go
// 启用采样
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    50,
    Thereafter: 20,
    Tick:       0, // 不自动重置
})

// 关闭采样（恢复全量记录）
logger.SetSampling(nil)

// 查询当前采样配置
sc := logger.GetSampling()
if sc != nil {
    fmt.Printf("采样: Initial=%d, Thereafter=%d\n", sc.Initial, sc.Thereafter)
}
```

:::tip 全局 Logger 采样
包级函数 `dd.SetSampling()` 和 `dd.GetSampling()` 直接操作全局 Logger。
:::

## 参数详解

### Initial：初始全量窗口

`Initial` 保证系统启动或 Tick 重置后的前 N 条日志**全部记录**，确保：

- 启动阶段的初始化日志不丢失
- 短时间内的突发流量有完整记录
- Tick 重置后能看到周期起始状态

### Thereafter：采样率

`Thereafter` 控制采样密度：

| Thereafter | 效果 | 日志保留率（Initial 后） |
|:----------:|------|:-----------------------:|
| 1 | 每条都记（等于关闭采样） | 100% |
| 10 | 每 10 条记 1 条 | 10% |
| 100 | 每 100 条记 1 条 | 1% |
| 0 | Initial 后不再记录 | 0% |

:::warning Thereafter=0
`Thereafter=0` 表示 Initial 阶段后**完全停止记录**。这在某些场景下有用（如只需启动日志），但请确保不会遗漏重要信息。
:::

### Tick：周期重置

```go
// 方案 A：每秒重置（适合突发流量检测）
Sampling: &dd.SamplingConfig{
    Enabled: true, Initial: 100, Thereafter: 10,
    Tick: time.Second,
}

// 方案 B：不重置（全局计数，适合长期降量）
Sampling: &dd.SamplingConfig{
    Enabled: true, Initial: 1000, Thereafter: 100,
    Tick: 0,
}
```

Tick 重置后，计数器归零，重新进入 Initial 全量阶段。这对于**按周期观察流量模式**非常有用。

## 典型配置场景

### 场景 1：HTTP 请求日志

```go
// 高流量 API：前 100 条全量，之后 10% 采样，每秒重置
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Second,
}
```

### 场景 2：后台任务日志

```go
// 批处理任务：前 50 条全量，之后每 100 条记 1 条，不重置
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    50,
    Thereafter: 100,
    Tick:       0,
}
```

### 场景 3：调试模式切换

```go
// 正常运行时：采样降量
logger.SetSampling(&dd.SamplingConfig{
    Enabled: true, Initial: 10, Thereafter: 50,
})

// 排查问题时：关闭采样，全量记录
logger.SetSampling(nil)

// 排查完毕：恢复采样
logger.SetSampling(&dd.SamplingConfig{
    Enabled: true, Initial: 10, Thereafter: 50,
})
```

## 线程安全

采样功能使用原子操作（`atomic.Int64`）实现计数器，Tick 重置使用互斥锁保护。在多 goroutine 并发记录日志时无需额外同步。

:::tip Fatal 日志不受采样限制
即使启用了采样，`Fatal` 级别的日志**始终被记录**——因为 Fatal 必须在程序退出前写入，不应被采样跳过。
:::

## 下一步

- [性能优化](../../advanced/performance) -- 零分配与缓冲池机制
- [配置详解](../basics/configuration) -- 完整配置字段
- [钩子系统](./hooks) -- BeforeLog 钩子可配合采样做额外处理
