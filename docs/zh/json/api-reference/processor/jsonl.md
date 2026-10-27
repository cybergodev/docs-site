---
sidebar_label: "JSONL"
title: "Processor JSONL 方法 - CyberGo JSON | StreamJSONL 流式读写"
description: "Processor 的 JSONL 方法：StreamJSONL 逐行读取与并行、分块、文件变体，MapJSONL/ReduceJSONL 变换与转换。"
sidebar_position: 80
---

# Processor JSONL 方法

JSONL（JSON Lines）处理分为四组：流式读取、函数式变换、JSONL 编解码转换，以及遗留的 `NDJSONProcessor`。所有引擎共用同一组 `JSONL*` 配置字段与安全限制。

::: tip 完整教程
JSONL/NDJSON 的概念说明与流式处理实战见 [JSONL 处理器](../../streaming/jsonl)。
:::

## 流式读取方法

### StreamJSONL

签名：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式处理 JSONL 数据，逐行读取并调用回调函数。回调返回 `nil` 继续处理下一行，返回 `item.Break()` 干净地提前终止（整体返回 `nil`），返回其他错误立即停止并返回该错误。回调内的 panic 会被捕获并转为错误返回。

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

并行处理 JSONL 数据，用多个工作协程分摊处理。适用于回调内的 CPU 密集计算（转换、聚合）；I/O 密集的场景用单线程 `StreamJSONL` 更省开销。

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

::: tip 工作协程数量
`workers` 参数显式指定且大于 0 时以它为准，`≤0` 回退 4。取值建议接近 CPU 核心数。
:::

### StreamJSONLParallelWithContext

签名：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

带上下文的并行处理，用于取消与超时控制。读取循环每读一行、每个工作协程每取一个任务都会检查 `ctx.Done()`；取消后停止投递新行，并返回 `ctx.Err()`（若此前已有回调错误或读取错误，则优先返回那个错误）。

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

分块处理 JSONL 数据，每攒满 `chunkSize` 个元素调用一次回调。`chunkSize` 决定每批数量，`≤0` 时按 1000 处理。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 数据源 |
| `chunkSize` | `int` | 每批元素数量，`≤0` 时按 1000 处理 |
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

从文件路径直接打开并流式处理 JSONL 数据，等价于打开文件后调用 `StreamJSONL`；文件路径先做安全校验。

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

`StreamJSONL` 的别名，行为相同。

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

签名：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

将 JSONL 数据映射为新格式，返回转换后的切片。回调返回的 `(value, nil)` 追加进结果；返回非 nil 错误时立即中止，整体返回该错误。

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

从 `initial` 出发逐行折叠，把 JSONL 数据归约为单个值。

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

过滤 JSONL 数据，返回判定函数返回 `true` 的元素。结果切片保存全部命中项，内存占用随命中数增长。

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

收集所有 JSONL 记录到切片。全部记录会驻留内存，大文件请改用 `StreamJSONL`。

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

查找第一个满足判定函数的元素。找到后立即停止读取剩余行；未找到时返回 `(nil, false, nil)`。

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

另有三个方法与[包级 JSONL 转换函数](../functions/jsonl#jsonl-处理函数)对应：`ParseJSONL`、`ToJSONL`、`ToJSONLString`。签名与包级版本相同（含尾随 `cfg ...Config`），用于复用已配置的处理器：

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
`NDJSONProcessor` / `NewNDJSONProcessor` 是**永久弃用的别名**。新代码用 `json.New(cfg)` 创建 `Processor`，配合 [`StreamJSONL`](#streamjsonl) 家族（[`StreamJSONL`](#streamjsonl)、[`StreamJSONLFile`](#streamjsonlfile) 及并行、分块变体）：两者由同一引擎驱动，受同一组安全限制约束，且 `StreamJSONL` 侧提供 `IterableValue` 类型化取值。`NDJSONProcessor` 在 v1 生命周期内保留、不会移除。
:::

`NDJSONProcessor` 是独立于 `Processor` 的 NDJSON（换行分隔 JSON）逐行处理器：回调直接收到 `map[string]any`，而非 `IterableValue`，且无需创建 `Processor` 实例；行跳过规则、单行上限、内存上限与嵌套深度检查与 `StreamJSONL` 家族相同。

它作为遗留 API 保留，仅供既有代码查阅。新代码一律用 `StreamJSONL` 系列：需要类型化取值、并行处理或 Map/Reduce/Filter 组合时，用上方的对应方法。

### NewNDJSONProcessor

<Badge type="danger" text="已废弃" />

签名：`func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

`NewNDJSONProcessor` 接受可选 cfg，不传时使用 `DefaultConfig()`。已弃用（见上方警告），新代码用 `json.New(cfg)` 加 `StreamJSONL` 家族。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `cfg` | `...Config` | 可选配置。构造时调用 `Validate` 钳制各字段（错误被丢弃），因此 `JSONLBufferSize` 非正值会被抬到 4KB，读取缓冲区取该值 |

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

`ProcessReader` 从 `io.Reader` 逐行处理 NDJSON：每行解析为 `map[string]any` 后调用回调，回调 panic 会被捕获并转为错误返回。安全限制与 `StreamJSONL` 系列相同：单行大小受 `JSONLMaxLineSize` 约束（默认 1MB，`Validate` 会把非正值钳制到下限 1KB），累计字节受 `JSONLMaxMemory` 约束，每行解析前按 `MaxNestingDepthSecurity` 检查嵌套深度。`JSONLContinueOnErr=true` 时跳过解析失败的行继续处理。

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

**完整示例**（仅空白字符的行始终跳过，行号保持原始物理行号）：

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

JSONL 处理行为由 `Config` 的以下字段控制：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536（64KB） | 读取缓冲区初始容量；`Validate` 把非正值钳制到 4KB 下限，上限 1MB |
| `JSONLMaxLineSize` | `int` | 1048576（1MB） | 单行最大字节数；`Validate` 钳制到 1KB–100MB，超出返回 `bufio.ErrTooLong` |
| `JSONLSkipEmpty` | `bool` | `true` | 跳过空行。当前所有引擎对仅空白字符的行**始终**跳过，因此设成 `false` 不改变行为 |
| `JSONLSkipComments` | `bool` | `false` | 跳过以 `#` 或 `//` 开头的行 |
| `JSONLContinueOnErr` | `bool` | `false` | 解析错误时继续。`true` 时所有 JSONL 引擎（`StreamJSONL` 系列、`NDJSONProcessor`、`StreamLinesInto`）跳过坏行；`false` 时立即中止并返回带行号的错误 |
| `JSONLMaxMemory` | `int64` | 104857600（100MB） | 累计处理字节上限，超出返回 `ErrSizeLimit`；`Validate` 钳制到 10MB–1GB |
| `JSONLWorkers` | `int` | 4 | 当前没有代码读取该字段来改变行为；实际并发数由 `StreamJSONLParallel` 的 `workers` 参数决定（`≤0` 回退 4） |
| `JSONLChunkSize` | `int` | 1000 | 当前没有代码读取该字段来改变行为；实际分块大小由 `StreamJSONLChunked` 的 `chunkSize` 参数决定（`≤0` 回退 1000） |

::: tip per-call cfg 只作用于本次调用
方法末尾的可选 `cfg ...Config` 替换处理器固化的 JSONL 设置（缓冲区、单行上限、内存上限、`JSONLSkipComments`、`JSONLContinueOnErr` 等），省略时用 `New(cfg)` 固化的配置。
:::

每行在解析前还按 `MaxNestingDepthSecurity` 检查嵌套深度。

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // 跳过注释行
cfg.JSONLContinueOnErr = true    // 解析错误时继续
cfg.JSONLMaxLineSize = 4 << 20   // 单行上限放宽到 4MB

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
	processor, _ := json.New()
	defer processor.Close()

	file, _ := os.Open("large_data.jsonl")
	defer file.Close()

	var processed int64

	// 第二个参数 16 即并行 worker 数
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
