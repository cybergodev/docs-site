---
sidebar_label: "钩子系统"
title: "钩子系统 - CyberGo DD | 生命周期钩子实战指南"
description: "CyberGo DD 钩子系统指南：6 种生命周期事件（BeforeLog、AfterLog、OnFilter、OnRotate、OnClose、OnError）、HookRegistry 注册管理、HookContext 上下文与常见扩展场景。"
sidebar_position: 2
---

# 钩子系统

> 📖 **使用教程** · 完整 API 签名见 [钩子系统 - HookRegistry](../../api-reference/core/hooks)

钩子（Hooks）允许你在日志生命周期的关键节点注入自定义逻辑，如日志写入前后、文件轮换、错误发生等时刻执行额外操作。

## 钩子事件

DD 提供 6 种生命周期钩子事件：

| 事件 | 触发时机 | 典型用途 |
|------|----------|----------|
| `HookBeforeLog` | 日志格式化之前（字段已过滤） | 条件跳过、采样控制 |
| `HookAfterLog` | 日志写入完成 | 更新指标、发送通知 |
| `HookOnFilter` | 敏感数据被脱敏时触发：字段值脱敏（hook 收到字段 key）或消息文本脱敏（key 为空字符串）；hook 仅收到 key，**不收到原值** | 记录脱敏事件、审计 |
| `HookOnRotate` | 文件轮换完成 | 通知运维、上传旧文件 |
| `HookOnClose` | Logger 关闭 | 清理资源、发送最终报告 |
| `HookOnError` | 写入错误发生 | 告警、降级处理 |

## 快速开始

### 使用 HooksConfig

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("即将写入: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

cfg := dd.DefaultConfig()
cfg.Hooks = hooks
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### 使用 HookRegistry

```go
registry := dd.NewHookRegistry()

// 注册 BeforeLog 钩子
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 跳过调试级别日志的某些处理
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// 注册 OnRotate 钩子
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("文件轮换: %s\n", hCtx.Metadata)
    return nil
})

cfg := dd.DefaultConfig()
cfg.Hooks = registry
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## HookContext 上下文

每个钩子接收 `HookContext`，包含当前日志的完整信息：

```go
type HookContext struct {
    Event          HookEvent    // 触发的事件类型
    Level          LogLevel     // 日志级别
    Message        string       // 日志消息
    Fields         []Field      // 处理后的字段
    OriginalFields []Field      // 原始字段（过滤前）
    Error          error        // 相关错误（OnError 时）
    Timestamp      time.Time    // 时间戳
    Writer         io.Writer    // 目标 Writer
    Metadata       map[string]any // 附加元数据
}
```

## 常见场景

### 指标收集

```go
var (
    logCounter   atomic.Int64
    errorCounter atomic.Int64
)

registry := dd.NewHookRegistry()

registry.Add(dd.HookAfterLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    logCounter.Add(1)
    if hCtx.Level >= dd.LevelError {
        errorCounter.Add(1)
    }
    return nil
})

cfg := dd.DefaultConfig()
cfg.Hooks = registry
logger, err := dd.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### 日志采样

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // 每 100 条只记录 1 条
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // 返回错误阻止日志写入
        }
    }
    return nil
})
```

### 文件轮换通知

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 通知监控系统
    monitoring.Alert("log_rotated", map[string]any{
        "path": hCtx.Metadata["path"],
    })
    return nil
})
```

### 错误告警

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 发送告警
    alerting.Send(fmt.Sprintf("日志写入失败: %v", hCtx.Error))
    return nil
})
```

## 错误处理

### 全局错误处理器

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // 可能返回错误
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("钩子 %s 执行失败: %v", event, err)
    },
})
```

### BeforeLog 中止日志

`BeforeLog` 钩子返回错误时，该条日志不会写入：

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 检查条件，不符合则跳过
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // 阻止写入
    }
    return nil // 允许写入
})
```

:::warning 钩子中的 Panic
钩子函数中如果发生 panic，DD 会自动恢复并转为 error。若配置了 `ErrorHandler`，该 error 会交给 ErrorHandler 处理；未配置时钩子执行停止并返回该错误（`HookBeforeLog` 的错误会中止该条日志写入），不会影响主流程。
:::

## 动态注册

```go
// 运行时为已创建的 Logger 增加钩子：正道是 logger.AddHook（Clone-Modify-Store，线程安全）
if err := logger.AddHook(dd.HookAfterLog, newHookFunc); err != nil {
    log.Printf("注册钩子失败: %v", err) // ErrNilHook 或 ErrLoggerClosed
}

// 运行时移除：HookRegistry.Remove 会清空该事件的全部钩子（无法只移除单个钩子）。
// 对已创建的 Logger：先 GetHooks() 取副本，Remove 后再 SetHooks() 写回
if hooks := logger.GetHooks(); hooks != nil {
    hooks.Remove(dd.HookAfterLog)
    _ = logger.SetHooks(hooks)
}
```

:::warning registry 克隆
Logger 创建时会克隆传入的 `registry`（`dd.New(dd.Config{Hooks: registry})` 后内部存的是副本），之后再修改原 `registry` 不影响已创建的 Logger。运行时变更**已创建 Logger** 的钩子，请用 `logger.AddHook(event, hook)`（内部 Clone-Modify-Store）。
:::

## 下一步

- [审计日志](../security/audit-logging) -- 安全审计集成
- [分布式追踪](../integration/context-tracing) -- 上下文集成
- [API 参考 - Hooks](../../api-reference/core/hooks) -- 钩子完整 API
