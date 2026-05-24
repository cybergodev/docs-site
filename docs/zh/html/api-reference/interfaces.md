---
title: "接口定义 - HTML"
description: "CyberGo HTML 库核心接口定义 API 参考，包括 Extractor（完整提取接口）、StatsProvider（统计与缓存管理）、ContentNode（HTML 节点抽象）、Scorer（自定义评分策略）和 AuditSink（审计输出），用于功能扩展和集成测试，帮助深入理解库的架构设计与扩展机制。"
---

# 接口定义

HTML 库定义了以下核心接口：

## Extractor

HTML 内容提取的主要接口，`Processor` 实现了此接口。

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

## StatsProvider

统计信息和缓存管理接口。

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

## ContentNode

HTML 节点的抽象接口，用于内容评分算法。

```go
type ContentNode interface {
    Type() string                    // 节点类型 ("element", "text", "comment" 等)
    Data() string                    // 标签名或文本内容
    AttrValue(key string) string     // 属性值
    Attrs() []NodeAttr               // 所有属性
    FirstChild() ContentNode         // 第一个子节点
    NextSibling() ContentNode        // 下一个兄弟节点
    Parent() ContentNode             // 父节点
}
```

## Scorer

内容评分算法接口，用于自定义文章识别策略。

```go
type Scorer interface {
    Score(node ContentNode) int          // 计算节点相关性分数
    ShouldRemove(node ContentNode) bool  // 判断节点是否应移除
}
```

通过 `Config.Scorer` 字段注入自定义评分器：

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

## AuditSink

审计日志输出接口。

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

内置 Sink 实现详见 [审计系统](./audit)。
