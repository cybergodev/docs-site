---
sidebar_label: "大文件处理指南"
title: "大文件处理 - CyberGo JSON | 流式解析与内存控制"
description: "CyberGo JSON 提供大文件分级处理方案，支持 ForeachFile 系列结构化迭代、StreamIterator 流式解码与 StreamJSONL 逐行消费，配合 MaxMemory、BufferSize 等配置，帮助开发者让内存占用与文件体积解耦、稳定处理日志与 ETL 数据。"
sidebar_position: 10
---

# 大文件处理

对于大型 JSON 文件（如日志、配置、数据导出），直接加载到内存可能导致内存溢出。json 库提供了多种高效的处理方式。

::: tip 提示
流式与并行迭代器（StreamIterator、StreamObjectIterator、BatchIterator、ParallelIterator）的类型级 API 参考见 [迭代器](../api-reference/iterator)，并行处理实践见 [并发与并行处理](../advanced/concurrency)。
:::

::: warning
`ForeachFile` 和 `ForeachFileChunked` 在迭代前会将整个文件加载到内存中。"分块"行为仅影响内存中数据的迭代方式，不影响文件的读取方式。对于真正需要控制内存的超大文件处理，请使用 `StreamJSONL` 家族配合 JSONL 格式，或使用 `StreamIterator`。
:::

## 备选方案

| 方案 | 适用场景 | 内存占用 |
|------|----------|----------|
| **Processor.ForeachFile** | 结构化迭代处理文件 | 加载完整文件，逐条迭代 |
| **Processor.ForeachFileChunked** | 批量分块迭代处理 | 加载完整文件，分块迭代 |
| **StreamJSONL 家族** | 逐行处理 JSONL 文件 | 内存可控，真正的流式处理 |
| **StreamIterator** | 逐元素流式解码大数组 | 内存与数组长度无关 |

### ForeachFile 系列四变体

`ForeachFile` 家族共有四个变体，均接受可选 `Config`（用于逐调用解析与安全校验选项），区别在于遍历目标与分组方式：

| 变体 | 遍历目标 | 典型场景 |
|------|----------|----------|
| `ForeachFile` | 根数组元素 / 根对象键值 | 顶层即数据集合的日志、导出文件 |
| `ForeachFileWithPath` | 指定路径下的数组/对象 | 文件中 `users`、`orders` 等子集合 |
| `ForeachFileChunked` | 根数组元素，按 `chunkSize` 分批 | 批量写入数据库、批量下发 |
| `ForeachFileNested` | 递归遍历所有嵌套结构 | 深度未知的多层配置、结构统计 |

四者都支持在回调中返回 `item.Break()` 提前停止；`ForeachFileChunked` 要求根节点为 JSON 数组（否则返回 `ErrTypeMismatch`），`chunkSize <= 0` 时按 100 处理。

## 统一 API：Processor

### 配置选项

大文件处理配置已集成到 `Config` 中：

```go
type Config struct {
    // ... 其他配置 ...

    // 大文件处理配置（生效字段）
    MaxMemory  int64 // 最大内存使用（默认 100MB）
    BufferSize int   // 读取缓冲区大小（默认 64KB）
}
```

::: warning 已废弃字段不要混淆
`Config.ChunkSize`、`SamplingEnabled`、`SampleSize` 均已废弃——不被任何代码路径读取（安全扫描是否采样由 `FullSecurityScan` 决定），设置后不改变行为。历史语境中的 `ChunkSize` 指「字节分块尺寸」，而 [`ForeachFileChunked`](#批量处理) 的参数 `chunkSize`（`int`）是**每批元素数量**，二者互不影响——`ForeachFileChunked` 的分批粒度只由它自己的参数决定（≤0 时按 100 处理）。
:::

### 基本使用

```go
package main

import (
	"github.com/cybergodev/json"
	"log"
)

func main() {
	// 创建 Processor（使用默认配置）
	processor, err := json.New()
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// 方式 1：逐条处理（推荐）
	count := 0
	err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
		count++

		// 使用 IterableValue 便捷访问字段
		id := item.GetInt("id")
		name := item.GetString("name")
		email := item.GetString("email")

		// 支持路径访问嵌套属性
		city := item.GetString("profile.city")
		interests := item.GetArray("profile.interests")

		if count%10000 == 0 {
			log.Printf("已处理 %d 条记录，示例: id=%d name=%s email=%s city=%s 兴趣数=%d",
				count, id, name, email, city, len(interests))
		}
		return nil
	})

	if err != nil {
		log.Fatal(err)
	}
	log.Printf("处理完成，共 %d 条记录", count)
}
```

### 批量处理

```go
// 方式 2：分批处理（适合批量写入数据库）
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("处理批次：%d 条记录", len(chunk))

    // 批量写入数据库
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... 处理数据
    }
    return nil
})
```

### 带中断控制
```go
// 方式 3：带中断控制（查找特定数据后停止）
// 返回 item.Break() 停止迭代，返回 nil 继续迭代
targetID := 42 // 要查找的目标记录 ID（业务变量）
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // 找到目标，停止迭代
        fmt.Printf("找到目标: ID=%d, Name=%s\n", id, item.GetString("name"))
        return item.Break() // 停止迭代（返回中断信号）
    }

    return nil // 继续迭代
})
```

### 处理对象文件
```go
// 方式 4：处理 JSON 对象文件（键值对结构）
// 文件格式：{"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### 自定义配置
```go
// 自定义大文件处理配置
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 内存限制
cfg.BufferSize = 128 * 1024        // 128KB 缓冲区

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## IterableValue 便捷方法

`ForeachFile*` 系列方法提供 `IterableValue` 接口，支持便捷的数据访问：

| 方法 | 说明 | 示例 |
|------|------|------|
| `Get(path)` | 获取值 | `item.Get("field")` |
| `GetString(path)` | 获取字符串 | `item.GetString("name")` |
| `GetInt(path)` | 获取整数 | `item.GetInt("id")` |
| `GetFloat64(path)` | 获取浮点数 | `item.GetFloat64("score")` |
| `GetBool(path)` | 获取布尔值 | `item.GetBool("active")` |
| `GetArray(path)` | 获取数组 | `item.GetArray("tags")` |
| `GetObject(path)` | 获取对象 | `item.GetObject("profile")` |
| `Exists(path)` | 检查字段是否存在 | `item.Exists("email")` |
| `IsNull(path)` | 检查是否为 null | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | 检查是否为空 | `item.IsEmpty("notes")` |
| `Break()` | 返回中断信号 | `return item.Break()` |

**支持路径导航**
```go
city := item.GetString("profile.address.city")      // 嵌套对象
firstTag := item.GetString("tags[0]")               // 数组索引
lastTag := item.GetString("tags[-1]")               // 负索引（最后一个）
nested := item.GetString("data.items[0].name")      // 复杂路径
```

::: warning 回调返回后不要持有 IterableValue 引用
`ForeachFile*`（以及内存态 `Foreach*`）系列为降低分配开销使用了对象池：**回调返回后** `IterableValue` 会被归还池中且内部数据置空。请在回调内提取所需的值（如 `GetString` 的结果），不要把 `item` 本身或 `item.GetData()` 的引用存到回调之外。
:::

## 流式处理配置

通过 `Config` 配置流式处理参数。与流式读取直接相关的字段及其实际行为：

| 字段 | 默认值（`DefaultConfig`） | 行为 |
|------|--------------------------|------|
| `MaxJSONSize` | 100MB（`DefaultMaxJSONSize`） | 文件/Reader 读取的总字节上限。`LoadFromFile`/`UnmarshalFromFile`/`LoadFromReader` 在**读取期间**用 `io.LimitReader` 强制执行（读取上限 +1 字节以检测截断，避免 TOCTOU 竞态），`ForeachFile*` 系列经由 `LoadFromFile` 自动继承；传给流式迭代器构造函数的 `cfg.MaxJSONSize > 0` 时对整个流封顶 |
| `BufferSize` | 64KB | `StreamIterator`/`StreamObjectIterator` 的读取缓冲；传入 `cfg` 但其 `BufferSize <= 0` 时回退 32KB |
| `ChunkSize` | 1MB | 已废弃：不被任何代码路径读取（流式读取用 `BufferSize`；校验仍将其钳制在 64KB–100MB），仅参与配置缓存键 |
| `MaxMemory` | 100MB | 总内存上限（校验范围 10MB–1GB）；JSONL 流式的内存上限回退链为 `JSONLMaxMemory` → `MaxMemory` |
| `MaxNestingDepthSecurity` | 200（`DefaultMaxNestingDepth`） | JSONL 每行的嵌套深度上限，解析前逐行检查 |
| `ValidateFilePath` | `true` | 字段已声明但当前**不作为开关**：文件路径安全校验（路径遍历、符号链接、平台限制）在读取/写入时无条件执行 |

`Config.Validate`/`ValidateWithWarnings` 会把越界值静默钳制回合法区间（如 `BufferSize` 钳至 4KB–1MB），可用 `ValidateWithWarnings` 查看具体调整项。

```go
cfg := json.DefaultConfig()

// 大文件处理配置
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 内存限制
cfg.BufferSize = 128 * 1024        // 128KB 缓冲区

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 使用 StreamLinesInto 泛型函数

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

_, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("处理: %s\n", user.Name)
    return nil
})
```

### 并行处理

对于可并行处理的任务，可以使用多 goroutine：

```go
package main

import (
	"github.com/cybergodev/json"
	"sync"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// 使用 worker pool
	workers := 4
	items := make(chan any, 100)
	var wg sync.WaitGroup

	// 启动 workers
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for item := range items {
				// 处理 item（替换为你的业务逻辑）
				_ = item
			}
		}(i)
	}

	// 流式读取并分发
	processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
		items <- item.GetData()
		return nil
	})

	close(items)
	wg.Wait()
}
```

若数据已在内存中（`[]any`），也可直接使用库内置的 [ParallelIterator](../api-reference/iterator#paralleliterator-类型) 并行迭代器，免去手写 worker pool。

## 流式迭代器与并行迭代器

`ForeachFile*` 需要先加载整个文件；当文件大到不适合整载内存时，应改用本节的迭代器：`StreamIterator`/`StreamObjectIterator` 直接在 `io.Reader` 上边读边解码，内存占用与数据规模无关。类型级完整 API 见[迭代器](../api-reference/iterator)。

### StreamIterator：逐元素流式解码大数组

```go
package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// 演示用小数据；实际场景替换为 os.Open("large-array.json")
	var src io.Reader = strings.NewReader(`[
		{"id": 1, "name": "Alice"},
		{"id": 2, "name": "Bob"},
		{"id": 3, "name": "Carol"}
	]`)

	iter := json.NewStreamIterator(src)
	count := 0
	for iter.Next() {
		if obj, ok := iter.Value().(map[string]any); ok {
			fmt.Printf("index=%d id=%.0f name=%s\n", iter.Index(), obj["id"], obj["name"])
		}
		count++
	}
	if err := iter.Err(); err != nil {
		fmt.Println("迭代错误：", err)
		return
	}
	fmt.Println("共迭代元素：", count)
	// 输出：
	// index=0 id=1 name=Alice
	// index=1 id=2 name=Bob
	// index=2 id=3 name=Carol
	// 共迭代元素：3
}
```

要点：

- 顶层必须是 JSON 数组；顶层标量会作为单个元素产出一次，顶层对象会被拒绝（`iter.Err()` 返回错误）。
- 传入的 `cfg.MaxJSONSize > 0` 时对**整个流**的总字节数封顶（默认回退 100MB），超限在迭代中报错。
- 逐个元素解码，任意时刻内存中只有当前元素。

### StreamObjectIterator：逐键值流式解码大对象

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	src := strings.NewReader(`{
		"users":  {"count": 3},
		"orders": {"count": 128},
		"events": {"count": 9001}
	}`)

	iter := json.NewStreamObjectIterator(src)
	for iter.Next() {
		if obj, ok := iter.Value().(map[string]any); ok {
			fmt.Printf("%s: count=%.0f\n", iter.Key(), obj["count"])
		}
	}
	if err := iter.Err(); err != nil {
		fmt.Println("迭代错误：", err)
		return
	}
	// 输出（按文档顺序，而非 map 随机顺序）：
	// users: count=3
	// orders: count=128
	// events: count=9001
}
```

适用于顶层是一个超大对象的场景（如配置表、分区索引），按键值对逐个处理。

### BatchIterator：内存数组分批消费

`BatchIterator` 作用在已加载的 `[]any` 上，按批切片返回，适合把中等规模数组按固定批量送入下游（批量入库、分页计算）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := []any{
		map[string]any{"id": 1},
		map[string]any{"id": 2},
		map[string]any{"id": 3},
		map[string]any{"id": 4},
		map[string]any{"id": 5},
	}

	// 批大小取 Config.MaxBatchSize；默认配置下为 2000
	cfg := json.DefaultConfig()
	cfg.MaxBatchSize = 2

	iter := json.NewBatchIterator(data, cfg)
	fmt.Println("总批数：", iter.TotalBatches())
	for iter.HasNext() {
		batch := iter.NextBatch()
		fmt.Printf("批次 [%d:%d)，元素数=%d\n", iter.CurrentIndex()-len(batch), iter.CurrentIndex(), len(batch))
	}
	// 输出：
	// 总批数：3
	// 批次 [0:2)，元素数=2
	// 批次 [2:4)，元素数=2
	// 批次 [4:5)，元素数=1
}
```

超大批量入库请改用 [`ForeachFileChunked`](#批量处理)（文件源）或 [`StreamJSONLChunked`](./jsonl#streamjsonlchunked)（JSONL 源）；两者的分块回调返回后同样会归还 `IterableValue`，需在回调内完成落库。

### ParallelIterator：CPU 密集型并行处理

`ParallelIterator` 用工作池并行处理内存数组，工作数取 `Config.MaxConcurrency`（默认配置 50）并按数据长度自动收窄。`Map` 的结果按下标写入，保持输入顺序：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	nums := []any{1, 2, 3, 4}

	iter := json.NewParallelIterator(nums)
	defer iter.Close()

	squares, err := iter.Map(func(idx int, val any) (any, error) {
		n, ok := val.(int)
		if !ok {
			return nil, fmt.Errorf("元素 %d 不是整数", idx)
		}
		return n * n, nil
	})
	if err != nil {
		fmt.Println("处理错误：", err)
		return
	}
	fmt.Println("平方结果：", squares)
	// 输出：平方结果：[1 4 9 16]
}
```

`ForEach`/`ForEachWithContext` 任一回调返回错误即停止派发新任务并返回该错误；回调 panic 会被恢复为错误而不是拖垮进程；`Close` 通知所有 worker 收尾，可安全并发调用。带取消/超时场景使用 `ForEachWithContext`/`ForEachBatchWithContext` 变体。

## 性能优化建议

### 内存控制
```go
// 根据可用内存配置
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500MB

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### 最佳实践
1. **预估文件大小**：处理前检查文件大小，选择合适的策略
2. **设置内存限制**：使用 `MaxMemory` 防止 OOM
3. **批量提交**：积累一定数量后批量写入数据库
4. **错误处理**：实现 `JSONLContinueOnErr` 或记录失败条目
5. **进度监控**：定期输出处理进度

## 选择指南

| 文件大小 | 推荐方案 | 示例 |
|---------|---------|------|
| < 10MB | 直接加载 | `json.ParseAny` + `Get` |
| 10-100MB | Processor.ForeachFile | 整载内存后逐条迭代 |
| 100MB-1GB | StreamIterator / StreamObjectIterator（或转为 JSONL 分行） | 恒定内存，边读边解码 |
| > 1GB | JSONL 格式 + StreamJSONL 家族 | 真正的流式处理，内存可控 |

::: warning 不要对超过 100MB 的文件用 ForeachFile*
`ForeachFile*` 系列（含 `ForeachFileChunked`）在迭代前会把**整个文件读入内存**（见本页开头的警告），且受 `MaxJSONSize` 读取上限约束：默认 100MB（`DefaultMaxJSONSize`），`Config.Validate` 会把更大的值钳回 100MB——因此超过 100MB 的文件会直接收到 `ErrSizeLimit`，无法通过调大配置让 `ForeachFile*` 处理。这类输入请改用 `StreamIterator` / `StreamObjectIterator`（恒定内存；传入 `cfg.MaxJSONSize > 0` 时按该值对整个流封顶，可高于 100MB，超限输入需在构造时显式调大）或将数据转为 JSONL 后走 `StreamJSONL` 家族。
:::

## API 参考

本节汇总大文件处理相关 API 的函数签名与参数表，便于快速查阅。

### Processor 方法

**ForeachFile**

签名：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

逐条处理大文件中的 JSON 数组元素。完整用法见[基本使用](#基本使用)与[中断控制](#带中断控制)。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `fn` | `func(key any, item *IterableValue) error` | 处理回调 |

**回调返回值**

| 返回值 | 说明 |
|--------|------|
| `nil` | 继续处理下一项 |
| `item.Break()` | 停止迭代，不返回错误 |
| 其他 `error` | 停止迭代并返回错误 |

**ForeachFileChunked**

签名：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) (err error)`

分批处理大文件，每次处理指定数量的元素。用法见[批量处理](#批量处理)。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `chunkSize` | `int` | 每批元素数量 |
| `fn` | `func(chunk []*IterableValue) error` | 批处理回调 |

**ForeachFileWithPath**

签名：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

处理文件中指定路径的 JSON 数组或对象。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `path` | `string` | JSON 路径表达式 |
| `fn` | `func(key any, item *IterableValue) error` | 处理回调 |

```go
// 处理文件中 users 数组的每个元素
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Name: %s\n", item.GetString("name"))
    return nil
})
```

**ForeachFileNested**

签名：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

递归遍历文件中的所有嵌套 JSON 结构。

```go
// 递归遍历所有嵌套元素
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

## 包级函数

除了 Processor 方法外，以下函数可以直接调用，无需创建 Processor 实例。它们内部使用全局处理器。

### ForeachFile（包级函数）

签名：`func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并迭代。

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath（包级函数）

签名：`func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并按路径迭代。

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("用户: %s\n", name)
    return nil
})
```

### ForeachFileChunked（包级函数）

签名：`func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

分块迭代文件中的 JSON 数组。

```go
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### ForeachFileNested（包级函数）

签名：`func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

从文件加载 JSON 并递归迭代所有嵌套结构。

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("路径: %v, 类型: %T\n", key, item.GetData())
    return nil
})
```

## 相关

- [JSONL 流式处理](./jsonl) — StreamJSONL 家族与 JSONLWriter 实战
- [JSONLWriter](./jsonl#jsonlwriter) — JSONL 写入器

## 下一步
- [API 文档](../api-reference/) — 完整 API 参考
