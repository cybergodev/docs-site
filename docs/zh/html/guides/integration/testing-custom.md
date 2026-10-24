---
sidebar_label: "测试与自定义扩展"
title: "测试与自定义扩展 - CyberGo html | Scorer 与 mock 测试"
description: "CyberGo html 测试与扩展：自定义 Scorer 评分算法、ContentNode 节点遍历、Extractor 接口 mock 与测试配置（禁用缓存/清洗）的写法与注意事项。"
sidebar_position: 20
---

# 测试与自定义扩展

自定义 `Scorer` 的实现要点，以及用 `Extractor` 接口解耦业务代码、编写单元测试的写法。

## 自定义 Scorer

`Scorer` 决定正文容器如何选出：`Score` 返回的分数越高，节点越可能被选为正文容器。

### 接口定义

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`：为节点评分，分数越高越可能被选为正文容器
- `ShouldRemove`：接口预留方法。自定义 Scorer 必须实现它才能满足接口，但当前版本库**不会调用它**，返回值不生效（可固定返回 `false`）。要排除特定节点，请在 `Score` 中返回低分或负分

### 默认行为

未配置 `Scorer` 时使用内置默认评分器，按标签语义、class/id 模式、段落密度、文本长度等信号打分。完整维度表见 [内容提取实战](../core-features/content-extraction#默认评分器的信号维度)。

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

// ShouldRemove 当前版本不会被库调用，下面的逻辑不会生效；
// 实现它只是为了满足接口（节点排除请用 Score 返回低分/负分）
func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
	if node == nil {
		return false
	}

	// 以下判断不会被执行
	switch node.Data() {
	case "nav", "footer", "header":
		return true
	}

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

`ContentNode` 是 `Scorer` 收到的节点抽象，屏蔽了底层 `golang.org/x/net/html` 的类型，实现自定义 Scorer 无需导入解析器包：

```go
type ContentNode interface {
	Type() string                // 节点类型："element"、"text"、"comment" 等
	Data() string                // 元素节点为标签名，文本节点为文本内容
	AttrValue(key string) string // 按属性名取值，不存在时返回空字符串
	Attrs() []NodeAttr           // 全部属性
	FirstChild() ContentNode     // 第一个子节点，无则 nil
	NextSibling() ContentNode    // 下一个兄弟节点，无则 nil
	Parent() ContentNode         // 父节点，根节点为 nil
}
```

### 遍历子节点

遍历时每个访问器都可能返回 `nil`，必须先判空：

```go
func (s myScorer) Score(root html.ContentNode) int {
	if root == nil {
		return 0
	}
	score := 0
	for child := root.FirstChild(); child != nil; child = child.NextSibling() {
		if child.Type() == "element" && textLength(child) > 200 {
			score += 10
		}
	}
	return score
}
```

:::warning 单次调用要足够快
`Score` 对文档中每个非行内元素各调用一次，复杂度按元素数放大。在 `Score` 里重新遍历整棵子树会让提取退化为 O(N²)；优先只读取当前节点自身的标签、属性与直接子节点。完整复杂度约定见 [接口定义](../../api-reference/types/interfaces#scorer)。
:::

## 测试配置

### 禁用缓存

测试通常不需要缓存。`MaxCacheEntries = 0` 让每次调用都重新处理，用例之间不会互相影响：

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0
```

### 禁用清洗

对可信输入关闭安全清洗，测试 HTML 就不会被改写：

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning 只用于测试
生产环境保持 `EnableSanitization = true`。
:::

### 使用 TextOnlyConfig

只验证纯文本提取时，`TextOnlyConfig` 会跳过图片、链接与媒体，减少无关字段：

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
	cfg.MaxCacheEntries = 0

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
	// 导航与侧栏由清洗和候选过滤排除，与 ShouldRemove 无关
	assert.NotContains(t, result.Text, "侧边栏")
	assert.NotContains(t, result.Text, "首页")
}
```

### 测试错误处理

```go
func TestInputTooLarge(t *testing.T) {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100 // 故意设为极小值

	_, err := html.Extract(make([]byte, 200), cfg)

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

	p, err := html.New(cfg)
	require.NoError(t, err)
	defer p.Close()

	_, err = p.Extract([]byte(`<html><body><script>alert(1)</script><p>正文</p></body></html>`))
	require.NoError(t, err)

	entries := p.GetAuditLog()
	require.NotEmpty(t, entries)
	for _, e := range entries {
		t.Logf("[%s] %s", e.EventType, e.Message)
	}
}
```

## 常见扩展场景

### 按站点选择评分器

```go
func newSiteScorer(site string) html.Scorer {
	switch site {
	case "github.com":
		return githubScorer{}
	case "medium.com":
		return mediumScorer{}
	default:
		return nil // 返回 nil 时使用内置默认评分器
	}
}
```

### 统计节点属性分布

```go
func analyzeStructure(root html.ContentNode) map[string]int {
	counts := make(map[string]int)
	walk(root, counts)
	return counts
}

// walk 遍历 root 的子树与同级节点，按标签名计数。
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

- [接口定义](../../api-reference/types/interfaces) — `Scorer` 与 `ContentNode` 的完整签名
- [配置](../../api-reference/core/config) — `Config.Scorer` 字段
- [常见问题](../../faq/) — 高频疑问与排查
