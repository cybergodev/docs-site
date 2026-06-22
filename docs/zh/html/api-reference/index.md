---
title: "API 参考 - CyberGo HTML | 完整模块索引"
description: "CyberGo HTML 完整 API 索引：包函数与 Processor 两种调用方式，涵盖内容提取、格式输出、链接、批量、配置、审计与类型等全部模块。"
---

# API 参考

HTML 库提供以下核心组件：

| 组件 | 说明 | 文档 |
|------|------|------|
| 包函数 | 便捷函数，适合一次性调用 | [包函数](./functions) |
| Processor | 处理器实例，复用资源和缓存 | [Processor](./processor) |
| Config | 配置结构体和预设 | [配置](./config) |
| 输出格式 | Markdown、JSON 输出 | [输出格式](./output) |
| 链接提取 | 独立的链接提取 API | [链接提取](./links) |
| 批量处理 | 并发批量提取 | [批量处理](./batch) |
| 接口 | Extractor、StatsProvider 等 | [接口定义](./interfaces) |
| 类型 | Result、ImageInfo 等 | [类型定义](./types) |
| 常量与错误 | 默认值、哨兵错误 | [常量与错误](./constants) |
| 审计系统 | 审计管道和 Sink | [审计系统](./audit) |

## API 总览

### 两种调用模式

```text
┌─────────────────────────────────────────┐
│           包函数（便捷模式）               │
│  html.Extract(data) → *Result, error    │
│  内部使用 sync.Pool 复用 Processor       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Processor（实例模式）             │
│  p, _ := html.New(cfg)                  │
│  defer p.Close()                        │
│  result, err := p.Extract(data)         │
│  ✓ 缓存复用  ✓ 统计收集  ✓ 审计日志      │
└─────────────────────────────────────────┘
```

### 函数命名规则

| 模式 | 命名 | 示例 |
|------|------|------|
| 基础 | `Extract*` | `Extract`, `ExtractText` |
| 从文件 | `Extract*FromFile` | `ExtractFromFile` |
| 带上下文 | `Extract*WithContext` | `ExtractWithContext` |
| 从文件+上下文 | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### 模块信息

- **模块路径**: `github.com/cybergodev/html`
- **Go 版本**: 1.25+
- **依赖**: `golang.org/x/net`, `golang.org/x/text`
