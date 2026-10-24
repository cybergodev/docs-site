---
sidebar_label: "Testing & Custom Extensions"
title: "Testing & Custom Extensions - CyberGo html | Scorer & Mocks"
description: "CyberGo html testing and extensions: custom Scorer implementation, ContentNode traversal, Extractor mocks, and test configuration (cache/sanitization off)."
sidebar_position: 20
---

# Testing & Custom Extensions

How to implement a custom `Scorer`, and how to decouple business code behind the `Extractor` interface so it can be unit-tested.

## Custom Scorer

`Scorer` decides which container becomes the body: the higher the score returned by `Score`, the more likely a node is selected.

### Interface Definition

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`: Scores a node; higher scores are more likely to be selected as the body container
- `ShouldRemove`: Reserved interface method. A custom Scorer must implement it to satisfy the interface, but the current library version **never calls it** and its return value has no effect (returning `false` is fine). To exclude a node, return a low or negative score from `Score`

### Default Behavior

With no `Scorer` configured, the built-in default scorer runs. It scores nodes by tag semantics, class/id patterns, paragraph density, and text length. See [Content Extraction](../core-features/content-extraction#default-scorer-signals) for the full table.

### Implementing a Custom Scorer

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// blogScorer is optimized for blog-style websites
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

	// Semantic tags bonus
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

// ShouldRemove is never called by the library in the current version, so the logic below never runs;
// it exists only to satisfy the interface. To exclude nodes, return a low score from Score.
func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
	if node == nil {
		return false
	}

	// Never executed
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
`Score` runs once per non-inline element, so its cost scales with the element count. Re-walking the whole subtree inside `Score` makes extraction O(N²); read only the node's own tag, attributes, and immediate children. See [Interfaces](../../api-reference/types/interfaces#scorer) for the full complexity contract.
:::

## Test Configuration

### Disable Cache

Tests rarely need caching. `MaxCacheEntries = 0` reprocesses on every call, so cases cannot affect each other:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0
```

### Disable Sanitization

For trusted input, turning off sanitization keeps the test markup unmodified:

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning Test only
Keep `EnableSanitization = true` in production.
:::

### Use TextOnlyConfig

To assert on text alone, `TextOnlyConfig` skips images, links, and media, so unrelated fields cannot pollute the assertion:

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
    cfg.MaxCacheEntries = 0 // Disable cache

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
    // Navigation and sidebar are dropped by sanitization and candidate filtering, not by ShouldRemove
    assert.NotContains(t, result.Text, "Sidebar")
    assert.NotContains(t, result.Text, "Home")
}
```

### Test Error Handling

```go
func TestInputTooLarge(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.MaxInputSize = 100 // Tiny limit

    largeData := make([]byte, 200)
    _, err := html.Extract(largeData, cfg)

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

    p, _ := html.New(cfg)
    defer p.Close()

    data := []byte(`<html><body><script>alert(1)</script><p>Content</p></body></html>`)
    p.Extract(data)

    entries := p.GetAuditLog()
    t.Logf("Audit events: %d", len(entries))
    for _, e := range entries {
        t.Logf("  [%s] %s", e.EventType, e.Message)
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

### Counting Tags in a Subtree

```go
func analyzeStructure(root html.ContentNode) map[string]int {
	counts := make(map[string]int)
	walk(root, counts)
	return counts
}

// walk counts tag names across root's subtree and its following siblings.
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
