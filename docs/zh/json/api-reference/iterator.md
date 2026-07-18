---
sidebar_label: "迭代器类型"
title: "迭代器类型 - CyberGo JSON | API 参考"
description: "CyberGo JSON 迭代器类型：Iterator 顺序遍历、IterableValue 数据访问、StreamIterator/StreamObjectIterator 流式、BatchIterator 批量与 ParallelIterator 并行迭代器构造与方法。"
sidebar_position: 9
---

# 迭代器类型

json 包提供多种迭代器类型，覆盖顺序遍历、流式处理、批量处理和并行处理场景。迭代**函数**（`Foreach`/`ForeachFile` 等）见 [包级迭代函数](./functions/iterate) 与 [Processor 迭代方法](./processor/iterate)。

## IteratorControl 常量

`IteratorControl` 表示迭代控制标志，用于 `ForeachWithPathAndControl` 与 `ForeachWithPathAndIterator` 控制迭代流程。

| 常量 | 说明 |
|------|------|
| `IteratorNormal` | 正常继续迭代（默认值） |
| `IteratorContinue` | 跳过当前项，继续迭代 |
| `IteratorBreak` | 停止迭代 |

**使用场景**

| 场景 | 推荐返回值 | 说明 |
|------|------------|------|
| 正常处理元素 | `IteratorNormal` | 继续处理下一个元素 |
| 过滤无效数据 | `IteratorContinue` | 跳过当前元素，不中断迭代 |
| 找到目标后退出 | `IteratorBreak` | 找到所需数据后立即停止 |
| 遇到错误中断 | `IteratorBreak` | 遇到严重错误时停止迭代 |

---

## Iterator 类型

Iterator 用于遍历 JSON 数组或对象的低级迭代器。

### NewIterator

签名：`func NewIterator(data any, cfg ...Config) *Iterator`

创建迭代器实例。

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | 检查是否有更多元素 |
| `Next` | `func (it *Iterator) Next() (any, bool)` | 获取下一个元素 |
| `Reset` | `func (it *Iterator) Reset()` | 清除迭代器状态和缓存，准备复用 |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | 清除状态并使用新数据初始化 |

### Reset

清除迭代器状态，释放缓存的键。调用后可使用 `ResetWith` 重新初始化。

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // 清除缓存
```

### ResetWith

清除迭代器状态并使用新数据初始化，实现迭代器复用。

```go
it := json.NewIterator(data1)
// ... 遍历 data1 ...

it.ResetWith(data2) // 复用迭代器遍历新数据
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## IterableValue 类型

IterableValue 封装了迭代过程中的当前元素，提供便捷的值访问方法。`Foreach` 系列函数的回调即接收 `*IterableValue`。

### 方法

#### GetData

签名：`func (iv *IterableValue) GetData() any`

返回底层数据。

#### Get

签名：`func (iv *IterableValue) Get(path string) any`

按路径获取值（支持点号表示法和数组索引）。

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

签名：`func (iv *IterableValue) GetString(key string) string`

获取字符串值。

```go
name := item.GetString("name")
```

#### GetInt

签名：`func (iv *IterableValue) GetInt(key string) int`

获取整数值。

```go
age := item.GetInt("age")
```

#### GetFloat64

签名：`func (iv *IterableValue) GetFloat64(key string) float64`

获取浮点数值。

```go
price := item.GetFloat64("price")
```

#### GetBool

签名：`func (iv *IterableValue) GetBool(key string) bool`

获取布尔值。

```go
enabled := item.GetBool("enabled")
```

#### GetArray

签名：`func (iv *IterableValue) GetArray(key string) []any`

获取数组值。

```go
items := item.GetArray("items")
```

#### GetObject

签名：`func (iv *IterableValue) GetObject(key string) map[string]any`

获取对象值。

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

签名：`func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

获取值，若键不存在则返回默认值。

```go
// 获取可选字段，缺失时使用默认值
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

签名：`func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

获取字符串值，若键不存在则返回默认值。

```go
name := item.GetStringWithDefault("name", "未知")
```

#### GetIntWithDefault

签名：`func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

获取整数值，若键不存在则返回默认值。

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

签名：`func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

获取浮点数值，若键不存在则返回默认值。

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

签名：`func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

获取布尔值，若键不存在则返回默认值。

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

签名：`func (iv *IterableValue) Exists(key string) bool`

检查指定键是否存在。

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("邮箱: %s\n", email)
}
```

#### ForeachNested

签名：`func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

递归遍历指定路径下的嵌套结构。

#### IsNullData

签名：`func (iv *IterableValue) IsNullData() bool`

检查整个值是否为 null。

```go
if item.IsNullData() {
    fmt.Println("值为 null")
}
```

#### IsNull

签名：`func (iv *IterableValue) IsNull(key string) bool`

检查指定键的值是否为 null。

```go
if item.IsNull("optional_field") {
    fmt.Println("可选字段为 null")
}
```

#### IsEmptyData

签名：`func (iv *IterableValue) IsEmptyData() bool`

检查整个值是否为空（nil、空字符串、空数组或空对象）。

```go
if item.IsEmptyData() {
    fmt.Println("值为空")
}
```

#### IsEmpty

签名：`func (iv *IterableValue) IsEmpty(key string) bool`

检查指定键的值是否为空。

```go
if item.IsEmpty("tags") {
    fmt.Println("标签列表为空")
}
```

#### Break

签名：`func (iv *IterableValue) Break() error`

返回停止迭代的信号。在迭代回调中调用可提前终止遍历。

```go
// 注意：Break() 仅在回调返回 error 的迭代函数中生效（如 ForeachWithError、
// ForeachNestedWithError 等）。普通的 Foreach 回调不返回 error，
// 在其中调用 item.Break() 不会停止迭代。
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // 找到目标后停止迭代
        return item.Break()
    }
    // 继续处理
    return nil
})
```

#### Release

签名：`func (iv *IterableValue) Release()`

将 IterableValue 归还到对象池，释放内部数据引用。

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // 处理数据...
    fmt.Println(item.GetData())
    // 处理完毕后释放，减轻 GC 压力
    item.Release()
})
```

---

## StreamIterator 类型

StreamIterator 提供内存高效的流式迭代，适用于大型 JSON 数组。逐元素处理，无需将整个数组加载到内存。

### NewStreamIterator

签名：`func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

创建流式迭代器。通过 `Config.BufferSize` 设置缓冲区大小。

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// 不带配置
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("索引 %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// 带配置
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // 64KB 缓冲区
it2 := json.NewStreamIterator(file, cfg)
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | 前进到下一个元素 |
| `Value` | `func (si *StreamIterator) Value() any` | 返回当前元素 |
| `Index` | `func (si *StreamIterator) Index() int` | 返回当前索引 |
| `Err` | `func (si *StreamIterator) Err() error` | 返回迭代中的错误 |

---

## StreamObjectIterator 类型

StreamObjectIterator 提供内存高效的流式迭代，适用于大型 JSON 对象。

### NewStreamObjectIterator

签名：`func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

创建流式对象迭代器。

```go
file, _ := os.Open("large-object.json")
defer file.Close()

it := json.NewStreamObjectIterator(file)
for it.Next() {
    fmt.Printf("键: %s, 值: %v\n", it.Key(), it.Value())
}
if err := it.Err(); err != nil {
    panic(err)
}
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | 前进到下一个键值对 |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | 返回当前键 |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | 返回当前值 |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | 返回迭代中的错误 |

---

## BatchIterator 类型

BatchIterator 用于高效的批量处理大型数组，减少单元素处理开销。

### NewBatchIterator

签名：`func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

创建批量迭代器。通过 `Config.MaxBatchSize` 设置批量大小。

```go
data := make([]any, 10000)
// 填充数据...

cfg := json.DefaultConfig()
cfg.MaxBatchSize = 100 // 每批 100 个元素
it := json.NewBatchIterator(data, cfg)
for it.HasNext() {
    batch := it.NextBatch()
    // 批量处理
    processBatch(batch)
    fmt.Printf("处理了 %d 个元素，剩余 %d\n", len(batch), it.Remaining())
}
```

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | 返回下一批元素 |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | 检查是否有更多批次 |
| `Reset` | `func (it *BatchIterator) Reset()` | 重置迭代器到起始位置 |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | 返回总批次数 |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | 返回当前位置 |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | 返回剩余元素数 |

---

## ParallelIterator 类型

ParallelIterator 用于并行处理数组，利用多核 CPU 加速处理。

### NewParallelIterator

签名：`func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

创建并行迭代器。通过 `Config.MaxConcurrency` 设置工作协程数。

```go
data := make([]any, 10000)
// 填充数据...

cfg := json.DefaultConfig()
cfg.MaxConcurrency = 8 // 8 个工作协程
it := json.NewParallelIterator(data, cfg)
err := it.ForEach(func(idx int, val any) error {
    // 并行处理每个元素
    return processItem(idx, val)
})
if err != nil {
    panic(err)
}
```

### ForEach

签名：`func (it *ParallelIterator) ForEach(fn func(int, any) error) error`

并行处理每个元素，返回第一个遇到的错误。

```go
err := it.ForEach(func(idx int, val any) error {
    // 此函数在多个协程中并行执行
    return nil
})
```

### ForEachWithContext

签名：`func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

带上下文的并行处理，支持取消操作。

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := it.ForEachWithContext(ctx, func(idx int, val any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return processItem(idx, val)
    }
})
```

### ForEachBatch

签名：`func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error`

并行批量处理。

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // 每个批次在一个协程中处理
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

签名：`func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

带上下文的并行批量处理。

### Map

签名：`func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

并行转换每个元素，返回新切片。

```go
results, err := it.Map(func(idx int, val any) (any, error) {
    if num, ok := val.(float64); ok {
        return num * 2, nil
    }
    return nil, fmt.Errorf("unexpected type at index %d", idx)
})
```

### Filter

签名：`func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any`

并行过滤元素，返回满足条件的元素切片。

```go
even := it.Filter(func(idx int, val any) bool {
    if num, ok := val.(float64); ok {
        return int(num)%2 == 0
    }
    return false
})
```

### Close

签名：`func (it *ParallelIterator) Close()`

释放 ParallelIterator 资源。

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## 完整示例

### 流式处理大文件

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Open("large-array.json")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    it := json.NewStreamIterator(file)
    count := 0

    for it.Next() {
        val := it.Value()
        // 逐元素处理，内存友好
        count++
        if count%1000 == 0 {
            fmt.Printf("已处理 %d 个元素，当前值: %v\n", count, val)
        }
    }

    if err := it.Err(); err != nil {
        panic(err)
    }

    fmt.Printf("总计处理 %d 个元素\n", count)
}
```

### 并行处理

```go
package main

import (
    "fmt"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    // 解析 JSON 数组
    data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
    var arr []any
    json.Unmarshal([]byte(data), &arr)

    // 创建并行迭代器（4 个工作协程）
    cfg := json.DefaultConfig()
    cfg.MaxConcurrency = 4
    it := json.NewParallelIterator(arr, cfg)

    var sum int64

    err := it.ForEach(func(idx int, val any) error {
        if num, ok := val.(float64); ok {
            atomic.AddInt64(&sum, int64(num))
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("总和: %d\n", sum) // 输出: 总和: 55
}
```

### 批量处理

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 创建大数据集
    data := make([]any, 1000)
    for i := range data {
        data[i] = map[string]any{"id": i, "value": i * 10}
    }

    // 每批 100 个元素
    cfg := json.DefaultConfig()
    cfg.MaxBatchSize = 100
    it := json.NewBatchIterator(data, cfg)
    batchNum := 0

    for it.HasNext() {
        batch := it.NextBatch()
        batchNum++

        // 批量处理（如批量写入数据库）
        fmt.Printf("批次 %d: 处理 %d 个元素\n", batchNum, len(batch))
    }

    fmt.Printf("总批次: %d\n", it.TotalBatches())
}
```

### Iterator 复用

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // 首次遍历
    it := json.NewIterator([]any{"a", "b", "c"})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }

    // 复用同一迭代器遍历新数据，避免重新分配
    it.ResetWith([]any{1, 2, 3, 4})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }
}
```

---

## 性能建议

1. **复用 Iterator** - 使用 `Reset`/`ResetWith` 避免重复分配，适合多次遍历场景
2. **大数据集使用流式迭代器** - `StreamIterator`/`StreamObjectIterator` 逐元素处理，内存友好
3. **批量处理减少开销** - `BatchIterator` 按批处理，降低单元素开销
4. **CPU 密集型任务并行处理** - `ParallelIterator` 利用多核加速
5. **释放 IterableValue** - 在 `Foreach` 回调中处理完毕后调用 `Release()` 减轻 GC 压力

---

## 相关

- [包级迭代函数](./functions/iterate) - Foreach/ForeachFile 等迭代函数
- [Processor 迭代方法](./processor/iterate) - 对应的处理器迭代方法
- [大文件处理](../streaming/large-files) - 大文件处理指南与 API 参考
- [NDJSON 处理器](../streaming/jsonl) - JSONL 处理
