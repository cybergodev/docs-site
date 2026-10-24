---
sidebar_label: "速查表"
title: "速查表 - CyberGo html | API 一页速查"
description: "CyberGo html 常用 API 一页速查：Extract、ExtractText、ExtractToMarkdown 等包级函数，Processor 方法与生命周期，四种 Config 预设与常用配置项，编码检测、媒体提取、审计 Sink 与 errors.Is 错误判断写法。"
sidebar_position: 20
---

# 速查表

常用 API 一览；完整签名与参数说明见 [API 参考](../api-reference/)。

## 包函数

### 提取内容

```go
// 从字节提取完整结果
result, err := html.Extract(data)

// 从文件提取
result, err := html.ExtractFromFile("page.html")

// 仅提取文本
text, err := html.ExtractText(data)
text, err = html.ExtractTextFromFile("page.html")
```

### 输出格式

```go
md, err := html.ExtractToMarkdown(data)
jsonBytes, err := html.ExtractToJSON(data)
```

### 链接提取

```go
links, err := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)
```

### 批量处理

```go
batch := html.ExtractBatch(pages)
// 或
batch := html.ExtractBatchFiles(paths)
```

### 带上下文版本

提取类函数都有 `*WithContext` 变体（`GroupLinksByType` 是纯内存分组工具，没有该变体）：

```go
result, err := html.ExtractWithContext(ctx, data)
result, err = html.ExtractFromFileWithContext(ctx, path)
text, err := html.ExtractTextWithContext(ctx, data)
md, err := html.ExtractToMarkdownWithContext(ctx, data)
links, err := html.ExtractAllLinksWithContext(ctx, data)
batch := html.ExtractBatchWithContext(ctx, pages)
```

## Processor

```go
// 创建
p, err := html.New(html.DefaultConfig())
defer p.Close()

// 提取
result, err := p.Extract(data)
result, err = p.ExtractFromFile(path)
text, err := p.ExtractText(data)

// 输出
md, err := p.ExtractToMarkdown(data)
jsonBytes, err := p.ExtractToJSON(data)

// 链接
links, err := p.ExtractAllLinks(data)

// 批量
batch := p.ExtractBatch(pages)

// 统计
stats := p.GetStatistics()
p.ClearCache()
p.ResetStatistics()

// 审计
entries := p.GetAuditLog()
p.ClearAuditLog()
```

## 配置预设

```go
html.DefaultConfig()       // 默认配置
html.TextOnlyConfig()      // 图片、链接、视频、音频均不保留
html.MarkdownConfig()      // 内联图片与链接输出为 Markdown
html.HighSecurityConfig()  // 收紧限制并启用完整审计
```

## 常用配置项

```go
cfg := html.DefaultConfig()

// 资源限制
cfg.MaxInputSize = 10 * 1024 * 1024  // 最大输入 10MB
cfg.ProcessingTimeout = time.Minute   // 处理超时
cfg.MaxDepth = 200                    // 最大 DOM 深度

// 内容控制
cfg.ExtractArticle = true             // 文章识别
cfg.PreserveImages = true             // 保留图片
cfg.PreserveLinks = true              // 保留链接
cfg.PreserveVideos = false            // 不保留视频
cfg.PreserveAudios = false            // 不保留音频

// 输出格式
cfg.InlineImageFormat = "markdown"    // none/markdown/html/placeholder
cfg.InlineLinkFormat = "markdown"     // none/markdown/html
cfg.TableFormat = "markdown"          // markdown/html

// 链接过滤
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// 缓存
cfg.MaxCacheEntries = 1000
cfg.CacheTTL = 30 * time.Minute
```

## 错误处理

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 输入过大
    case errors.Is(err, html.ErrInvalidHTML):
        // 无效 HTML
    case errors.Is(err, html.ErrProcessingTimeout):
        // 库内 ProcessingTimeout 到期
    case errors.Is(err, html.ErrFileNotFound):
        // 文件未找到
    case errors.Is(err, html.ErrInvalidConfig):
        // 配置无效
    case errors.Is(err, html.ErrProcessorClosed):
        // 处理器已关闭
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // DOM 深度超限
    case errors.Is(err, html.ErrInvalidFilePath):
        // 文件路径无效
    default:
        // 其他错误
    }
}
```

用户 ctx 到期返回 `context.DeadlineExceeded`，手动 `cancel()` 返回 `context.Canceled`，两者都不归一化为 `ErrProcessingTimeout`。

## 编码检测

```go
// 自动检测（默认行为，支持 15+ 编码）
result, err := html.Extract(pageData)

// 手动指定编码
cfg := html.DefaultConfig()
cfg.Encoding = "shift_jis"
```

支持 UTF-8、GBK、Shift_JIS、EUC-JP、Windows-1252 等 15+ 编码。没有 `<meta charset>` 声明的旧页面会按 windows-1252 兜底解码，因此已知来源编码时应显式指定。

## 媒体提取

```go
result, err := html.Extract(data)

// 视频
for _, v := range result.Videos {
    fmt.Println(v.URL, v.Type)
}

// 音频
for _, a := range result.Audios {
    fmt.Println(a.URL, a.Type)
}

// 只关闭媒体（图片与链接照常保留）
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
```

## 审计系统

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// 使用自定义 Sink
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// 处理后获取审计日志
entries := p.GetAuditLog()
```

### 审计 Sink 速查

```go
// 内置 Sink 构造函数
html.NewLoggerAuditSink()                   // stderr，[AUDIT] 前缀
html.NewLoggerAuditSinkWithWriter(w)        // 自定义 Writer
html.NewWriterAuditSink(w)                  // JSON Lines 写入 io.Writer
html.NewChannelAuditSink(bufSize)           // 带缓冲 channel
html.NewMultiSink(sinks...)                 // 扇出到多个 Sink
html.NewFilteredSink(sink, filterFunc)      // 谓词过滤
html.NewLevelFilteredSink(sink, minLevel)   // 按级别过滤

// Channel Sink 辅助方法
sink.Channel()       // <-chan AuditEntry，消费事件
sink.DroppedCount()  // int64，被丢弃的事件数
sink.Close()         // 幂等关闭 channel
```

### Processor 生命周期

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()               // 释放资源（幂等）

stats := p.GetStatistics()    // Statistics{TotalProcessed, CacheHits, ...}
entries := p.GetAuditLog()    // []AuditEntry
p.ClearAuditLog()             // 清空内存审计日志
p.ClearCache()                // 清空缓存（保留统计）
p.ResetStatistics()           // 重置统计计数器（保留缓存）
```

## 下一步

- [内容提取](../guides/core-features/content-extraction) - 提取流程与文章识别
- [Processor 复用与缓存](../guides/performance/processor-cache) - 生命周期与缓存调优
- [API 参考](../api-reference/) - 完整 API 文档
