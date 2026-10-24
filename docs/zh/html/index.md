---
sidebar_label: "概述"
title: "HTML 提取工具库 - CyberGo html | 内容提取与清洗"
description: "CyberGo html 是 Go 语言 HTML 内容提取与清洗库：识别页面正文，提取标题、图片、链接、视频与音频，支持 15+ 编码检测、Markdown 与 JSON 输出、批量并发处理、可插拔审计管道与多层安全防护，适用于 Web 抓取、爬虫与内容采集场景。"
---

# HTML

CyberGo html 是一个 Go 语言 HTML 内容提取与清洗库，从 HTML 字节中提取正文、标题、图片、链接与音视频，支持 15+ 编码检测与多种输出格式。

## 特性

- **文章识别** - 定位页面主体内容，移除导航、广告等噪音
- **内容清洗** - 移除危险标签、事件属性与危险协议，降低 XSS 风险
- **元数据提取** - 输出标题、图片、链接、视频、音频等结构化信息
- **多格式输出** - 纯文本、Markdown、JSON 三种输出格式
- **编码检测** - 支持 UTF-8、GBK、Shift_JIS、Windows-1252 等 15+ 编码
- **批量处理** - 并发批量提取，复用 Processor 对象池
- **链接提取** - 独立的链接提取 API，支持按类型分组
- **审计系统** - 可插拔审计管道，支持多 Sink、事件过滤
- **安全防护** - 输入大小限制、深度限制、路径遍历防护、panic 恢复

## 安装

```bash
go get github.com/cybergodev/html
```

## 快速开始

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>示例</title></head>
        <body><h1>标题</h1><p>正文内容</p></body></html>`)

	result, err := html.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.Title) // 输出：示例
	fmt.Println(result.Text)  // 输出：标题\n\n正文内容
}
```

## 架构概览

库围绕三个核心类型构建：

```text
                Config
                  │
                  ▼
             Processor ──→ Result
              │    │         │
              │    │         ├── Text / Title
              │    │         ├── Images / Videos / Audios
              │    │         ├── Links
              │    │         └── WordCount / ReadingTime
              │    │
              │    ├── Cache（缓存）
              │    ├── Statistics（统计）
              │    └── AuditLog（审计）
              │
              ├── Scorer（自定义评分 ── 可扩展）
              └── AuditSink（审计输出 ── 可扩展）
```

| 类型 | 职责 | 说明 |
|------|------|------|
| `Config` | 配置 | 控制所有行为，提供 4 种预设 |
| `Processor` | 引擎 | 有状态的处理引擎，管理缓存、统计、审计 |
| `Result` | 结果 | 提取的结构化输出，包含文本和全部元数据 |

### Processor 与包级函数

| | 包级函数 | Processor |
|---|---|---|
| 调用方式 | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| 缓存 | 无（池化实例归还时清空缓存） | 有，可配置 TTL 和容量 |
| 统计 | 无 | 有，可查询命中率等指标 |
| 审计 | 无 | 有，可配置审计管道 |
| 生命周期 | 无需管理 | 需 `defer p.Close()` |
| 并发安全 | 是 | 是 |

:::tip 两种调用方式的适用场景
- **一次性提取**（CLI 工具、脚本）→ 包级函数
- **服务端高频调用**（Web 服务、爬虫）→ Processor
- **需要审计或监控** → Processor
:::

| 阶段 | 页面 | 内容 |
|------|------|------|
| 入门 | [快速开始](./getting-started/) | 安装、基本用法、两种调用方式 |
| 核心 | [内容提取](./guides/core-features/content-extraction) | Extract 全家族、Config 配置、Result 解读 |
| 媒体 | [媒体提取](./guides/core-features/media-extraction) | 视频、音频、嵌入内容提取 |
| 格式 | [输出格式](./guides/core-features/output-formats) | Markdown / JSON 输出、格式配置 |
| 链接 | [链接提取](./guides/core-features/link-extraction) | 链接提取、分组、资源发现 |
| 编码 | [编码检测](./guides/core-features/encoding-detection) | 自动检测、手动指定、15+ 编码支持 |
| 配置 | [配置指南](./guides/core-features/configuration) | 四种预设、六大类字段、常见组合 |
| 错误 | [错误处理](./guides/performance/error-handling) | 五类错误、errors.Is/As、context 取消 |
| 性能 | [缓存与复用](./guides/performance/processor-cache) | Processor 生命周期、缓存调优 |
| 批量 | [批量处理](./guides/performance/batch-processing) | 并发批量提取、WorkerPool 调优 |
| 安全 | [安全防护](./guides/security/) | 安全特性、审计系统、生产检查 |
| 高级 | [测试与自定义](./guides/integration/testing-custom) | 自定义 Scorer、ContentNode、测试模式 |
| 参考 | [速查表](./getting-started/cheatsheet) | 常用 API 一览 |

## 下一步

- [快速开始](./getting-started/) - 5 分钟入门教程
- [速查表](./getting-started/cheatsheet) - 常用操作速查
- [API 参考](./api-reference/) - 完整 API 文档
