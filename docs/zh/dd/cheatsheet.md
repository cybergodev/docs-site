---
title: "速查表 - CyberGo DD | 常用 API 速查"
description: "CyberGo DD 日志库常用 API 速查表，涵盖日志记录器创建与克隆、日志级别控制、结构化字段构造、文件输出轮换与缓冲配置、敏感数据安全过滤规则、钩子注册与回调处理函数、审计日志记录和完整性签名验证等高频操作，方便开发者快速查阅和使用。"
---

# 速查表

## 创建日志记录器

| 方式 | 代码 | 说明 |
|------|------|------|
| 全局默认 | `dd.Info("msg")` | 零配置即用 |
| 开发模式 | `dd.New(dd.DevelopmentConfig())` | DEBUG 级别，带 caller |
| 自定义 | `dd.New(dd.Config{Targets: ...})` | 完整配置 |
| 文件 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | 仅文件输出 |
| 双目标 | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | 控制台+文件 |
| JSON 双目标 | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSON格式双目标 |

## 预设配置

```go
dd.DefaultConfig()       // 默认配置：INFO 级别，文本格式
dd.DevelopmentConfig()   // 开发配置：DEBUG 级别，动态 caller
dd.JSONConfig()          // JSON 配置：JSON 格式输出
```

## 日志级别

| 级别 | 常量 | 方法 | 格式化 |
|------|------|------|--------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

结构化版本：`DebugWith()`、`InfoWith()`、`WarnWith()`、`ErrorWith()`、`FatalWith()`

## 字段构造器

| 类型 | 构造器 | 示例 |
|------|--------|------|
| 通用 | `Any(key, val)` | `dd.Any("data", obj)` |
| 字符串 | `String(key, val)` | `dd.String("name", "test")` |
| 整数 | `Int(key, val)` | `dd.Int("count", 42)` |
| 布尔 | `Bool(key, val)` | `dd.Bool("ok", true)` |
| 时间 | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| 持续时间 | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| 错误 | `Err(err)` | `dd.Err(err)` |
| 错误+栈 | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## 字段链

```go
// 预设字段
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("启动")                    // 自动携带 svc=api

// 追加字段
entry2 := entry.WithField("env", "prod")
entry2.Info("环境就绪")               // 携带 svc + env
```

## 输出目标

```go
// 文件写入器（自动轮换）
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// 缓冲写入器
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// 多写入器
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## 上下文集成

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## 安全配置

```go
dd.DefaultSecurityConfig()   // 基础过滤（推荐）
dd.DefaultSecureConfig()     // 完整过滤
dd.HealthcareConfig()        // HIPAA 合规
dd.FinancialConfig()         // PCI-DSS 合规
dd.GovernmentConfig()        // 政府标准
```

## 生命周期

```go
logger.Flush()                           // 刷新缓冲
logger.Close()                           // 关闭日志记录器
logger.Shutdown(ctx)                     // 优雅关闭（带超时）
dd.SetDefault(logger)                    // 替换全局日志记录器
dd.InitDefault(cfg)                      // 初始化全局日志记录器
```

## 调试输出

```go
// 通过全局 Logger（受安全过滤）
dd.Print("值:", val)       // 快速打印
dd.Printf("格式: %v", val) // 格式化打印

// 直接输出（无安全过滤，仅用于调试）
dd.JSON(data)              // JSON 格式调试输出
dd.Text(data)              // 文本格式调试输出
dd.Exit(data)              // 输出后退出
```
