---
sidebar_label: "Logger"
title: "Logger - CyberGo DD | 核心日志记录器"
description: "CyberGo DD Logger 核心日志记录器 API：日志输出方法（Info/Warn/Error/Fatal）、级别动态管理、Writer 增删替换、生命周期控制（Close/Flush）与链式字段设置，是日志库线程安全高性能的核心入口类型。"
sidebar_position: 2
---

# Logger

`Logger` 是 DD 的核心类型，提供线程安全的日志记录功能。

## 创建

```go
// 通过 New 创建
logger, _ := dd.New(dd.DefaultConfig())
```

```go
// 自定义配置创建
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## 日志方法

### 基础日志

| 方法 | 说明 |
|------|------|
| `Debug(args ...any)` | Debug 级别日志 |
| `Info(args ...any)` | Info 级别日志 |
| `Warn(args ...any)` | Warn 级别日志 |
| `Error(args ...any)` | Error 级别日志 |
| `Fatal(args ...any)` | Fatal 级别日志（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |
| `Log(level LogLevel, args ...any)` | 指定级别日志 |

### 格式化日志

| 方法 | 说明 |
|------|------|
| `Debugf(format string, args ...any)` | 格式化 Debug |
| `Infof(format string, args ...any)` | 格式化 Info |
| `Warnf(format string, args ...any)` | 格式化 Warn |
| `Errorf(format string, args ...any)` | 格式化 Error |
| `Fatalf(format string, args ...any)` | 格式化 Fatal（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |
| `Logf(level LogLevel, format string, args ...any)` | 格式化指定级别 |

### 结构化日志

| 方法 | 说明 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 结构化 Debug |
| `InfoWith(msg string, fields ...Field)` | 结构化 Info |
| `WarnWith(msg string, fields ...Field)` | 结构化 Warn |
| `ErrorWith(msg string, fields ...Field)` | 结构化 Error |
| `FatalWith(msg string, fields ...Field)` | 结构化 Fatal（默认调用 os.Exit(1)，**defer 不会执行**；可通过 FatalHandler 自定义） |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 结构化指定级别 |

```go
logger.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## 级别管理

```go
level := logger.GetLevel()                    // 获取当前级别
_ = logger.SetLevel(dd.LevelDebug)            // 设置级别
enabled := logger.IsLevelEnabled(dd.LevelInfo)// 检查级别

// 快捷检查
logger.IsDebugEnabled()
logger.IsInfoEnabled()
logger.IsWarnEnabled()
logger.IsErrorEnabled()
logger.IsFatalEnabled()

// 动态级别解析器
logger.SetLevelResolver(func(ctx context.Context) dd.LogLevel {
    if isDebug {
        return dd.LevelDebug
    }
    return dd.LevelInfo
})
resolver := logger.GetLevelResolver()
```

## 字段链

```go
// 预设字段，返回 LoggerEntry
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// 单字段
entry := logger.WithField("env", "prod")
```

## 输出目标管理

```go
// 添加 Writer
_ = logger.AddWriter(os.Stderr)

// 移除 Writer
_ = logger.RemoveWriter(os.Stderr)

// 获取 Writer 数量
count := logger.WriterCount()

// 设置写入错误处理器
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "写入失败: %v\n", err)
})
```

## 上下文集成

```go
// 添加上下文提取器
_ = logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// 替换所有提取器
_ = logger.SetContextExtractors(extractor1, extractor2)

// 获取当前提取器
extractors := logger.GetContextExtractors()
```

## 钩子管理

```go
// 注册钩子
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // 日志前处理
    return nil
})

// 替换钩子注册表
_ = logger.SetHooks(registry)

// 获取钩子注册表
hooks := logger.GetHooks()
```

## 采样控制

```go
// 设置采样配置
logger.SetSampling(&dd.SamplingConfig{
    // 采样参数
})

// 获取采样配置
cfg := logger.GetSampling()
```

## 安全配置

```go
// 设置安全配置
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// 获取安全配置
sec := logger.GetSecurityConfig()
```

## 字段验证

```go
// 设置字段验证
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 获取验证配置
validation := logger.GetFieldValidation()
```

## 生命周期

```go
// 刷新缓冲
_ = logger.Flush()

// 关闭日志记录器
_ = logger.Close()

// 优雅关闭（带超时）
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// 检查是否已关闭
closed := logger.IsClosed()

// 等待过滤协程完成
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## 调试输出

| 方法 | 说明 |
|------|------|
| `Print(args ...any)` | 输出到配置的 Writer（LevelInfo，受安全过滤） |
| `Println(args ...any)` | 与 Print 行为一致（底层 Log() 已自动换行） |
| `Printf(format string, args ...any)` | 格式化输出（LevelInfo，受安全过滤） |
| `JSON(data ...any)` | 紧凑 JSON 格式输出到 stdout（含调用者信息，不经过安全过滤） |
| `JSONF(format string, args ...any)` | 格式化紧凑 JSON 输出到 stdout（含调用者信息，不经过安全过滤） |
| `Text(data ...any)` | 美化打印格式输出到 stdout（不含调用者信息，不经过安全过滤） |
| `Textf(format string, args ...any)` | 格式化文本输出到 stdout（不含调用者信息，不经过安全过滤） |

## 下一步

- [LoggerEntry](./entry) -- 预设字段链式调用
- [配置](./config) -- Config 详解
- [输出目标](../output-integration/writers) -- FileWriter 详解
