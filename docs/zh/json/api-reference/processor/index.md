---
title: "Processor 处理器 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 处理器：New 创建、GetString/Set/Delete 操作、Foreach 迭代、Encode 编码、Close 生命周期、Stats 统计与缓存配置，适合高频复用场景。"
---

# Processor

Processor 提供高性能、可自定义性、更灵活的复用能力，适合多次操作同一数据源。

## 特点

- **高性能**：内部缓存机制，重复操作更高效
- **可配置**：支持多种配置选项
- **链式调用**：方法返回修改后的 JSON，支持连续操作
- **资源管理**：显式生命周期控制

## 创建 Processor

### New

签名：`func New(cfg ...Config) (*Processor, error)`

创建 Processor 实例。使用可选的 Config 参数配置处理器。

```go
// 使用默认配置
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.StrictMode = true
processor, err = json.New(cfg)

// 使用安全配置
processor, err = json.New(json.SecurityConfig())
```

## 链式调用

Processor 方法返回修改后的 JSON 字符串，支持连续操作：

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
| [路径查询](./query) | GetString/Int/Float/Bool/Get/GetWithContext/SafeGet/GetArray/GetObject/GetMultiple/CompilePath/GetCompiled |
| [数据修改](./modify) | Set/SetMultiple/SetCreate/SetMultipleCreate/Delete/DeleteClean |
| [输出方法](./output) | Encode/EncodePretty/EncodeWithConfig/Compact/Indent/HTMLEscape/EncodeBatch/EncodeFields/EncodeStream |
| [解析与加载](./parse) | Parse/ParseAny/Valid/ValidBytes/Marshal/Unmarshal/LoadFromFile/LoadFromReader/SaveToFile/MarshalToFile/SaveToWriter/UnmarshalFromFile |
| [迭代方法](./iterate) | Foreach/ForeachWithPath/ForeachNested/ForeachReturn/ForeachWithError/ForeachNestedWithError/ForeachWithPathAndIterator/ForeachWithPathAndControl/ForeachFile/ForeachFileWithPath/ForeachFileChunked/ForeachFileNested |
| [批量操作](./batch) | ProcessBatch/WarmupCache |
| [JSONL 处理](./jsonl) | StreamJSONL/StreamJSONLParallel/StreamJSONLParallelWithContext/StreamJSONLChunked/StreamJSONLFile/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL/CollectJSONL/FirstJSONL |
| [生命周期](./lifecycle) | Close/IsClosed/GetConfig/AddHook/ClearCache/GetStats/GetHealthStatus |

---

## 全局处理器管理

包级函数使用内部全局处理器。可以通过以下函数管理：

### SetGlobalProcessor

签名：`func SetGlobalProcessor(processor *Processor)`

设置自定义全局处理器。所有包级函数（Get、Set、Marshal 等）将使用此处理器。

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

关闭并移除全局处理器。后续包级操作将创建新的默认处理器。

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

- [包函数](../functions) - 顶级函数参考
- [Config](../config) - 配置选项
- [接口定义](../interfaces) - Hook 接口
- [Hook 钩子系统](../hooks) - 钩子详细使用指南
