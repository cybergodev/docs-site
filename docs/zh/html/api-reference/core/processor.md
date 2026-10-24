---
sidebar_label: "Processor"
title: "Processor - CyberGo html | 方法、并发与生命周期"
description: "CyberGo html Processor 参考：New 的初始化步骤、30 个导出方法的分组清单、错误返回与 context 超时语义、缓存命中与深拷贝行为、GetStatistics 统计字段含义与审计日志查询，以及 Close 生命周期与并发共享前提。"
sidebar_position: 20
---

# Processor

`Processor` 是 HTML 库的核心处理引擎。它复用内部资源（缓存、编码检测器），适合高频调用；一次性调用用[包函数](./functions)即可。

## 创建

### New

创建 `Processor` 实例，可选传入配置。

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

`New` 依次执行以下步骤：

1. **校验配置**：调用 `Config.Validate()`，无效配置返回 `*ConfigError`（`errors.Is(err, ErrInvalidConfig)` 为真）。校验数值边界与格式字符串：`MaxInputSize`、`WorkerPoolSize`、`MaxDepth` 必须为正；`MaxCacheEntries` 不能为负（`0` 合法，表示禁用缓存）；上述字段均不得超上限。
2. **预计算格式串**：把 `InlineImageFormat`/`InlineLinkFormat` 归一化（小写、去空格，空串映射为 `"none"`）并缓存到 `imageFormat`/`linkFormat` 字段，避免热路径反复 `strings.ToLower`。
3. **设置 Scorer**：配置了自定义 `Scorer` 时，库自动适配到内部接口；否则使用内置默认评分器（不导出，只读且并发安全）。
4. **启动缓存清理**：仅当 `CacheTTL>0` **且** `CacheCleanup>0` 时启动后台清理 goroutine；任一为 0 都不启动。

## 并发安全性

:::tip 并发共享的前提
`Processor` 可在多个 goroutine 间共享，无需额外加锁。依据有四条：

- **配置不可变**：`config` 在 `New()` 后不再改变，`ExtractToMarkdown` 等格式方法做值拷贝生成临时 Processor 时不需要锁，格式覆盖也不会写回共享配置。
- **统计计数器**：`TotalProcessed`/`CacheHits`/`CacheMisses`/`ErrorCount`/`totalProcessTime` 均使用 `atomic` 操作。
- **缓存**：内部缓存自带锁。缓存行为通过公开 API 观测与控制：`Config.MaxCacheEntries = 0` 禁用、`ClearCache()` 清空、`Statistics.CacheHits`/`CacheMisses` 观测命中。
- **Scorer**：内置默认评分器只读。**自定义 `Scorer` 必须自行保证并发安全**：单个 Processor 并发 `Extract` 时会从多个 goroutine 调用其 `Score`。`ShouldRemove` 是接口预留方法，当前版本不被库调用。
:::

## 方法总览

`Processor` 共 30 个导出方法，按功能分组如下（签名与行为见后续小节）：

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
| 生命周期 | `Processor.Close` | 释放资源（幂等）。关闭后带返回值的提取类方法返回 `ErrProcessorClosed` |

## 内容提取

### 错误返回

`Extract` 方法族在各处理阶段返回明确的哨兵错误，可用 `errors.Is` 精确判断：

| 错误 | 触发条件 | 备注 |
|------|----------|------|
| `ErrProcessorClosed` | `p` 为 `nil` 或已 `Close` | 提取、格式化、链接与批量方法共用 |
| `ErrInputTooLarge` | 输入字节数超过 `MaxInputSize` | 包裹在 `*InputError`，含实际/限制大小 |
| 编码检测错误 | 编码检测或 UTF-8 转换失败 | 原始错误被包裹 |
| `ErrInvalidHTML` | 字节无法解析为 HTML | 底层解析错误一并包裹 |
| `ErrMaxDepthExceeded` | 元素嵌套深度超过 `MaxDepth` | 迭代式校验，防栈溢出 |
| `ErrProcessingTimeout` | 库内处理超时到期 | `ProcessingTimeout=0` 表示不限时 |
| `ErrInternalPanic` | 内部意外 panic 被恢复 | 兜底保护，正常使用中不会出现 |
| `ErrTooManyConcurrentOps` | 并发超时 watchdog 达全局上限（1000） | "太忙"状态，未发生超时 |

带 `context` 的版本按以下规则返回错误：

| 场景 | 返回错误 |
|------|----------|
| 库内 `ProcessingTimeout` 到期（用户 ctx 仍有效） | `ErrProcessingTimeout` |
| 用户 ctx 的 deadline 先到期（或与库内超时同时到期） | `context.DeadlineExceeded`，原样透传，**不**归一化 |
| 用户主动 `cancel()` | `context.Canceled` |
| `ProcessingTimeout=0`（不限时）且用户 ctx 到期 | `context.DeadlineExceeded`（库不启动超时 goroutine） |

库内超时到期时，提取 goroutine 在下一个协作检查点退出。用户 ctx 到期时库立即返回，内层检查点看到同一个 ctx 后同样会中止，但库不会强制终止 goroutine。

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

提取、文本、输出、链接与批量方法都有带 `context.Context` 的版本：

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

:::warning 两种输出格式的缓存行为不同
- **`ExtractToMarkdown`** 构建临时 Processor（拷贝不可变 `config`，`MaxCacheEntries` 置零），**不读写主缓存**，Markdown 结果也不进缓存；统计与审计仍写入父 Processor 的计数器与日志。
- **`ExtractToJSON`** 直接调用 `p.Extract`，**走正常缓存路径**，命中/写入主缓存并更新统计。

需要 Markdown 输出也进入缓存时，用 `MarkdownConfig()` 创建专用 Processor 后调用 `Extract`，或自行缓存输出。
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

`MaxCacheEntries > 0` 时，`Extract` 启用缓存：

- **命中路径**：`CacheHits` 与 `TotalProcessed` 各加 1，返回 `cloneResult`——对 `Images`/`Links`/`Videos`/`Audios` 等 slice 做 `copy` 的深拷贝。调用方修改返回值不影响缓存条目，也避免并发命中时的数据竞争。
- **未命中路径**：处理完成后写入缓存，再返回一份 `cloneResult`。缓存条目与返回值互不别名。
- **禁用缓存**：`MaxCacheEntries = 0` 时跳过缓存键生成与读写，无任何缓存开销。

### GetStatistics

返回当前处理统计。

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

获取内存中的审计日志条目。

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

:::tip 生命周期要点
- **单例复用**：长驻服务（HTTP handler、worker）中创建一个 Processor，在并发请求间共享；Processor 并发安全，不必每请求新建。
- **立即 `defer Close()`**：创建后立刻挂上 `defer p.Close()`，异常路径也能停止缓存清理 goroutine、清空缓存并关闭审计 sink。
- **Close 后不可用**：`Close` 之后调用提取、格式化、链接或批量方法都返回 `ErrProcessorClosed`；`Close` 幂等，重复调用安全但无意义。
:::
