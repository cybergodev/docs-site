---
sidebar_label: "JSONL"
title: "Processor JSONL 方法 - CyberGo JSON | StreamJSONL 流式读写"
description: "CyberGo JSON 的 Processor 提供 StreamJSONL 流式逐行读取及并行、文件直读变体，配合 MapJSONL/ReduceJSONL 等函数式变换，回调 panic 被捕获为错误返回、Break 可干净提前终止，适合日志分析与大规模 JSONL 数据的流式处理场景。"
sidebar_position: 80
---

# Processor JSONL 方法

Processor 提供完整的 JSONL（JSON Lines）流式处理能力，支持逐行处理、并行处理、批量处理和函数式操作。

::: tip 完整教程
需要 JSONL/NDJSON 的概念说明和流式处理实战？参阅 [JSONL 处理器](../../streaming/jsonl) 完整教程。
:::

## 流式读取方法

### StreamJSONL

签名：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式处理 JSONL 数据，逐行读取并调用回调函数。回调返回 `nil` 继续处理下一行，返回 `item.Break()` 干净地提前终止（整体返回 `nil`），返回其他错误立即停止并返回该错误。回调内的 panic 会被捕获并转为错误返回，不会击穿进程。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 数据源 |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理函数：`nil` 继续 / `item.Break()` 停止 / 其他错误中断 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    level := item.GetString("level")
    msg := item.GetString("message")
    fmt.Printf("[%d] %s: %s\n", lineNum, level, msg)
    return nil
})
```

---

### StreamJSONLParallel

签名：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

并行处理 JSONL 数据，使用多个工作协程加速处理。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 数据源 |
| `workers` | `int` | 工作协程数量（≤0 时默认 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理函数 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("large.jsonl")
defer file.Close()

var count int64
err := processor.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    atomic.AddInt64(&count, 1)
    // CPU 密集型处理...
    return nil
})
fmt.Printf("处理了 %d 行\n", count)
```

::: tip 性能建议
- 适合 CPU 密集型操作（数据转换、计算）
- I/O 密集型操作建议使用单线程 `StreamJSONL`
- workers 数量建议设置为 CPU 核心数
:::

### StreamJSONLParallelWithContext

签名：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

带上下文的并行处理 JSONL 数据，支持取消和超时控制。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `ctx` | `context.Context` | 上下文，用于取消或超时 |
| `reader` | `io.Reader` | JSONL 数据源 |
| `workers` | `int` | 工作协程数量（≤0 时默认 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理函数 |

```go
processor, _ := json.New()
defer processor.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := processor.StreamJSONLParallelWithContext(ctx, reader, 8, func(lineNum int, item *json.IterableValue) error {
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

---

### StreamJSONLChunked

签名：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

分块处理 JSONL 数据，每次处理一批元素。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 数据源 |
| `chunkSize` | `int` | 每批元素数量 |
| `fn` | `func(chunk []*IterableValue) error` | 批量处理函数 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // 批量写入数据库
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:    item.GetInt("id"),
            Name:  item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

---

### StreamJSONLFile

签名：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

直接从文件流式处理 JSONL 数据。

```go
processor, _ := json.New()
defer processor.Close()

err := processor.StreamJSONLFile("logs.jsonl", func(lineNum int, item *json.IterableValue) error {
    if item.GetString("level") == "error" {
        logErrors(item)
    }
    return nil
})
```

---

## 函数式操作方法

### ForeachJSONL

签名：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

迭代 JSONL 数据的别名方法，行为与 `StreamJSONL` 相同。

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

签名：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

将 JSONL 数据映射为新格式，返回转换后的切片。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// 提取所有用户名
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

签名：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

将 JSONL 数据归约为单个值。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// 计算总销售额
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("总销售额：%.2f\n", total.(float64))
```

---

### FilterJSONL

签名：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

过滤 JSONL 数据，返回满足条件的元素。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// 筛选错误日志
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("发现 %d 条错误日志\n", len(errors))
```

---

### CollectJSONL

签名：`func (p *Processor) CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

收集所有 JSONL 数据到切片。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

items, err := processor.CollectJSONL(file)
if err != nil {
    panic(err)
}
fmt.Printf("收集了 %d 条记录\n", len(items))
```

::: warning 内存注意
此方法会将所有数据加载到内存，不适合超大文件。大文件建议使用 `StreamJSONL` 逐行处理。
:::

---

### FirstJSONL

签名：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

查找第一个满足条件的元素。

**返回值**

| 类型 | 说明 |
|------|------|
| `*IterableValue` | 找到的元素（如存在） |
| `bool` | 是否找到 |
| `error` | 错误信息 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// 查找第一个管理员
admin, found, err := processor.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetBool("is_admin")
})
if err != nil {
    panic(err)
}
if found {
    fmt.Printf("管理员: %s\n", admin.GetString("name"))
}
```

---

## JSONL 转换方法

Processor 还提供与[包级 JSONL 转换函数](../functions/jsonl#jsonl-处理函数)对应的三个方法——`ParseJSONL`、`ToJSONL`、`ToJSONLString`，签名与包级版本一致（含尾随 `cfg ...Config`），适合复用已配置的处理器：

### ParseJSONL

签名：`func (p *Processor) ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

将 JSONL 字节切片解析为 `[]any`，每个元素是一行的解析结果。

### ToJSONL

签名：`func (p *Processor) ToJSONL(data []any, cfg ...Config) ([]byte, error)`

将值切片编码为 JSONL 字节（每行一个 JSON 值）。

### ToJSONLString

签名：`func (p *Processor) ToJSONLString(data []any, cfg ...Config) (string, error)`

将值切片编码为 JSONL 字符串，与 `ToJSONL` 输出相同内容、以 `string` 返回。

---

## NDJSONProcessor 独立处理器

<Badge type="danger" text="已废弃" />

::: warning 已废弃（永久弃用别名）
`NDJSONProcessor` / `NewNDJSONProcessor` 是**永久弃用的别名**：新代码请用 `json.New(cfg)` 创建 `Processor`，配合 [`StreamJSONL`](#streamjsonl) 家族（[`StreamJSONL`](#streamjsonl)、[`StreamJSONLFile`](#streamjsonlfile) 及并行/分块变体）——两者由同一引擎驱动、受同一组安全限制约束，且提供 `IterableValue` 类型化取值。`NDJSONProcessor` 在 v1 生命周期内保留、不会移除。
:::

`NDJSONProcessor` 是独立于 `Processor` 的 NDJSON（换行分隔 JSON）逐行处理器：回调直接收到 `map[string]any`（而非 `IterableValue`），无需创建 `Processor` 实例，且**始终**跳过空行。作为**遗留 API** 保留（新代码请用 `StreamJSONL` 系列）；需要类型化取值、并行处理或 Map/Reduce/Filter 函数式组合时，同样用本页上方的 `StreamJSONL` 系列。以下 API 参考对既有代码仍有查阅价值。

### NewNDJSONProcessor

<Badge type="danger" text="已废弃" />

签名：`func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

`NewNDJSONProcessor` 接受可选 cfg，遵循统一 Config 模式。已弃用（见上方小节警告）：新代码请用 `json.New(cfg)` + `StreamJSONL` 家族。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `cfg` | `...Config` | 可选配置，不传时使用 `DefaultConfig()`；读取缓冲区取 `JSONLBufferSize`（≤0 回退 64KB） |

其余 JSONL 字段（`JSONLMaxLineSize`、`JSONLMaxMemory`、`JSONLSkipComments`、`JSONLContinueOnErr`、`MaxNestingDepthSecurity`）在处理时生效，含义见[配置选项](#配置选项)。

### ProcessFile

签名：`func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

`ProcessFile` 逐行处理 NDJSON 文件。文件路径先做路径遍历等安全校验（非法路径返回 `ErrSecurityViolation`），随后等价于对打开的文件调用 `ProcessReader`；文件打开失败等错误包装为 `JsonsError` 返回。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filename` | `string` | NDJSON 文件路径（先做安全校验） |
| `fn` | `func(lineNum int, obj map[string]any) error` | 每行回调，返回错误立即终止并原样返回 |

### ProcessReader

签名：`func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

`ProcessReader` 从 `io.Reader` 逐行处理 NDJSON：每行解析为 `map[string]any` 后调用回调，回调 panic 会被捕获并转为错误返回。安全限制与 `StreamJSONL` 系列一致——单行大小受 `JSONLMaxLineSize` 约束（≤0 回退 1MB）、总处理量受 `JSONLMaxMemory` 约束（回退 `MaxMemory`）、每行解析前按 `MaxNestingDepthSecurity` 检查嵌套深度；`JSONLContinueOnErr=true` 时跳过解析失败的行继续处理。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | NDJSON 数据源 |
| `fn` | `func(lineNum int, obj map[string]any) error` | 每行回调，返回错误立即终止并原样返回 |

<!-- check-code: skip -->
```go
np := json.NewNDJSONProcessor()

err := np.ProcessReader(strings.NewReader(`{"id":1}`), func(lineNum int, obj map[string]any) error {
    fmt.Printf("行 %d: id=%v\n", lineNum, obj["id"])
    return nil
})
```

**完整示例**（空行始终被跳过，行号保持原始物理行号）：

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	np := json.NewNDJSONProcessor()

	data := "{\"id\":1}\n\n{\"id\":2}\n"
	var count int

	err := np.ProcessReader(strings.NewReader(data), func(lineNum int, obj map[string]any) error {
		count++
		fmt.Printf("行 %d: id=%v\n", lineNum, obj["id"])
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("共处理 %d 行\n", count)
	// 输出：
	// 行 1: id=1
	// 行 3: id=2
	// 共处理 2 行
}
```

::: tip 与 StreamJSONL 的选择
`NDJSONProcessor` 为遗留兼容保留，新代码请一律使用 `StreamJSONL` 系列（类型化取值 `GetInt`/`GetString`、并行 worker、分块、函数式管道均在其上提供）。两者受同一组 JSONL 安全限制约束。
:::

---

## 配置选项

JSONL 处理行为可通过 `Config` 的以下字段配置：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | 读取缓冲区大小 |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | 单行最大字节数 |
| `JSONLSkipEmpty` | `bool` | `true` | 跳过空行 |
| `JSONLSkipComments` | `bool` | `false` | 跳过 `#` 或 `//` 注释 |
| `JSONLContinueOnErr` | `bool` | `false` | 解析错误时继续（`true` 时所有 JSONL 引擎——含本页 `StreamJSONL` 系列、`NDJSONProcessor` 与 `StreamLinesInto`——跳过坏行继续；`false` 时立即中止并返回带行号的错误） |
| `JSONLWorkers` | `int` | 4 | 并行处理工作协程数 |
| `JSONLChunkSize` | `int` | 1000 | 分块处理每批大小 |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | 最大内存使用 |

::: tip per-call cfg 覆盖处理器固化配置
本页方法末尾的可选 `cfg ...Config` **仅对本次调用生效**：提供的 cfg 会整体替换处理器的 JSONL 相关设置（缓冲区/单行上限、内存上限、嵌套深度、`JSONLSkipComments`、`JSONLContinueOnErr` 等）；省略时使用 `New(cfg)` 时固化的配置。另注意：`StreamJSONLParallel` 的显式 `workers` 参数、`StreamJSONLChunked` 的显式 `chunkSize` 参数**优先于** `JSONLWorkers` / `JSONLChunkSize` 字段。此外每行在解析前还按 `MaxNestingDepthSecurity` 做嵌套深度检查，防止深层嵌套载荷撑爆栈。
:::

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // 跳过注释行
cfg.JSONLContinueOnErr = true    // 解析错误时继续
cfg.JSONLWorkers = 8             // 8 个并行 worker

processor, _ := json.New(cfg)
defer processor.Close()
```

---

## 完整示例

### 日志分析

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

func main() {
	processor, _ := json.New()
	defer processor.Close()

	file, _ := os.Open("app.log.jsonl")
	defer file.Close()

	var errorCount, warningCount int

	err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
		level := item.GetString("level")
		switch level {
		case "error":
			errorCount++
			fmt.Printf("[ERROR] %s\n", item.GetString("message"))
		case "warning":
			warningCount++
		}
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("统计：%d 错误，%d 警告\n", errorCount, warningCount)
}
```

### 并行数据处理

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
	"sync/atomic"
)

func main() {
	cfg := json.DefaultConfig()
	cfg.JSONLWorkers = 16 // 16 个并行 worker

	processor, _ := json.New(cfg)
	defer processor.Close()

	file, _ := os.Open("large_data.jsonl")
	defer file.Close()

	var processed int64

	err := processor.StreamJSONLParallel(file, 16, func(lineNum int, item *json.IterableValue) error {
		// CPU 密集型处理（替换为你的业务逻辑）
		_ = item
		atomic.AddInt64(&processed, 1)
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("并行处理了 %d 条记录\n", processed)
}
```

---

## 相关

- [JSONL 处理器](../../streaming/jsonl) - 包级 JSONL 函数
- [大文件处理](../../streaming/large-files) - 大文件处理指南
- [迭代器](../iterator) - IterableValue 类型详解
