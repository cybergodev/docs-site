---
sidebar_label: "测试与自定义扩展"
title: "测试与自定义扩展 - CyberGo html | Scorer 与 mock 测试"
description: "CyberGo html 测试与扩展：自定义 Scorer 与 ArticleFinder 单遍选取、ShouldRemove 的生效范围、ContentNode 节点遍历、Extractor 接口 mock 与业务解耦，以及禁用缓存与清洗的测试配置写法与注意事项。"
sidebar_position: 20
---

# 测试与自定义扩展

本页覆盖自定义 `Scorer` 与 `ArticleFinder` 的实现要点，以及用 `Extractor` 接口解耦业务代码、编写单元测试的写法。

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
- `ShouldRemove`：库使用内置默认评分器时才调用它（候选过滤与节点移除启发式都依赖它）。配置自定义 Scorer 后，正文选取由 `Score` 与可选的 `ArticleFinder` 驱动；清洗阶段的节点移除仍按内置规则执行。因此自定义 `ShouldRemove` 只需满足接口签名，返回值不产生作用
- 需要排除节点时，在 `Score` 中返回低分或负分，或实现 `ArticleFinder` 直接选取正文
- 自定义 Scorer **必须并发安全**：Processor 被多个 goroutine 共享并发提取时，`Score` 会同时从多个 goroutine 被调用。无状态的实现天然满足；持有可变状态（计数器、缓存 map）时必须自行加锁或改用原子操作——内置默认评分器即为只读实现，可并发共享

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

// ShouldRemove 满足 Scorer 接口。配置自定义 Scorer 后，清洗阶段的节点移除
// 仍按内置评分器规则执行，因此这里的返回值不影响哪些节点被剥离；
// 要排除节点，请在 Score 中返回低分/负分。
func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
	if node == nil {
		return false
	}

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

## ArticleFinder 单遍选取

`ArticleFinder` 是 `Scorer` 的可选扩展接口：

```go
type ArticleFinder interface {
    FindArticleNode(root ContentNode) ContentNode
}
```

未实现它时，库枚举文档中每个非行内元素并逐个调用 `Score`（复杂度约定见上方警告）。实现 `FindArticleNode` 后，库不再逐元素调用 `Score`，而是一次遍历直接给出正文节点：

- 返回值必须来自 `root` 的遍历方法（`FirstChild`/`NextSibling`/`Parent`），这样库才能映射回内部节点；自行构造的 `ContentNode` 实现无法映射，按「未找到正文」处理
- 返回 `nil` 表示没有合格节点，库回落到 `<body>` 提取（不会退回逐元素评分）
- 选取结果若不是语义容器（`article`/`main`，或 `role="main"`/`role="article"`），仍会经过「拆分文章的兄弟块合并」启发式，可能被上提到父节点
- 该钩子只接管正文节点选取，清洗阶段的节点移除规则不变

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

// roleMainScorer 实现 html.Scorer 与 html.ArticleFinder。
// 实现 ArticleFinder 后，库不再逐元素调用 Score，而是一次遍历直接取 role="main" 的节点。
type roleMainScorer struct{}

// Score 满足 html.Scorer；实现 FindArticleNode 后不再被调用
func (roleMainScorer) Score(html.ContentNode) int { return 0 }

// ShouldRemove 满足 html.Scorer；返回值对选取不起作用
func (roleMainScorer) ShouldRemove(html.ContentNode) bool { return false }

// FindArticleNode 单遍查找首个 role="main" 元素；返回 nil 时回落 <body>
func (roleMainScorer) FindArticleNode(root html.ContentNode) html.ContentNode {
	var found html.ContentNode
	var walk func(html.ContentNode)
	walk = func(n html.ContentNode) {
		if n == nil || found != nil {
			return
		}
		if n.Type() == "element" && n.AttrValue("role") == "main" {
			found = n
			return
		}
		for c := n.FirstChild(); c != nil; c = c.NextSibling() {
			walk(c)
		}
	}
	walk(root)
	return found // nil 时回落 <body>
}

func main() {
	cfg := html.DefaultConfig()
	cfg.Scorer = roleMainScorer{}
	cfg.MaxCacheEntries = 0

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body>
        <nav>站点导航</nav>
        <div role="main"><h1>正文标题</h1><p>这是正文内容。</p></div>
        <aside>侧栏</aside>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // 输出: 正文标题
}
```

## 用 Extractor 接口解耦业务代码

`Extractor` 接口聚合了 `Processor` 的全部提取方法（25 个）。业务代码依赖该接口而非具体的 `*html.Processor`，单元测试就能注入替身，不必真实解析 HTML：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

// headlineOf 依赖 html.Extractor 接口：生产环境传 *html.Processor，测试传桩实现
func headlineOf(ext html.Extractor, page []byte) (string, error) {
	result, err := ext.Extract(page)
	if err != nil {
		return "", err
	}
	return result.Title, nil
}

// stubExtractor 嵌入 html.Extractor：只需实现用到的 Extract，
// 其余 24 个方法继承自内嵌的接口值，被意外调用时 panic 并当场暴露测试问题
type stubExtractor struct {
	html.Extractor
	title string
}

func (s *stubExtractor) Extract([]byte) (*html.Result, error) {
	return &html.Result{Title: s.title}, nil
}

func main() {
	// 生产路径：Processor 实现了完整的 Extractor
	p, err := html.New()
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	title, err := headlineOf(p, []byte(`<html><head><title>真标题</title></head><body><p>正文</p></body></html>`))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(title) // 输出：真标题

	// 测试路径：注入桩实现，不经过真实解析
	title, err = headlineOf(&stubExtractor{title: "桩标题"}, nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(title) // 输出：桩标题
}
```

测试中的用法（断言用 testify，import 省略）：

```go
func TestHeadlineOf(t *testing.T) {
	title, err := headlineOf(&stubExtractor{title: "测试标题"}, nil)
	require.NoError(t, err)
	assert.Equal(t, "测试标题", title)
}
```

嵌入接口的写法只需实现业务代码真正调用的方法；需要逐方法显式实现时，完整方法清单见 [接口定义](../../api-reference/types/interfaces#extractor)。

## 阅读模式与测试

阅读模式方法（`ReadPage`、`ReadPageToMarkdown`、`ReadPageFromFile` 等）**不在** `Extractor` 接口内，它们是 `Processor` 的独立方法。mock `Extractor` 时无需实现它们。要测试阅读模式，直接使用 `Processor` 或包级函数。接口清单见 [接口定义](../../api-reference/types/interfaces)。

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
	// 导航与侧栏由清洗阶段的内置移除规则排除，与自定义 ShouldRemove 无关
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
