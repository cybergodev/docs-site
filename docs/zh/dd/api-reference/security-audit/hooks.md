---
sidebar_label: "HookRegistry"
title: "钩子系统 - CyberGo DD | HookRegistry"
description: "CyberGo DD 生命周期钩子系统完整 API 文档，支持在日志写入前后（BeforeLog/AfterLog）、文件轮换（OnRotate）、错误发生（OnError）等关键事件上注册自定义回调函数，提供 HookRegistry 注册表和灵活的日志处理扩展机制。"
sidebar_position: 1
---

# 钩子系统

DD 提供基于事件的钩子系统，可在日志生命周期的关键节点插入自定义逻辑。

## 钩子事件

| 常量 | String() | 触发时机 |
|------|----------|----------|
| `HookBeforeLog` | `"BeforeLog"` | 日志写入前 |
| `HookAfterLog` | `"AfterLog"` | 日志写入后 |
| `HookOnFilter` | `"OnFilter"` | 敏感数据过滤时 |
| `HookOnRotate` | `"OnRotate"` | 文件轮换时 |
| `HookOnClose` | `"OnClose"` | 日志记录器关闭时 |
| `HookOnError` | `"OnError"` | 发生错误时 |

## 钩子函数类型

### Hook

```go
type Hook func(ctx context.Context, hookCtx *HookContext) error
```

钩子函数签名。在日志生命周期事件触发时被调用。

- `BeforeLog` 钩子返回错误时，**日志条目不会写入**。
- 其他事件返回的错误默认会终止后续钩子执行；若设置了错误处理器（见 `HookErrorHandler`），则改为把错误交由处理器，所有钩子仍会执行。
- 钩子内发生的 panic 会被 `HookRegistry` 捕获并转换为错误，避免拖垮整个应用。

### HookErrorHandler

```go
type HookErrorHandler func(event HookEvent, hookCtx *HookContext, err error)
```

钩子错误处理器签名。

参数：

- `event`：触发错误的钩子事件类型
- `hookCtx`：传给钩子的上下文
- `err`：钩子返回（或 panic 转换而来）的错误

设置错误处理器后（通过 `HookRegistry.SetErrorHandler` 或 `HooksConfig.ErrorHandler`），`Trigger` 会执行所有钩子而不再遇错即停；每个错误都会被传入处理器。**例外**：对 `BeforeLog` 事件，即使设置了处理器，返回的错误仍会阻止日志写入。处理器内部不应 panic；若 panic，会被恢复并输出到 stderr。

## HookRegistry

钩子注册表，管理所有钩子的注册和触发。线程安全。

### 创建

```go
// 空注册表
reg := dd.NewHookRegistry()

// 从配置创建
reg := dd.NewHooksFromConfig(hooksConfig)
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Add` | `(event HookEvent, hook Hook)` | 注册钩子 |
| `Remove` | `(event HookEvent)` | 移除事件的所有钩子 |
| `Trigger` | `(ctx, event, hookCtx) error` | 触发事件的所有钩子 |
| `Clear` | `()` | 清除所有钩子 |
| `ClearFor` | `(event HookEvent)` | 清除指定事件的钩子 |
| `SetErrorHandler` | `(handler HookErrorHandler)` | 设置错误处理器 |

### 注册钩子

```go
reg := dd.NewHookRegistry()

// BeforeLog 钩子
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("即将写入日志:", hc.Message)
    return nil
})

// AfterLog 钩子
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate 钩子
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("文件轮换完成",
        dd.String("path", hc.Metadata["path"].(string)),
    )
    return nil
})
```

### 通过 Logger 管理

```go
// 添加单个钩子
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// 替换整个注册表
_ = logger.SetHooks(reg)

// 获取当前注册表
hooks := logger.GetHooks()
```

## HookContext

钩子上下文，提供事件发生时的详细信息。

```go
type HookContext struct {
    Event          HookEvent      // 事件类型
    Level          LogLevel       // 日志级别
    Message        string         // 日志消息
    Fields         []Field        // 结构化字段（过滤后）
    OriginalFields []Field        // 原始字段（过滤前）
    Error          error          // 错误信息（OnError 事件）
    Timestamp      time.Time      // 事件时间
    Writer         io.Writer      // 目标 Writer（写相关事件）
    Metadata       map[string]any // 额外元数据
}
```

## HooksConfig

结构化钩子配置，推荐用于批量注册钩子。

```go
type HooksConfig struct {
    BeforeLog    []Hook              // 日志写入前钩子
    AfterLog     []Hook              // 日志写入后钩子
    OnFilter     []Hook              // 敏感数据过滤时钩子
    OnRotate     []Hook              // 文件轮换时钩子
    OnClose      []Hook              // 日志记录器关闭时钩子
    OnError      []Hook              // 写入错误时钩子
    ErrorHandler HookErrorHandler    // 错误处理器
}
```

```go
cfg := dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // 日志前处理
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        log.Printf("钩子错误: %v\n", err)
    },
}
registry := dd.NewHooksFromConfig(cfg)
```

## 完整示例

### 指标收集

```go
reg := dd.NewHookRegistry()
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    logCount.Inc()
    logLevelCounter.WithLabelValues(hc.Level.String()).Inc()
    return nil
})
reg.Add(dd.HookOnError, func(ctx context.Context, hc *dd.HookContext) error {
    errorCount.Inc()
    return nil
})
_ = logger.SetHooks(reg)
```

## 下一步

- [Logger](../core/logger) -- AddHook / SetHooks 方法
- [配置](../core/config) -- HooksConfig 配置
- [接口定义](../core/interfaces) -- Hook 类型定义
