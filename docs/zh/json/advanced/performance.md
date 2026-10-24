---
sidebar_label: "性能优化"
title: "性能优化 - CyberGo JSON | 基准测试与零分配"
description: "CyberGo JSON 性能优化：CompilePath 预编译路径、PreParse 预解析、对象池与 ParallelThreshold 并行阈值。"
sidebar_position: 20
---

# 性能优化

JSON 处理的性能由处理器复用、路径预编译、预解析与并行度四个维度决定。本页给出各机制的适用信号、基准测试写法与配置文件。

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

## 库内建性能机制

了解库自身做了哪些优化，避免重复造轮子：

| 机制 | 作用 | 你需要做的 |
|------|------|------------|
| 快速路径检测 | 单键属性访问（如 `name`，路径仅含字母/数字/下划线）经查找表识别，缓存关闭时直达根对象取值、绕过递归处理器 | 无——自动生效；缓存开启（默认）时同类访问由解析/结果缓存加速 |
| FastEncoder | 简单类型（map/slice/基础值）编码免反射 | 无——自动生效 |
| 结果缓存 | 相同 (JSON, 路径) 的重复查询命中缓存 | 默认开启；调 `CacheTTL`/`MaxCacheSize` 控制规模 |
| 对象池 | `IterableValue`、编码缓冲、Config 等复用，减少 GC 压力 | `parsed.Release()` / `cp.Release()` 归还 |
| 编译路径缓存 | 常用路径的解析结果全局缓存 | 高频路径用 [`CompilePath`](../api-reference/processor/query#compilepath) |

::: tip CacheSharedResults：读多写少场景的零拷贝开关
`Config.CacheSharedResults = true` 时，缓存命中的 `Get` 直接返回共享值，**跳过防御性深拷贝**——重复读取大型子树时省去每次的拷贝分配。契约是**调用方不得修改**返回的 `map[string]any`/`[]any`（原始值始终安全）。默认关闭（读时拷贝），按负载特征显式开启。
:::

## 优化决策路径

遇到性能问题时按固定顺序推进，每一步都**以测量结果**决定是否进入下一步：

| 步骤 | 手段 | 适用信号 |
|------|------|----------|
| ① 先测量 | 基准测试 + 内存分析（见下文），`GetStats()` 看缓存命中率 | 任何优化之前——没有数据就没有优化方向 |
| ② 复用 | 包级函数或共享 `Processor` 实例（复用缓存与对象池） | 每请求 `json.New()`、频繁重建处理器 |
| ③ 预编译路径 | [`CompilePath`](../api-reference/processor/query#compilepath) + `GetCompiled` | **同一路径**查询大量不同 JSON（路径解析成为重复开销） |
| ④ 预解析 | [`PreParse`](../api-reference/processor/query#preparse) + `GetFromParsed` | **同一份 JSON** 连续查询多个路径（重复解析成为热点） |
| ⑤ 并行 | `NewParallelIterator` / `StreamJSONLParallel`（见[并发处理](./concurrency)） | CPU 密集批处理；行数多且单行处理重 |

::: tip 先测量再优化
默认配置（缓存开启 + 对象池 + 快速路径）已覆盖多数场景。先用基准测试定位热点、确认瓶颈归属，再动用 ③④⑤ 的显式优化——它们都以牺牲一定灵活性换取速度。小数组（低于 `ParallelThreshold` 默认 10）并行反而更慢。
:::

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

### 优先使用内建 ParallelIterator

库自带并行迭代器，免去手写信号量与 goroutine 池，自动分批并支持取消：

```go
items, _ := json.GetArray(data, "items")
it := json.NewParallelIterator(items)
defer it.Close()

// 并行映射
doubled, err := it.Map(func(i int, v any) (any, error) {
    return processItem(v), nil
})

// 或并行遍历 / 过滤（WithContext 版本可响应取消）
_ = it.ForEach(func(i int, v any) error { return nil })
_ = it.ForEachWithContext(ctx, func(i int, v any) error { return nil })
filtered := it.Filter(func(i int, v any) bool { return v != nil })
```

### 需要完全控制时：手写 Worker Pool

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

::: tip 并行阈值
`Config.ParallelThreshold`（默认 10）控制库内部并行路径的触发下限；JSONL 并行处理的 worker 数由 `StreamJSONLParallel(reader, workers, ...)` 的参数决定，`Config.JSONLWorkers` 当前不被读取。详见[并发处理](./concurrency)。
:::

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

### 优化手段 A/B 对比

验证优化是否有效，最可靠的方式是把「优化前 / 优化后」写成一对基准测试对比运行。`b.ReportAllocs()` 让 `B/op` 与 `allocs/op` 一并输出，用 `go test -bench=. -benchmem` 运行：

```go
// 基线：重复 Get（每次独立走缓存键查找 + 导航）
func BenchmarkRepeatGet(b *testing.B) {
    data := `{"user": {"name": "CyberGo"}, "items": [1, 2, 3]}`
    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.Get(data, "user.name")
        _, _ = json.Get(data, "items")
    }
}

// 候选优化：PreParse 一次解析，GetFromParsed 多次查询
func BenchmarkPreParse(b *testing.B) {
    data := `{"user": {"name": "CyberGo"}, "items": [1, 2, 3]}`
    p, err := json.New()
    if err != nil {
        b.Fatal(err)
    }
    defer p.Close()

    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        parsed, err := p.PreParse(data)
        if err != nil {
            b.Fatal(err)
        }
        _, _ = p.GetFromParsed(parsed, "user.name")
        _, _ = p.GetFromParsed(parsed, "items")
        parsed.Release()
    }
}
```

::: tip 解读结果
对比两条基准的 `ns/op` 与 `allocs/op`：若预解析基准明显更低，说明该热点的开销主要在重复解析/缓存键查找上，预解析值得引入；若差距可忽略，则按[优化决策路径](#优化决策路径)继续排查下一层（如编码、锁竞争）。
:::

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

    fmt.Printf("内存使用：%d bytes\n", after-before)
}
```

## 如何自行基准测试

性能结论依赖数据形状与硬件，这里不罗列具体数字；需要数字时请在自己的负载上实测。

库源码自带的 `benchmark_test.go` 覆盖两类场景：与 `encoding/json` 的热路径对照（快速编码器、路径 `Get`、数组切片、字段提取），以及 `StreamIterator` 流式迭代、`PreParse` 预解析、并发 `Get`/`Set`/`Marshal`：

```bash
# 在库源码根目录运行完整基准套件（含分配统计）
go test -run='^$' -bench=. -benchmem ./...
```

- `-benchmem` 输出每次操作的分配字节数与次数（`B/op`、`allocs/op`），与 `ns/op` 一起作为选型依据；
- 对照组以 `BenchmarkStdLib_*` / `BenchmarkComparison_*` 命名，可与 `BenchmarkFastEncoder_*` 等同场景基准直接比较；
- 按数据规模选择 API（如 `ForeachFile` 适用于 10–100MB 的整载场景，更大文件改用 `StreamIterator`）见[大文件选择指南](../streaming/large-files#选择指南)。

## 相关

- [大文件处理](../streaming/large-files)
- [错误处理](./error-handling)
