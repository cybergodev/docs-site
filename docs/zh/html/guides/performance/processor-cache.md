---
sidebar_label: "Processor 复用与缓存"
title: "Processor 复用与缓存 - CyberGo html | 复用指南"
description: "CyberGo html 的 Processor 复用与缓存：包级函数与常驻实例的区别、sync.Pool 复用机制、缓存 Key 的构成与命中条件、缓存参数配置、GetStatistics 命中率监控，以及长期运行实例的定期维护与常见误用。"
sidebar_position: 10
---

# Processor 复用与缓存

CyberGo html 是一个 Go 语言 HTML 内容提取与清洗库，提供包级函数与常驻 `Processor` 实例两种调用方式。两者的差别在生命周期与缓存。下面依次说明选择依据、缓存 Key 的构成、命中率监控与长期运行实例的维护。

## 两种调用模式

### 包级函数（一次性调用）

```go
result, err := html.Extract(data)
```

底层用 `sync.Pool` 管理临时 Processor，每次调用从池中取出、用完归还。

**适用场景**：低频调用（CLI 工具、一次性脚本）

**生命周期**：

```text
调用 Extract()
  → 从 sync.Pool 获取 Processor（或新建）
  → 执行提取
  → 归还到 sync.Pool
```

### Processor 实例（复用模式）

```go
p, _ := html.New()
defer p.Close()

for _, page := range pages {
    if _, err := p.Extract(page); err != nil {
        log.Fatal(err)
    }
}
```

创建一个独立的 Processor 实例，手动管理生命周期。

**适用场景**：高频调用（Web 服务、爬虫）

**生命周期**：

```text
html.New()
  → 创建 Processor（缓存、审计、统计）
  → 循环调用 p.Extract()（复用缓存）
  → defer p.Close()
```

## 如何选择

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| CLI 工具、单次处理 | 包级函数 | 无需管理生命周期 |
| Web 服务、API 后端 | Processor 实例 | 缓存加速，统计可观测 |
| 批量爬虫 | Processor 实例 | 缓存去重，资源可控 |
| 测试代码 | 包级函数 | 无状态，测试之间互不影响 |

## 缓存机制

Processor 实例内置按输入字节做键的结果缓存。**命中条件是相同的原始字节 + 相同的配置**，而不是「语义相同的 HTML」：两份文档只差一个空格或一个属性顺序，字节就不同，也不会互相命中。

### 缓存配置

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000         // 最大缓存条目数（0=禁用）
cfg.CacheTTL = time.Hour           // 缓存有效期
cfg.CacheCleanup = 5 * time.Minute // 后台清理间隔
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MaxCacheEntries` | 2000 | 缓存容量上限，设为 0 禁用缓存 |
| `CacheTTL` | 1 小时 | 条目过期时间 |
| `CacheCleanup` | 5 分钟 | 后台清理过期条目的间隔；为 0 时不启动清理 goroutine |

`CacheTTL` 与 `CacheCleanup` 都大于 0 时，`New` 才会启动后台清理 goroutine。

### 缓存 Key 生成

缓存 Key 是一个 `[16]byte` 值，直接用作 `map` 键，生成过程不产生堆分配。计算输入分两部分：

- **完整原始输入字节**：用 `hash/maphash` 对全部字节做哈希。amd64 上走 AES-NI，种子在进程启动时随机生成。因为是全量哈希，文档任意位置的字节改动都会改变 Key。
- **配置项**：5 个布尔开关（`ExtractArticle`、`PreserveImages`、`PreserveLinks`、`PreserveVideos`、`PreserveAudios`）打包成 1 字节，随后混入三个格式串（`InlineImageFormat`、`InlineLinkFormat`、`TableFormat`）和 `Encoding`。

maphash 输出 64 位，经 splitmix64 扩散得到第二个 64 位，拼成 128 位 Key。Key 的宽度是 128 位，有效碰撞强度约为 64 位：splitmix64 只分离输出空间，不增加熵。

由此得到几条结论：

- 相同的原始字节 + 相同的配置，重复调用直接命中，跳过编码检测、解析与提取；
- 同一文档以不同编码存储（字节不同），或以不同 `Encoding` 配置处理，Key 不同，无法互相命中；
- `ExtractArticle` 或 `Preserve*` 开关、格式串不同，同样不命中；
- 全零 Key（`[16]byte{}`）被缓存视为「无 Key」，对应输入每次都 miss。这种情况的概率是 2^-128。

## 监控缓存命中率

```go
p, _ := html.New()
defer p.Close()

// 处理一批页面
for _, page := range pages {
    if _, err := p.Extract(page); err != nil {
        log.Fatal(err)
    }
}

// 获取统计
stats := p.GetStatistics()
fmt.Printf("总处理：%d\n", stats.TotalProcessed)
fmt.Printf("缓存命中：%d\n", stats.CacheHits)
fmt.Printf("缓存未命中：%d\n", stats.CacheMisses)

if stats.TotalProcessed > 0 {
    hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
    fmt.Printf("命中率：%.1f%%\n", hitRate)
}
```

`TotalProcessed` 统计的是成功完成的提取（含缓存命中），失败的调用不计入其中。

## 推荐模式

### Web 服务单例

Web 服务把 Processor 实例存放在包级变量中，在 `init` 里创建：

```go
var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
    data, _ := io.ReadAll(r.Body)
    result, err := processor.Extract(data)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(result)
}
```

### 爬虫批量处理

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := crawlURLs()
pages := fetchPages(urls) // [][]byte

batch := p.ExtractBatch(pages)
fmt.Printf("成功：%d, 失败：%d\n", batch.Success, batch.Failed)
```

### 定期维护

长期运行的 Processor 需要定期清理：

```go
// 定期清理缓存（防止内存增长）
go func() {
    ticker := time.NewTicker(10 * time.Minute)
    for range ticker.C {
        p.ClearCache()
    }
}()

// 定期重置统计（保留缓存）
go func() {
    ticker := time.NewTicker(time.Hour)
    for range ticker.C {
        stats := p.GetStatistics()
        log.Printf("处理 %d 次，错误 %d 次",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## 两种模式的开销差异

| 模式 | 首次处理 | 重复输入 |
|------|----------|----------|
| 包级函数 | 完整提取 | 完整提取（无缓存） |
| Processor（`MaxCacheEntries = 0`） | 完整提取 | 完整提取 |
| Processor（启用缓存） | 完整提取 | 计算 Key + 查表命中 + `cloneResult` 深拷贝，跳过编码检测、解析与提取 |

:::tip 缓存生效范围
缓存只在 `Processor` 实例上生效。包级函数虽然经 `sync.Pool` 复用 Processor，但池化配置把 `MaxCacheEntries`、`CacheTTL`、`CacheCleanup` 全设为 0，且每次归还时清空缓存，因此没有缓存收益。传入自定义 Config 的包级调用也一样：库会创建一次性 Processor，并把缓存字段强制置零。
:::

## 常见误用

| 误用 | 正确做法 |
|------|----------|
| 每次调用都 `html.New()` | 复用同一个实例 |
| 忘记调用 `p.Close()` | 使用 `defer p.Close()` |
| 对包级函数抱有缓存预期 | 缓存只在 `Processor` 实例上生效 |
| 关闭后继续使用 Processor | 检查 `ErrProcessorClosed` 错误 |
| 对语义相同但字节不同的输入期待命中 | 命中要求原始字节与配置都相同 |

## 下一步

- [性能优化](./performance) - 内部优化机制与超时、并发调优
- [批量处理实战](./batch-processing) - 并发批量提取
- [API 参考：Processor](../../api-reference/core/processor) - 完整方法列表
- [API 参考：配置](../../api-reference/core/config) - 缓存配置详解
