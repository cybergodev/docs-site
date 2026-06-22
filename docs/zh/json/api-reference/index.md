---
title: "API 参考 - CyberGo JSON | 完整函数文档"
description: "CyberGo JSON 完整 API 参考：GetString/GetInt 路径查询、Set/Delete 修改、Marshal/Unmarshal 序列化、Processor 处理器、Schema 验证、Hook 与安全配置，兼容标准库。"
---

# API 参考

本节提供 `github.com/cybergodev/json` 库的完整 API 参考。

## 模块索引

| 模块 | 说明 |
|------|------|
| [包函数](./functions) | 包级函数参考，包括路径查询、类型获取、编解码等 |
| [Processor](./processor/) | 处理器方法和配置 |
| [Config](./config) | 配置选项详解 |
| [类型定义](./types) | 核心类型定义（含 Encoder/Decoder） |
| [泛型操作](./generics) | 泛型 API 参考 |
| [接口定义](./interfaces) | 扩展接口定义 |
| [流式处理](./large-file) | 流式处理器参考 |
| [NDJSON 处理](./jsonl) | JSONL/NDJSON 处理器 |
| [迭代器](./iterator) | 迭代遍历 API |
| [辅助函数](./helpers) | 类型转换和工具函数 |
| [格式化输出](./print) | 格式化和美化输出 |
| [安全验证](./security) | 安全相关 API |
| [验证器](./validator) | Schema 验证器 |
| [钩子系统](./hooks) | 操作拦截钩子 |
| [自定义编码器](./custom-encoder) | 自定义编码器 |
| [常量与错误](./constants) | 常量和错误类型 |

## 快速查找

### 按功能分类

#### 路径查询

| 函数 | 说明 |
|------|------|
| `Get`, `GetWithContext`, `GetString`, `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | 类型安全获取 |
| `GetTyped[T]` | 泛型获取 |
| `SafeGet` | 安全获取 AccessResult |
| `GetMultiple` | 批量获取 |

#### 修改操作

| 函数 | 说明 |
|------|------|
| `Set`, `SetMultiple` | 设置值 |
| `SetCreate`, `SetMultipleCreate` | 设置值并自动创建路径 |
| `Delete`, `DeleteClean` | 删除值 |
| `ProcessBatch` | 批量操作 |

#### 编解码

| 函数 | 说明 |
|------|------|
| `Marshal`, `Unmarshal` | 标准编解码 |
| `MarshalIndent` | 格式化编码 |
| `Encode`, `EncodeWithConfig` | 编码为字符串 |
| `NewEncoder`, `NewDecoder` | 流式编解码 |
| `Parse` | 解析 JSON |

#### 格式化

| 函数 | 说明 |
|------|------|
| `Prettify` | 格式化 JSON |
| `Compact` | 压缩 JSON |

#### 文件操作

| 函数 | 说明 |
|------|------|
| `LoadFromFile`, `SaveToFile` | 文件读写 |
| `LoadFromReader` | 从 Reader 读取 |
| `MarshalToFile`, `UnmarshalFromFile` | 文件编解码 |

#### 流式处理

| 类型/方法 | 说明 |
|------|------|
| `StreamLinesInto[T]` | 从 Reader 流式读取 JSONL 并转换为 `[]T` |
| `ParseJSONL` | 解析 JSONL 字节为 `[]any` |
| `ToJSONL`, `ToJSONLString` | 将 `[]any` 转换为 JSONL 格式 |
| `JSONLWriter` | JSONL 写入器（Write/WriteAll/WriteRaw） |
| `NDJSONProcessor` | NDJSON/JSONL 处理器 |
| `ForeachFile` | 文件流式处理 |

#### 验证

| 函数 | 说明 |
|------|------|
| `Valid` | JSON 验证（兼容 `encoding/json.Valid`） |
| `ValidWithConfig` | 带配置的 JSON 验证 |
| `ValidateSchema` | Schema 验证（配合 `Schema` 类型使用） |
| `CompareJSON` | 比较 JSON 是否等价 |

## 命名约定

库遵循以下命名约定：

| 模式 | 说明 | 示例 |
|------|------|------|
| `Get{Type}` | 获取指定类型（支持 defaultValue） | `GetString`, `GetInt` |
| `GetTyped[T]` | 泛型获取，返回 T | `GetTyped[User]` |
| `New{Type}` | 创建实例 | `New` (返回 *Processor), `NewEncoder` |
| `Default{Type}` | 默认配置 | `DefaultConfig` |
| `{Type}Config` | 配置预设 | `SecurityConfig`, `PrettyConfig` |

## 相关

- [快速开始](../getting-started) -- 安装和基本用法
- [路径表达式语法](../path-syntax) -- 路径查询语法
- [使用示例](../examples) -- 实战代码示例
- [大文件处理](../large-files) -- 流式处理指南
