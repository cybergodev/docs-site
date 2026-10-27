---
sidebar_label: "Testing & Custom Extensions"
title: "Testing & Custom Extensions - CyberGo html | Scorer & Mocks"
description: "CyberGo html testing and extensions: custom Scorer and ArticleFinder single-pass selection, ShouldRemove scope, ContentNode traversal, mocks and decoupling, and test config."
sidebar_position: 20
---

# Testing & Custom Extensions

This page covers the key points of implementing a custom `Scorer` and `ArticleFinder`, and how to decouple business code behind the `Extractor` interface for unit tests.

## Custom Scorer

`Scorer` decides how the body container is selected: the higher the score returned by `Score`, the more likely a node is chosen as the body container.

### Interface Definition

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`: scores a node; the higher the score, the more likely it is selected as the body container
- `ShouldRemove`: the library calls it only while its built-in default scorer is in use — both candidate filtering and the node-removal heuristics rely on it. With a custom Scorer configured, body selection is driven by `Score` and the optional `ArticleFinder` hook; node removal in the cleaning stage still follows the built-in rules. A custom `ShouldRemove` therefore only needs to satisfy the interface signature; its return value has no effect
- To exclude nodes, return a low or negative score from `Score`, or implement `ArticleFinder` to select the body directly
- A custom Scorer **must be safe for concurrent use**: when the Processor is shared by several goroutines extracting concurrently, `Score` is called from all of them at the same time. A stateless implementation satisfies this for free; one holding mutable state (counters, cache maps) must lock itself or switch to atomic operations — the built-in default scorer is a read-only implementation and safe to share concurrently

### Default Behavior

With no `Scorer` configured, the built-in default scorer runs, scoring by tag semantics, class/id patterns, paragraph density, text length, and other signals. See [Content Extraction](../core-features/content-extraction#default-scorer-signals) for the full dimension table.

### Implementing a Custom Scorer

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// blogScorer is a scorer tuned for blog-style websites
type blogScorer struct{}

func (s blogScorer) Score(node html.ContentNode) int {
	if node == nil {
		return 0
	}

	score := 0
	class := strings.ToLower(node.AttrValue("class"))
	id := strings.ToLower(node.AttrValue("id"))
	tag := node.Data()

	// Positive signals: article-related class/id
	if containsAny(class, "article", "post", "content", "entry") {
		score += 50
	}
	if containsAny(id, "article", "post", "content") {
		score += 60
	}

	// Semantic tag bonus
	switch tag {
	case "article":
		score += 80
	case "main":
		score += 70
	case "section":
		score += 30
	}

	// Negative signals
	if containsAny(class, "sidebar", "comment", "footer", "nav", "menu") {
		score -= 50
	}
	if containsAny(id, "sidebar", "comments", "footer") {
		score -= 60
	}

	return score
}

// ShouldRemove satisfies the Scorer interface. With a custom Scorer configured,
// node removal in the cleaning stage still follows the built-in scorer's rules,
// so this return value does not decide which nodes are stripped; to exclude a
// node, return a low or negative score from Score.
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
        <article class="post"><h1>Test Article</h1><p>Article content</p></article>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Text)
}
```

## ContentNode Interface

`ContentNode` is the node abstraction handed to `Scorer`. It hides the underlying `golang.org/x/net/html` types, so a custom Scorer needs no parser imports:

```go
type ContentNode interface {
	Type() string                // Node type: "element", "text", "comment", etc.
	Data() string                // Tag name for elements, text for text nodes
	AttrValue(key string) string // Attribute value, or "" when absent
	Attrs() []NodeAttr           // All attributes
	FirstChild() ContentNode     // First child, or nil
	NextSibling() ContentNode    // Next sibling, or nil
	Parent() ContentNode         // Parent, or nil at the root
}
```

### Traversing Children

Every accessor can return `nil`, so check before dereferencing:

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

:::warning Keep each call cheap
`Score` runs once per non-inline element, so its cost scales with the element count. Re-walking the whole subtree inside `Score` degrades extraction to O(N²); prefer reading only the node's own tag, attributes, and direct children. See [Interfaces](../../api-reference/types/interfaces#scorer) for the full complexity contract.
:::

## Single-Pass Selection: ArticleFinder

`ArticleFinder` is an optional extension interface for `Scorer`:

```go
type ArticleFinder interface {
    FindArticleNode(root ContentNode) ContentNode
}
```

Without it, the library enumerates every non-inline element in the document and calls `Score` on each (see the warning above for the complexity contract). With `FindArticleNode` implemented, the library no longer calls `Score` per element and instead returns the body node in a single traversal:

- The returned value must come from `root`'s traversal methods (`FirstChild`/`NextSibling`/`Parent`) so the library can map it back to the internal node; a hand-built `ContentNode` implementation cannot be mapped and is treated as "no article found"
- Returning `nil` means no qualifying node, and the library falls back to extracting `<body>` (it does not fall back to per-element scoring)
- If the selected node is not a semantic container (`article`/`main`, or `role="main"`/`role="article"`), it still goes through the sibling-block merge heuristic for split articles and may be lifted to the parent
- The hook only takes over body-node selection; cleaning-stage node removal rules are unchanged

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

// roleMainScorer implements html.Scorer and html.ArticleFinder.
// With ArticleFinder implemented, the library no longer calls Score per element
// and instead picks the role="main" node in one traversal.
type roleMainScorer struct{}

// Score satisfies html.Scorer; it is no longer called once FindArticleNode exists
func (roleMainScorer) Score(html.ContentNode) int { return 0 }

// ShouldRemove satisfies html.Scorer; the return value does not affect selection
func (roleMainScorer) ShouldRemove(html.ContentNode) bool { return false }

// FindArticleNode finds the first role="main" element in one pass; nil falls back to <body>
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
	return found // nil falls back to <body>
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
        <nav>Site navigation</nav>
        <div role="main"><h1>Body Heading</h1><p>This is the body text.</p></div>
        <aside>Sidebar</aside>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title) // Output: Body Heading
}
```

## Decoupling Business Code with the Extractor Interface

The `Extractor` interface aggregates all of `Processor`'s extraction methods (25 in total). When business code depends on this interface instead of a concrete `*html.Processor`, unit tests can inject a stand-in and skip real HTML parsing:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

// headlineOf depends on the html.Extractor interface: production passes *html.Processor,
// tests pass a stub implementation
func headlineOf(ext html.Extractor, page []byte) (string, error) {
	result, err := ext.Extract(page)
	if err != nil {
		return "", err
	}
	return result.Title, nil
}

// stubExtractor embeds html.Extractor: only the Extract method in use is implemented;
// the other 24 methods are inherited from the embedded interface value and panic if
// called unexpectedly, exposing the test problem on the spot
type stubExtractor struct {
	html.Extractor
	title string
}

func (s *stubExtractor) Extract([]byte) (*html.Result, error) {
	return &html.Result{Title: s.title}, nil
}

func main() {
	// Production path: Processor implements the full Extractor
	p, err := html.New()
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	title, err := headlineOf(p, []byte(`<html><head><title>Real Title</title></head><body><p>Body</p></body></html>`))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(title) // Output: Real Title

	// Test path: inject a stub, no real parsing involved
	title, err = headlineOf(&stubExtractor{title: "Stub Title"}, nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(title) // Output: Stub Title
}
```

Inside a test (assertions with testify; imports omitted):

```go
func TestHeadlineOf(t *testing.T) {
	title, err := headlineOf(&stubExtractor{title: "Test Title"}, nil)
	require.NoError(t, err)
	assert.Equal(t, "Test Title", title)
}
```

Embedding the interface means implementing only the methods the business code actually calls; for explicit per-method implementations, the complete method list is in [Interfaces](../../api-reference/types/interfaces#extractor).

## Reader Mode and Testing

Reader mode methods (`ReadPage`, `ReadPageToMarkdown`, `ReadPageFromFile`, and so on) are **not** part of the `Extractor` interface; they are separate `Processor` methods. Mocking `Extractor` does not require them. To test reader mode, use `Processor` or the package-level functions directly. See [Interfaces](../../api-reference/types/interfaces) for the interface list.

## Test Configuration

### Disable Cache

Tests rarely need caching. `MaxCacheEntries = 0` reprocesses on every call, so cases cannot affect each other:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0
```

### Disable Sanitization

For trusted input, turning off sanitization keeps the test HTML unmodified:

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning Test only
Keep `EnableSanitization = true` in production.
:::

### Use TextOnlyConfig

To verify plain-text extraction only, `TextOnlyConfig` skips images, links, and media, reducing unrelated fields:

```go
result, err := html.Extract(data, html.TextOnlyConfig())
```

## Writing Tests

### Test Extraction Results

```go
func TestExtractTitle(t *testing.T) {
	data := []byte(`<html><head><title>Test Title</title></head>
        <body><p>Body content</p></body></html>`)

	result, err := html.Extract(data)
	require.NoError(t, err)
	assert.Equal(t, "Test Title", result.Title)
	assert.Contains(t, result.Text, "Body content")
}
```

### Test Custom Scorer

```go
func TestBlogScorer(t *testing.T) {
	cfg := html.DefaultConfig()
	cfg.Scorer = blogScorer{}
	cfg.MaxCacheEntries = 0

	p, err := html.New(cfg)
	require.NoError(t, err)
	defer p.Close()

	data := []byte(`<html><body>
        <nav><a href="/">Home</a></nav>
        <article class="post">
            <h1>Blog Title</h1>
            <p>Blog body content</p>
        </article>
        <aside class="sidebar">Sidebar</aside>
    </body></html>`)

	result, err := p.Extract(data)
	require.NoError(t, err)
	assert.Contains(t, result.Text, "Blog body content")
	// Navigation and sidebar are excluded by the built-in removal rules in the
	// cleaning stage, independent of the custom ShouldRemove
	assert.NotContains(t, result.Text, "Sidebar")
	assert.NotContains(t, result.Text, "Home")
}
```

### Test Error Handling

```go
func TestInputTooLarge(t *testing.T) {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100 // Deliberately tiny

	_, err := html.Extract(make([]byte, 200), cfg)

	assert.ErrorIs(t, err, html.ErrInputTooLarge)
}
```

### Test Audit Log

```go
func TestAuditLog(t *testing.T) {
	cfg := html.DefaultConfig()
	cfg.Audit = html.DefaultAuditConfig()
	cfg.Audit.Enabled = true
	cfg.MaxCacheEntries = 0

	p, err := html.New(cfg)
	require.NoError(t, err)
	defer p.Close()

	_, err = p.Extract([]byte(`<html><body><script>alert(1)</script><p>Content</p></body></html>`))
	require.NoError(t, err)

	entries := p.GetAuditLog()
	require.NotEmpty(t, entries)
	for _, e := range entries {
		t.Logf("[%s] %s", e.EventType, e.Message)
	}
}
```

## Common Extension Scenarios

### Choosing a Scorer per Site

```go
func newSiteScorer(site string) html.Scorer {
	switch site {
	case "github.com":
		return githubScorer{}
	case "medium.com":
		return mediumScorer{}
	default:
		return nil // nil falls back to the built-in default scorer
	}
}
```

### Counting Tag Distribution

```go
func analyzeStructure(root html.ContentNode) map[string]int {
	counts := make(map[string]int)
	walk(root, counts)
	return counts
}

// walk traverses root's subtree and siblings, counting by tag name.
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

## Next Steps

- [Interfaces](../../api-reference/types/interfaces) — full `Scorer` and `ContentNode` signatures
- [Config](../../api-reference/core/config) — the `Config.Scorer` field
- [FAQ](../../faq/) — common questions and troubleshooting
