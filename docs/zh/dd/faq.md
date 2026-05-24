---
title: "FAQ - CyberGo DD | 常见问题"
description: "CyberGo DD 日志库常见问题与详细解答汇总，涵盖配置调优技巧、性能优化建议、敏感数据安全过滤规则、审计日志与合规配置方法、文件轮换策略选择与优化、错误处理最佳实践和钩子系统使用示例等主题，帮助开发者快速解决在实际项目中遇到的各类问题。"
---

# 常见问题

## 基础使用

### 全局日志记录器和自定义日志记录器有什么区别？

**全局日志记录器**通过 `dd.Info()` 等包级函数直接使用，适合简单场景。**自定义日志记录器**通过 `dd.New()` 创建，支持独立配置和生命周期管理。

```go
// 全局日志记录器
dd.Info("全局日志")

// 自定义日志记录器
logger, _ := dd.New(dd.JSONConfig())
logger.Info("独立日志")
```

### 如何在程序启动时初始化全局日志记录器？

```go
func init() {
    err := dd.InitDefault(dd.JSONConfig())
    if err != nil {
        log.Fatal(err)
    }
}
```

或通过 `SetDefault`：

```go
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
dd.SetDefault(logger)
```

### Fatal 级别日志会怎样？

`Fatal` / `Fatalf` / `FatalWith` 在输出日志后调用 `os.Exit(1)`。可通过 `FatalHandler` 自定义行为。

## 配置

### 如何同时输出到控制台和文件？

```go
logger, _ := dd.New(dd.Config{
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
// 或 JSON 格式
logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### 如何动态修改日志级别？

```go
_ = logger.SetLevel(dd.LevelDebug)  // 运行时修改（返回 error）
_ = dd.SetLevel(dd.LevelDebug)      // 修改全局日志记录器级别
```

### 如何配置文件轮换策略？

通过 `FileWriter` 配置：

```go
fw, _ := dd.NewFileWriter("logs/app.log",
    dd.DefaultFileWriterConfig(),  // 100MB, 30天, 10个备份
)
```

## 性能

### 日志会影响程序性能吗？

DD 在设计上追求高性能：
- 热路径零分配优化
- 原子级别检查，无锁
- 敏感数据过滤在独立 goroutine 中执行
- 可选缓冲写入减少 I/O

### 高吞吐场景如何优化？

1. 使用 `BufferedWriter` 减少 I/O
2. 先检查级别再构造字段
3. 考虑启用日志采样
4. 避免在高频路径使用 `Any` 字段

详见 [性能优化](./advanced/performance)。

## 安全

### 敏感数据过滤是如何工作的？

`SensitiveDataFilter` 使用正则模式匹配，在日志写入前自动替换匹配的敏感值为 `[REDACTED]`。小输入同步处理，大输入在独立 goroutine 中执行并带超时保护，不阻塞日志写入。

### 如何自定义敏感数据模式？

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)my_secret_field\s*[:=]\s*\S+`,
)
```

### 如何确保日志不被篡改？

使用 `IntegritySigner` 对日志进行 HMAC 签名：

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
sig := signer.Sign(logMessage)
// 验证: signer.Verify(signedEntry)
```

## 错误处理

### 为什么 AddWriter 返回错误？

可能的原因：
- `ErrNilWriter` -- 传入了 nil Writer
- `ErrLoggerClosed` -- 日志记录器已关闭
- `ErrMaxWritersExceeded` -- Writer 数量超限

### 如何处理写入失败？

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // 自定义处理
    metrics.WriteErrors.Inc()
})
```

## 测试

### 如何在测试中捕获日志？

使用 `LoggerRecorder`：

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("test")

if !rec.ContainsMessage("test") {
    t.Error("未找到预期日志")
}
```

详见 [测试辅助](./api-reference/recorder)。

## 下一步

- [快速开始](./getting-started) -- 入门指南
- [API 参考](./api-reference/) -- 完整 API
- [生产检查清单](./security/production-checklist) -- 上线检查
