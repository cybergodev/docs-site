---
sidebar_label: "迭代器与流式迭代器"
title: "迭代器与 IterableValue - CyberGo JSON | 流式遍历与并行迭代"
description: "CyberGo JSON 迭代器类型覆盖顺序、流式、批量与并行四种遍历：Iterator 基础迭代、StreamIterator 流式读取、BatchIterator 分批回调与 ParallelIterator 并行 Map/Filter，IterableValue 提供类型化取值与 Break 控制，帮助开发者高效遍历数组、对象与大文件。"
sidebar_position: 100
---

# 迭代器类型

json 包提供多种迭代器类型，覆盖顺序遍历、流式处理、批量处理和并行处理场景。迭代**函数**（`Foreach`/`ForeachFile` 等）见 [包级迭代函数](./functions/iterate) 与 [Processor 迭代方法](./processor/iterate)。

## IteratorControl 常量

`IteratorControl` 表示迭代控制标志，用于 `ForeachWithPathAndControl` 与 `ForeachWithPathAndIterator` 控制迭代流程。

| 常量 | 说明 |
|------|------|
| `IteratorNormal` | 正常继续迭代（默认值，零值即此） |
| `IteratorContinue` | 继续迭代。与 `IteratorNormal` 等价（为 API 对称保留的别名）——「跳过当前项」是隐式的，迭代始终会继续 |
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

`Iterator` 是用于遍历 JSON 数组或对象的低级迭代器，由 `NewIterator` 创建。

### NewIterator

签名：`func NewIterator(data any, cfg ...Config) *Iterator`

创建迭代器实例。可选 `cfg` 参数为保持 API 一致性而保留，当前不影响迭代器行为。

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

::: tip 迭代顺序确定
遍历对象时，键按**排序后**的顺序依次产出（Go 原生 map 遍历顺序随机，这里做了确定性处理）；遍历数组时按索引顺序。`Next()` 对数组返回元素本身，对对象返回当前键对应的**值**（不返回键）。
:::

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

::: warning 并发不安全
`Reset`/`ResetWith` 不可与另一 goroutine 正在进行的 `HasNext()`/`Next()` 并发调用；需要并发遍历时请为每个 goroutine 创建独立迭代器。
:::

### ResetWith

清除迭代器状态并使用新数据初始化，实现迭代器复用。并发约束同 `Reset`。

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

| 类别 | 方法 |
|------|------|
| 基础取值 | `GetData` / `Get` / `GetString` / `GetInt` / `GetFloat64` / `GetBool` / `GetArray` / `GetObject` |
| 带默认值取值 | `GetWithDefault` / `GetStringWithDefault` / `GetIntWithDefault` / `GetFloat64WithDefault` / `GetBoolWithDefault` |
| 状态检查 | `Exists` / `IsNull` / `IsNullData` / `IsEmpty` / `IsEmptyData` |
| 流程控制 | `Break` / `ForeachNested` / `Release` |

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

::: tip 可省略的 Release
迭代函数在回调返回后会**自动**把每个 `IterableValue` 归还对象池，回调内显式调用 `Release()` 是冗余但无害的（内部有防重复归还保护）。注意回调返回后其内部数据即被清空，因此**不要**把 `*IterableValue` 存到回调之外继续使用——需要留存请复制 `GetData()` 取出的数据。
:::

### IterableValue 完整示例

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"users": [
        {"name": "Alice", "age": 30, "email": null},
        {"name": "Bob", "tags": []}
    ]}`

	err := json.ForeachWithError(data, "users", func(key any, item *json.IterableValue) error {
		idx, _ := key.(int)

		// 带默认值获取
		name := item.GetStringWithDefault("name", "未知")
		age := item.GetIntWithDefault("age", 0)

		// 存在性 / null / 空值检查
		hasEmail := item.Exists("email")
		emailNull := item.IsNull("email")
		tagsEmpty := item.IsEmpty("tags")

		fmt.Printf("[%d] name=%s age=%d email存在=%v email为null=%v tags为空=%v\n",
			idx, name, age, hasEmail, emailNull, tagsEmpty)

		// 找到 Alice 后提前终止
		if name == "Alice" {
			return item.Break()
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
	// 输出：
	// [0] name=Alice age=30 email存在=true email为null=true tags为空=true
}
```

---

## StreamIterator 类型

StreamIterator 提供内存高效的流式迭代，适用于大型 JSON 数组。逐元素处理，无需将整个数组加载到内存。

### NewStreamIterator

签名：`func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

创建流式迭代器。缓冲区取 `Config.BufferSize`（不传 cfg 时为 `DefaultConfig` 的 64KB；传入 cfg 且 `BufferSize <= 0` 时回落到 32KB）；`MaxJSONSize` 始终对**整个流的总字节数**生效（不传 cfg 时上限为 `DefaultMaxJSONSize` = 100MB），超出即报错。

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

::: tip 顶层输入形态
`StreamIterator` 面向 JSON **数组**。若顶层是单个标量（如 `"hello"`、`42`），会把它作为唯一元素产出一次；若顶层是对象或其他分隔符开头，`Next()` 返回 false 且 `Err()` 报「expects a JSON array」错误。
:::

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | 前进到下一个元素 |
| `Value` | `func (si *StreamIterator) Value() any` | 返回当前元素 |
| `Index` | `func (si *StreamIterator) Index() int` | 返回当前索引（从 0 开始） |
| `Err` | `func (si *StreamIterator) Err() error` | 返回迭代中的错误 |

---

## StreamObjectIterator 类型

StreamObjectIterator 提供内存高效的流式迭代，适用于大型 JSON 对象。

### NewStreamObjectIterator

签名：`func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

创建流式对象迭代器。`Config.BufferSize` 与 `MaxJSONSize`（流总字节数上限）的语义同 `NewStreamIterator`。

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

::: tip 仅接受顶层对象
首个 token 不是 `{` 时 `Next()` 返回 false 且 `Err()` 报「expects a JSON object」错误；键非字符串同样以错误结束（不再静默）。读取时按流中**出现顺序**产出键值对（不做排序）。
:::

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | 前进到下一个键值对 |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | 返回当前键 |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | 返回当前值 |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | 返回迭代中的错误 |

---

## BatchIterator 类型

BatchIterator 用于高效的批量处理大型数组，减少单元素处理开销，由 `NewBatchIterator` 创建。

### NewBatchIterator

签名：`func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

创建批量迭代器。通过 `Config.MaxBatchSize` 设置批量大小（不传 cfg 时为 `DefaultConfig` 的 2000；传入 cfg 且 `MaxBatchSize <= 0` 时回落到每批 100 个元素）。

::: tip 批次切分方式
`NextBatch` 返回的是底层数组切片的**视图**（`data[current:end]`），不复制数据；末批可能不足 batchSize，修改视图元素会影响原数组。
:::

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
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | 返回下一批元素；无剩余批次时返回 nil |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | 检查是否有更多批次 |
| `Reset` | `func (it *BatchIterator) Reset()` | 重置迭代器到起始位置 |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | 返回总批次数（`ceil(len/batchSize)` 向上取整；batchSize 非正时返回 0） |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | 返回当前已消费到的数组位置 |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | 返回剩余元素数（消费完为 0） |

---

## ParallelIterator 类型

ParallelIterator 用于并行处理数组，利用多核 CPU 加速处理。

### NewParallelIterator

签名：`func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

创建并行迭代器。通过 `Config.MaxConcurrency` 设置工作协程数（不传 cfg 时为 `DefaultConfig` 的 50；传入 cfg 且 `MaxConcurrency <= 0` 时回落到 4；实际协程数不超过 `len(data)`，空数据时为 1）。

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

::: tip 错误与终止语义
任一回调返回错误后，其余工作协程尽快停止派发并返回**第一个**错误；`Close` 之后的调用直接返回 nil（不执行回调）；回调 panic 会被捕获并转换为错误返回，不会击穿进程。
:::

### ForEachWithContext

签名：`func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

带上下文的并行处理，支持取消操作。上下文取消时返回 `ctx.Err()`。

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

并行批量处理。每个批次由单个协程处理；`batchSize <= 0` 时按 100 处理；回调收到的是**批次序号**（第几批）与该批元素。

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // 每个批次在一个协程中处理
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

签名：`func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

带上下文的并行批量处理。取消时返回 `ctx.Err()`，Close 后返回 nil。

### Map

签名：`func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

并行转换每个元素，返回新切片。每个工作协程写入与元素索引对应的位置，因此**结果顺序与输入一致**；任一转换出错时返回 `(nil, err)`。

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

并行过滤元素，返回满足条件的元素切片。**保持输入顺序**（非完成顺序）；predicate 无错误返回，回调 panic 会被记录日志而非中断。

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

释放 ParallelIterator 资源：通知运行中的协程停止并等待退出。基于 CAS 实现，**可安全重复调用、可多协程并发调用**。

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
	"github.com/cybergodev/json"
	"os"
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
	"github.com/cybergodev/json"
	"sync/atomic"
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

	fmt.Printf("总和：%d\n", sum) // 输出：总和：55
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

	fmt.Printf("总批次：%d\n", it.TotalBatches())
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
- [JSONL 流式处理](../streaming/jsonl) - JSONL/NDJSON 流式处理
