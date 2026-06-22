---
title: "Processor JSONL 方法 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor JSONL 方法：StreamJSONL 流式、ForeachJSONL 迭代、MapJSONL 映射、ReduceJSONL 归约与 FilterJSONL 过滤，适合流式数据处理。"
---

# Processor JSONL 方法

Processor 提供完整的 JSONL（JSON Lines）流式处理能力，支持逐行处理、并行处理、批量处理和函数式操作。

## 流式读取方法

### StreamJSONL

签名：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

流式处理 JSONL 数据，逐行读取并调用回调函数。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL 数据源 |
| `fn` | `func(lineNum int, item *IterableValue) error` | 处理函数，返回错误将停止处理 |

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

签名：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

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

签名：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

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

签名：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

迭代 JSONL 数据的别名方法，行为与 `StreamJSONL` 相同。

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

签名：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

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

签名：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

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
fmt.Printf("总销售额: %.2f\n", total.(float64))
```

---

### FilterJSONL

签名：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

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

签名：`func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

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

签名：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

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

## 配置选项

JSONL 处理行为可通过 `Config` 的以下字段配置：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | 读取缓冲区大小 |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | 单行最大字节数 |
| `JSONLSkipEmpty` | `bool` | `true` | 跳过空行 |
| `JSONLSkipComments` | `bool` | `false` | 跳过 `#` 或 `//` 注释 |
| `JSONLContinueOnErr` | `bool` | `false` | 解析错误时继续 |
| `JSONLWorkers` | `int` | 4 | 并行处理工作协程数 |
| `JSONLChunkSize` | `int` | 1000 | 分块处理每批大小 |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | 最大内存使用 |

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
    "os"
    "github.com/cybergodev/json"
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

    fmt.Printf("统计: %d 错误, %d 警告\n", errorCount, warningCount)
}
```

### 并行数据处理

```go
package main

import (
    "fmt"
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
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

- [JSONL 处理器](../jsonl) - 包级 JSONL 函数
- [大文件处理](../../large-files) - 大文件处理指南
- [迭代器](../iterator) - IterableValue 类型详解
