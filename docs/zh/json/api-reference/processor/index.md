---
sidebar_label: "概述"
title: "Processor 处理器 - CyberGo JSON | 链式处理与生命周期"
description: "Processor 是复用同一数据源的处理器实例：提供 Get/Set/Delete 查询修改、Foreach 迭代与 Encode 编码，内置结果缓存与 Close 生命周期。"
sidebar_position: 10
---

# Processor

`Processor` 是持有配置、缓存与钩子的处理器实例。每次方法调用仍接收 JSON 字符串，但安全校验、编码选项与结果缓存由同一个实例统一决定。

## 特点

- **缓存**：命中结果缓存时跳过重复的解析与路径求值
- **可配置**：`New(cfg)` 固化安全校验、编码与缓存参数
- **不可变返回**：修改方法返回新字符串，可链式串联
- **显式生命周期**：`Close` 释放缓存、校验器与钩子引用

## 创建 Processor

### New

签名：`func New(cfg ...Config) (*Processor, error)`

创建 Processor 实例。省略 `cfg` 时使用 `DefaultConfig()`；传入的配置先经 `Validate` 校验并钳制越界字段。

```go
// 使用默认配置
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.FullSecurityScan = true
processor, err = json.New(cfg)

// 使用安全配置
processor, err = json.New(json.SecurityConfig())
```

## 链式调用

修改方法与删除方法返回新的 JSON 字符串，上一个结果可以直接作为下一个调用的输入：

```go
processor, _ := json.New()

// 设置多个值
result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## API 目录

| 类别 | 说明 |
|------|------|
| [查询获取](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled/PreParse/GetFromParsed |
| [修改操作](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/MergeJSON/MergeMany/CompareJSON |
| [删除操作](./delete) | Delete/DeleteClean |
| [编码输出](./output) | Encode/EncodePretty/EncodeWithConfig（已废弃）/MarshalIndent/Prettify/Compact/CompactString/CompactBuffer/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream/ValidateSchema |
| [解析验证](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal |
| [批量操作](./batch) | ProcessBatch/WarmupCache |
| [JSONL](./jsonl) | StreamJSONL/StreamJSONLParallel/StreamJSONLParallelWithContext/StreamJSONLChunked/StreamJSONLFile/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL/CollectJSONL/FirstJSONL/ParseJSONL/ToJSONL/ToJSONLString |
| [文件操作](./file-io) | LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile/ForeachFile 系列 |
| [迭代方法](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachReturn/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachWithPathAndControl/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [生命周期](./lifecycle) | Close/IsClosed/GetConfig/AddHook/SetLogger/ClearCache/WarmupCache/GetStats/GetHealthStatus/SetGlobalProcessor/ShutdownGlobalProcessor |

---

## 全局处理器管理

包级函数使用内部全局处理器，用以下两个函数管理：

### SetGlobalProcessor

签名：`func SetGlobalProcessor(processor *Processor)`

设置自定义全局处理器。所有包级函数（`Get`、`Set`、`Marshal` 等）改用此实例。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `processor` | `*Processor` | 自定义处理器实例 |

```go
package main

import (
	"github.com/cybergodev/json"
)

func main() {
	// 创建自定义配置的处理器
	cfg := json.SecurityConfig()
	processor, err := json.New(cfg)
	if err != nil {
		panic(err)
	}

	// 设置为全局处理器
	json.SetGlobalProcessor(processor)

	// 现在所有包级函数使用安全配置
	data, err := json.Get(`{"name":"Alice"}`, "name")
	// 使用了 SecurityConfig 的限制
	_ = data
}
```

::: warning 注意
- 传入 `nil` 不会执行任何操作
- 前一个全局处理器会自动关闭
- 此函数是线程安全的
:::

### ShutdownGlobalProcessor

签名：`func ShutdownGlobalProcessor()`

关闭并移除全局处理器，同时清理它的缓存。后续包级操作会新建默认处理器。

```go
package main

import (
	"github.com/cybergodev/json"
)

func main() {
	// 使用全局处理器
	data, _ := json.Get(`{"key":"value"}`, "key")
	_ = data

	// 应用关闭时清理
	json.ShutdownGlobalProcessor()

	// 后续操作会创建新的默认处理器
	data2, _ := json.Get(`{"key":"value2"}`, "key")
	_ = data2
}
```

::: tip 使用场景
- 长时间运行的服务在关闭时清理资源
- 需要重置处理器配置时
- 测试环境中隔离不同测试用例
:::

---

## 相关

- [包函数](../functions/) - 顶级函数参考
- [Config](../config) - 配置选项
- [接口定义](../interfaces) - Hook 接口
- [Hook 钩子系统](../../extensions/hooks) - 钩子详细使用指南
