---
title: "常见问题 - CyberGo HTML | 高频问题解答"
description: "CyberGo HTML 常见问题解答：包函数与 Processor 选择、编码检测、输入限制、批量上限、空文本排查、统计监控、审计与自定义评分器。"
---

# 常见问题

## 包函数和 Processor 有什么区别？

**包函数**（如 `html.Extract`）内部使用 `sync.Pool` 复用 Processor，适合低频、一次性调用。每次调用后 Processor 归还到池中。

**Processor**（如 `p := html.New()`）适合高频调用，复用缓存和内部资源。还支持统计收集和审计日志。

```go
// 低频：包函数
result, _ := html.Extract(data)

// 高频：Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## 如何处理编码问题？

HTML 库自动检测 15+ 种编码（UTF-8、GBK、Shift_JIS、Windows-1252 等），通常不需要手动指定。

如需强制指定编码：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## 输入大小限制是多少？

默认最大 50MB（`DefaultMaxInputSize = 52428800`）。可通过配置调整：

```go
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB
```

## 如何获取 Markdown 格式的输出？

```go
md, err := html.ExtractToMarkdown(data)
```

或使用 Processor：

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## 批量处理最多支持多少条？

单次批量最多 10000 个项目。更大的数据集请分批处理。

## 为什么提取的文本为空？

可能的原因：

1. **HTML 结构问题** - 内容在 `<script>` 或 `<style>` 标签中
2. **清洗后内容为空** - 若正文仅存在于被清洗移除的标签（如 `<iframe>`、`<object>`）中，结果可能为空；可对可信输入临时设置 `EnableSanitization = false` 排查
3. **输入为空** - 检查输入字节数组是否为空（空白内容会返回空 `Result`）
4. **文章识别** - 尝试关闭 `ExtractArticle` 看是否能提取

:::tip 注意区分错误与空结果
DOM 嵌套超过 `MaxDepth` 不会产生空文本，而是返回 `ErrMaxDepthExceeded` 错误。若调用返回了 `error`，请优先用 `errors.Is` 判断错误类型，而非检查文本是否为空。
:::

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // 关闭文章识别
```

## 如何监控处理统计？

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// 处理一些内容后
stats := p.GetStatistics()
fmt.Printf("已处理: %d\n", stats.TotalProcessed)
fmt.Printf("缓存命中: %d\n", stats.CacheHits)
fmt.Printf("平均耗时: %v\n", stats.AverageProcessTime)
fmt.Printf("错误数: %d\n", stats.ErrorCount)
```

## 如何启用审计？

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

详见 [审计系统](./api-reference/audit)。

## 文件路径安全吗？

`FileError` 会自动截断完整路径，防止在错误消息中泄露服务器路径：

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // 仅文件名，非完整路径
}
```

## 如何实现自定义内容评分？

实现 `Scorer` 接口：

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // 自定义评分逻辑
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // 自定义移除逻辑
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

详见 [接口定义](./api-reference/interfaces)。
