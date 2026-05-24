---
title: "Processor - HTML"
description: "CyberGo HTML 库 Processor 处理器完整 API 参考，包括 New 创建、Extract 提取方法族、GetStatistics 统计查询、GetAuditLog 审计日志、ClearCache 缓存管理、ResetStatistics 重置和 Close 生命周期管理，适合高频调用场景复用资源，是生产环境高性能处理的核心组件。"
---

# Processor

`Processor` 是 HTML 库的核心处理引擎。相比包函数，Processor 复用内部资源（缓存、编码检测器），适合高频调用场景。

## 创建

### New

创建 Processor 实例，可选传入配置。

```go
func New(cfg ...Config) (*Processor, error)
```

**参数**：最多一个 `Config`，未提供时使用 `DefaultConfig()`。

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## 内容提取

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

从 HTML 字节提取内容，自动检测编码。

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

从文件提取内容。

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

仅返回纯文本。

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

从文件提取纯文本。

## 上下文版本

所有提取方法都有带 `WithContext` 的版本：

```go
func (p *Processor) ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
func (p *Processor) ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)
func (p *Processor) ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

## 输出格式

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
```

带上下文版本：

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

## 链接提取

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## 批量处理

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## 统计与缓存

### GetStatistics

返回当前处理统计信息。

```go
func (p *Processor) GetStatistics() Statistics
```

```go
stats := p.GetStatistics()
fmt.Printf("已处理: %d, 缓存命中: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

清空缓存，保留累计统计。

```go
func (p *Processor) ClearCache()
```

### ResetStatistics

重置所有统计计数器。

```go
func (p *Processor) ResetStatistics()
```

## 审计

### GetAuditLog

获取审计日志条目。

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

清空审计日志。

```go
func (p *Processor) ClearAuditLog()
```

## 生命周期

### Close

释放 Processor 持有的资源。使用完毕后必须调用。

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... 使用 p 进行提取
```
