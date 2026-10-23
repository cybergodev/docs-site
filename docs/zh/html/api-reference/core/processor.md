---
sidebar_label: "Processor"
title: "Processor - CyberGo html | 用法、参数与示例"
description: "CyberGo html Processor 处理器 API 参考：New 构造、Extract 方法族、ExtractText 等文本提取、输出格式与批量处理方法、GetStatistics 统计、ClearCache 清理、GetAuditLog 审计查询及 Close 生命周期管理详解，实例复用缓存与编码检测器、并发安全共享，适合高频调用场景。"
sidebar_position: 20
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

**内部初始化**：

`New` 并非简单赋值，它执行以下步骤保证返回的 Processor 立即可用：

1. **校验配置**：调用 `Config.Validate()`，无效配置返回 `*ConfigError`（`errors.Is(err, ErrInvalidConfig)` 为真）。校验范围包括数值边界（`MaxInputSize`、`WorkerPoolSize`、`MaxDepth` 必须为正，`MaxCacheEntries` 不能为负——`0` 合法，表示禁用缓存，均不得超上限）与格式字符串（`InlineImageFormat`/`InlineLinkFormat`/`TableFormat` 取值合法）。
2. **设置 Scorer**：配置了自定义 `Scorer` 时适配到内部接口（适配过程由库自动完成）；否则使用内置默认评分器（内部实现，不导出；只读、并发安全）。
3. **预计算格式串**：把 `InlineImageFormat`/`InlineLinkFormat` 归一化（小写 + 去空格，空串映射为 `"none"`）并缓存到 `imageFormat`/`linkFormat` 字段，避免热路径中反复 `strings.ToLower`。
4. **启动缓存清理**：仅当 `CacheTTL>0` **且** `CacheCleanup>0` 时才启动后台清理 goroutine；两者任一为 0 都不会启动。

## 并发安全性

:::tip 并发使用
`Processor` 可安全地在多个 goroutine 间共享，无需额外加锁。并发保证来自：

- **配置不可变**：`config` 在 `New()` 后不可变（`*Config` 指针永不被重新赋值或修改），因此 `ExtractToMarkdown` 等格式方法可以安全地做值拷贝生成临时 Processor，无需任何锁——格式覆盖不会回写到共享配置。
- **统计计数器**：`TotalProcessed`/`CacheHits`/`CacheMisses`/`ErrorCount`/`totalProcessTime` 全部使用 `atomic` 操作。
- **缓存**：内部缓存自带锁，读写安全。缓存行为完全由公开 API 观测与控制：`Config.MaxCacheEntries = 0` 禁用缓存、`ClearCache()` 清空、`Statistics.CacheHits`/`CacheMisses` 观测命中情况。
- **Scorer**：内置默认评分器（内部实现，不导出）只读。**自定义 `Scorer` 必须自行保证并发安全**（如内部持锁），因为单个 Processor 在并发 `Extract` 时会从多个 goroutine 调用其 `Score`（`ShouldRemove` 为接口预留方法，当前版本不被库调用）。
:::

## 方法总览

`Processor` 共 30 个导出方法，按功能分组如下（签名与行为详解见后续小节）：

| 分组 | 方法 | 说明 |
|------|------|------|
| 内容提取 | `Processor.Extract` | 从 HTML 字节提取完整 `Result` |
| 内容提取 | `Processor.ExtractWithContext` | 同上，支持 context 取消 |
| 内容提取 | `Processor.ExtractFromFile` | 从 HTML 文件提取 |
| 内容提取 | `Processor.ExtractFromFileWithContext` | 同上，支持 context 取消 |
| 文本提取 | `Processor.ExtractText` | 仅提取纯文本 |
| 文本提取 | `Processor.ExtractTextWithContext` | 同上，支持 context 取消 |
| 文本提取 | `Processor.ExtractTextFromFile` | 从文件提取纯文本 |
| 文本提取 | `Processor.ExtractTextFromFileWithContext` | 同上，支持 context 取消 |
| 输出格式 | `Processor.ExtractToMarkdown` | 输出 Markdown（临时 Processor，不走主缓存） |
| 输出格式 | `Processor.ExtractToMarkdownWithContext` | 同上，支持 context 取消 |
| 输出格式 | `Processor.ExtractToMarkdownFromFile` | 从文件输出 Markdown |
| 输出格式 | `Processor.ExtractToMarkdownFromFileWithContext` | 同上，支持 context 取消 |
| 输出格式 | `Processor.ExtractToJSON` | 输出 JSON（走主缓存） |
| 输出格式 | `Processor.ExtractToJSONWithContext` | 同上，支持 context 取消 |
| 输出格式 | `Processor.ExtractToJSONFromFile` | 从文件输出 JSON |
| 输出格式 | `Processor.ExtractToJSONFromFileWithContext` | 同上，支持 context 取消 |
| 链接提取 | `Processor.ExtractAllLinks` | 提取所有链接资源（不应用清洗） |
| 链接提取 | `Processor.ExtractAllLinksWithContext` | 同上，支持 context 取消 |
| 链接提取 | `Processor.ExtractAllLinksFromFile` | 从文件提取链接 |
| 链接提取 | `Processor.ExtractAllLinksFromFileWithContext` | 同上，支持 context 取消 |
| 批量处理 | `Processor.ExtractBatch` | 并发批量提取（字节切片输入） |
| 批量处理 | `Processor.ExtractBatchWithContext` | 同上，支持 context 取消 |
| 批量处理 | `Processor.ExtractBatchFiles` | 并发批量提取（文件路径输入） |
| 批量处理 | `Processor.ExtractBatchFilesWithContext` | 同上，支持 context 取消 |
| 统计与缓存 | `Processor.GetStatistics` | 返回 `Statistics` 处理统计 |
| 统计与缓存 | `Processor.ClearCache` | 清空缓存，保留累计统计 |
| 统计与缓存 | `Processor.ResetStatistics` | 重置所有统计计数器 |
| 审计 | `Processor.GetAuditLog` | 返回内存中的审计日志条目 |
| 审计 | `Processor.ClearAuditLog` | 清空审计日志 |
| 生命周期 | `Processor.Close` | 释放资源（幂等，关闭后所有方法返回 `ErrProcessorClosed`） |

## 内容提取

### 错误返回

`Extract` 方法族在处理各阶段会返回明确的哨兵错误，可用 `errors.Is` 精确判断：

| 错误 | 触发条件 | 备注 |
|------|----------|------|
| `ErrProcessorClosed` | `p` 为 `nil` 或已 `Close` | 所有方法共用 |
| `ErrInputTooLarge` | 输入字节数超过 `MaxInputSize` | 包裹在 `*InputError`，含实际/限制大小 |
| 编码检测错误 | 编码检测或 UTF-8 转换失败 | 原始错误被包裹 |
| `ErrInvalidHTML` | 字节无法解析为 HTML | 底层解析错误一并包裹 |
| `ErrMaxDepthExceeded` | 元素嵌套深度超过 `MaxDepth` | 迭代式校验，防栈溢出 |
| `ErrProcessingTimeout` | 处理耗时超过 `ProcessingTimeout` | `ProcessingTimeout=0` 表示不限时 |
| `ErrInternalPanic` | 内部意外 panic 被恢复 | 兜底保护，不应在正常使用中出现 |
| `ErrTooManyConcurrentOps` | 并发超时 watchdog 达全局上限（1000） | "太忙"状态，区别于 `ErrProcessingTimeout`（未发生超时） |

带 `context` 的版本：手动 `cancel()` → 返回 `context.Canceled`；用户 context 超时则取决于配置——已配置 `ProcessingTimeout` 时归一化为 `ErrProcessingTimeout`，未配置时透传 `context.DeadlineExceeded`（完整条件表见[常见问题](../../faq/#processingtimeout-和用户-context-超时有什么区别)）。

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

所有提取方法都有带 `ExtractWithContext` 的版本：

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

:::warning 缓存行为差异
两者在缓存处理上截然不同：

- **`ExtractToMarkdown`** 构建一个临时 Processor（拷贝不可变的 `config`，但 `MaxCacheEntries` 置零、审计禁用），**不读写主缓存**，因此不会污染或命中主 Processor 的缓存。Markdown 格式结果也不会被缓存。
- **`ExtractToJSON`** 直接调用 `p.Extract`，**走正常缓存路径**——会命中/写入主缓存，统计计数器也会随之更新。

若希望 Markdown 输出也享受缓存，可改用 `MarkdownConfig()` 创建专用 Processor 并调用 `Extract`，或自行缓存其输出。
:::

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

### 缓存行为详解

当 `MaxCacheEntries > 0` 时，`Extract` 启用缓存：

- **命中路径**：检测到缓存项后，`CacheHits` 与 `TotalProcessed` 各加 1，返回的是 `cloneResult`——对 `Images`/`Links`/`Videos`/`Audios` 等 slice 做 `copy` 的深拷贝。调用方修改返回值**不会**影响缓存中的条目，也避免并发命中读取时的数据竞争。
- **未命中路径**：处理完成后将结果写入缓存，再返回一份 `cloneResult`（同样深拷贝）。因此缓存条目与返回值互不别名。
- **禁用缓存**：`MaxCacheEntries = 0` 时，`Extract` 跳过缓存键生成与缓存读写（短路），无任何缓存开销。

### GetStatistics

返回当前处理统计信息。

```go
func (p *Processor) GetStatistics() Statistics
```

`Statistics` 各字段含义：

| 字段 | 说明 |
|------|------|
| `TotalProcessed` | 完成且无错误的提取次数，**包含缓存命中** |
| `CacheHits` | 由缓存直接命中的次数 |
| `CacheMisses` | 未命中、需完整处理的次数 |
| `ErrorCount` | 返回错误的提取次数 |
| `AverageProcessTime` | 每次提取的平均墙上时间（`TotalProcessed` 为 0 时为 0） |

```go
stats := p.GetStatistics()
fmt.Printf("已处理：%d, 缓存命中：%d\n",
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

:::tip 生命周期最佳实践
- **单例复用**：在长驻服务（HTTP handler、worker）中创建一个 Processor 并在并发请求间共享，配合缓存最大化收益。Processor 本身并发安全，无需每请求新建。
- **`defer Close()`**：在创建后立即 `defer p.Close()`，确保异常路径也释放后台清理 goroutine 与审计资源。`Close` 会停止缓存清理 goroutine、清空缓存、关闭审计 sink。
- **不要 Close 后使用**：`Close` 之后调用任何方法都会返回 `ErrProcessorClosed`。`Close` 通过原子 CAS 操作保证幂等（内部实现细节），重复调用安全但无意义。
:::
