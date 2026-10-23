---
sidebar_label: "概述"
title: "API 参考 - CyberGo JSON | 完整函数与类型清单"
description: "CyberGo JSON 是功能完备的 Go JSON 处理库，API 参考覆盖包级函数与 Processor 方法两种风格，汇总 GetString/GetTyped 查询、Set/Delete 修改、Marshal/Unmarshal 编解码、Foreach 迭代与 ValidateSchema 校验等模块索引，帮助开发者快速定位函数、接口与类型用法。"
sidebar_position: 10
---

# API 参考

本节提供 `github.com/cybergodev/json` 库的完整 API 参考。

::: tip 两种 API 风格
本库提供 **包级函数**（如 `json.GetString(data, "path")`，无需创建实例）和 **Processor 方法**（如 `p.GetString(data, "path")`，支持配置复用、预解析缓存与钩子系统）两套 API。不确定该用哪个？参阅 [Processor 入门](../getting-started/processor-guide) 的选择决策树。
:::

## 模块索引

### 函数 API

| 模块 | 说明 |
|------|------|
| [包函数](./functions/) | 包级函数参考（查询/修改/删除/编码/解析/批量/JSONL/文件/迭代） |
| [Processor](./processor/) | 处理器方法（与包函数镜像分类，额外含生命周期与预解析） |

### 类型与接口

| 模块 | 说明 |
|------|------|
| [Config](./config) | 配置选项详解（DefaultConfig / SecurityConfig / PrettyConfig） |
| [类型定义](./types) | 核心类型（Config / Schema / Stats / AccessResult，含 Encoder / Decoder、CompiledPath / PathSegment） |
| [接口定义](./interfaces) | 扩展接口（CustomEncoder / Validator / Hook / PathParser） |
| [迭代器与 IterableValue](./iterator) | Iterator / BatchIterator / ParallelIterator / StreamIterator 类型 |
| [泛型操作](./generics) | 泛型 API（GetTyped[T] / StreamLinesInto[T] / Result[T]） |
| [常量与错误](./constants) | 常量和错误类型（含 `Default*` 常量与 Config 字段对照表） |

### 工具与辅助

| 模块 | 说明 |
|------|------|
| [工具函数](./helpers) | CompareJSON / MergeJSON、缓存管理、全局处理器、SafeError / RedactedPath、AccessResult 方法 |
| [格式化输出](../getting-started/print) | 格式化与压缩 JSON 选型，含 Print 系列迁移说明 |

### 跨模块专题

| 模块 | 说明 |
|------|------|
| [流式处理](../streaming/large-files) | 大文件处理指南（整载迭代与流式迭代器选型） |
| [JSONL / NDJSON 流式处理](../streaming/jsonl) | StreamJSONL 家族与 JSONLWriter 的流式读写 |
| [安全验证](../security/security-mode) | 安全模式 API（SecurityConfig / DangerousPattern / RegisterDangerousPattern） |
| [Schema 校验](./schema) | Schema 验证（ValidateSchema / DefaultSchema / NewSchema） |
| [Hook 钩子系统](../extensions/hooks) | 操作拦截钩子（LoggingHook / TimingHook / ValidationHook / ErrorHook） |
| [自定义编码器](../extensions/custom-encoder) | 自定义编码器（CustomEncoder / TypeEncoder） |

## 快速查找

### 按功能分类

#### 路径查询

| 函数 | 说明 |
|------|------|
| [`Get`](./functions/query#get), `GetWithContext`, [`GetString`](./functions/query#getstring), `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | 类型安全获取 |
| [`GetTyped[T]`](./functions/query#gettyped-t) | 泛型获取 |
| [`SafeGet`](./functions/query#safeget-包级函数) | 安全获取 AccessResult |
| [`GetMultiple`](./functions/query#getmultiple-包级函数) | 批量获取 |

#### 修改操作

| 函数 | 说明 |
|------|------|
| [`Set`](./functions/modify#set), `SetMultiple` | 设置值 |
| [`SetCreate`](./functions/modify#setcreate), `SetMultipleCreate` | 设置值并自动创建路径 |
| [`Delete`](./functions/delete#delete), `DeleteClean` | 删除值 |
| [`ProcessBatch`](./functions/batch#processbatch) | 批量操作 |

#### 编解码

| 函数 | 说明 |
|------|------|
| [`Marshal`](./functions/output#marshal), [`Unmarshal`](./functions/output#unmarshal) | 标准编解码（兼容 `encoding/json`，可附加 `cfg`） |
| [`MarshalIndent`](./functions/output#marshalindent) | 格式化编码（兼容 `encoding/json.MarshalIndent`，可附加 `cfg`） |
| [`Encode`](./functions/output#encode), [`EncodePretty`](./functions/output#encodepretty) | 编码为字符串（带配置 / 格式化输出） |
| [`EncodeWithConfig`](./functions/output#encodewithconfig)（已废弃） | 与 `Encode` 功能等价，v1 生命周期内保留——新代码请改用 `Encode` 或 `Marshal` |
| `NewEncoder`, `NewDecoder` | 流式编解码 |
| [`Parse`](./functions/parse#parse), [`ParseAny`](./functions/parse#parseany) | 解析到目标变量 / 解析为 `any` |
| [`EncodeBatch`](./processor/output#encodebatch), `EncodeFields`, `EncodeStream` | 键值对编码为对象 / 按字段挑选编码 / 多值编码为数组 |

#### 格式化

| 函数 | 说明 |
|------|------|
| [`Prettify`](./functions/output#prettify) | 格式化 JSON |
| [`Compact`](./functions/output#compact) | 压缩 JSON（buffer 形式，兼容 `encoding/json.Compact`） |
| [`CompactString`](./functions/output#compactstring) | 压缩 JSON（字符串输入/输出形式，镜像 `Processor.Compact`） |
| [`Indent`](./functions/output#indent) | 缩进格式化并写入 buffer（兼容 `encoding/json.Indent`） |
| [`HTMLEscape`](./functions/output#htmlescape) | HTML 字符转义并写入 buffer（兼容 `encoding/json.HTMLEscape`） |

#### 文件操作

| 函数 | 说明 |
|------|------|
| [`LoadFromFile`](./functions/file-io#loadfromfile), `SaveToFile` | 文件读写 |
| [`LoadFromReader`](./functions/file-io#loadfromreader) | 从 Reader 读取 |
| [`MarshalToFile`](./functions/file-io#marshaltofile), `UnmarshalFromFile` | 文件编解码 |
| [`SaveToWriter`](./functions/file-io#savetowriter) | 写入任意 Writer |

#### 迭代遍历

| 函数 | 说明 |
|------|------|
| [`Foreach`](./functions/iterate#foreach)（已废弃）, [`ForeachWithError`](./functions/iterate#foreachwitherror), `ForeachNested`（已废弃）, `ForeachNestedWithError` | 遍历数组/对象（含深度遍历；void 变体已废弃，推荐 `*WithError`） |
| [`ForeachWithPath`](./functions/iterate#foreachwithpath), `ForeachWithPathAndIterator`, `ForeachWithPathAndControl` | 指定路径遍历（携带当前路径/可控制中断） |
| [`ForeachReturn`](./functions/iterate#foreachreturn) | 遍历并返回修改后的 JSON |
| [`ForeachFile`](./functions/iterate#foreachfile), `ForeachFileWithPath`, `ForeachFileChunked`, `ForeachFileNested` | 文件逐条迭代（整载内存后逐条/分批回调） |
| [`NewIterator`](./iterator#newiterator), `NewBatchIterator`, `NewParallelIterator`, `NewStreamIterator` | 独立迭代器构造（详见[迭代器](./iterator)） |

#### 缓存与全局

| 函数 | 说明 |
|------|------|
| [`WarmupCache`](./helpers#warmupcache), `ClearCache` | 缓存预热 / 清理 |
| [`GetStats`](./helpers#getstats-包级函数), `GetHealthStatus` | 运行统计 / 健康检查 |
| `GetConfig`, `SetLogger` | 处理器配置读取 / 日志注入（含全局与 Processor 方法） |
| [`SetGlobalProcessor`](./helpers#全局处理器管理), `ShutdownGlobalProcessor` | 全局处理器替换与关闭 |
| `RegisterDangerousPattern`, `UnregisterDangerousPattern`, `ListDangerousPatterns` | 全局危险模式注册表的注册 / 移除 / 列举（详见[工具函数](./helpers#registerdangerouspattern)） |
| [`CompilePath`](./processor/query#compilepath)（Processor）, [`PreParse`](./processor/query#preparse)（Processor） | 路径预编译 / JSON 预解析 |

#### 流式处理

| 类型/方法 | 说明 |
|------|------|
| [`StreamLinesInto[T]`](./functions/jsonl#streamlinesinto) | 从 Reader 流式读取 JSONL 并转换为 `[]T` |
| [`ParseJSONL`](./functions/jsonl#parsejsonl) | 解析 JSONL 字节为 `[]any` |
| [`ToJSONL`](./functions/jsonl#tojsonl), `ToJSONLString` | 将 `[]any` 转换为 JSONL 格式 |
| `JSONLWriter` | JSONL 写入器（Write/WriteAll/WriteRaw） |
| `NDJSONProcessor`（[已弃用](../streaming/jsonl#ndjsonprocessor)） | NDJSON/JSONL 处理器（由 `NewNDJSONProcessor` 创建；新代码请用 StreamJSONL 家族） |
| [`ForeachFile`](./functions/iterate#foreachfile) | 文件逐条迭代（整载内存） |

#### 验证

| 函数 | 说明 |
|------|------|
| [`Valid`](./functions/parse#valid) | JSON 验证（兼容 `encoding/json.Valid`） |
| [`ValidWithConfig`](./functions/parse#validwithconfig) | 带配置的 JSON 验证 |
| [`ValidateSchema`](./functions/parse#validateschema) | Schema 验证（配合 `Schema` 类型使用） |
| [`CompareJSON`](./helpers#comparejson) | 比较 JSON 是否等价 |
| `MergeJSON`, `MergeMany` | JSON 合并（联合/交集/差集模式，详见[工具函数](./helpers)） |

## 命名约定

库遵循以下命名约定：

| 模式 | 说明 | 示例 |
|------|------|------|
| `Get{Type}` | 获取指定类型（支持 defaultValue） | `GetString`, `GetInt` |
| `GetTyped[T]` | 泛型获取，返回 T | `GetTyped[User]` |
| `New{Type}` | 创建实例 | `New` (返回 *Processor), `NewEncoder` |
| `Default{Type}` | 默认配置 | `DefaultConfig` |
| `{Type}Config` | 配置预设 | `SecurityConfig`, `PrettyConfig` |
| `Foreach*` | 迭代变体（WithError / WithPath / Nested / File） | `ForeachNestedWithError` |
| `Stream*` | 流式处理变体（Into / Parallel / File / Chunked） | `StreamJSONLParallel` |
| `{Verb}Hook` | 钩子工厂 | `LoggingHook`, `ValidationHook` |

## 相关

- [快速开始](../getting-started/) -- 安装和基本用法
- [Processor 入门](../getting-started/processor-guide) -- 何时使用处理器
- [路径表达式语法](../getting-started/path-syntax) -- 路径查询语法
- [使用示例](../examples/) -- 实战代码示例
- [大文件处理](../streaming/large-files) -- 流式处理指南
