---
title: "快速开始 - CyberGo DD | 5分钟入门指南"
description: "快速上手 CyberGo DD 高性能结构化日志库的完整入门教程，从安装依赖到首次输出日志，逐步学习创建日志记录器、配置输出目标与文件轮换策略、使用结构化字段记录请求上下文信息和钩子系统扩展功能，5 分钟即可掌握核心用法并应用到实际项目中。"
---

# 快速开始

## 1. 创建日志记录器

DD 提供多种便捷构造函数，满足不同场景需求：

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    // 方式一：默认全局日志记录器（零配置）
    dd.Info("使用全局日志记录器")

    // 方式二：开发模式（DEBUG 级别，带 caller）
    dev, _ := dd.New(dd.DevelopmentConfig())
    defer dev.Close()
    dev.Info("开发模式输出")

    // 方式三：输出到文件
    file, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    defer file.Close()
    file.Info("文件输出")

    // 方式四：同时输出到控制台和文件
    all, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    defer all.Close()
    all.Info("双目标输出")

    // 方式五：JSON 格式双目标输出
    jsonLogger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    defer jsonLogger.Close()
    jsonLogger.Info("JSON 格式输出")
}
```

## 2. 日志级别

DD 支持 5 个日志级别，从低到高：

```go
dd.Debug("调试信息")   // LevelDebug
dd.Info("一般信息")    // LevelInfo（默认）
dd.Warn("警告信息")    // LevelWarn
dd.Error("错误信息")   // LevelError
dd.Fatal("致命错误")   // LevelFatal（调用 os.Exit）
```

格式化版本：

```go
dd.Debugf("用户 %s 登录，耗时 %dms", name, elapsed)
dd.Infof("请求处理完成: status=%d", status)
dd.Warnf("连接池使用率 %d%%", usage)
dd.Errorf("数据库查询失败: %v", err)
```

## 3. 结构化日志

使用类型安全的字段构造器：

```go
dd.InfoWith("请求处理完成",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

输出示例（默认文本格式）：

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 请求处理完成 method=GET path=/api/users status=200 elapsed=150ms
```

:::tip JSON 格式输出
默认全局日志记录器使用文本格式。如需 JSON 格式输出，请使用 `dd.New(dd.JSONConfig())` 创建 JSON 格式的日志记录器。
:::

## 4. 字段链式传递

```go
// 创建带预设字段的 Entry
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// 每次日志自动携带预设字段
requestLogger.Info("服务启动")
requestLogger.InfoWith("路由注册完成",
    dd.Int("routes", 42),
)
```

## 5. 文件轮换

通过 `FileWriter` 配置轮换策略：

```go
// 默认 100MB, 30天, 10个备份
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})

logger.Info("hello world")
```

## 6. 敏感数据过滤

DD 默认启用基础敏感数据过滤（密码、API Key、信用卡号等自动脱敏）：

```go
// 默认配置已包含基础安全过滤
logger, _ := dd.New(dd.DefaultConfig())

// 密码字段自动脱敏
logger.InfoWith("用户登录",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 输出: [REDACTED]
)
```

## 下一步

- [核心概念](./guides/core-concepts) -- 理解 Logger 体系与处理管道
- [结构化日志](./guides/structured-logging) -- 字段使用详解
- [文件输出与轮换](./guides/file-output) -- FileWriter 详解
- [敏感数据过滤](./guides/sensitive-filtering) -- 安全过滤实战
- [速查表](./cheatsheet) -- 常用 API 速查
