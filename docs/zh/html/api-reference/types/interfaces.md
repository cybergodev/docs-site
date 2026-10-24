---
sidebar_label: "接口定义"
title: "接口定义 - CyberGo html | 核心接口参考"
description: "CyberGo html 核心接口：Extractor 提取主接口、StatsProvider 统计与缓存管理、ContentNode 节点抽象、Scorer 评分扩展与 AuditSink 审计输出，含 Mock 测试示例、并发安全要求与适配器设计说明。"
sidebar_position: 10
---

# 接口定义

HTML 库定义了 5 个核心接口：`Extractor`、`StatsProvider`、`ContentNode`、`Scorer` 与 `AuditSink`。

## Extractor

内容提取的主接口，`Processor` 实现了它。接口共 25 个方法。

```go
type Extractor interface {
	// 核心提取
	Extract(htmlBytes []byte) (*Result, error)
	ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
	ExtractFromFile(filePath string) (*Result, error)
	ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)

	// 文本提取
	ExtractText(htmlBytes []byte) (string, error)
	ExtractTextFromFile(filePath string) (string, error)
	ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
	ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)

	// 格式化输出
	ExtractToMarkdown(htmlBytes []byte) (string, error)
	ExtractToMarkdownFromFile(filePath string) (string, error)
	ExtractToJSON(htmlBytes []byte) ([]byte, error)
	ExtractToJSONFromFile(filePath string) ([]byte, error)
	ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
	ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
	ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
	ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)

	// 批量处理
	ExtractBatch(htmlContents [][]byte) *BatchResult
	ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
	ExtractBatchFiles(filePaths []string) *BatchResult
	ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult

	// 链接提取
	ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
	ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
	ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
	ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)

	// 生命周期
	Close() error
}
```

### 方法一览

| 方法 | 说明 |
|------|------|
| `Extractor.Extract` | 从 HTML 字节提取完整 `Result` |
| `Extractor.ExtractWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractFromFile` | 从 HTML 文件提取 |
| `Extractor.ExtractFromFileWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractText` | 仅提取纯文本 |
| `Extractor.ExtractTextWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractTextFromFile` | 从文件提取纯文本 |
| `Extractor.ExtractTextFromFileWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractToMarkdown` | 提取并渲染为 Markdown |
| `Extractor.ExtractToMarkdownWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractToMarkdownFromFile` | 从文件提取并渲染为 Markdown |
| `Extractor.ExtractToMarkdownFromFileWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractToJSON` | 提取并序列化为 JSON |
| `Extractor.ExtractToJSONWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractToJSONFromFile` | 从文件提取并序列化为 JSON |
| `Extractor.ExtractToJSONFromFileWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractBatch` | 并发批量提取（字节切片输入） |
| `Extractor.ExtractBatchWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractBatchFiles` | 并发批量提取（文件路径输入） |
| `Extractor.ExtractBatchFilesWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractAllLinks` | 枚举全部链接资源（不应用清洗） |
| `Extractor.ExtractAllLinksWithContext` | 同上，支持 context 取消 |
| `Extractor.ExtractAllLinksFromFile` | 从文件枚举链接资源 |
| `Extractor.ExtractAllLinksFromFileWithContext` | 同上，支持 context 取消 |
| `Extractor.Close` | 释放资源（缓存、后台 goroutine） |

## StatsProvider

统计与缓存管理接口。

```go
type StatsProvider interface {
	GetStatistics() Statistics
	ClearCache()
	ResetStatistics()
}
```

### 方法一览

| 方法 | 说明 |
|------|------|
| `StatsProvider.GetStatistics` | 返回当前处理统计 |
| `StatsProvider.ClearCache` | 清空缓存内容，保留累计统计 |
| `StatsProvider.ResetStatistics` | 重置所有统计计数器归零 |

`Processor` 同时实现 `Extractor` 与 `StatsProvider`。按接口类型引用 `Processor`，可以把提取能力与监控能力分别注入不同的消费者：

```go
type ExtractionService struct {
	extractor     html.Extractor     // 只需要提取能力
	statsProvider html.StatsProvider // 只需要监控能力
}

func NewService(p *html.Processor) *ExtractionService {
	return &ExtractionService{
		extractor:     p, // *Processor 满足 Extractor
		statsProvider: p, // *Processor 满足 StatsProvider
	}
}
```

## 依赖注入与 Mock 测试

`Extractor` 接口把提取逻辑与业务代码解耦，单元测试中可以注入 mock 实现。

<!-- check-code: skip -->
```go
// mockExtractor 实现 html.Extractor 接口，用于测试
type mockExtractor struct {
	result *html.Result
	err    error
}

func (m *mockExtractor) Extract([]byte) (*html.Result, error) { return m.result, m.err }
func (m *mockExtractor) ExtractWithContext(ctx context.Context, b []byte) (*html.Result, error) {
	return m.result, m.err
}
func (m *mockExtractor) ExtractFromFile(string) (*html.Result, error) { return m.result, m.err }
func (m *mockExtractor) ExtractFromFileWithContext(context.Context, string) (*html.Result, error) {
	return m.result, m.err
}
func (m *mockExtractor) ExtractText([]byte) (string, error)         { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextFromFile(string) (string, error) { return m.result.Text, m.err }
func (m *mockExtractor) ExtractTextWithContext(context.Context, []byte) (string, error) {
	return m.result.Text, m.err
}
func (m *mockExtractor) ExtractTextFromFileWithContext(context.Context, string) (string, error) {
	return m.result.Text, m.err
}
// ... 其余方法返回零值
```

为控制篇幅，上面的 `mockExtractor` 只实现了部分方法。实际实现需补齐 `Extractor` 的全部 25 个方法，否则无法通过编译；省略的方法可以直接返回零值。

```go
// 业务代码依赖接口而非具体类型
type ArticleService struct {
	extractor html.Extractor
}

func (s *ArticleService) GetTitle(htmlBytes []byte) (string, error) {
	result, err := s.extractor.Extract(htmlBytes)
	if err != nil {
		return "", err
	}
	return result.Title, nil
}
```

```go
// 测试中注入 mock（断言用 testify，此处省略 import）
func TestGetTitle(t *testing.T) {
	svc := &ArticleService{
		extractor: &mockExtractor{
			result: &html.Result{Title: "测试标题"},
		},
	}
	title, err := svc.GetTitle([]byte("<html></html>"))
	assert.NoError(t, err)
	assert.Equal(t, "测试标题", title)
}
```

## ContentNode

HTML 节点的抽象接口，用于内容评分算法。`Type`、`Data`、`AttrValue`、`Attrs` 提供只读访问，`FirstChild`、`NextSibling`、`Parent` 用于遍历节点树。

```go
type ContentNode interface {
	Type() string                // 节点类型（"element"、"text"、"comment" 等）
	Data() string                // 标签名或文本内容
	AttrValue(key string) string // 属性值
	Attrs() []NodeAttr           // 所有属性
	FirstChild() ContentNode     // 第一个子节点
	NextSibling() ContentNode    // 下一个兄弟节点
	Parent() ContentNode         // 父节点
}
```

### 方法一览

| 方法 | 签名 | 说明 |
|------|------|------|
| `ContentNode.Type` | `Type() string` | 节点类型字符串，取值见下 |
| `ContentNode.Data` | `Data() string` | 元素节点返回标签名（如 `"div"`），文本节点返回文本内容 |
| `ContentNode.AttrValue` | `AttrValue(key string) string` | 按属性名取值，属性不存在时返回空字符串 |
| `ContentNode.Attrs` | `Attrs() []NodeAttr` | 返回节点全部属性 |
| `ContentNode.FirstChild` | `FirstChild() ContentNode` | 第一个子节点，无则返回 `nil` |
| `ContentNode.NextSibling` | `NextSibling() ContentNode` | 下一个兄弟节点，无则返回 `nil` |
| `ContentNode.Parent` | `Parent() ContentNode` | 父节点，根节点时返回 `nil` |

`Type()` 的取值：`element`、`text`、`comment`、`document`、`doctype`、`error`、`raw`、`unknown`。

## Scorer

内容评分接口，用于自定义文章识别策略。

```go
type Scorer interface {
	Score(node ContentNode) int         // 计算节点相关性分数
	ShouldRemove(node ContentNode) bool // 预留：当前版本不被库调用
}
```

### 方法一览

| 方法 | 签名 | 说明 |
|------|------|------|
| `Scorer.Score` | `Score(node ContentNode) int` | 计算节点的内容相关性分数 |
| `Scorer.ShouldRemove` | `ShouldRemove(node ContentNode) bool` | 接口预留方法，当前版本不被库调用 |

`ShouldRemove` 必须实现才能满足接口，但库只调用 `Score`，其返回值不生效，固定返回 `false` 即可。要排除节点，在 `Score` 中返回低分或负分。

:::warning 自定义 Scorer 必须并发安全
单个 `Processor` 被多个并发 `Extract` 调用共享时，`Score` 会从**多个 goroutine 同时**被触发，因此 `Scorer` 实现必须自行保证并发安全。

库内置的默认评分器只读，天然满足并发安全。**自定义 `Scorer` 若持有可变状态（如缓存、计数器），必须自行加锁**。
:::

通过 `Config.Scorer` 注入自定义评分器：

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
	// 自定义评分逻辑
	return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
	// 预留方法：当前版本不会被库调用，下面的逻辑不会生效
	return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

### ContentNode 与内部类型的关系

`ContentNode` 是抽象接口，屏蔽了底层的 `golang.org/x/net/html.Node`。库内部通过 `contentNodeAdapter` 把 `*html.Node` 包装为 `ContentNode`：

```text
调用方 Scorer.Score(ContentNode)
                          │
                    contentNodeAdapter（适配器）
                          │
                  内部 *html.Node（golang.org/x/net/html）
```

双层接口设计带来三点：

- **公共 API 干净**：实现自定义 Scorer 无需导入 `golang.org/x/net/html`。
- **内部开销低**：库内的 `DefaultScorer` 直接操作 `*html.Node`，不经过适配层。
- **适配自动完成**：`scorerAdapter` 在公共 `Scorer` 与内部评分器之间双向转换，调用方无需感知。

:::tip 遍历子树时检查 nil
`FirstChild()`、`NextSibling()`、`Parent()` 在没有对应节点时返回 `nil`。自定义 Scorer 遍历子树时必须做 nil 检查，否则会 panic。
:::

## AuditSink

审计日志输出接口。

```go
type AuditSink interface {
	Write(entry AuditEntry)
	Close() error
}
```

内置 Sink 实现见 [审计系统](../modules/audit)。
