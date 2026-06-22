---
title: "性能优化 - CyberGo JSON | 高性能指南"
description: "CyberGo JSON 性能优化指南：EnableCache/CacheTTL 缓存、ParallelThreshold 并行、PreParse 预解析、WarmupCache 预热与对象池复用，提升高频 JSON 处理性能。"
---

# 性能优化

优化 JSON 处理性能的策略和技巧。

## 处理器复用

### 复用 Processor 实例

```go
// ✅ 包级函数自动复用全局 Processor
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// ✅ 或显式复用实例（适合自定义配置）
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## 内存优化

### 减少分配

```go
// ✅ 使用 Marshal 返回字节切片
bytes, _ := json.Marshal(data)

// ✅ 使用 Encode 返回字符串
s, _ := json.Encode(data)
```

### 预分配缓冲区

```go
// 处理大量数据时预分配
buf := make([]byte, 0, 1024*1024)
```

## 文件处理

### 大文件使用结构化迭代

```go
// ❌ 一次性加载
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// ✅ 结构化迭代（注意：仍会将完整文件加载到内存）
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
processor.ForeachFile("large.json", func(key any, item *json.IterableValue) error {
    processItem(item)
    return nil
})
```

### NDJSON 处理

```go
// 使用 StreamLinesInto 流式处理
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // 处理每一行 JSON
    return nil
})
```

## 并发处理

### 并行处理数组

```go
items := json.GetArray(data, "items")

var wg sync.WaitGroup
sem := make(chan struct{}, runtime.NumCPU())

for _, item := range items {
    wg.Add(1)
    go func(item any) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()

        processItem(item)
    }(item)
}
wg.Wait()
```

### 使用 Worker Pool

```go
items := json.GetArray(data, "items")
jobs := make(chan any, len(items))

// 启动固定数量的 worker，复用 goroutine 避免频繁创建/销毁
var wg sync.WaitGroup
workers := runtime.NumCPU()
for w := 0; w < workers; w++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for item := range jobs {
            processItem(item)
        }
    }()
}

// 分发任务后关闭通道，通知 worker 退出
for _, item := range items {
    jobs <- item
}
close(jobs)
wg.Wait()
```

## 配置优化

### 根据场景调整配置

```go
// 小数据量：宽松配置
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // 最大允许值（验证范围 10-200）

// 不可信输入：安全配置
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### 禁用不必要的功能

```go
// 如果不需要 Hook，不要配置
cfg := json.DefaultConfig() // 最小配置
```

## 缓存策略

### 缓存解析结果

```go
var cache sync.Map

func getOrParse(key string, data []byte) (any, error) {
    if val, ok := cache.Load(key); ok {
        return val, nil
    }

    result, err := json.ParseAny(string(data))
    if err != nil {
        return nil, err
    }

    cache.Store(key, result)
    return result, nil
}
```

### 缓存路径查询

```go
// 预编译常用路径（使用 Processor）
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## 基准测试

### 性能测试示例

```go
func BenchmarkParse(b *testing.B) {
    data := []byte(`{"name": "test", "items": [1, 2, 3]}`)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.ParseAny(string(data))
    }
}

func BenchmarkGetString(b *testing.B) {
    data := `{"user": {"name": "CyberGo", "email": "test@example.com"}}`

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        json.GetString(data, "user.name")
    }
}
```

### 内存分析

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // 执行操作
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("内存使用: %d bytes\n", after-before)
}
```

## 性能对比

| 操作 | 小数据 (<1KB) | 中等数据 (1MB) | 大数据 (>10MB) |
|------|---------------|----------------|----------------|
| `Parse` | 推荐 | 推荐 | 不推荐 |
| `ForeachFile` | 不必要 | 可选 | 推荐 |

## 相关

- [大文件处理 API](../api-reference/large-file)
- [错误处理](./error-handling)
- [大文件处理](../large-files)
