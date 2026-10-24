---
sidebar_label: "概述"
title: "JSON 处理库 - CyberGo JSON | JSONPath 查询与流式处理"
description: "CyberGo JSON 是 Go 的 JSON 库：Get/Set 路径查询、StreamJSONL 流式处理与泛型 GetTyped，签名兼容 encoding/json。"
---

# JSON 处理库

`github.com/cybergodev/json` 是 Go 的 JSON 处理库，提供解析、路径查询、修改、校验与格式化，以及大文件与 JSONL 流式处理。

函数签名与 `encoding/json` 一致，替换 import 后现有代码可直接编译。默认输入会做安全校验，与标准库存在少量行为差异（见[与标准库对比](#与标准库对比)）。

## 核心特性

- **签名兼容 encoding/json** — `Marshal`/`Unmarshal`/`Valid`/`Compact`/`Indent` 与 `Encoder`/`Decoder` 方法与标准库同名同签名，替换 import 即可编译；默认输入校验带来少量行为差异
- **线程安全** — 单个 `Processor` 可被多个 goroutine 共享，所有公开方法内部有并发保护
- **路径查询** — 点号语法、数组索引、切片、通配符与 JSON Pointer 都可用一条路径表达
- **类型安全获取** — `GetTyped[T]` 泛型解码，`SafeGet` 返回可链式转换的 `AccessResult`
- **流式处理** — `StreamIterator`/`StreamObjectIterator` 逐元素解码，JSONL 系列逐行处理
- **安全防护** — 默认校验输入体积、嵌套深度、非法 UTF-8 与危险模式
- **缓存** — 解析缓存与结果缓存默认开启，`WarmupCache` 可预热高频路径
- **可扩展** — `Hook` 拦截 `Get`/`Set`/`Delete`；自定义编码经 `MarshalJSON`、`MarshalText` 或 `CustomEscapes`

## 安装

```bash
go get github.com/cybergodev/json
```

**要求 Go 1.25+**（源码 go.mod 声明 `go 1.25.0`；示例用到泛型与 `slices` 标准库）。

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
| 批量获取 | `GetMultiple` | 一次解析取回多个路径的值 |
| 带默认值获取 | `GetString`, `GetInt` 等 | 传入 defaultValue 参数 |
| 设置值 | `Set` | 默认自动创建不存在的路径（Config.CreatePaths） |
| 删除值 | `Delete` | 删除指定路径 |

### 编解码

| 功能 | 函数 | 说明 |
|------|------|------|
| 编码 | `Marshal`, `MarshalIndent` | 输出字节与标准库一致（典型值） |
| 解码 | `Unmarshal`, `Parse`, `ParseAny` | 支持泛型和类型安全 |
| 格式化 | `Prettify`, `Compact` | JSON 美化/压缩 |

### 高级功能

| 功能 | 函数/类型 | 说明 |
|------|-----------|------|
| 泛型 API | `GetTyped[T]` | 类型安全的泛型获取 |
| 预解析 | `Processor.PreParse`, `Processor.GetFromParsed` | 一次解析多次查询 |
| 路径预编译 | `Processor.CompilePath`, `Processor.GetCompiled` | 同一路径高频查询零重复解析 |
| 并行迭代 | `NewParallelIterator` | 内置 worker 池的并行 Map/Filter/ForEach |
| 安全获取 | `SafeGet` → `AccessResult` | 链式类型转换 |
| 流式处理 | `StreamJSONL` 家族 | 逐行流式，内存可控 |
| JSONL 处理 | `StreamLinesInto[T]` | 日志/数据管道 |
| Schema 验证 | `ValidateSchema` | JSON Schema 验证 |

## 模块导航

| 模块 | 说明 |
|------|------|
| [快速开始](./getting-started/) | 安装、基本用法、核心概念 |
| [路径表达式语法](./getting-started/path-syntax) | 路径查询、切片、通配符、字段提取 |
| [Processor 入门](./getting-started/processor-guide) | 何时使用 Processor、预解析优化、生命周期 |
| [API 文档](./api-reference/) | 完整 API 参考 |
| [大文件处理](./streaming/large-files) | 文件逐条迭代、流式迭代器与读取上限 |
| [扩展接口](./extensions/) | Hook 拦截 Get/Set/Delete 全流程；自定义编码走 `MarshalJSON`、`MarshalText` 或 `CustomEscapes` |
| [安全](./security/) | 默认开启输入安全校验（体积/深度/UTF-8/危险模式），`SecurityConfig()` 预设面向不可信输入，附生产检查清单 |
| [使用示例](./examples/) | 路径、编解码、迭代与 JSONL 的可运行示例 |
| [高级功能示例](./examples/examples-advanced) | 批量编码、字段筛选、预解析、路径预编译、缓存预热 |

## 性能特性

- **零分配快速路径** — 缓存键由可比较结构体构成，不在每次操作时拼接字符串；缓存关闭时单键属性访问直接读根对象，绕过递归处理器
- **缓存** — 解析结果与查询结果默认缓存（`EnableCache`/`CacheResults`），`WarmupCache` 可预热高频路径
- **对象池** — 复用 `IterableValue`、编码缓冲与排序键切片等中间对象，降低 GC 压力
- **并行流处理** — JSONL 流式处理支持多 worker 并行（`StreamJSONLParallel`）
- **预解析** — `PreParse` 让同一份 JSON 只解析一次，多个路径共享解析树

## 与标准库对比

| 特性 | encoding/json | cybergodev/json |
|------|---------------|-----------------|
| 基本编解码 | ✅ | ✅ 签名一致，默认输入额外做安全校验 |
| 路径查询 | ❌ | ✅ 点号/方括号语法 |
| 类型安全获取 | ❌ | ✅ 泛型 API |
| 流式处理 | 基础流式解码 | ✅ 逐元素/逐行迭代器 |
| JSONL 支持 | ❌ | ✅ 原生支持 |
| 安全验证 | ❌ | ✅ 默认开启 |
| 钩子系统 | ❌ | ✅ 可扩展 |
| 缓存优化 | ❌ | ✅ 解析与结果缓存 |

## 快速决策指南

| 场景 | 推荐方案 |
|------|----------|
| 简单查询 | `GetString(data, "path")` |
| 带默认值 | `GetString(data, "path", "default")` |
| 类型安全 | `GetTyped[User](data, "user")` |
| 同一 JSON 查多路径 | `Processor` + `PreParse` |
| 同一路径查多 JSON | `Processor` + `CompilePath` |
| 大文件 | `StreamIterator`（>100MB）/ `Processor.ForeachFile`（10–100MB，整载） |
| 大数组并行处理 | `NewParallelIterator` |
| JSONL 流水线 | `StreamLinesInto[T]` |
| 不可信输入 | `SecurityConfig()` |

## 下一步

- [快速开始](./getting-started/) — 安装与最小示例
- [Processor 入门](./getting-started/processor-guide) — 何时使用处理器
- [路径表达式语法](./getting-started/path-syntax) — 完整路径语法
- [使用示例](./examples/) — 更多可运行示例
- [安全](./security/) — 默认输入安全校验与不可信输入防护
