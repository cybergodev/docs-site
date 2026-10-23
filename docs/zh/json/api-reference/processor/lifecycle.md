---
sidebar_label: "生命周期"
title: "Processor 生命周期 - CyberGo JSON | Close 幂等关闭与统计"
description: "CyberGo JSON 的 Processor 提供 Close 幂等关闭与 IsClosed 状态检查，先排空在途操作再释放资源，配合 ClearCache/WarmupCache 缓存管理、GetStats 统计与 GetHealthStatus 健康监控，退出前可用 ShutdownGlobalProcessor 清理全局缓存，适合长期驻留服务的并发安全管理。"
sidebar_position: 110
---

# 生命周期与统计

Processor 提供完整的生命周期管理、缓存控制和健康监控能力。

## 生命周期

### Close

签名：`func (p *Processor) Close() error`

关闭处理器并释放资源（缓存、安全校验器、钩子引用）。使用完 Processor 后应调用此方法。

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

::: tip 关闭语义
- **幂等且线程安全**：重复调用 `Close` 只生效一次。
- **先排空在途操作**：`Close` 会等待正在进行中的操作结束（有超时上限）；超时后处理器拒绝新操作（`IsClosed()` 返回 `true`），但资源保持完整，让在途操作在未受扰动的状态下跑完。
- 关闭后所有操作返回 `ErrProcessorClosed`。
- `Close` **不清理**跨实例共享的全局缓存（路径类型缓存、结构体编码器缓存）；进程退出前的完整清理用 [`ShutdownGlobalProcessor`](#全局处理器管理)。
:::

### IsClosed

签名：`func (p *Processor) IsClosed() bool`

检查处理器是否已关闭。处于「关闭中（排空）」状态时同样返回 `true`——该窗口内新操作已被拒绝。

```go
if processor.IsClosed() {
    // 处理器已关闭，不能再使用
}
```

## 缓存管理

### ClearCache

签名：`func (p *Processor) ClearCache()`

清除处理器的内部缓存。

```go
processor.ClearCache()
```

适用于：
- 数据源发生变化
- 内存使用过高
- 需要强制刷新

### WarmupCache

签名：`func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

预热缓存以提高后续操作性能。要求处理器开启缓存（默认开启），否则返回错误。完整示例与 `WarmupResult` 字段说明见[批量操作](./batch#缓存预热-warmupcache)。

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("成功预热 %d 个路径\n", result.Successful)
```

## 统计信息

### GetStats

签名：`func (p *Processor) GetStats() Stats`

获取处理器的统计信息。

```go
stats := processor.GetStats()
fmt.Printf("缓存命中率：%.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小：%d\n", stats.CacheSize)
```

**Stats 结构**：

```go
type Stats struct {
    CacheSize        int64         `json:"cache_size"`        // 缓存条目数
    CacheMemory      int64         `json:"cache_memory"`      // 缓存内存使用（字节）
    MaxCacheSize     int           `json:"max_cache_size"`    // 最大缓存大小
    HitCount         int64         `json:"hit_count"`         // 缓存命中次数
    MissCount        int64         `json:"miss_count"`        // 缓存未命中次数
    HitRatio         float64       `json:"hit_ratio"`         // 缓存命中率
    CacheTTL         time.Duration `json:"cache_ttl"`         // 缓存 TTL
    CacheEnabled     bool          `json:"cache_enabled"`     // 缓存是否启用
    IsClosed         bool          `json:"is_closed"`         // 处理器是否已关闭
    MemoryEfficiency float64       `json:"memory_efficiency"` // 内存效率
    OperationCount   int64         `json:"operation_count"`   // 操作总数
    ErrorCount       int64         `json:"error_count"`       // 错误总数
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `CacheSize` | `int64` | 当前缓存条目数 |
| `CacheMemory` | `int64` | 缓存内存使用（字节） |
| `MaxCacheSize` | `int` | 最大缓存大小限制 |
| `HitCount` | `int64` | 缓存命中次数 |
| `MissCount` | `int64` | 缓存未命中次数 |
| `HitRatio` | `float64` | 缓存命中率（0-1） |
| `CacheTTL` | `time.Duration` | 缓存过期时间 |
| `CacheEnabled` | `bool` | 缓存是否启用 |
| `IsClosed` | `bool` | 处理器是否已关闭 |
| `MemoryEfficiency` | `float64` | 内存效率 |
| `OperationCount` | `int64` | 总操作次数 |
| `ErrorCount` | `int64` | 总错误次数 |

**字段解读**：

- `OperationCount` / `ErrorCount`：读写操作（`Get` / `GetMultiple` / `Set` / `SetMultiple` / `Delete` 等）均会累计；生命周期类拒绝（处理器已关闭、并发超限）不计入错误数。
- `HitRatio`：0–1 区间（0.85 即 85%）；`CacheEnabled=false` 时无命中数据。
- `CacheSize` / `CacheMemory` 是缓存实况，`MaxCacheSize` / `CacheTTL` 是配置上限（见 [Config](../config)）。
- `IsClosed`：与 [`IsClosed()`](#isclosed) 一致，可在监控中探测处理器是否被意外关闭。

## 健康检查

### GetHealthStatus

签名：`func (p *Processor) GetHealthStatus() HealthStatus`

获取处理器的健康状态。

```go
status := processor.GetHealthStatus()
if status.Healthy {
    fmt.Println("处理器健康")
} else {
    for name, check := range status.Checks {
        if !check.Healthy {
            fmt.Printf("检查 %s 失败: %s\n", name, check.Message)
        }
    }
}
```

**HealthStatus 结构**（总体状态在 `HealthStatus` 中，各分项结果为 `CheckResult`）：

```go
type HealthStatus struct {
    Timestamp time.Time              `json:"timestamp"` // 检查时间
    Healthy   bool                   `json:"healthy"`   // 总体健康状态
    Checks    map[string]CheckResult `json:"checks"`    // 各项检查结果
}

type CheckResult struct {
    Healthy bool   `json:"healthy"` // 是否健康
    Message string `json:"message"` // 状态消息
}
```

`HealthStatus` 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Timestamp` | `time.Time` | 检查时间 |
| `Healthy` | `bool` | 总体是否健康 |
| `Checks` | `map[string]CheckResult` | 各项检查详情 |

`CheckResult` 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Healthy` | `bool` | 该分项是否健康 |
| `Message` | `string` | 状态消息（失败原因等） |

::: tip 解读
`Checks` 是各分项检查（指标采集等）的结果映射，任一分项不健康则 `Healthy=false`。nil 处理器或指标采集器未初始化时直接返回 `Healthy=false`，并在 `Checks` 中给出原因（如 `processor is nil`）。指标采集器在 `EnableMetrics=true` 时才创建——未开启时 `GetHealthStatus` 返回 `Healthy=false` 并在 `Checks` 中注明 `Metrics collector not initialized`；`Config.EnableHealthCheck` 字段已废弃、不被读取，不影响此行为（见 [Config](../config#输入与可观测性开关)）。
:::

## 扩展钩子

### AddHook

签名：`func (p *Processor) AddHook(hook Hook)`

添加操作钩子到处理器。

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

钩子会在每次操作前后被调用，可用于：
- 日志记录
- 性能监控
- 指标收集
- 审计追踪

### SetLogger

签名：`func (p *Processor) SetLogger(logger *slog.Logger)`

`SetLogger` 原子替换处理器的结构化日志记录器（自动附加 `component=json-processor` 字段），传入 `nil` 时回退 `slog.Default()`。用于调试和运行时诊断。

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

签名：`func (p *Processor) GetConfig() Config`

`GetConfig` 返回处理器当前配置的深拷贝（内部走 `Config.Clone`），修改返回值不影响处理器；对 nil 处理器调用返回零值 Config。

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("缓存启用: %v\n", cfg.EnableCache)
fmt.Printf("最大 JSON 大小：%d\n", cfg.MaxJSONSize)
```

## 全局处理器管理

包级函数依赖内部全局处理器，两个包级管理函数也属于生命周期范畴（签名与完整示例见 [Processor 概述](./index#全局处理器管理)）：

- `json.SetGlobalProcessor(p)` — 将自定义处理器设为全局：传入 `nil` 为 no-op，旧全局处理器先被关闭，函数线程安全。
- `json.ShutdownGlobalProcessor()` — 关闭并移除全局处理器，同时清理跨实例共享的全局缓存与配置化处理器缓存，适合长驻服务退出前调用。

## 使用建议

### 资源管理

```go
processor, _ := json.New()
defer processor.Close()  // 确保释放资源

// 使用 processor...
```

### 性能优化

```go
// 预热常用路径
processor.WarmupCache(data, []string{
    "user.name",
    "user.email",
    "items[*].id",
})

// 定期检查统计
stats := processor.GetStats()
if stats.HitRatio < 0.5 {
    // 命中率低，考虑调整缓存配置
}
```

### 监控集成

```go
// 定期健康检查
go func() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        status := processor.GetHealthStatus()
        if !status.Healthy {
            log.Printf("Processor unhealthy: %+v", status.Checks)
        }
    }
}()
```

## 相关

- [Config](../config) - 配置选项（缓存大小、TTL 等）
- [Hook 钩子系统](../../extensions/hooks) - 钩子详细使用指南
- [接口定义](../interfaces) - Hook 接口
