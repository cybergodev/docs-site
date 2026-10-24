---
sidebar_label: "JSONL"
title: "JSONL 处理函数 - CyberGo JSON | ParseJSONL 与 ToJSONL 用法"
description: "JSONL 处理：ParseJSONL/ToJSONL 整块转换，StreamLinesInto[T] 与 StreamJSONL 家族逐行读取，NewJSONLWriter 写行。"
sidebar_position: 80
---

# JSONL 处理函数

json 包的 JSONL（JSON Lines）处理函数，覆盖解析、流式读取、格式转换与逐行写入。

::: tip 完整教程
JSONL/NDJSON 的概念、流式处理模式与实战用法见 [JSONL 流式处理](../../streaming/jsonl)。
:::

## JSONL 处理函数

JSONL（JSON Lines）是换行分隔的 JSON 格式，每行一个独立的 JSON 值。

### ParseJSONL

签名：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

解析 JSONL（换行分隔 JSON）数据，返回每行解析结果的切片。任一坏行导致失败时返回 `nil` 与错误，不返回部分结果；`JSONLContinueOnErr=true` 时可跳过坏行继续。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]byte` | 是 | JSONL 字节数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
	results, err := json.ParseJSONL([]byte(jsonl))
	if err != nil {
		panic(err)
	}
	for i, r := range results {
		fmt.Printf("[%d] %v\n", i, r)
	}
}
```

### StreamLinesInto

签名：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

从 `io.Reader` 流式读取 JSONL，每行按目标类型 `T` 解码后传给回调；回调返回非 nil 错误即中断处理并作为函数返回值。这是泛型 JSONL 处理的首选入口。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `reader` | `io.Reader` | 是 | 数据源 |
| `fn` | `func(lineNum int, data T) error` | 是 | 处理回调（接收行号和数据） |
| `cfg` | `Config` | 否 | 可选配置 |

**返回值**

| 类型 | 说明 |
|------|------|
| `[]T` | 所有处理后的结果切片 |
| `error` | 错误信息 |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

type User struct {
	Name string `json:"name"`
}

func main() {
	src := `{"name":"Alice"}
{"name":"Bob"}`

	// 基本用法
	results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
		fmt.Printf("行 %d: 用户 %s\n", lineNum, user.Name)
		return nil // 返回 error 可中断处理
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("共处理 %d 条记录\n", len(results))
}
```

### ToJSONL

签名：`func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

将数据切片转换为 JSONL 格式。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]any` | 是 | 数据切片 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	items := []any{
		map[string]any{"name": "Alice"},
		map[string]any{"name": "Bob"},
	}
	jsonl, err := json.ToJSONL(items)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(jsonl))
	// {"name":"Alice"}
	// {"name":"Bob"}
}
```

### ToJSONLString

签名：`func ToJSONLString(data []any, cfg ...Config) (string, error)`

将数据切片转换为 JSONL 字符串。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]any` | 是 | 数据切片 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	items := []any{
		map[string]any{"name": "Alice"},
		map[string]any{"name": "Bob"},
	}
	jsonlStr, err := json.ToJSONLString(items)
	if err != nil {
		panic(err)
	}
	fmt.Println(jsonlStr)
}
```

## JSONL 流式处理函数（包级）

json 包的 JSONL 流式处理包级函数，签名与对应 Processor 方法一致（末尾同样接受可选的 `cfg ...Config`）。它们内部使用按 `cfg` 缓存的全局 Processor，无需手动创建实例，适合一次性处理；需要多次处理或共享同一份配置时，改用 [`json.New(cfg)`](../processor/#new) 创建独立 Processor。

完整用法与示例见 [JSONL 流式处理指南](../../streaming/jsonl#包级函数) 与 [Processor JSONL 方法](../processor/jsonl)。

**选型**

| 场景 | 推荐 |
|------|------|
| 逐行处理（顺序敏感） | `StreamJSONL` / `ForeachJSONL` |
| CPU 密集的行处理（顺序不敏感） | `StreamJSONLParallel` |
| 需要中途取消或超时 | `StreamJSONLParallelWithContext` |
| 批量落库等分块消费 | `StreamJSONLChunked` |
| 解码到具体结构体 `T` | `StreamLinesInto[T]` |
| 转换、聚合、筛选、查找首个 | `MapJSONL` / `ReduceJSONL` / `FilterJSONL` / `FirstJSONL` |
| 全量收集 | `CollectJSONL`（全量驻留内存，大文件慎用） |

**行为要点**

- **坏行处理**：默认（`JSONLContinueOnErr=false`）遇到无法解析的行**立即中止**，返回 `line N: ...` 形式的错误。`JSONLContinueOnErr=true` 时所有 JSONL 引擎（`StreamJSONL` 家族、`StreamLinesInto`、`NDJSONProcessor`）都跳过坏行继续。
- **深度护栏**：每行解析前检查嵌套深度（`MaxNestingDepthSecurity`，默认 200），防止深嵌套行导致栈溢出。
- **并行语义**：`StreamJSONLParallel` 在 `workers <= 0` 时按 4 处理；回调在多个 goroutine 中并发执行，并发安全由调用方负责。回调返回 `item.Break()` 是**正常**提前结束（函数返回 `nil`）；返回其他错误会取消其余任务并成为函数返回值。
- **内存护栏**：`JSONLMaxMemory`（未设时回退 `MaxMemory`）限制已处理的总字节数，超限即中止。

### StreamJSONL

签名：`func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式逐行处理 JSONL，每行解析为 `IterableValue` 后调用回调；回调返回 `nil` 继续，返回 `item.Break()` 提前正常结束，返回其他错误即中止。

### StreamJSONLParallel

签名：`func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

使用 `workers` 个 goroutine 并行处理 JSONL，适合 CPU 密集场景；`workers <= 0` 时按 4 处理。

### StreamJSONLParallelWithContext

签名：`func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

支持上下文取消/超时的并行 JSONL 处理。

### StreamJSONLChunked

签名：`func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

按 `chunkSize` 分批处理，每批以 `[]*IterableValue` 传入回调。

### ForeachJSONL

签名：`func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

遍历 JSONL（`StreamJSONL` 的别名，行为相同）。

### MapJSONL

签名：`func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

将每行映射为新值，返回结果切片。

### ReduceJSONL

签名：`func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

归约 JSONL 为单个值，`initial` 为累加器初值。

### FilterJSONL

签名：`func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

按谓词过滤，返回匹配项切片。

### StreamJSONLFile

签名：`func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

直接流式处理整个 JSONL 文件。

### CollectJSONL

签名：`func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

读取全部 JSONL 行并收集为切片（全量加载到内存，大文件用 `StreamJSONL`）。

### FirstJSONL

签名：`func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

返回第一个满足谓词的元素；第二个返回值表示是否找到。

## JSONL 配置

::: warning
独立的 JSONLConfig 结构与 DefaultJSONLConfig 函数已移除。JSONL 配置统一放在 `Config` 的 `JSONL*` 字段中。
:::

### 通过 Config 配置 JSONL

```go
cfg := json.DefaultConfig()

// JSONL 配置
cfg.JSONLBufferSize    = 64 * 1024    // 读取缓冲区大小 (默认：64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // 单行最大大小 (默认：1MB)
cfg.JSONLSkipEmpty     = true         // 跳过空行 (默认：true)
cfg.JSONLSkipComments  = false        // 跳过注释行 (默认：false)
cfg.JSONLContinueOnErr = false        // 遇错继续 (默认：false)
cfg.JSONLWorkers       = 4            // 并行工作协程数 (默认：4)
cfg.JSONLChunkSize     = 1000         // 每批处理行数 (默认：1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // 最大内存 (默认：100MB)

processor, err := json.New(cfg)
```

详见 [Config 配置](../config#config-结构体)。

## JSONL 写入器

### NewJSONLWriter

签名：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

创建 JSONL 写入器，后续每次 `Write` 输出一行。

```go
package main

import (
	"github.com/cybergodev/json"
	"os"
)

func main() {
	file, err := os.Create("output.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()
	jw := json.NewJSONLWriter(file)
	jw.Write(map[string]any{"id": 1, "name": "Alice"})
	jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
```

### JSONLWriter 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `func (w *JSONLWriter) Write(data any) error` | 将单个值编码为一行 JSON 写入 |
| `WriteAll` | `func (w *JSONLWriter) WriteAll(data []any) error` | 依次写入多个值，遇首个错误即停止 |
| `WriteRaw` | `func (w *JSONLWriter) WriteRaw(line []byte) error` | 写入已编码的原始 JSON 行 |
| `Err` | `func (w *JSONLWriter) Err() error` | 返回首个被缓存的写入错误 |
| `Stats` | `func (w *JSONLWriter) Stats() JSONLStats` | 返回写入统计 |

#### Write

签名：`func (w *JSONLWriter) Write(data any) error`

将单个 JSON 值编码为一行写入底层 writer，行尾自动追加 `\n`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `any` | 是 | 要编码写入的值 |

**返回值**

| 类型 | 说明 |
|------|------|
| `error` | 编码或写入错误；出错后被缓存到写入器（见下方「行为细节」） |

#### WriteAll

签名：`func (w *JSONLWriter) WriteAll(data []any) error`

将多个值依次编码为多行写入，遇到首个错误立即停止并返回。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]any` | 是 | 要写入的值切片 |

**返回值**

| 类型 | 说明 |
|------|------|
| `error` | 首个由 `Write` 返回的错误（全部成功为 `nil`） |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

#### WriteRaw

签名：`func (w *JSONLWriter) WriteRaw(line []byte) error`

写入**已编码**的原始 JSON 行，避免二次编码开销；行尾没有 `\n` 时自动补一个。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `line` | `[]byte` | 是 | 已编码的 JSON 行（无需包含换行符） |

**返回值**

| 类型 | 说明 |
|------|------|
| `error` | 写入错误；出错后被缓存到写入器 |

#### Err

签名：`func (w *JSONLWriter) Err() error`

返回首个被缓存的写入/编码错误（无错为 `nil`），适合批量写入后统一检查。

**返回值**

| 类型 | 说明 |
|------|------|
| `error` | 首个缓存错误；从未出错时为 `nil` |

#### Stats

签名：`func (w *JSONLWriter) Stats() JSONLStats`

返回写入统计（成功写入的行数与字节数）。

**返回值**

| 类型 | 说明 |
|------|------|
| `JSONLStats` | 写入统计，字段见下文 [JSONLStats](#jsonlstats) |

### JSONLStats

`Stats()` 返回的写入统计类型。

```go
type JSONLStats struct {
    LinesProcessed int64 // 已成功写入的行数
    BytesWritten   int64 // 已写入的总字节数（含行尾换行符）
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `LinesProcessed` | `int64` | 已成功写入的行数（失败的行不计入） |
| `BytesWritten` | `int64` | 已写入底层 writer 的总字节数（含自动补齐的换行符） |

**行为细节**

- `Write`：将值编码为单行 JSON 后追加 `\n`；是否转义 `<`/`>`/`&` 由 `Config.EscapeHTML`（默认 `true`）决定。`NewJSONLWriter` 只读取该字段，`Pretty`/`Indent`/`FloatPrecision` 不影响输出。需要完整配置化编码时，先用 `Encode` 生成行，再交给 `WriteRaw`
- `WriteRaw`：写入**已编码**的原始行以避免二次编码开销；行尾没有 `\n` 时自动补一个
- **错误粘性**：任一次写入或编码出错后，错误被缓存在写入器上，后续 `Write`/`WriteRaw` 不再写底层 writer、直接返回该错误，避免在半写状态上继续追加
- `Err()` 读取缓存错误（无错为 `nil`）；`Stats()` 返回 `JSONLStats`，字段见上表
- **并发**：`JSONLWriter` 不保证并发安全（错误与计数状态无锁保护）。每个 goroutine 各用一个写入器，或由调用方串行化 `Write`

### 使用示例

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

func main() {
	jw := json.NewJSONLWriter(os.Stdout)

	// 写入 3 条记录，每条一行
	for i := 1; i <= 3; i++ {
		if err := jw.Write(map[string]int{"id": i}); err != nil {
			panic(err)
		}
	}

	stats := jw.Stats()
	if err := jw.Err(); err != nil {
		panic(err)
	}
	fmt.Printf("已写入 %d 行，共 %d 字节\n", stats.LinesProcessed, stats.BytesWritten)
	// {"id":1}
	// {"id":2}
	// {"id":3}
	// 已写入 3 行，共 27 字节
}
```

## 相关

- [文件操作函数](./file-io) - LoadFromFile, SaveToFile 等文件操作
- [Processor JSONL 方法](../processor/jsonl) - Processor 级 JSONL 方法详解
- [JSONL 流式处理](../../streaming/jsonl#jsonlwriter) - JSONL/NDJSON 概念与流式实战教程
- [流式处理](../../streaming/large-files) - 流式处理器详解
