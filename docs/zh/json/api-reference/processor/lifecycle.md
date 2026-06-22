---
title: "Processor 生命周期 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 生命周期：New 创建、Close 释放资源、IsClosed 状态检查、GetStats 统计与 GetHealthStatus 健康监控，保障并发安全关闭。"
---

# 生命周期与统计

Processor 提供完整的生命周期管理、缓存控制和健康监控能力。

## 生命周期

### Close

签名：`func (p *Processor) Close() error`

关闭处理器并释放资源。使用完 Processor 后应调用此方法。

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

### IsClosed

签名：`func (p *Processor) IsClosed() bool`

检查处理器是否已关闭。

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

预热缓存以提高后续操作性能。

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("成功预热 %d 个路径\n", result.Successful)
```

**WarmupResult 结构**：

```go
type WarmupResult struct {
    TotalPaths  int      `json:"total_paths"`            // 总路径数
    Successful  int      `json:"successful"`             // 成功预热的路径数
    Failed      int      `json:"failed"`                 // 失败的路径数
    SuccessRate float64  `json:"success_rate"`           // 成功率（百分比）
    FailedPaths []string `json:"failed_paths,omitempty"` // 失败的路径列表
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `TotalPaths` | `int` | 总路径数 |
| `Successful` | `int` | 成功预热的路径数 |
| `Failed` | `int` | 失败的路径数 |
| `SuccessRate` | `float64` | 成功率（0-100） |
| `FailedPaths` | `[]string` | 失败的路径列表 |

## 统计信息

### GetStats

签名：`func (p *Processor) GetStats() Stats`

获取处理器的统计信息。

```go
stats := processor.GetStats()
fmt.Printf("缓存命中率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("缓存大小: %d\n", stats.CacheSize)
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

**HealthStatus 结构**：

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

| 字段 | 类型 | 说明 |
|------|------|------|
| `Timestamp` | `time.Time` | 检查时间 |
| `Healthy` | `bool` | 总体是否健康 |
| `Checks` | `map[string]CheckResult` | 各项检查详情 |

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

设置处理器的日志记录器。用于调试和运行时诊断。

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

签名：`func (p *Processor) GetConfig() Config`

获取处理器当前的配置副本。返回的配置可以安全修改而不影响处理器。

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("缓存启用: %v\n", cfg.EnableCache)
fmt.Printf("最大 JSON 大小: %d\n", cfg.MaxJSONSize)
```

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
- [Hook 钩子系统](../hooks) - 钩子详细使用指南
- [接口定义](../interfaces) - Hook 接口
