---
sidebar_label: "JSONL"
title: "JSONL 处理函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON JSONL 处理函数：ParseJSONL/ToJSONL/ToJSONLString 转换、StreamJSONL/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL 流式处理、StreamLinesInto[T] 泛型流与 NewJSONLWriter 写入器。"
sidebar_position: 8
---

# JSONL 处理函数

json 包提供的 JSONL（JSON Lines）处理函数，支持解析、流式读取、转换和写入换行分隔的 JSON 数据。

## JSONL 处理函数

JSONL（JSON Lines）是换行分隔的 JSON 格式，每行一个独立的 JSON 对象。

### ParseJSONL

签名：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

解析 JSONL（换行分隔 JSON）数据。

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

从 io.Reader 流式读取 JSONL 数据并通过回调函数处理每一行。这是推荐的泛型 JSONL 处理方式。

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
    "strings"
    "github.com/cybergodev/json"
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

json 包提供的 JSONL 流式处理包级便捷函数，签名与对应 Processor 方法一致，并在末尾额外接受可选的 `cfg ...Config` 尾参；内部使用按 `cfg` 缓存的全局 Processor，因此无需手动创建实例，适合一次性处理场景。需要多次处理或共享同一份配置时，建议改用 [`json.New(cfg)`](../processor/#new) 创建独立 Processor。

完整用法与示例见 [JSONL 流式处理指南](../../streaming/jsonl#包级函数) 与 [Processor JSONL 方法](../processor/jsonl)。

### StreamJSONL

签名：`func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

流式逐行处理 JSONL，每行解析为 `IterableValue` 后调用回调。

### StreamJSONLParallel

签名：`func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

使用 `workers` 个并行 goroutine 处理 JSONL（CPU 密集型场景）。

### StreamJSONLParallelWithContext

签名：`func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

支持上下文取消/超时的并行 JSONL 处理。

### StreamJSONLChunked

签名：`func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

按 `chunkSize` 分批处理，每批以 `[]*IterableValue` 传入回调。

### ForeachJSONL

签名：`func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

遍历 JSONL（行为与 `StreamJSONL` 相同的别名）。

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

读取全部 JSONL 行并收集为切片（注意：全量加载到内存，大文件建议用 `StreamJSONL`）。

### FirstJSONL

签名：`func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

返回第一个满足谓词的元素；第二个返回值表示是否找到。

## JSONL 配置

::: warning
JSONLConfig 独立结构和 `DefaultJSONLConfig()` 函数已移除。JSONL 配置已统一集成到 `Config` 的 `JSONL*` 字段中。
:::

### 通过 Config 配置 JSONL

```go
cfg := json.DefaultConfig()

// JSONL 配置
cfg.JSONLBufferSize    = 64 * 1024    // 读取缓冲区大小 (默认: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // 单行最大大小 (默认: 1MB)
cfg.JSONLSkipEmpty     = true         // 跳过空行 (默认: true)
cfg.JSONLSkipComments  = false        // 跳过注释行 (默认: false)
cfg.JSONLContinueOnErr = false        // 遇错继续 (默认: false)
cfg.JSONLWorkers       = 4            // 并行工作协程数 (默认: 4)
cfg.JSONLChunkSize     = 1000         // 每批处理行数 (默认: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // 最大内存 (默认: 100MB)

processor, err := json.New(cfg)
```

详见 [Config 配置](../config#config-结构体)

## JSONL 写入器

### NewJSONLWriter

签名：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

创建 JSONL 写入器。

```go
package main

import (
    "os"
    "github.com/cybergodev/json"
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

**JSONLWriter 方法**

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(data any) error` | 写入单行 |
| `WriteAll` | `(data []any) error` | 写入多行 |
| `WriteRaw` | `(line []byte) error` | 写入原始字节行 |
| `Err` | `() error` | 返回累积错误 |
| `Stats` | `() JSONLStats` | 返回写入统计 |

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

## 相关

- [文件操作函数](./file-io) - LoadFromFile, SaveToFile 等文件操作
- [Processor JSONL 方法](../processor/jsonl) - Processor 级 JSONL 方法详解
- [流式处理](../../streaming/large-files) - 流式处理器详解
