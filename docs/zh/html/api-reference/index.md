---
sidebar_label: "概览"
title: "API 参考 - CyberGo html | 完整函数与类型清单"
description: "CyberGo html API 参考索引：对比包函数与 Processor 两种调用模式，按模块导航至配置、输出格式、链接提取、批量处理、接口定义、数据类型、常量与错误、安全防护与审计系统；附核心类型速查、接口速查、四种预设与按场景找 API 的对照表。"
sidebar_position: 10
---

# API 参考

CyberGo html 是 Go 语言的 HTML 内容提取库，API 分两组入口：包级函数用于一次性调用，`Processor` 实例用于复用缓存与累计状态。下表按组件导航到对应文档。

| 组件 | 说明 | 文档 |
|------|------|------|
| 包函数 | 便捷函数，适合一次性调用 | [包函数](./core/functions) |
| Processor | `Processor` 实例，复用资源与缓存 | [Processor](./core/processor) |
| Config | 配置结构体与预设 | [配置](./core/config) |
| 输出格式 | Markdown、JSON 输出 | [输出格式](./modules/output) |
| 链接提取 | 独立的链接提取 API | [链接提取](./modules/links) |
| 批量处理 | 并发批量提取 | [批量处理](./modules/batch) |
| 接口 | `Extractor`、`StatsProvider` 等 | [接口定义](./types/interfaces) |
| 类型 | `Result`、`ImageInfo` 等 | [类型定义](./types/type-defs) |
| 常量与错误 | 默认值、哨兵错误 | [常量与错误](./types/constants) |
| 安全防护 | 清洗、输入限制、路径安全 | [安全防护](./modules/security) |
| 审计系统 | 审计管道与 Sink | [审计系统](./modules/audit) |

## API 总览

### 两种调用模式

```text
┌─────────────────────────────────────────┐
│           包函数（一次性调用）             │
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
| 基础 | `Extract*` | `Extract`、`ExtractText` |
| 从文件 | `Extract*FromFile` | `ExtractFromFile` |
| 带上下文 | `Extract*WithContext` | `ExtractWithContext` |
| 从文件 + 上下文 | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### 模块信息

- **模块路径**：`github.com/cybergodev/html`
- **Go 版本**：1.26+
- **依赖**：`golang.org/x/net`、`golang.org/x/text`

## 核心类型速查

| 类型 | 说明 | 文档 |
|------|------|------|
| `Result` | 提取结果（文本、标题、图片、链接、统计） | [类型定义](./types/type-defs) |
| `Config` | 统一配置结构体与预设 | [配置](./core/config) |
| `Processor` | 核心处理引擎，支持缓存与统计 | [Processor](./core/processor) |
| `Statistics` | 处理统计（命中、错误、平均耗时） | [类型定义](./types/type-defs) |
| `BatchResult` | 批量提取结果 | [批量处理](./modules/batch) |
| `LinkResource` | 链接资源（含类型分类） | [链接提取](./modules/links) |
| `AuditEntry` | 审计日志条目 | [审计系统](./modules/audit) |

## 接口速查

| 接口 | 说明 | 文档 |
|------|------|------|
| `Extractor` | 提取主接口，便于解耦与 mock | [接口定义](./types/interfaces) |
| `StatsProvider` | 统计与缓存管理接口 | [接口定义](./types/interfaces) |
| `Scorer` | 自定义内容评分算法 | [接口定义](./types/interfaces) |
| `ContentNode` | 节点抽象，屏蔽内部解析器类型 | [接口定义](./types/interfaces) |
| `AuditSink` | 审计日志输出目标 | [接口定义](./types/interfaces) |

## 预设配置

从预设出发再覆写字段，不要手写零值配置（`Config{}` 无法通过 `Validate()`）：

| 预设 | 用途 |
|------|------|
| `DefaultConfig()` | 通用场景，平衡功能与性能 |
| `TextOnlyConfig()` | 不保留媒体与链接信息，跳过对应提取 |
| `MarkdownConfig()` | 正文内联图片与链接输出 Markdown 格式 |
| `HighSecurityConfig()` | 高安全环境：收紧限额、缩短超时、开启审计 |

详见 [配置](./core/config)。

## 按场景找 API

| 需求 | 推荐 API | 文档 |
|------|----------|------|
| 只提取纯文本 | `ExtractText` / `Processor.ExtractText` | [包函数](./core/functions) |
| Markdown 输出 | `ExtractToMarkdown` 或 `MarkdownConfig()` | [输出格式](./modules/output) |
| 提取所有链接资源 | `ExtractAllLinks` | [链接提取](./modules/links) |
| 批量并发处理 | `ExtractBatch` / `ExtractBatchFiles` | [批量处理](./modules/batch) |
| 自定义内容识别 | `Scorer` 接口 + `Config.Scorer` | [接口定义](./types/interfaces) |
| 审计安全事件 | `AuditConfig` + `AuditSink` | [审计系统](./modules/audit) |
| 高频复用 + 缓存 | `html.New()` 长驻 `Processor` | [Processor](./core/processor) |
