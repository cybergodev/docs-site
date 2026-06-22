---
title: "JSON 处理库 - CyberGo JSON | 高性能 Go 库"
description: "CyberGo JSON 是高性能、线程安全的 Go JSON 处理库，支持 JSONPath 路径查询、流式处理、泛型 API 与 Schema 验证，100% 兼容 encoding/json，适用于高并发生产环境。"
---

# JSON 处理库

`github.com/cybergodev/json` 是一个高性能、线程安全的 Go JSON 处理库。它提供了丰富的 JSON 操作功能，包括解析、查询、修改、验证和格式化，同时保持与标准库 `encoding/json` 的 100% 兼容性。

## 核心特性

- **100% encoding/json 兼容** — 无缝替换标准库，无需修改现有代码
- **线程安全** — 所有操作并发安全，支持高并发场景
- **路径查询** — 支持 JSONPath 风格的路径表达式，包括通配符、切片
- **类型安全获取** — 泛型 API (`GetTyped[T]`) 和类型断言方法 (`SafeGet`)
- **流式处理** — 支持大文件和 JSONL/NDJSON 格式流式处理
- **安全防护** — 内置输入验证、深度限制、危险模式检测
- **高性能缓存** — 智能缓存、预解析优化、对象池复用
- **可扩展** — 钩子系统、自定义编码器、验证器

## 安装

```bash
go get github.com/cybergodev/json
```

## 30 秒快速体验

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "CyberGo", "version": 1, "tags": ["json", "go"]}`

    // 1. 路径获取
    name := json.GetString(data, "name")
    fmt.Println("Name:", name)

    // 2. 修改值
    updated, _ := json.Set(data, "version", 2)
    fmt.Println("Updated:", updated)

    // 3. 验证
    if json.Valid([]byte(data)) {
        fmt.Println("Valid JSON")
    }

    // 4. 带默认值获取
    desc := json.GetString(data, "description", "默认描述")
    fmt.Println("Description:", desc)

    // 5. 解码到结构体
    type Config struct {
        Name    string   `json:"name"`
        Version int      `json:"version"`
        Tags    []string `json:"tags"`
    }
    var config Config
    json.Unmarshal([]byte(data), &config)
    fmt.Printf("Config: %+v\n", config)
}
```

## 功能概览

### 路径操作

| 功能 | 函数 | 说明 |
|------|------|------|
| 获取值 | `Get`, `GetString`, `GetInt`... | 支持嵌套路径、数组索引 |
| 带默认值获取 | `GetString`, `GetInt` 等 | 传入 defaultValue 参数 |
| 设置值 | `Set` | 默认自动创建不存在的路径（Config.CreatePaths） |
| 删除值 | `Delete` | 删除指定路径 |

### 编解码

| 功能 | 函数 | 说明 |
|------|------|------|
| 编码 | `Marshal`, `MarshalIndent` | 100% 兼容 encoding/json |
| 解码 | `Unmarshal`, `Parse`, `ParseAny` | 支持泛型和类型安全 |
| 格式化 | `Prettify`, `Compact` | JSON 美化/压缩 |

### 高级功能

| 功能 | 函数/类型 | 说明 |
|------|-----------|------|
| 泛型 API | `GetTyped[T]` | 类型安全的泛型获取 |
| 预解析 | `Processor.PreParse`, `Processor.GetFromParsed` | 一次解析多次查询 |
| 安全获取 | `SafeGet` → `AccessResult` | 链式类型转换 |
| 流式处理 | `NDJSONProcessor` | 逐行流式，内存可控 |
| JSONL 处理 | `StreamLinesInto[T]` | 日志/数据管道 |
| Schema 验证 | `ValidateSchema` | JSON Schema 验证 |

## 模块导航

| 模块 | 说明 |
|------|------|
| [快速开始](./getting-started) | 安装、基本用法、核心概念 |
| [路径表达式语法](./path-syntax) | 路径查询、切片、通配符、字段提取 |
| [API 文档](./api-reference/) | 完整 API 参考 |
| [大文件处理](./large-files) | 流式处理、分块读写、内存优化 |
| [使用示例](./examples) | 实战代码示例 |
| [高级功能示例](./examples-advanced) | 批量编码、预解析、钩子系统 |

## 性能特性

- **零拷贝解析** — 减少内存分配
- **智能缓存** — 自动缓存热点路径，支持缓存预热
- **对象池** — 复用中间对象，降低 GC 压力
- **并行处理** — 批量操作自动并行化
- **预解析优化** — 大型 JSON 一次解析多次查询

## 与标准库对比

| 特性 | encoding/json | cybergodev/json |
|------|---------------|-----------------|
| 基本编解码 | ✅ | ✅ 100% 兼容 |
| 路径查询 | ❌ | ✅ 点号/方括号语法 |
| 类型安全获取 | ❌ | ✅ 泛型 API |
| 流式处理 | 基础 | ✅ 增强 |
| JSONL 支持 | ❌ | ✅ 原生支持 |
| 安全验证 | ❌ | ✅ 内置防护 |
| 钩子系统 | ❌ | ✅ 可扩展 |
| 缓存优化 | ❌ | ✅ 智能缓存 |

## 快速决策指南

| 场景 | 推荐方案 |
|------|----------|
| 简单查询 | `GetString(data, "path")` |
| 带默认值 | `GetString(data, "path", "default")` |
| 类型安全 | `GetTyped[User](data, "user")` |
| 高频查询 | `Processor` + `PreParse` |
| 大文件 | `Processor.ForeachFile` |
| 不可信输入 | `SecurityConfig()` |

## 下一步

- [快速开始](./getting-started) — 5 分钟上手
- [路径表达式语法](./path-syntax) — 完整路径语法
- [使用示例](./examples) — 更多实战示例
