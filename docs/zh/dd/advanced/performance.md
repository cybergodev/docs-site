---
title: "性能优化 - CyberGo DD | 高性能日志"
description: "CyberGo DD 日志库性能优化完整指南，详解零分配优化技巧、BufferedWriter 缓冲写入配置、日志采样策略与频率控制、级别提前检查避免无用分配、sync.Pool 对象池复用和基准测试分析方法，帮助开发者在高并发场景下获得极致日志性能。"
---

# 性能优化

DD 在设计上追求高性能，以下是一些进一步优化日志性能的建议。

## 零分配优化

DD 在热路径上最小化内存分配：

- `IsLevelEnabled()` 检查使用原子操作，无锁
- 结构化字段使用预分配缓冲区
- 避免在日志级别不匹配时格式化消息

## 级别检查

在高频路径上先检查级别，避免不必要的字段构造：

```go
// 推荐：先检查级别
if logger.IsDebugEnabled() {
    logger.DebugWith("详细信息",
        dd.String("data", expensiveToString()),
        dd.Int("size", len(largeSlice)),
    )
}

// 不推荐：总是构造字段
logger.DebugWith("详细信息",
    dd.String("data", expensiveToString()),
)
```

## 缓冲写入

使用 `BufferedWriter` 减少 I/O 系统调用：

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 8192
bw, _ := dd.NewBufferedWriter(fw, bwCfg)  // 8KB 缓冲

logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{dd.CustomOutput(bw)},
})
defer logger.Close()  // Close 会自动 Flush
```

:::tip 缓冲区大小
推荐 4KB-16KB。太小的缓冲区无法有效减少系统调用，太大的缓冲区增加内存使用和延迟。
:::

## 日志采样

高吞吐场景下可启用日志采样，减少重复日志：

```go
logger.SetSampling(&dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,    // 前 100 条全部记录
    Thereafter: 10,     // 之后每 10 条记录 1 条
    Tick:       time.Minute, // 每分钟重置计数器
})

// 运行时动态调整
cfg := logger.GetSampling()
```

## 文件写入优化

### 合理的轮换配置

```go
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())
// 默认: 100MB / 30天 / 10个备份
```

- 文件过小导致频繁轮换，增加 I/O
- 备份过多占用磁盘空间
- 根据实际日志量调整参数

### 多文件分离

```go
// 按级别分离
infoWriter, _ := dd.NewFileWriter("logs/info.log", dd.DefaultFileWriterConfig())
errorWriter, _ := dd.NewFileWriter("logs/error.log", dd.DefaultFileWriterConfig())
```

## Writer 管理

### 动态增减 Writer

```go
// 运行时动态添加
logger.AddWriter(newWriter)

// 移除不再需要的 Writer
logger.RemoveWriter(oldWriter)
```

### 避免过多 Writer

每个 Writer 都会增加写入延迟。推荐不超过 3-4 个 Writer。

## 字段优化

### 使用类型化字段

```go
// 推荐：类型化构造器
dd.Int("count", 42)
dd.String("name", "test")

// 避免：Any（需要额外类型断言）
dd.Any("count", 42)
```

### 避免大对象

```go
// 不推荐：记录大对象
logger.InfoWith("数据", dd.Any("payload", hugeStruct))

// 推荐：仅记录关键信息
logger.InfoWith("数据",
    dd.Int("count", len(items)),
    dd.String("first", items[0].Name),
)
```

## 关闭与清理

```go
// 等待过滤协程完成
logger.WaitForFilterGoroutines(3 * time.Second)

// 优雅关闭，等待所有缓冲刷新
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 下一步

- [输出目标](../api-reference/writers) -- FileWriter、BufferedWriter API
- [配置](../api-reference/config) -- 性能相关配置项
- [生产检查清单](../security/production-checklist) -- 上线前检查
