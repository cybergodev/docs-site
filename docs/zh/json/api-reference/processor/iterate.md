---
title: "Processor 迭代方法 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 迭代方法参考：包括 Foreach/ForeachWithPath/ForeachNested 迭代、IterableValue 数据访问、IteratorControl 控制流和批量迭代实践。"
---

# 迭代方法

Processor 提供多种迭代 JSON 数组和对象的方法。

## Foreach

签名：`func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

迭代 JSON 数组或对象。

```go
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**迭代数组时**：key 为索引（int）
**迭代对象时**：key 为键名（string）

## ForeachWithPath

签名：`func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

按路径迭代，返回错误。

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

适用于：
- 迭代嵌套数组
- 迭代指定路径的对象

## ForeachNested

签名：`func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

递归迭代所有嵌套层级。

```go
p.ForeachNested(data, func(key any, item *json.IterableValue) {
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

签名：`func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

迭代并返回原始 JSON（只读操作）。

```go
result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // 只读处理
})
```

适用于需要在迭代后继续链式操作的场景。

## ForeachWithError

签名：`func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

按路径迭代，回调支持返回错误。

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // 继续迭代
})
```

## ForeachNestedWithError

签名：`func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

递归迭代所有嵌套层级，回调支持返回错误。

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("键: %v, 值: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

签名：`func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

按路径迭代并提供当前路径信息。使用 `IteratorControl` 控制迭代流程。

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("路径: %s, 键: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // 停止迭代
    }
    return json.IteratorNormal // 继续迭代
})
```

## ForeachWithPathAndControl

签名：`func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

按路径迭代原始值，使用 `IteratorControl` 控制流程。

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("键: %v, 值: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

迭代回调中的 `IterableValue` 提供以下能力：

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
| `GetWithDefault(key string, defaultValue any) any` | 获取值（带默认值） |
| `GetStringWithDefault(key string, defaultValue string) string` | 获取字符串（带默认值） |
| `GetIntWithDefault(key string, defaultValue int) int` | 获取整数（带默认值） |
| `GetFloat64WithDefault(key string, defaultValue float64) float64` | 获取浮点数（带默认值） |
| `GetBoolWithDefault(key string, defaultValue bool) bool` | 获取布尔值（带默认值） |
| `Exists(key string) bool` | 判断字段是否存在 |
| `IsNull(key string) bool` | 判断字段是否为 null |
| `IsNullData() bool` | 判断当前值是否为 null |
| `IsEmpty(key string) bool` | 判断字段是否为空 |
| `IsEmptyData() bool` | 判断当前值是否为空 |
| `Break() error` | 返回中断迭代的错误信号 |
| `Release()` | 释放资源回对象池 |
| `ForeachNested(path string, fn func(key any, item *IterableValue))` | 递归迭代嵌套结构 |

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

## 文件迭代方法

Processor 提供直接从文件迭代的方法，适合处理大型 JSON 文件。

### ForeachFile

签名：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并迭代。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `fn` | `func(key any, item *IterableValue) error` | 迭代回调 |

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 继续迭代
})
```

---

### ForeachFileWithPath

签名：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并按路径迭代。

```go
// 只迭代 users 数组
err := p.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("用户: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

签名：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

分块迭代文件中的 JSON 数组，适合批量处理大数据集。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `chunkSize` | `int` | 每批处理的数量（≤0 时默认 100） |
| `fn` | `func(chunk []*IterableValue) error` | 批处理回调 |

```go
// 每批处理 100 条记录
err := p.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
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

签名：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并递归迭代所有嵌套结构。

```go
err := p.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
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

### 中断迭代

在回调函数中返回 `item.Break()` 可中断迭代：

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
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
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
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

- [路径查询](./query) - Get 系列方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [文件操作](../functions/file-io) - LoadFromFile/SaveToFile
