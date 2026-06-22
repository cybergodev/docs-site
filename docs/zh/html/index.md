---
title: "HTML 提取库 - CyberGo HTML | 生产级 Go 库"
description: "CyberGo HTML 是高性能 Go HTML 内容提取与清洗库，提供智能文章识别、自动编码检测、并发批量处理与可插拔审计，输出文本、Markdown、JSON，适用于 Web 抓取与文档分析。"
---

# HTML

生产级 HTML 内容提取工具，支持自动编码检测（15+ 编码）、智能文章识别、链接/媒体提取和多格式输出。

## 特性

- **智能文章识别** - 自动识别并提取页面主体内容，去除导航、广告等噪音
- **内容清洗** - 自动清洗 HTML，移除危险标签和属性，防止 XSS 攻击
- **元数据提取** - 自动提取标题、图片、链接、视频、音频等结构化信息
- **多格式输出** - 纯文本、Markdown、JSON 三种输出格式
- **自动编码检测** - 支持 UTF-8、GBK、Shift_JIS、Windows-1252 等 15+ 编码
- **批量处理** - 并发批量提取，内置 Processor 对象池复用
- **链接提取** - 独立的链接提取 API，支持按类型分组
- **审计系统** - 可插拔的审计管道，支持多 Sink、事件过滤
- **安全防护** - 输入大小限制、深度限制、路径遍历防护、恐慌恢复

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

    fmt.Println(result.Title) // 输出: 示例
    fmt.Println(result.Text)  // 输出: 标题\n\n正文内容
}
```

## 架构概览

HTML 库围绕三个核心类型构建：

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
| `Config` | 配置 | 所有行为的控制中心，提供 4 种预设 |
| `Processor` | 引擎 | 有状态的处理引擎，管理缓存、统计、审计 |
| `Result` | 结果 | 提取的结构化输出，包含文本和所有元数据 |

### Processor vs 包级函数

| | 包级函数 | Processor |
|---|---|---|
| 调用方式 | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| 缓存 | 无（每次使用内部临时池） | 有，可配置 TTL 和容量 |
| 统计 | 无 | 有，可查询命中率等指标 |
| 审计 | 无 | 有，可配置审计管道 |
| 生命周期 | 无需管理 | 需 `defer p.Close()` |
| 并发安全 | 是 | 是 |

:::tip 选择建议
- **一次性提取**（CLI 工具、脚本）→ 包级函数
- **服务端高频调用**（Web 服务、爬虫）→ Processor
- **需要审计/监控** → Processor
:::

| 阶段 | 页面 | 你将学到 |
|------|------|----------|
| 入门 | [快速开始](./getting-started) | 安装、基本用法、两种调用方式 |
| 核心 | [内容提取](./guides/content-extraction) | Extract 全家族、Config 配置、Result 解读 |
| 格式 | [输出格式](./guides/output-formats) | Markdown / JSON 输出、格式配置 |
| 性能 | [缓存与复用](./guides/processor-cache) | Processor 生命周期、缓存调优、批量处理 |
| 扩展 | [链接提取](./guides/link-extraction) | 链接提取、分组、资源发现 |
| 安全 | [审计管道](./guides/audit-pipeline) | 审计系统、自定义 Sink、安全监控 |
| 高级 | [测试与自定义](./guides/testing-custom) | 自定义 Scorer、ContentNode、测试模式 |
| 参考 | [速查表](./cheatsheet) | 常用 API 一览 |

## 下一步

- [快速开始](./getting-started) - 5 分钟入门教程
- [速查表](./cheatsheet) - 常用操作速查
- [API 参考](./api-reference/) - 完整 API 文档
