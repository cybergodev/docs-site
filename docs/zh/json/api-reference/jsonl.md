---
title: "JSONL 处理器 - CyberGo JSON | API 参考"
description: "CyberGo JSON JSONL 处理器参考：包括 StreamJSONL 流式处理、JSONLWriter 写入、StreamLinesInto[T] 泛型流、ParseJSONL 解析、ToJSONL 转换和配置选项，支持 JSON Lines 格式读写操作。"
---

# JSONL 处理器

JSONL（JSON Lines）或 NDJSON（Newline Delimited JSON）是每行一个 JSON 对象的格式。本库通过 `Processor` 方法和包级函数提供完整的 JSONL 处理能力。

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

JSONL 处理功能通过 `Processor` 的方法提供。

### StreamJSONL

签名：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

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

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU 密集型处理
    return processItem(item)
})
```

::: tip 性能提示
对于 CPU 密集型操作（如数据转换、计算），使用并行处理可显著提升性能。对于 I/O 密集型操作，建议使用单线程处理。
:::

### StreamJSONLParallelWithContext

签名：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

分批处理 JSONL 数据，每次处理指定数量的元素。

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

### StreamJSONLFile

签名：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

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

签名：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

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

签名：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

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

签名：`func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

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

签名：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

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
    fmt.Println("找到:", user.GetString("name"))
}
```

### ForeachJSONL

签名：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

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

写入单个 JSON 值作为一行。

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

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

写入原始 JSON 行（不进行 JSON 编码）。

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
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
fmt.Printf("写入 %d 行, %d 字节\n", stats.LinesProcessed, stats.BytesWritten)
```

**JSONLStats 结构**：

```go
type JSONLStats struct {
    LinesProcessed int64 // 已处理的行数
    BytesWritten   int64 // 已写入的字节数
}
```

---

## NDJSONProcessor

专门处理 `map[string]any` 类型的 NDJSON 文件处理器。

### NewNDJSONProcessor

签名：`func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

创建 NDJSON 处理器。支持可选配置参数。

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

::: warning 注意
`StreamJSONLFile` 是 Processor 方法而非包级函数。使用前需要创建 Processor 实例：

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

详见 [Processor JSONL 方法](./processor/jsonl#streamjsonlfile)。
:::

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
    "os"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

func main() {
    file, _ := os.Open("logs.jsonl")
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
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Create("output.jsonl")
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    for i := 0; i < 10; i++ {
        writer.Write(map[string]any{
            "id":    i,
            "value": fmt.Sprintf("item-%d", i),
        })
    }

    stats := writer.Stats()
    fmt.Printf("写入 %d 字节\n", stats.BytesWritten)
}
```

### 并行处理大型文件

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Open("large.jsonl")
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

- [大文件处理 API](./large-file) - ForeachFile 系列方法
- [大文件处理指南](../large-files) - 大文件处理指南
- [迭代器](./iterator) - 迭代遍历 API
