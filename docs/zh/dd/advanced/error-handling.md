---
title: "错误处理 - CyberGo DD | 日志错误管理"
description: "CyberGo DD 日志库错误处理完整指南，详解结构化错误类型与层级体系、错误码设计、哨兵错误定义与判断方法、errors.Is/As 错误包装与拆包、自定义错误处理策略实现、错误恢复机制和错误钩子回调配置，帮助开发者精确识别和处理各类日志相关错误。"
---

# 错误处理

DD 定义了结构化的错误体系，便于精确识别和处理各类错误。

## 错误类型

### LoggerError

结构化错误，包含错误码、消息、原因和上下文：

```go
type LoggerError struct { ... }

// 创建（直接使用 LoggerError 结构体字段）
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "错误描述",
}

// 包装（使用 LoggerError 结构体字段）
err := &dd.LoggerError{
    Code:    "WRAP_CODE",
    Message: "包装描述",
    Cause:   originalErr,
}
```

方法：

| 方法 | 说明 |
|------|------|
| `Error() string` | 错误消息 |
| `Unwrap() error` | 获取内部错误 |
| `Is(target error) bool` | 错误比较 |
| `WithContext(key, value)` | 添加上下文信息 |
| `WithField(key, value)` | 添加字段信息 |

```go
err := &dd.LoggerError{
    Code:    "DB_ERROR",
    Message: "查询失败",
    Cause:   dbErr,
}
err = err.WithContext("query", "SELECT * FROM users")
err = err.WithField("retry_count", 3)
```

### WriterError

写入器错误，包含 Writer 索引和原始错误。

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

多写入器聚合错误。

```go
type MultiWriterError struct { ... }
```

方法：`HasErrors()`、`ErrorCount()`、`FirstError()`

## 错误处理模式

### errors.Is 匹配

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrNilConfig) {
        // 处理配置为空
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 处理无效级别
    }
}
```

### 写入错误处理

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 自定义写入错误处理
    if errors.Is(err, dd.ErrWriterNotFound) {
        // Writer 已被移除
        return
    }
    // 记录错误指标
    metrics.WriteErrors.Inc()
})
```

### 运行时错误处理

```go
// 添加 Writer
if err := logger.AddWriter(w); err != nil {
    if errors.Is(err, dd.ErrLoggerClosed) {
        // 日志记录器已关闭
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer 为空
        return
    }
}

// 设置级别
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // 无效级别
    }
}
```

### 安全错误

```go
fw, err := dd.NewFileWriter(userPath, dd.DefaultFileWriterConfig())
if err != nil {
    if errors.Is(err, dd.ErrPathTraversal) {
        // 路径遍历攻击
        log.Fatal("检测到路径遍历攻击")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Null 字节注入
        log.Fatal("检测到 null 字节注入")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // 符号链接不允许
    }
}
```

### 模式错误

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // ReDoS 风险模式
        log.Fatal("正则模式存在 ReDoS 风险")
    }
    if errors.Is(err, dd.ErrInvalidPattern) {
        // 无效正则
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // 模式过长
    }
}
```

## 钩子错误

使用钩子时可通过钩子配置的 `OnError` 回调来捕获和处理钩子执行中的错误：

```go
// 通过 HooksConfig 配置钩子错误处理
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // 自定义钩子错误处理
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## 全局日志记录器错误

```go
// 初始化时检查
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// 运行时检查
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("全局日志记录器初始化有误:", err)
}
```

## 下一步

- [常量与错误](../api-reference/constants) -- 完整错误码列表
- [钩子系统](../api-reference/hooks) -- HookRegistry
- [安全过滤](../api-reference/security) -- 安全相关错误
