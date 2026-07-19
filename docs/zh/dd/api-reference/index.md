---
sidebar_label: "概览"
title: "API 参考 - CyberGo DD | 概览"
description: "CyberGo DD 结构化日志库完整 API 参考文档概览，全面涵盖 Logger 核心记录器、Config 配置选项、Writers 输出目标、Security 安全过滤、Audit 审计日志、Hooks 钩子系统和 Integrity 完整性签名等核心功能模块。"
sidebar_position: 1
---

# API 参考

DD 日志库提供丰富的 API 接口，按功能模块组织如下：

## 核心组件

| 模块 | 说明 | 文档 |
|------|------|------|
| **包函数** | 全局日志函数、便捷构造器 | [包函数](./core/functions) |
| **Logger** | 核心日志记录器及其方法 | [Logger](./core/logger) |
| **LoggerEntry** | 预设字段的日志 Entry | [LoggerEntry](./core/entry) |
| **Config** | 配置结构体和预设配置 | [配置](./core/config) |
| **接口** | CoreLogger、LogProvider 等接口 | [接口定义](./core/interfaces) |

## 输出与写入

| 模块 | 说明 | 文档 |
|------|------|------|
| **Writers** | FileWriter、BufferedWriter、MultiWriter | [输出目标](./output-integration/writers) |
| **上下文** | Context 集成和 ContextExtractor | [上下文集成](./output-integration/context) |

## 扩展功能

| 模块 | 说明 | 文档 |
|------|------|------|
| **Fields** | 结构化字段构造器（20 种） | [结构化字段](./output-integration/fields) |
| **Hooks** | 生命周期钩子系统 | [钩子系统](./security-audit/hooks) |
| **Security** | 敏感数据过滤和安全配置 | [安全过滤](./security-audit/security) |
| **Audit** | 审计日志和审计事件 | [审计日志](./security-audit/audit) |
| **Integrity** | 日志完整性签名和验证 | [完整性签名](./security-audit/integrity) |

## 辅助工具

| 模块 | 说明 | 文档 |
|------|------|------|
| **Debug Visual** | Print/JSON/Text/Exit 调试函数 | [调试输出](./dev-tools/debug-visual) |
| **Recorder** | 测试辅助日志记录器 | [测试辅助](./dev-tools/recorder) |
| **Constants** | 日志级别、格式、错误码 | [常量与错误](./dev-tools/constants) |

## 快速定位

```go
// 基础使用
dd.Info("message")                        // → 包函数
dd.InfoWith("msg", dd.String("k", "v"))   // → 包函数 + Fields

// 创建自定义日志记录器
logger, _ := dd.New(dd.DefaultConfig())    // → 包函数 + Config
logger.WithFields(fields).Info("msg")      // → Logger + Entry

// 文件输出
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // → Writers

// 安全
sec := dd.DefaultSecurityConfig()          // → Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // → Audit
```

## 下一步

- [包函数](./core/functions) -- 全局函数和构造器
- [Logger](./core/logger) -- 核心日志记录器详解
- [配置](./core/config) -- 配置选项
