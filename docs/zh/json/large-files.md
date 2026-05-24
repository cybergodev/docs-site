---
title: "大文件处理 - CyberGo JSON | 指南"
description: "CyberGo JSON 大文件处理完整指南：详细介绍 ForeachFile 结构化迭代、ForeachFileChunked 批量处理、内存控制配置、缓冲区大小优化、JSONL 批量处理和 NDJSONProcessor 真正流式处理，适用于日志分析、数据导出和 ETL 场景。"
---

# 大文件处理

对于大型 JSON 文件（如日志、配置、数据导出），直接加载到内存可能导致内存溢出。 json 库提供了多种高效的处理方式。

::: warning
`ForeachFile` 和 `ForeachFileChunked` 在迭代前会将整个文件加载到内存中。"分块"行为仅影响内存中数据的迭代方式，不影响文件的读取方式。对于真正需要控制内存的超大文件处理，请使用 `NDJSONProcessor` 配合 JSONL 格式，或使用 `StreamIterator`。
:::

## 备选方案

| 方案 | 适用场景 | 内存占用 |
|------|----------|----------|
| **Processor.ForeachFile** | 结构化迭代处理文件 | 加载完整文件，逐条迭代 |
| **Processor.ForeachFileChunked** | 批量分块迭代处理 | 加载完整文件，分块迭代 |
| **NDJSONProcessor** | 逐行处理 JSONL 文件 | 内存可控，真正的流式处理 |

## 统一 API： Processor

### 配置选项

大文件处理配置已集成到 `Config` 中：

```go
type Config struct {
    // ... 其他配置 ...

    // 大文件处理配置
    ChunkSize       int64 // 分块大小（默认 1MB）
    MaxMemory       int64 // 最大内存使用（默认 100MB）
    BufferSize      int   // 读取缓冲区大小（默认 64KB）
    SamplingEnabled bool  // 是否启用采样（默认 true）
    SampleSize      int   // 采样数量（默认 1000）
}
```

### 基本使用

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
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
            log.Printf("已处理 %d 条记录", count)
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
    log.Printf("处理批次: %d 条记录", len(chunk))

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
// 文件格式: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### 自定义配置
```go
// 自定义大文件处理配置
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 分块
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

## 流式处理配置

通过 `Config` 配置流式处理参数：

```go
cfg := json.DefaultConfig()

// 大文件处理配置
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 分块
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
    "fmt"
    "sync"
    "github.com/cybergodev/json"
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
                // 处理 item
                processItem(item)
            }
        }(i)
    }

    // 流式读取并分发
    processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        items <- item.Get("")
        return nil
    })

    close(items)
    wg.Wait()
}
```

## 性能优化建议

### 内存控制
```go
// 根据可用内存配置
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500MB
cfg.ChunkSize = 10 * 1024 * 1024  // 10MB

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
| 10-100MB | Processor.ForeachFile | 逐条处理 |
| 100MB-1GB | Processor.ForeachFileChunked | 分块迭代处理 |
| > 1GB | NDJSONProcessor / JSONL 格式 | 真正的流式处理，内存可控 |


## 下一步
- [API 文档](./api-reference/) — 完整 API 参考
