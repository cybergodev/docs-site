---
sidebar_label: "迭代方法"
title: "Processor 迭代方法 - CyberGo JSON | Foreach 系列方法"
description: "Processor 迭代方法：Foreach/ForeachWithPath 等八个变体、IteratorControl 流程控制与 ForeachFile 文件迭代。"
sidebar_position: 100
---

# 迭代方法

迭代方法遍历 JSON 数组或对象，对每个元素调用回调；回调从 `IterableValue` 取值，并用 `Break()` 或 `IteratorControl` 控制流程。

::: tip 与包级迭代函数的镜像关系
下列 8 个 `Foreach*` 方法与[包级迭代函数](../functions/iterate)逐条同源，回调签名与迭代语义相同，完整示例见包级页。Processor 侧的差异有三处：

- **cfg 语义**：可选尾随 `cfg` 控制该次调用的安全校验（大小、深度、危险模式）；省略时按处理器自身配置。
- **缓存保护**：迭代根先 `Get` 再**深拷贝**出工作副本，回调即使修改 `item.GetData()` 返回的容器，也不会污染处理器的解析缓存与原输入。
- **生命周期**：处理器关闭后，返回 `error` 的迭代方法给出 `ErrProcessorClosed`；已废弃的 `Foreach` / `ForeachNested` 无返回值，只能静默跳过回调。

另外两条语义与包级函数相同：根既不是数组也不是对象时回调不执行也不报错（`ForeachWithError` 同样返回 `nil`）；对象按键名字典序迭代，数组按下标自然序。
:::

## Foreach

<Badge type="danger" text="已废弃" />

签名：`func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

迭代 JSON 数组或对象。

::: warning 已废弃
`Foreach` 会**静默丢弃错误**：文档非法、路径解析失败或处理器已关闭时，回调被整体跳过且不返回任何错误，调用方无从得知。改用 [`ForeachWithError`](#foreachwitherror)，它把错误正常返回，回调返回 `nil` 表示继续迭代。`Foreach` 在 v1 生命周期内保留、不会移除。
:::

```go
// 已废弃：错误被静默丢弃；新代码请用 ForeachWithError（见下）
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**迭代数组时**：key 为索引（int）
**迭代对象时**：key 为键名（string）

## ForeachWithPath

签名：`func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

按路径迭代，返回错误。回调本身无返回值：解析或路径解析失败时错误被返回，而不是像已废弃的 `Foreach` 那样静默跳过。适用于迭代嵌套数组，或迭代指定路径下的对象。

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

## ForeachNested

<Badge type="danger" text="已废弃" />

签名：`func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

递归迭代所有嵌套层级。

::: warning 已废弃
`ForeachNested` 与 `Foreach` 一样**静默丢弃错误**：解析失败、路径解析失败或处理器已关闭时回调被整体跳过，不返回任何错误。改用 [`ForeachNestedWithError`](#foreachnestedwitherror)，它把错误正常返回，回调返回 `nil` 表示继续迭代。`ForeachNested` 在 v1 生命周期内保留、不会移除。
:::

```go
// 已废弃：错误被静默丢弃；新代码请用 ForeachNestedWithError（见下）
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
键：user, 值：map[string]any{...}
键：name, 值：test
键：profile, 值：map[string]any{...}
键：age, 值：25
键：tags, 值：[]any{...}
...
```

## ForeachReturn

签名：`func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

迭代 JSON 数据并返回重新序列化后的 JSON 字符串。回调**可以修改**迭代容器：`item.GetData()` 返回工作副本（深拷贝）的引用，对 map / slice 的增删改会反映到最终序列化结果；标量无法原地替换。修改不影响原输入与处理器缓存。重新编码后的输出同样受 `MaxJSONSize` 约束，超限返回 `ErrSizeLimit`。

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `[{"id":1,"internal":"x"},{"id":2,"internal":"y"}]`
	result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
		if obj, ok := item.GetData().(map[string]any); ok {
			delete(obj, "internal") // 修改工作副本，写入返回结果
		}
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：[{"id":1},{"id":2}]
}
```

适合在迭代后继续链式处理结果的场景。

## ForeachWithError

签名：`func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

按路径迭代，回调可返回错误：返回 `nil` 继续，返回其他错误立即中断并原样返回该错误。

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // 继续迭代
})
```

## ForeachNestedWithError

签名：`func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

递归迭代所有嵌套层级，回调可返回错误中断。

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("键: %v, 值: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

签名：`func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

按路径迭代，并向回调传入元素相对于被迭代集合的路径。`currentPath` 形如 `[0]`（数组元素）或 `.name`（对象成员），不含传入的 `path` 前缀。返回 `json.IteratorBreak` 停止迭代，返回 `json.IteratorNormal` 继续。

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

签名：`func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

按路径迭代原始值（回调收到 `any` 而非 `IterableValue`），用 `IteratorControl` 控制流程。回调 panic 会被捕获并转为错误返回。

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("键: %v, 值: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

迭代回调中的 `IterableValue` 提供类型安全取值：`Get`、`GetString`、`GetInt`、`GetFloat64`、`GetBool`、`GetArray`、`GetObject` 及带默认值的变体（`GetWithDefault`、`GetStringWithDefault`、`GetIntWithDefault` 等），状态判断（`Exists`、`IsNull`、`IsNullData`、`IsEmpty`、`IsEmptyData`），嵌套迭代 `ForeachNested`，以及 `Break()` 中断信号。完整方法清单见 [IterableValue 类型详解](../iterator)。

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

文件迭代方法等价于 `LoadFromFile` 加对应的 `Foreach` 方法：路径安全校验、`MaxJSONSize` 读取限制与 per-call `cfg` 透传都与文件加载一致。文件会先**整载内存**再迭代（受 `MaxJSONSize` 约束，默认 100MB）；需要恒定内存时见[大文件处理](../../streaming/large-files#流式迭代器与并行迭代器)。

| 方法 | 签名要点 | 语义 |
|------|----------|------|
| `ForeachFile` | `(filePath, fn, cfg...)` | 迭代文件根级数组 / 对象 |
| `ForeachFileWithPath` | `(filePath, path, fn, cfg...)` | 迭代文件中指定路径下的集合 |
| `ForeachFileChunked` | `(filePath, chunkSize, fn, cfg...)` | 按批迭代根级**数组**（`chunkSize` ≤0 时默认 100）；根非数组时报 `ErrTypeMismatch` |
| `ForeachFileNested` | `(filePath, fn, cfg...)` | 递归迭代所有嵌套结构 |

回调均为 `func(key any, item *json.IterableValue) error`：返回 `nil` 继续、`item.Break()` 干净停止、其他错误中断并返回。逐方法完整示例见[包级迭代页](../functions/iterate#文件迭代函数)（Processor 方法只多一个尾随 `cfg`），方法选择表见[文件操作](./file-io#方法选择)。

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // 继续迭代
})
```

## 文件迭代方法对比

| 方法 | 路径参数 | 递归 | 分块 | 适合场景 |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | 无 | 否 | 否 | 简单文件遍历 |
| `ForeachFileWithPath` | 有 | 否 | 否 | 定点遍历 |
| `ForeachFileChunked` | 无 | 否 | **是** | 批量落库、分批回调（文件仍整载内存） |
| `ForeachFileNested` | 无 | **是** | 否 | 深度遍历所有节点 |

---

## 迭代控制

回调返回 `item.Break()` 可干净中断迭代（整体返回 `nil`）；返回其他错误立即中断并原样返回该错误。带回路径信息的两个变体（`ForeachWithPathAndIterator` / `ForeachWithPathAndControl`）用 `IteratorControl` 常量（`json.IteratorNormal` / `json.IteratorBreak`）控制流程，日常场景优先用 `item.Break()`。示例与常量说明见[包级迭代页](../functions/iterate#迭代控制)。

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        return item.Break() // 找到目标，干净停止
    }
    return nil // 继续迭代
})
```

---

## 相关

- [路径查询](./query) - Get 系列方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [文件操作](../functions/file-io) - LoadFromFile/SaveToFile
