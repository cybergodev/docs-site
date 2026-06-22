---
title: "测试与自定义扩展 - CyberGo HTML | 测试体系指南"
description: "CyberGo HTML 测试与自定义扩展：自定义 Scorer 实现、ContentNode 遍历、测试模式、mock 数据与 Extractor 接口 mock 及可运行示例。"
---

# 测试与自定义扩展

本指南介绍如何自定义内容评分算法，以及如何为使用 HTML 库的代码编写测试。

## 自定义 Scorer

`Scorer` 接口控制两个核心决策：如何识别正文内容，以及哪些节点应该移除。

### 接口定义

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`：为节点评分，分数越高越可能被选为正文容器
- `ShouldRemove`：返回 `true` 表示在提取前移除该节点

### 默认行为

未配置 `Scorer` 时，使用内置的默认评分器。它根据节点特征（文本密度、段落比例、标签语义等）计算分数。

### 实现自定义 Scorer

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// blogScorer 针对博客类网站优化的评分器
type blogScorer struct{}

func (s blogScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }

    score := 0
    class := strings.ToLower(node.AttrValue("class"))
    id := strings.ToLower(node.AttrValue("id"))
    tag := node.Data()

    // 正面信号：文章相关 class/id
    if containsAny(class, "article", "post", "content", "entry") {
        score += 50
    }
    if containsAny(id, "article", "post", "content") {
        score += 60
    }

    // 语义化标签加分
    switch tag {
    case "article":
        score += 80
    case "main":
        score += 70
    case "section":
        score += 30
    }

    // 负面信号
    if containsAny(class, "sidebar", "comment", "footer", "nav", "menu") {
        score -= 50
    }
    if containsAny(id, "sidebar", "comments", "footer") {
        score -= 60
    }

    return score
}

func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
    if node == nil {
        return false
    }

    // 移除导航和页脚
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }

    // 移除广告和评论区域
    class := strings.ToLower(node.AttrValue("class"))
    return containsAny(class, "ad", "advertisement", "comment", "social-share")
}

func containsAny(s string, keywords ...string) bool {
    for _, kw := range keywords {
        if strings.Contains(s, kw) {
            return true
        }
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <article class="post"><h1>测试文章</h1><p>正文内容</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.Text)
}
```

## ContentNode 接口

`ContentNode` 是 `Scorer` 接口中使用的节点抽象，屏蔽了底层 HTML 解析器的具体类型：

```go
type ContentNode interface {
    Type() string                        // "element", "text", "comment" 等
    Data() string                        // 标签名或文本内容
    AttrValue(key string) string         // 获取属性值
    Attrs() []NodeAttr                   // 获取所有属性
    FirstChild() ContentNode             // 第一个子节点
    NextSibling() ContentNode            // 下一个兄弟节点
    Parent() ContentNode                 // 父节点
}
```

### 遍历节点

```go
func (s myScorer) Score(root html.ContentNode) int {
    score := 0
    // 遍历子节点
    for child := root.FirstChild(); child != nil; child = child.NextSibling() {
        if child.Type() == "element" {
            // 检查嵌套的文本密度
            textLen := countTextLength(child)
            if textLen > 200 {
                score += 10
            }
        }
    }
    return score
}
```

## 测试模式

### 禁用缓存

测试中通常不需要缓存，禁用后每次调用都是"干净"的：

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // 禁用缓存
```

### 禁用清洗

对可信输入可以禁用安全清洗，确保测试 HTML 不被修改：

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning 仅限测试
生产环境务必保持 `EnableSanitization = true`。
:::

### 使用 TextOnlyConfig

测试纯文本提取逻辑时，使用 `TextOnlyConfig` 减少噪音：

```go
result, err := html.Extract(data, html.TextOnlyConfig())
```

## 编写测试

### 测试提取结果

```go
func TestExtractTitle(t *testing.T) {
    data := []byte(`<html><head><title>测试标题</title></head>
        <body><p>正文内容</p></body></html>`)

    result, err := html.Extract(data)
    require.NoError(t, err)
    assert.Equal(t, "测试标题", result.Title)
    assert.Contains(t, result.Text, "正文内容")
}
```

### 测试自定义 Scorer

```go
func TestBlogScorer(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}
    cfg.MaxCacheEntries = 0 // 禁用缓存

    p, err := html.New(cfg)
    require.NoError(t, err)
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">首页</a></nav>
        <article class="post">
            <h1>博客标题</h1>
            <p>博客正文内容</p>
        </article>
        <aside class="sidebar">侧边栏</aside>
    </body></html>`)

    result, err := p.Extract(data)
    require.NoError(t, err)
    assert.Contains(t, result.Text, "博客正文内容")
    assert.NotContains(t, result.Text, "侧边栏")
    assert.NotContains(t, result.Text, "首页")
}
```

### 测试错误处理

```go
func TestInputTooLarge(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.MaxInputSize = 100 // 极小限制

    largeData := make([]byte, 200)
    _, err := html.Extract(largeData, cfg)

    assert.ErrorIs(t, err, html.ErrInputTooLarge)
}
```

### 测试审计日志

```go
func TestAuditLog(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Audit = html.DefaultAuditConfig()
    cfg.Audit.Enabled = true
    cfg.MaxCacheEntries = 0

    p, _ := html.New(cfg)
    defer p.Close()

    data := []byte(`<html><body><script>alert(1)</script><p>正文</p></body></html>`)
    p.Extract(data)

    entries := p.GetAuditLog()
    t.Logf("审计事件: %d 条", len(entries))
    for _, e := range entries {
        t.Logf("  [%s] %s", e.EventType, e.Message)
    }
}
```

## 常见扩展场景

### 为特定网站定制提取

```go
func newSiteScorer(site string) html.Scorer {
    switch site {
    case "github.com":
        return githubScorer{}
    case "medium.com":
        return mediumScorer{}
    default:
        return nil // 使用默认评分器
    }
}
```

### 统计节点属性分布

```go
func analyzeStructure(node html.ContentNode) map[string]int {
    counts := make(map[string]int)
    walk(node, counts)
    return counts
}

func walk(node html.ContentNode, counts map[string]int) {
    if node == nil {
        return
    }
    if node.Type() == "element" {
        counts[node.Data()]++
    }
    walk(node.FirstChild(), counts)
    walk(node.NextSibling(), counts)
}
```

## 下一步

- [API 参考：接口](../api-reference/interfaces) - Scorer 和 ContentNode 完整定义
- [API 参考：配置](../api-reference/config) - Scorer 配置字段
- [FAQ](../faq) - 常见问题
