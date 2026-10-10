---
sidebar_label: "迭代方法"
title: "包级迭代函数 - CyberGo JSON | Foreach 遍历用法"
description: "CyberGo JSON 是包级迭代的 Go 库，ForeachWithPath 按路径遍历、ForeachWithError 错误可控、ForeachFile 迭代文件，对象按键名字典序遍历、顺序确定可复现，并支持嵌套递归与文件分块处理，帮助开发者按序遍历数组与对象。"
sidebar_position: 100
---

# 包级迭代函数

无需创建 Processor 实例，直接调用的迭代函数。与 [Processor 迭代方法](../processor/iterate) 一一对应（双层设计）。

::: tip 迭代顺序确定
对象迭代按键名**字典序**进行，数组按自然顺序——Go map 原生迭代顺序是随机的，库内部做了排序，因此同一输入的回调顺序可复现、输出可测试。
:::

## Foreach

<Badge type="danger" text="已废弃" />

签名：`func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

迭代 JSON 数组或对象。

::: warning 已废弃
`Foreach` 会**静默丢弃错误**：文档非法、处理器不可用或已关闭时，回调被**整体跳过**且不返回任何错误，调用方无从得知。请改用 [`ForeachWithError`](#foreachwitherror)——它把错误正常返回，且回调返回 `nil` 表示继续迭代。`Foreach` 在 v1 生命周期内保留、不会移除。
:::

```go
// 已废弃：错误被静默丢弃；新代码请用 ForeachWithError（见下）
json.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**迭代数组时**：key 为索引（int）
**迭代对象时**：key 为键名（string）

## ForeachWithPath

签名：`func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

按路径迭代，返回错误。

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

适用于：
- 迭代嵌套数组
- 迭代指定路径的对象

## ForeachNested

<Badge type="danger" text="已废弃" />

签名：`func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

递归迭代所有嵌套层级。递归深度上限为 200（防止深嵌套结构导致栈溢出，超出的子树不再深入）。

::: warning 已废弃
`ForeachNested` 与 `Foreach` 一样**静默丢弃错误**：解析失败或处理器已关闭时回调被整体跳过，不返回任何错误。请改用 [`ForeachNestedWithError`](#foreachnestedwitherror)——它把错误正常返回，且回调返回 `nil` 表示继续迭代。`ForeachNested` 在 v1 生命周期内保留、不会移除。
:::

```go
// 已废弃：错误被静默丢弃；新代码请用 ForeachNestedWithError（见下）
json.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("键: %v, 值: %v\n", key, item.GetData())
})
```

示例数据：

```json
{
  "user": {
    "name": "test",
    "profile": {
      "age": 25,
      "tags": ["a", "b"]
    }
  }
}
```

输出：

```text
键：user, 值：map[string]any{...}
键：name, 值：test
键：profile, 值：map[string]any{...}
键：age, 值：25
键：tags, 值：[]any{...}
...
```

## ForeachReturn

签名：`func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

迭代 JSON 数据并通过回调访问每个元素，返回重新序列化后的 JSON 字符串。回调可经由 `GetData()` 对 map/slice 做修改，修改会反映到返回值。注意两点：只能改动**容器内部**（map 增删键、slice 改元素）——无法通过 `IterableValue` 原地替换标量元素；迭代运行在解析结果的**深拷贝**上，不会污染处理器缓存。

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 可通过 item.GetData() 访问/修改元素
})
```

适用于需要在迭代后继续链式操作的场景。

## ForeachWithError

签名：`func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

按路径迭代，回调支持返回错误。

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // 继续迭代
})
```

## ForeachNestedWithError

签名：`func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

递归迭代所有嵌套层级，回调支持返回错误。

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("键: %v, 值: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

签名：`func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

按路径迭代并提供当前路径信息。使用 `IteratorControl` 控制迭代流程。

```go
err := json.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("路径: %s, 键: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // 停止迭代
    }
    return json.IteratorNormal // 继续迭代
})
```

## ForeachWithPathAndControl

签名：`func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

按路径迭代原始值，使用 `IteratorControl` 控制流程。

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("键: %v, 值: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

迭代回调中的 `IterableValue` 提供便捷的值访问能力，完整方法定义详见 [迭代器类型](../iterator#iterablevalue-类型)。

| 方法 | 说明 |
|------|------|
| `GetData() any` | 获取当前值 |
| `Get(path string) any` | 按路径获取值 |
| `GetString(key string) string` | 获取字符串值 |
| `GetInt(key string) int` | 获取整数值 |
| `GetFloat64(key string) float64` | 获取浮点数值 |
| `GetBool(key string) bool` | 获取布尔值 |
| `GetArray(key string) []any` | 获取数组值 |
| `GetObject(key string) map[string]any` | 获取对象值 |
| `Exists(key string) bool` | 判断字段是否存在 |
| `IsNull(key string) bool` / `IsNullData() bool` | 判断是否为 null |
| `IsEmpty(key string) bool` / `IsEmptyData() bool` | 判断是否为空 |
| `Break() error` | 返回中断迭代的错误信号 |
| `Release()` | 释放资源回对象池 |

## 方法对比

| 方法 | 路径参数 | 递归 | 返回值 | 错误回调 |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | 无 | 否 | 无 | 否 |
| `ForeachWithPath` | 有 | 否 | error | 否 |
| `ForeachNested` | 无 | 是 | 无 | 否 |
| `ForeachReturn` | 无 | 否 | (string, error) | 否 |
| `ForeachWithError` | 有 | 否 | error | 是 |
| `ForeachNestedWithError` | 无 | 是 | error | 是 |
| `ForeachWithPathAndIterator` | 有 | 否 | error | IteratorControl |
| `ForeachWithPathAndControl` | 有 | 否 | error | IteratorControl |

::: warning void 变体不报错
`Foreach` / `ForeachNested` 返回值为空：处理器不可用等设置错误被静默忽略，回调 panic 被捕获并记录日志后停止迭代（不会击穿进程）。error 变体（`*WithError` 系列）则把回调 panic 转换为错误返回。需要错误信息时，一律用带 `error` 返回值的变体。
:::

---

## 文件迭代函数

包级提供直接从文件迭代的函数，与 [Processor 文件迭代方法](../processor/iterate#文件迭代方法) 对应。注意：它们都会先把**整个文件加载进内存**再逐条/分批回调（受 `MaxJSONSize` 上限约束，默认 100MB），恒定内存的大文件处理请改用 [StreamIterator 等流式迭代器](../../streaming/large-files#流式迭代器与并行迭代器)。

### ForeachFile

签名：`func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并迭代。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `fn` | `func(key any, item *IterableValue) error` | 迭代回调 |

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 继续迭代
})
```

---

### ForeachFileWithPath

签名：`func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并按路径迭代。

```go
// 只迭代 users 数组
err := json.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("用户: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

签名：`func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

分块迭代文件中的 JSON 数组，适合批量处理大数据集。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `chunkSize` | `int` | 每批处理的数量（≤0 时默认 100） |
| `fn` | `func(chunk []*IterableValue) error` | 批处理回调 |

```go
// 每批处理 100 条记录
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // 批量插入数据库
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:   item.GetInt("id"),
            Name: item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

::: tip 使用场景
- 批量数据库插入
- 分批 API 调用（批量落库、分批回调）
- 注意：分块不省内存——文件仍会整载后才分批回调；恒定内存的大文件处理请改用 [StreamIterator](../../streaming/large-files)
:::

---

### ForeachFileNested

签名：`func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并递归迭代所有嵌套结构。

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // 遍历所有层级的所有键值对
    fmt.Printf("路径: %v, 类型: %T\n", key, item.GetData())
    return nil
})
```

**示例数据**：

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}
```

**输出**：

```text
路径：database, 类型：map[string]any
路径：host, 类型：string
路径：port, 类型：float64
路径：pool, 类型：map[string]any
路径：min, 类型：float64
路径：max, 类型：float64
```

---

## 文件迭代方法对比

| 方法 | 路径参数 | 递归 | 分块 | 适合场景 |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | 无 | 否 | 否 | 简单文件遍历 |
| `ForeachFileWithPath` | 有 | 否 | 否 | 定点遍历 |
| `ForeachFileChunked` | 无 | 否 | **是** | 批量落库、分批回调（文件仍整载内存） |
| `ForeachFileNested` | 无 | **是** | 否 | 深度遍历所有节点 |

---

## 迭代控制

### IteratorControl 常量

`ForeachWithPathAndControl` 与 `ForeachWithPathAndIterator` 通过返回 `IteratorControl` 控制迭代流程（常量定义见 [迭代器类型](../iterator#iteratorcontrol-常量)）：

| 常量 | 说明 |
|------|------|
| `IteratorNormal` | 正常继续迭代 |
| `IteratorContinue` | `IteratorNormal` 的 no-op 别名（为 API 对称保留）——「跳过当前项」是隐式的：不产生任何副作用，迭代照常继续 |
| `IteratorBreak` | 停止迭代 |

### 中断迭代

在错误回调中返回 `item.Break()` 可中断迭代：

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // 找到目标，停止迭代
        return item.Break()
    }
    return nil // 继续迭代
})
```

### 错误处理

返回其他错误会中断迭代并返回该错误：

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("发现错误记录: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("迭代中断: %v", err)
}
```

---

## 相关

- [Processor 迭代方法](../processor/iterate) - 对应的处理器方法
- [迭代器类型](../iterator) - Iterator/IterableValue/Stream/Batch/Parallel 类型定义
- [路径查询](./query) - Get 系列方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [文件操作](./file-io) - LoadFromFile/SaveToFile
- [大文件处理指南](../../streaming/large-files) - 流式处理场景实践
