---
sidebar_label: "迁移指南"
title: "迁移指南 - CyberGo DD | 从其他日志库迁移"
description: "CyberGo DD 从标准库 log/slog 及主流第三方日志库（zap、logrus、zerolog）迁移的完整对照指南，提供详细的 API 映射表、配置参数对照、常见迁移模式和渐进式迁移策略，帮助开发者低风险地将现有日志系统平滑切换到 DD 日志库。"
sidebar_position: 8
---

# 迁移指南

如果你正在使用其他日志库，本指南帮助你快速将项目迁移到 DD。

## 从标准库 log 迁移

### API 对照

| log | DD | 说明 |
|-----|-----|------|
| `log.Print(msg)` | `dd.Info(msg)` | Info 级别 |
| `log.Printf(format, args)` | `dd.Infof(format, args)` | 格式化 |
| `log.Println(msg)` | `dd.Info(msg)` | Info 级别 |
| `log.Fatal(msg)` | `dd.Fatal(msg)` | Fatal（调用 os.Exit） |
| `log.Fatalf(format, args)` | `dd.Fatalf(format, args)` | 格式化 Fatal |
| `log.Panic(msg)` | `dd.Error(msg)` + `panic()` | DD 无内置 Panic |
| — | `dd.InfoWith(msg, fields...)` | 结构化日志（新增） |

### 基本迁移

```go
// Before: log
log.Printf("用户 %s 登录失败: %v", username, err)

// After: DD
dd.Infof("用户 %s 登录失败: %v", username, err)

// 或使用结构化日志
dd.ErrorWith("用户登录失败",
    dd.String("username", username),
    dd.Err(err),
)
```

### 替换全局 Logger

```go
// Before: log
log.SetOutput(file)
log.SetFlags(log.LstdFlags | log.Lshortfile)

// After: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatText,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
dd.SetDefault(logger)
```

## 从 slog 迁移

### API 对照

| slog | DD | 说明 |
|------|-----|------|
| `slog.Info(msg)` | `dd.Info(msg)` | Info 级别 |
| `slog.Info(msg, "key", value)` | `dd.InfoWith(msg, dd.String("key", value))` | 结构化 |
| `slog.Debug(msg)` | `dd.Debug(msg)` | Debug 级别 |
| `slog.Error(msg, "err", err)` | `dd.ErrorWith(msg, dd.Err(err))` | 错误日志 |
| `slog.Warn(msg)` | `dd.Warn(msg)` | Warn 级别 |
| `slog.With("key", value)` | `dd.WithFields(dd.String("key", value))` | 预设字段 |
| `slog.New(handler)` | `dd.New(cfg)` | 创建实例 |
| `slog.SetDefault(logger)` | `dd.SetDefault(logger)` | 设置全局 |

### 结构化日志迁移

```go
// Before: slog
slog.Info("request completed",
    "method", "GET",
    "status", 200,
    "duration", 150*time.Millisecond,
)

// After: DD
dd.InfoWith("请求完成",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("duration", 150*time.Millisecond),
)
```

:::tip 类型安全
slog 使用 `any` 键值对，DD 使用类型明确的字段构造器。类型错误在编译期即可发现。
:::

## 从 zap 迁移

### API 对照

| zap | DD | 说明 |
|-----|-----|------|
| `zap.L().Info(msg, zap.Field...)` | `dd.InfoWith(msg, dd.Field...)` | 结构化 |
| `zap.String(key, val)` | `dd.String(key, val)` | 字符串字段 |
| `zap.Int(key, val)` | `dd.Int(key, val)` | 整数字段 |
| `zap.Error(err)` | `dd.Err(err)` | 错误字段 |
| `zap.Any(key, val)` | `dd.Any(key, val)` | 任意类型 |
| `zap.Sugar().Infof(...)` | `dd.Infof(...)` | 格式化 |
| `logger.With(zap.Field...)` | `logger.WithFields(dd.Field...)` | 预设字段 |
| `zapcore.NewCore(...)` | `dd.New(dd.Config{...})` | 创建实例 |

### 配置对照

```go
// Before: zap
cfg := zap.Config{
    Level:       zap.NewAtomicLevelAt(zap.InfoLevel),
    Encoding:    "json",
    OutputPaths: []string{"stdout", "logs/app.log"},
}
logger, _ := cfg.Build()

// After: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
```

### 字段对照

```go
// Before: zap
logger.Info("request",
    zap.String("method", "GET"),
    zap.Int("status", 200),
    zap.Duration("elapsed", 150*time.Millisecond),
    zap.Error(err),
)

// After: DD
dd.InfoWith("request",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
    dd.Err(err),
)
```

## 从 logrus 迁移

### API 对照

| logrus | DD | 说明 |
|--------|-----|------|
| `logrus.Info(msg)` | `dd.Info(msg)` | Info 级别 |
| `logrus.WithField("k", v)` | `dd.WithField("k", v)` | 单字段 |
| `logrus.WithFields(logrus.Fields{...})` | `dd.WithFields(dd.String(...), ...)` | 多字段 |
| `logrus.SetLevel(logrus.InfoLevel)` | `dd.SetLevel(dd.LevelInfo)` | 设置级别 |
| `logrus.SetFormatter(&logrus.JSONFormatter{})` | `dd.New(dd.Config{Format: dd.FormatJSON})` | JSON 格式 |
| `logrus.SetOutput(file)` | `dd.Config{Targets: ...}` | 输出目标 |
| `logrus.Fatal(msg)` | `dd.Fatal(msg)` | Fatal |

### 字段迁移

```go
// Before: logrus
logrus.WithFields(logrus.Fields{
    "method":  "GET",
    "status":  200,
    "elapsed": 150 * time.Millisecond,
}).Info("Request completed")

// After: DD
dd.WithFields(
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
).Info("Request completed")
```

## DD 特有功能

迁移后可以利用 DD 的独特功能：

| 功能 | 说明 | 文档 |
|------|------|------|
| 敏感数据过滤 | 自动脱敏密码、API Key 等 | [敏感数据过滤](./sensitive-filtering) |
| 审计日志 | 异步安全事件记录 | [审计日志](./audit-logging) |
| HMAC 签名 | 日志防篡改 | [HMAC 签名实战](../advanced/integrity) |
| 行业合规 | HIPAA/PCI-DSS 预设 | [行业合规配置](../security/compliance) |
| 生命周期钩子 | 6 种 Hook 事件 | [钩子系统](./hooks) |
| LoggerRecorder | 测试辅助 | [测试模式](../examples/testing-patterns) |

## 下一步

- [核心概念](./core-concepts) -- DD 架构概述
- [结构化日志](./structured-logging) -- 字段使用详解
- [速查表](../getting-started/cheatsheet) -- API 速查
