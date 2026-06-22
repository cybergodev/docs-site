---
title: "大文件处理 - CyberGo JSON | API 参考"
description: "CyberGo JSON 大文件 API：ForeachFile 流式处理、ForeachFileChunked 分批、ForeachFileWithPath 路径、ForeachFileNested 嵌套迭代与内存控制配置。"
---

# 大文件处理


## 配置选项

大文件处理配置已集成到 `Config` 结构中：

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

### 自定义配置

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB 分块
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB 内存限制
cfg.BufferSize = 128 * 1024        // 128KB 缓冲区

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

签名：`func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

逐条处理大文件中的 JSON 数组元素。

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

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // 使用 IterableValue 便捷访问字段
    id := item.GetInt("id")
    name := item.GetString("name")

    if count%10000 == 0 {
        log.Printf("已处理 %d 条记录", count)
    }
    return nil
})
```

**中断迭代示例**

```go
err := p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // 找到目标，停止迭代
        return item.Break() // 停止但不报错
    }
    return nil // 继续迭代
})
```

---

## ForeachFileChunked

签名：`func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

分批处理大文件，每次处理指定数量的元素。

**参数**

| 名称 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | JSON 文件路径 |
| `chunkSize` | `int` | 每批元素数量 |
| `fn` | `func(chunk []*IterableValue) error` | 批处理回调 |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 每次处理 1000 条记录
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // 批量写入数据库
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... 处理数据
    }
    return nil
})
```

---

## ForeachFileWithPath

签名：`func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

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

---

## ForeachFileNested

签名：`func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

递归遍历文件中的所有嵌套 JSON 结构。

```go
// 递归遍历所有嵌套元素
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

---

## IterableValue 便捷方法

`ForeachFile*` 系列方法提供 `IterableValue` 接口，支持便捷的数据访问：

| 方法 | 说明 | 示例 |
|------|------|------|
| `GetInt(path)` | 获取整数 | `item.GetInt("id")` |
| `GetString(path)` | 获取字符串 | `item.GetString("name")` |
| `GetFloat64(path)` | 获取浮点数 | `item.GetFloat64("score")` |
| `GetBool(path)` | 获取布尔值 | `item.GetBool("active")` |
| `GetArray(path)` | 获取数组 | `item.GetArray("tags")` |
| `GetObject(path)` | 获取对象 | `item.GetObject("profile")` |
| `Exists(path)` | 检查字段是否存在 | `item.Exists("email")` |
| `IsNull(path)` | 检查是否为 null | `item.IsNull("deleted_at")` |
| `GetData()` | 获取原始数据 | `item.GetData()` |
| `Break()` | 返回中断信号 | `return item.Break()` |

**支持路径导航**

```go
city := item.GetString("profile.address.city")      // 嵌套对象
firstTag := item.GetString("tags[0]")               // 数组索引
lastTag := item.GetString("tags[-1]")               // 负索引（最后一个）
nested := item.GetString("data.items[0].name")      // 复杂路径
```

---

## 完整示例

### 处理超大日志文件

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // 创建处理器
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // 10MB 分块
    cfg.MaxMemory = 500 * 1024 * 1024 // 500MB 内存限制

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 统计错误日志
    errorCount := 0
    err = p.ForeachFile("logs.json", func(key any, item *json.IterableValue) error {
        level := item.GetString("level")
        if level == "error" {
            message := item.GetString("message")
            fmt.Printf("错误: %s\n", message)
            errorCount++
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("共发现 %d 个错误\n", errorCount)
}
```

### 批量导入数据库

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

// User 表示用户记录（示例数据模型）
type User struct {
    ID    int
    Name  string
    Email string
}

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // 每批 500 条写入数据库
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // 批量插入
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("已批量插入 %d 条记录", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## 包级文件迭代函数

除了 Processor 方法外，以下函数可以直接调用，无需创建 Processor 实例。它们内部使用全局处理器。

### ForeachFile（包级函数）

签名：`func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并迭代。

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath（包级函数）

签名：`func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并按路径迭代。

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("用户: %s\n", name)
    return nil
})
```

### ForeachFileChunked（包级函数）

签名：`func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

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

签名：`func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

从文件加载 JSON 并递归迭代所有嵌套结构。

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("路径: %v, 类型: %T\n", key, item.GetData())
    return nil
})
```

---

## 相关

- [大文件处理指南](../large-files) - 完整使用指南
- [NDJSON 处理器](./jsonl) - JSONL/NDJSON 处理
- [JSONLWriter](./jsonl#jsonlwriter) - JSONL 写入器
