---
sidebar_label: "迭代方法"
title: "包级迭代函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 包级迭代函数：Foreach、ForeachWithPath、ForeachNested 递归、ForeachWithError 错误处理与 IterableValue 数据访问，含 ForeachFile 文件迭代。"
sidebar_position: 10
---

# 包级迭代函数

无需创建 Processor 实例，直接调用的迭代函数。与 [Processor 迭代方法](../processor/iterate) 一一对应（双层设计）。

## Foreach

签名：`func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

迭代 JSON 数组或对象。

```go
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

签名：`func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

递归迭代所有嵌套层级。

```go
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
键: user, 值: map[string]any{...}
键: name, 值: test
键: profile, 值: map[string]any{...}
键: age, 值: 25
键: tags, 值: []any{...}
...
```

## ForeachReturn

签名：`func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

迭代 JSON 数据并返回重新序列化后的 JSON 字符串。回调为只读访问。

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 只读处理
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

---

## 文件迭代函数

包级提供直接从文件迭代的函数，适合处理大型 JSON 文件，与 [Processor 文件迭代方法](../processor/iterate#文件迭代方法) 对应。

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
- 分批 API 调用
- 内存受限的大文件处理
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
路径: database, 类型: map[string]any
路径: host, 类型: string
路径: port, 类型: float64
路径: pool, 类型: map[string]any
路径: min, 类型: float64
路径: max, 类型: float64
```

---

## 文件迭代方法对比

| 方法 | 路径参数 | 递归 | 分块 | 适合场景 |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | 无 | 否 | 否 | 简单文件遍历 |
| `ForeachFileWithPath` | 有 | 否 | 否 | 定点遍历 |
| `ForeachFileChunked` | 无 | 否 | **是** | 批量处理、内存受限 |
| `ForeachFileNested` | 无 | **是** | 否 | 深度遍历所有节点 |

---

## 迭代控制

### IteratorControl 常量

`ForeachWithPathAndControl` 与 `ForeachWithPathAndIterator` 通过返回 `IteratorControl` 控制迭代流程（常量定义见 [迭代器类型](../iterator#iteratorcontrol-常量)）：

| 常量 | 说明 |
|------|------|
| `IteratorNormal` | 正常继续迭代 |
| `IteratorContinue` | 跳过当前项，继续迭代 |
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
