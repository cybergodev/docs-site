---
title: "DD - 结构化日志库"
description: "CyberGo DD 是 CyberGo 组织推出的高性能 Go 结构化日志库，提供线程安全的日志记录、灵活的输出目标配置、文件自动轮换、敏感数据自动过滤、异步审计日志、HMAC 完整性签名和零分配优化，帮助开发者快速构建安全可靠的日志记录系统。"
---

# DD

DD（Data-Driven Debugger）是 CyberGo 组织推出的高性能结构化日志库，提供线程安全的日志记录、灵活的输出目标配置和全面的安全防护。

## 特性

- **结构化日志** -- 支持类型安全的字段记录，自动 JSON 序列化
- **多输出目标** -- 同时输出到控制台、文件、自定义 `io.Writer`
- **文件轮换** -- 按大小自动轮换，支持备份数量限制和时间保留策略
- **敏感数据过滤** -- 内置正则模式，自动脱敏密码、密钥、Token 等敏感信息
- **审计日志** -- 异步审计事件记录，支持完整性签名和链式验证
- **钩子系统** -- BeforeLog、AfterLog、OnRotate 等生命周期钩子
- **上下文集成** -- 支持 TraceID、SpanID、RequestID 的自动传播
- **日志采样** -- 高吞吐场景下可选的日志采样策略
- **零分配优化** -- 热路径最小化内存分配，性能卓越

## 安装

```bash
go get github.com/cybergodev/dd
```

## 快速开始

```go
package main

import (
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // 使用默认日志记录器
    dd.Info("服务启动")

    // 结构化日志
    dd.InfoWith("请求处理完成",
        dd.String("method", "GET"),
        dd.Int("status", 200),
        dd.Duration("elapsed", 150*time.Millisecond),
    )

    // 创建自定义日志记录器
    logger, _ := dd.New(dd.DefaultConfig())
    defer logger.Close()

    logger.Info("自定义日志记录器已创建")
}
```

## 模块导航

| 模块 | 说明 |
|------|------|
| [核心概念](./guides/core-concepts) | Logger 体系、处理管道、接口层次 |
| [结构化日志](./guides/structured-logging) | 字段构造器、链式调用 |
| [文件输出与轮换](./guides/file-output) | FileWriter、BufferedWriter |
| [敏感数据过滤](./guides/sensitive-filtering) | 自动脱敏、安全等级 |
| [审计日志](./guides/audit-logging) | 异步审计事件、完整性签名 |
| [钩子系统](./guides/hooks) | 生命周期钩子扩展 |

## 下一步

- [快速开始](./getting-started) -- 5 分钟入门指南
- [核心概念](./guides/core-concepts) -- 理解 DD 架构
- [迁移指南](./guides/migration) -- 从 log/slog/zap/logrus 迁移
- [速查表](./cheatsheet) -- 常用 API 速查
- [API 参考](./api-reference/) -- 完整 API 文档
- [基础示例](./examples/basic-usage) -- 实用代码示例
