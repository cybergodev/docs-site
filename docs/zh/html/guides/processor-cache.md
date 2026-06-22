---
title: "Processor 复用与缓存 - CyberGo HTML | 高性能复用指南"
description: "CyberGo HTML Processor 复用与缓存：包函数与实例区别、sync.Pool 机制、缓存策略（TTL、容量、清理）、命中率监控与 Web 服务单例实践。"
---

# Processor 复用与缓存

本指南解释包级函数与 Processor 实例的区别，帮助你在不同场景下做出正确选择并获得最佳性能。

## 两种调用模式

### 包级函数（一次性调用）

```go
result, err := html.Extract(data)
```

底层使用 `sync.Pool` 管理临时 Processor，每次调用从池中取出、用完归还。

**适用场景**：低频调用（如 CLI 工具、一次性脚本）

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
    result, _ := p.Extract(page)
}
```

创建一个独立的 Processor 实例，手动管理生命周期。

**适用场景**：高频调用（如 Web 服务、爬虫）

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
| CLI 工具、单次处理 | 包级函数 | 简单直接，无需管理 |
| Web 服务、API 后端 | Processor 实例 | 缓存加速，统计监控 |
| 批量爬虫 | Processor 实例 | 缓存去重，资源可控 |
| 测试代码 | 包级函数 | 无状态，测试隔离 |

## 缓存机制

Processor 实例内置了基于内容的缓存。相同 HTML 输入不会重复处理。

### 缓存配置

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 2000     // 最大缓存条目数（0=禁用）
cfg.CacheTTL = time.Hour       // 缓存有效期
cfg.CacheCleanup = 5 * time.Minute // 后台清理间隔
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MaxCacheEntries` | 2000 | 缓存容量上限，设为 0 禁用缓存 |
| `CacheTTL` | 1 小时 | 条目过期时间 |
| `CacheCleanup` | 5 分钟 | 后台清理过期条目的间隔 |

### 缓存 Key 生成

缓存 Key 基于编码转换后的 UTF-8 内容生成：
- 小于 64KB 的内容：对完整内容计算哈希
- 大于 64KB 的内容：使用 5 点采样算法（头部 + 尾部 + 均匀采样）

相同 HTML 内容在重复调用时直接命中缓存，跳过解析和提取步骤。

## 监控缓存命中率

```go
p, _ := html.New()
defer p.Close()

// 处理一批页面
for _, page := range pages {
    p.Extract(page)
}

// 获取统计
stats := p.GetStatistics()
fmt.Printf("总处理: %d\n", stats.TotalProcessed)
fmt.Printf("缓存命中: %d\n", stats.CacheHits)
fmt.Printf("缓存未命中: %d\n", stats.CacheMisses)

hitRate := float64(stats.CacheHits) / float64(stats.TotalProcessed) * 100
fmt.Printf("命中率: %.1f%%\n", hitRate)
```

## 推荐模式

### Web 服务单例

在 Web 服务中，推荐使用单例 Processor：

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
fmt.Printf("成功: %d, 失败: %d\n", batch.Success, batch.Failed)
```

### 定期维护

长期运行的 Processor 需要定期维护：

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
        log.Printf("处理 %d 次, 错误 %d 次",
            stats.TotalProcessed, stats.ErrorCount)
        p.ResetStatistics()
    }
}()
```

## 性能对比

相同 HTML 重复处理 1000 次（仅供参考）：

| 模式 | 首次处理 | 缓存命中 |
|------|----------|----------|
| 包级函数 | 基准 | 无缓存 |
| Processor（无缓存） | ≈基准 | ≈基准 |
| Processor（有缓存） | ≈基准 | ≈基准的 1/10 |

:::tip 缓存生效条件
缓存仅在 Processor 实例上生效。包级函数每次调用使用不同的 Processor 实例，无法利用缓存。
:::

## 常见误区

| 误区 | 正确做法 |
|------|----------|
| 每次调用 `html.New()` 创建 Processor | 复用同一个实例 |
| 忘记调用 `p.Close()` | 使用 `defer p.Close()` |
| 对包级函数抱有缓存预期 | 缓存仅在 Processor 实例上生效 |
| 关闭后继续使用 Processor | 检查 `ErrProcessorClosed` 错误 |

## 下一步

- [性能优化](../advanced/performance) - 更多性能调优技巧
- [API 参考：Processor](../api-reference/processor) - 完整方法列表
- [API 参考：配置](../api-reference/config) - 缓存配置详解
