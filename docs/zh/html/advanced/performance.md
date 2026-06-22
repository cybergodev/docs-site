---
title: "性能优化 - CyberGo HTML | 吞吐量提升指南"
description: "CyberGo HTML 性能优化：Processor 实例复用、缓存策略、批量并发控制、输入大小与超时设置等技巧，提升大规模处理吞吐量。"
---

# 性能优化

## Processor 复用

高频调用场景应使用 Processor 实例而非包函数：

```go
// 推荐：复用 Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()

for _, page := range pages {
    result, _ := p.Extract(page)
    // 缓存、编码检测器等资源被复用
}

// 不推荐：每次创建新 Processor
for _, page := range pages {
    result, _ := html.Extract(page) // 每次都通过 Pool 获取
}
```

## 缓存策略

Processor 内置缓存，相同输入不会重复处理：

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 5000     // 增大缓存
cfg.CacheTTL = 10 * time.Minute // 根据场景调整
cfg.CacheCleanup = time.Minute   // 更频繁清理
```

监控缓存命中率：

```go
stats := p.GetStatistics()
hitRate := float64(stats.CacheHits) / float64(stats.CacheHits+stats.CacheMisses)
fmt.Printf("缓存命中率: %.2f%%\n", hitRate*100)
```

## 批量处理

批量处理自动并发执行，优于逐个处理：

```go
// 推荐：批量处理
batch := p.ExtractBatch(pages)

// 不推荐：循环逐个处理
for _, page := range pages {
    p.Extract(page) // 串行
}
```

配置工作池大小以匹配 CPU 核心数：

```go
cfg.WorkerPoolSize = runtime.NumCPU()
```

## 输入控制

- 减小 `MaxInputSize` 避免处理过大文档
- 使用 `TextOnlyConfig()` 跳过不需要的媒体提取
- 关闭不需要的 `Preserve*` 选项

```go
// TextOnlyConfig 已禁用所有媒体保留，无需额外设置
cfg := html.TextOnlyConfig()

// 可进一步关闭文章识别以提高性能
cfg.ExtractArticle = false
```

## 超时设置

合理设置超时防止慢请求阻塞：

```go
cfg.ProcessingTimeout = 10 * time.Second
```
