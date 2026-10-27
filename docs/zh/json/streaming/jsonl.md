---
sidebar_label: "JSONL 流式处理"
title: "JSONL 流式处理 - CyberGo JSON | NDJSON 流式读写"
description: "CyberGo JSON 的 JSONL 处理：StreamJSONL 逐行读取、StreamJSONLParallel 并行、MapJSONL 加工与 JSONLWriter 写入。"
sidebar_position: 20
---

# JSONL 流式处理

JSONL（JSON Lines）或 NDJSON（Newline Delimited JSON）是每行一个 JSON 对象的格式。库通过 `Processor` 方法与包级函数提供读取、并行、分块、函数式加工与写入能力。

## 格式规范

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- 每行是一个有效的 JSON 值
- 行与行之间用 `\n` 分隔
- 最后一行可以有或没有换行符

---

## Processor JSONL 方法

JSONL 处理功能通过 `Processor` 的方法提供。共 11 个流式/函数式方法，选型如下：

| 方法 | 形态 | 适用场景 |
|------|------|----------|
| `StreamJSONL` | 逐行回调 | 基础流式处理，逐行消费 `IterableValue` |
| `StreamJSONLParallel` | 并行回调 | CPU 密集型转换，多 worker 并行 |
| `StreamJSONLParallelWithContext` | 并行回调 + ctx | 需要超时/取消的并行处理 |
| `StreamJSONLChunked` | 分批回调 | 批量入库等按块消费场景 |
| `StreamJSONLFile` | 逐行回调（文件） | 直接读 `.jsonl` 文件（含路径安全校验） |
| `ForeachJSONL` | 逐行回调 | `StreamJSONL` 的别名 |
| `MapJSONL` | 变换收集 | 每行映射为新值，返回 `[]any` |
| `FilterJSONL` | 谓词收集 | 过滤出满足条件的行 |
| `ReduceJSONL` | 聚合 | 求和、统计等折叠计算 |
| `CollectJSONL` | 全量收集 | 一次性取出全部行 |
| `FirstJSONL` | 谓词 + 短路 | 找到第一个匹配即停止（内部等价 `Break`） |

### StreamJSONL

签名：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式处理 JSONL 数据，每行返回一个 `IterableValue`。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | 数据源 |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理回调 |

**回调返回值**

| 返回值 | 说明 |
|--------|------|
| `nil` | 继续处理下一行 |
| `item.Break()` | 停止迭代，不返回错误 |
| 其他 `error` | 停止迭代并返回错误 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("行 %d: name=%s, age=%d\n", lineNum, name, age)
    return nil // 继续处理
    // return item.Break() // 停止迭代
})
```

### StreamJSONLParallel

签名：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

并行处理 JSONL 数据，使用工作池模式。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | 数据源 |
| `workers` | `int` | 工作协程数量（<=0 时默认 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理回调 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// file 为已打开的 *os.File（如上文 StreamJSONL 示例中 os.Open 的返回值）
err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU 密集型处理
    return processItem(item)
})
```

::: tip 性能提示
并行是否划算取决于单行处理的开销：行内做转换、计算等 CPU 工作时，多 worker 能摊薄单行成本；行内主要是 I/O 等待时，单线程即可，多 worker 只增加调度与同步开销。
:::

回调返回 `item.Break()` 时为干净停止：扫描与各 worker 提前收尾，方法返回 `nil`；返回其他错误则该方法以该错误结束。回调 panic 会被恢复为错误，不会拖垮进程。

### StreamJSONLParallelWithContext

签名：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

带上下文的并行处理 JSONL 数据。支持超时和取消操作。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `ctx` | `context.Context` | 上下文，用于取消和超时 |
| `reader` | `io.Reader` | 数据源 |
| `workers` | `int` | 工作协程数量（<=0 时默认 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理回调 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err = p.StreamJSONLParallelWithContext(ctx, file, 8, func(lineNum int, item *json.IterableValue) error {
    // 支持取消的并行处理
    return processItem(item)
})
```

### StreamJSONLChunked

签名：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

分批处理 JSONL 数据，每次处理指定数量的元素。`chunkSize <= 0` 时按 1000 处理（`Config.JSONLChunkSize` 的默认值也是 1000，但此处按固定值回退，不读取该字段）。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 每批 1000 条
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // 批量写入数据库
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

::: warning 回调返回后归还对象池
`StreamJSONLChunked` 在**每批回调返回后**会把该批的 `IterableValue` 归还对象池（内部数据置空）。请在回调内完成落库或提取所需字段，不要跨回调持有 `chunk` 中的元素。`StreamJSONL`（及 `CollectJSONL`/`FilterJSONL`/`FirstJSONL` 等基于它的收集方法）不做归还，返回的元素可安全保留。
:::

### StreamJSONLFile

签名：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

直接处理 JSONL 文件。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

## 高级 JSONL 操作

### MapJSONL

签名：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

将 JSONL 数据映射为新格式。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return map[string]any{
        "name": item.GetString("name"),
        "age":  item.GetInt("age"),
    }, nil
})
```

### ReduceJSONL

签名：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

将 JSONL 数据聚合为单个结果。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 计算年龄总和
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

签名：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

过滤 JSONL 数据，返回满足条件的元素。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 筛选成年人
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

签名：`func (p *Processor) CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

收集所有 JSONL 元素到切片。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

items, err := p.CollectJSONL(file)
for _, item := range items {
    fmt.Println(item.GetString("name"))
}
```

### FirstJSONL

签名：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

返回第一个满足条件的元素。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

user, found, err := p.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("name") == "Alice"
})
if found {
    fmt.Println("找到：", user.GetString("name"))
}
```

### ForeachJSONL

签名：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

迭代 JSONL 数据（StreamJSONL 的别名）。

---

## JSONL 配置

JSONL 配置已集成到 `Config` 结构中：

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // 缓冲区大小（默认 64KB）
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // 最大行大小（默认 1MB）
cfg.JSONLSkipEmpty = true           // 跳过空行（默认 true）
cfg.JSONLSkipComments = true        // 跳过注释行（默认 false）
cfg.JSONLContinueOnErr = true       // 解析错误时继续（默认 false）
cfg.JSONLWorkers = 8                // 并行工作数（默认 4）
cfg.JSONLChunkSize = 500            // 分块大小（默认 1000）
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // 最大内存（默认 100MB）

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

字段生效范围与优先级：

- **`JSONLMaxLineSize`**：单行字节数上限。`StreamJSONL` 系列、`NDJSONProcessor` 与 `StreamLinesInto` 都用它限制 scanner；超出时返回 `bufio.ErrTooLong` 类错误。`JSONLMaxLineSize` ≤0 时统一回退 1MB（所有 JSONL 引擎共用同一组扫描上限）。
- **`JSONLMaxMemory`**：流式处理的总字节数上限（超出即报错终止）；回退链：`JSONLMaxMemory` → `MaxMemory`。
- **`MaxNestingDepthSecurity`**：所有 JSONL 流式入口在解析每行**之前**逐行检查嵌套深度，防止深嵌套导致栈溢出。
- **`JSONLContinueOnErr`**：对所有 JSONL 引擎生效——为 `true` 时 `StreamJSONL` 系列、`NDJSONProcessor`（`ProcessFile`/`ProcessReader`）与 `StreamLinesInto` 均跳过坏行继续；默认 `false` 遇解析错误立即终止。
- **`JSONLWorkers`/`JSONLChunkSize`**：参与配置校验（钳制范围 1–64 / 100–10000），但 `StreamJSONLParallel` 的 `workers` 参数与 `StreamJSONLChunked` 的 `chunkSize` 参数以显式传参为准。
- `Config.Validate` 会把越界值钳制回合法区间，可用 `ValidateWithWarnings` 查看调整明细。

---

## JSONLWriter

JSONL 写入器用于将数据写入 JSON Lines 格式。

### NewJSONLWriter

签名：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

创建 JSONL 写入器。支持可选配置参数。

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// 使用默认配置
writer := json.NewJSONLWriter(file)

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

签名：`func (w *JSONLWriter) Write(data any) error`

写入单个 JSON 值作为一行（编码结果 + `\n`）。HTML 转义跟随构造时的 `Config.EscapeHTML`（默认 `true`）。

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
// 写入内容：{"id":1,"name":"Alice"}\n
```

::: tip 错误会被缓存
`Write`/`WriteRaw` 一旦出错会把错误缓存在 writer 上，**后续所有写入调用直接返回同一错误**。批量写入结束后用 [`Err`](#err) 统一检查即可，无需每次判断。
:::

### WriteAll

签名：`func (w *JSONLWriter) WriteAll(data []any) error`

写入多个 JSON 值，每个作为一行。

```go
items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
    map[string]any{"id": 3, "name": "Charlie"},
}

err := writer.WriteAll(items)
```

### WriteRaw

签名：`func (w *JSONLWriter) WriteRaw(line []byte) error`

写入已编码的原始 JSON 行，跳过重新编码。行尾**没有**换行符时自动补一个；已有则原样写入。

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
// 写入内容：{"id":1,"name":"raw"}\n
```

### Err

签名：`func (w *JSONLWriter) Err() error`

返回写入过程中发生的错误。

```go
if err := writer.Err(); err != nil {
    fmt.Printf("写入错误: %v\n", err)
}
```

### Stats

签名：`func (w *JSONLWriter) Stats() JSONLStats`

获取写入统计信息。

```go
stats := writer.Stats()
fmt.Printf("写入 %d 行，%d 字节\n", stats.LinesProcessed, stats.BytesWritten)
```

**JSONLStats 结构**：

```go
type JSONLStats struct {
    LinesProcessed int64 // 已处理的行数
    BytesWritten   int64 // 已写入的字节数
}
```

| 字段 | 含义 |
|------|------|
| `LinesProcessed` | 经 `Write`/`WriteAll`/`WriteRaw` 成功写出的行数 |
| `BytesWritten` | 累计写出的总字节数，**含每行行尾的换行符** |

例如 `Write` 一行 `{"id":1}`（9 字节）后，`Stats()` 为 `LinesProcessed=1`、`BytesWritten=10`。

---

## NDJSONProcessor

<Badge type="danger" text="已废弃" />

::: warning 已废弃（永久弃用别名）
`NDJSONProcessor` / `NewNDJSONProcessor` 是**永久弃用的别名**：新代码请用 `json.New(cfg)` 创建 `Processor`，配合 [`StreamJSONL`](#streamjsonl) 家族（[`StreamJSONL`](#streamjsonl)、[`StreamJSONLFile`](#streamjsonlfile) 及并行/分块变体）——两者由同一引擎驱动、受同一组安全限制约束，且提供 `IterableValue` 类型化取值。`NDJSONProcessor` 在 v1 生命周期内保留、不会移除。API 级详情见 [NDJSONProcessor 弃用说明](../api-reference/processor/jsonl#ndjsonprocessor-独立处理器)。
:::

`NDJSONProcessor` 是独立于 `Processor` 的 NDJSON（换行分隔 JSON）逐行处理器：回调直接收到 `map[string]any`（而非 `IterableValue`），无需创建 `Processor` 实例，且**始终**跳过空行。它是**遗留 API**——新代码使用上方的 `StreamJSONL` 系列（类型化取值、并行 worker、分块与 Map/Reduce/Filter 组合均在其上提供）。以下参考对既有代码仍有查阅价值。

两个入口都内置防护：

- **每行嵌套深度检查**：解析前按 `MaxNestingDepthSecurity`（默认 200）检查，防深嵌套栈溢出；
- **单行大小上限**：`JSONLMaxLineSize`（≤0 回退 1MB）；
- **总量上限**：`JSONLMaxMemory`（回退 `MaxMemory`）超出即终止；
- **容错**：`JSONLContinueOnErr=true` 时跳过解析失败的行继续处理；
- **路径校验**：`ProcessFile` 对文件路径做路径遍历等安全校验；
- **回调 panic 恢复**：回调 panic 转为错误返回，不会拖垮进程。

### NewNDJSONProcessor

<Badge type="danger" text="已废弃" />

签名：`func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

创建 NDJSON 处理器（已弃用，见上方警告；新代码用 `json.New(cfg)` + `StreamJSONL` 家族）。支持可选配置参数。

```go
// 使用默认配置
np := json.NewNDJSONProcessor()

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024
np = json.NewNDJSONProcessor(cfg)
```

### ProcessFile

签名：`func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

处理 NDJSON 文件。

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

签名：`func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

从 Reader 处理 NDJSON。

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## 包级函数

所有 JSONL 处理函数均有包级版本，签名与对应 [Processor 方法](../api-reference/processor/jsonl) 一致，内部使用全局 Processor，无需手动创建实例。

::: tip 提示
包级函数适用于一次性处理。若在循环中多次调用或需要共享配置，创建专用 `Processor`（[`json.New()`](../api-reference/processor/)）以复用缓存。
:::

### StreamJSONL

签名：`func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式逐行处理 JSONL，每行解析为 `IterableValue` 后调用回调。

### StreamJSONLParallel

签名：`func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

使用 `workers` 个并行 goroutine 处理 JSONL。

### StreamJSONLParallelWithContext

签名：`func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

支持上下文取消的并行 JSONL 处理。

### StreamJSONLChunked

签名：`func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

按 `chunkSize` 分批处理 JSONL，每批以 `[]*IterableValue` 传入回调。

### ForeachJSONL

签名：`func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

遍历处理 JSONL，每行调用回调。

### MapJSONL

签名：`func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

将每行映射为新值，返回结果切片。

### ReduceJSONL

签名：`func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

归约 JSONL，`initial` 为累加器初值。

### FilterJSONL

签名：`func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

按谓词过滤 JSONL，返回匹配项。

### StreamJSONLFile

签名：`func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式处理整个 JSONL 文件。

```go
err := json.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

### CollectJSONL

签名：`func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

读取全部 JSONL 行并收集为切片。

### FirstJSONL

签名：`func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

返回第一个满足谓词的元素；第二个返回值表示是否找到。

### StreamLinesInto[T]

签名：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

流式读取 JSONL 并逐行处理。

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// 使用默认配置
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("处理: %s\n", user.Name)
    return nil
})

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

返回值语义：

- 返回的 `[]T` **只累积成功解析的行**——`fn` 处理过的行会追加进结果切片；
- 行解析失败且未开 `JSONLContinueOnErr` 时立即终止，返回 `nil` 结果与带行号的错误（`line N: ...`）；
- `JSONLContinueOnErr=true` 时坏行被跳过（不进结果、不调用 `fn`），继续处理后续行；
- `fn` 返回错误时立即终止并原样返回该错误；
- 单行超过 `JSONLMaxLineSize` 时以 `bufio.ErrTooLong` 结束。

### ParseJSONL

签名：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

解析 JSONL 字节切片。

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

签名：`func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

转换为 JSONL 字节切片。

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

签名：`func ToJSONLString(data []any, cfg ...Config) (string, error)`

转换为 JSONL 字符串。

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## 完整示例

### 读取大型 JSONL 文件

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

func main() {
	file, err := os.Open("logs.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	count := 0
	err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
		count++
		if item.GetString("level") == "error" {
			fmt.Printf("错误: %s\n", item.GetString("message"))
		}
		return nil
	})

	if err != nil {
		fmt.Printf("错误: %v\n", err)
	}

	fmt.Printf("共处理 %d 行\n", count)
}
```

### 写入 JSONL 文件

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

func main() {
	file, err := os.Create("output.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	writer := json.NewJSONLWriter(file)

	for i := 0; i < 10; i++ {
		if err := writer.Write(map[string]any{
			"id":    i,
			"value": fmt.Sprintf("item-%d", i),
		}); err != nil {
			panic(err)
		}
	}

	stats := writer.Stats()
	fmt.Printf("写入 %d 字节\n", stats.BytesWritten)
}
```

### 并行处理大型文件

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
	"sync/atomic"
)

func main() {
	file, err := os.Open("large.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	var count int64
	err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
		atomic.AddInt64(&count, 1)
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("并行处理 %d 行\n", count)
}
```

---

## 相关

- [大文件处理](./large-files) - 大文件处理指南与 API 参考
- [迭代器](../api-reference/iterator) - 迭代遍历 API
