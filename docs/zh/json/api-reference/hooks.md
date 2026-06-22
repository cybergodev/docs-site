---
title: "Hook 钩子系统 - CyberGo JSON | API 参考"
description: "CyberGo JSON Hook 钩子系统：Hook 接口、LoggingHook、TimingHook、ValidationHook、ErrorHook 与自定义钩子，在 JSON 操作前后插入自定义逻辑。"
---

# Hook 钩子系统

Hook 允许在 JSON 操作前后插入自定义逻辑，实现日志记录、性能监控、验证等功能。

## Hook 接口

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### 方法说明

| 方法 | 说明 |
|------|------|
| `Before(ctx HookContext) error` | 操作前调用，返回错误可中止操作 |
| `After(ctx HookContext, result any, err error) (any, error)` | 操作后调用，可修改结果或返回错误 |

---

## HookContext 结构

HookContext 提供操作的上下文信息。

```go
type HookContext struct {
    Operation string      // 操作类型："get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // 输入 JSON 字符串（marshal 时可能为空）。安全警告：可能包含敏感数据
    Path      string      // 目标路径（marshal/unmarshal 时可能为空）
    Value     any         // set 操作的值
    Config    *Config     // 活动配置
    StartTime time.Time   // 操作开始时间
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `Operation` | `string` | 操作类型，值为 `get`、`set`、`delete`、`marshal`、`unmarshal` |
| `JSONStr` | `string` | 输入 JSON 字符串（**安全警告：可能包含敏感数据**） |
| `Path` | `string` | 目标路径表达式 |
| `Value` | `any` | set 操作的值 |
| `Config` | `*Config` | 当前使用的配置 |
| `StartTime` | `time.Time` | 操作开始时间 |

---

## HookFunc 适配器

HookFunc 是一个结构体适配器，允许使用函数作为 Hook。适用于只需要 Before 或 After 其中之一的场景。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### 示例

```go
// 只需要 After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// 只需要 Before
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

---

## 便捷 Hook 工厂函数

### LoggingHook

创建日志记录 Hook。

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### TimingHook

创建计时 Hook，记录操作耗时。

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

### ValidationHook

创建验证 Hook，在操作前验证输入。

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

### ErrorHook

创建错误处理 Hook，拦截并处理错误。

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 返回原始或转换后的错误
}))
```

---

## 自定义 Hook 实现

### 完整示例

```go
package main

import (
    "fmt"
    "log/slog"
    "time"
    "github.com/cybergodev/json"
)

// 日志 Hook
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "op", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err)
    return result, err
}

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()
    
    // 添加自定义 Hook
    p.AddHook(&LoggingHook{logger: slog.Default()})
    
    // 使用 processor...
    val, err := p.Get(`{"name": "test"}`, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val)
}
```

### 使用 HookFunc 简化

```go
// 只需要记录完成时间
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## 配置 Hook

### 通过 Config 添加

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### 通过 Processor 添加

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

---

## 执行顺序

### Before 钩子

- 按**添加顺序**执行
- 任一 Hook 返回错误则中止操作

### After 钩子

- 按**添加逆序**执行
- 每个 Hook 都会执行（即使前面的返回错误）

```go
// 添加顺序: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// 执行顺序:
// Before: A.Before → B.Before → C.Before
// After:  C.After → B.After → A.After
```

---

## 最佳实践

### 1. 日志记录

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. 性能监控

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. 输入验证

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. 错误追踪

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. 审计日志

```go
type AuditHook struct {
    auditLogger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if ctx.Operation == "set" || ctx.Operation == "delete" {
        h.auditLogger.Info("data modification",
            "operation", ctx.Operation,
            "path", ctx.Path,
            "success", err == nil)
    }
    return result, err
}
```

---

## 相关

- [接口定义](./interfaces) - 扩展接口
- [Validator](./validator) - 验证器
- [Config](./config) - 配置选项
