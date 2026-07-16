---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo DD | Logger 接口层次"
description: "CyberGo DD 日志库接口层次定义完整文档，包括 CoreLogger 基础日志接口、LevelLogger 级别日志接口、ConfigurableLogger 可配置日志接口和 LogProvider 日志提供者接口，支持从简单到复杂的多层次日志抽象需求，便于自定义实现和依赖注入。"
sidebar_position: 5
---

# 接口定义

DD 定义了层次化的日志接口，支持不同级别的抽象需求。

## 接口层次

```text
CoreLogger                  基础日志方法
├── LevelLogger             + 级别管理
└── ConfigurableLogger      + 配置/生命周期/Writer/Hook
    └── LogProvider         + 全部功能
```

## CoreLogger

最基础的日志接口，仅包含日志输出方法。

```go
type CoreLogger interface {
    // 基础日志
    Debug(args ...any)
    Info(args ...any)
    Warn(args ...any)
    Error(args ...any)
    Fatal(args ...any)

    // 格式化日志
    Debugf(format string, args ...any)
    Infof(format string, args ...any)
    Warnf(format string, args ...any)
    Errorf(format string, args ...any)
    Fatalf(format string, args ...any)

    // 结构化日志
    DebugWith(msg string, fields ...Field)
    InfoWith(msg string, fields ...Field)
    WarnWith(msg string, fields ...Field)
    ErrorWith(msg string, fields ...Field)
    FatalWith(msg string, fields ...Field)

    // 字段链
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry
}
```

## LevelLogger

扩展 `CoreLogger`，增加级别管理能力。

```go
type LevelLogger interface {
    CoreLogger

    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool
}
```

## ConfigurableLogger

扩展 `CoreLogger`，增加配置、生命周期、Writer、上下文提取器、钩子和采样管理。

```go
type ConfigurableLogger interface {
    CoreLogger

    // 级别管理
    GetLevel() LogLevel
    SetLevel(level LogLevel) error

    // 输出目标
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // 生命周期
    Flush() error
    Close() error
    IsClosed() bool

    // 配置
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // 上下文提取器
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // 钩子
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // 采样
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig
}
```

## LogProvider

完整的日志接口，组合所有能力。`Logger` 类型实现了此接口。

```go
type LogProvider interface {
    // 级别管理
    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool

    // 通用日志
    Log(level LogLevel, args ...any)
    Logf(level LogLevel, format string, args ...any)
    LogWith(level LogLevel, msg string, fields ...Field)

    // 便捷日志 - Debug
    Debug(args ...any)
    Debugf(format string, args ...any)
    DebugWith(msg string, fields ...Field)

    // 便捷日志 - Info
    Info(args ...any)
    Infof(format string, args ...any)
    InfoWith(msg string, fields ...Field)

    // 便捷日志 - Warn
    Warn(args ...any)
    Warnf(format string, args ...any)
    WarnWith(msg string, fields ...Field)

    // 便捷日志 - Error
    Error(args ...any)
    Errorf(format string, args ...any)
    ErrorWith(msg string, fields ...Field)

    // 便捷日志 - Fatal
    Fatal(args ...any)
    Fatalf(format string, args ...any)
    FatalWith(msg string, fields ...Field)

    // 字段链
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry

    // 输出目标
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // 生命周期
    Flush() error
    Close() error
    IsClosed() bool

    // 配置
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // 上下文提取器
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // 钩子
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // 采样
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig

    // 调试输出
    Print(args ...any)
    Println(args ...any)
    Printf(format string, args ...any)
    Text(data ...any)
    Textf(format string, args ...any)
    JSON(data ...any)
    JSONF(format string, args ...any)

    // 协程管理
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip Logger 额外方法
具体类型 `Logger` 实现了 `LogProvider` 接口，还提供以下接口未包含的方法：

| 方法 | 签名 | 说明 |
|------|------|------|
| `Shutdown` | `(ctx context.Context) error` | 带超时的优雅关闭 |
| `SetLevelResolver` | `(resolver LevelResolver)` | 动态级别解析器 |
| `GetLevelResolver` | `() LevelResolver` | 获取级别解析器 |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | 字段验证配置 |
| `GetFieldValidation` | `() *FieldValidationConfig` | 获取字段验证配置 |

这些方法在 [Logger](./logger) 页面中有详细文档。
:::

## Flusher

Writer 刷新接口。实现了此接口的 Writer 会在 `Logger.Flush()` 时被调用。

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter` 实现了此接口。

## 函数类型

| 类型 | 签名 | 说明 |
|------|------|------|
| `FatalHandler` | `func()` | Fatal 级别的自定义处理函数 |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | 写入错误回调 |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | 动态级别解析 |
| `ContextExtractor` | `func(ctx context.Context) []Field` | 上下文字段提取 |
| `Hook` | `func(ctx context.Context, hookCtx *HookContext) error` | 钩子函数 |
| `HookErrorHandler` | `func(event HookEvent, hookCtx *HookContext, err error)` | 钩子错误处理 |

## 使用场景

### 依赖注入

```go
type Service struct {
    logger dd.CoreLogger  // 只依赖基础接口
}

func NewService(logger dd.CoreLogger) *Service {
    return &Service{logger: logger}
}

// 可传入 *Logger 或 *LoggerEntry
svc := NewService(logger)
svc.logger.Info("服务启动")
```

### 接口适配

```go
// 接受任何实现了 CoreLogger 的类型
func process(logger dd.CoreLogger) {
    logger.InfoWith("处理开始", dd.String("item", "data"))
}
```

## 下一步

- [Logger](./logger) -- 实现 LogProvider 的具体类型
- [LoggerEntry](./entry) -- 实现 CoreLogger 的 Entry 类型
- [包函数](./functions) -- 全局函数
