---
title: "Testing & Custom Extensions - CyberGo HTML | Testing Guide"
description: "CyberGo HTML testing and extension guide: custom Scorer, ContentNode traversal, test mode, mock HTML data, and Extractor mocking with runnable examples."
---

# Testing & Custom Extensions

This guide covers customizing content scoring algorithms and writing tests for code that uses the HTML library.

## Custom Scorer

The `Scorer` interface controls two core decisions: how to identify body content, and which nodes to remove.

### Interface Definition

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`: Score a node; higher scores are more likely to be selected as the body container
- `ShouldRemove`: Return `true` to remove a node before extraction

### Default Behavior

When no `Scorer` is configured, the built-in default scorer is used. It calculates scores based on node characteristics (text density, paragraph ratio, tag semantics, etc.).

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

func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
    if node == nil {
        return false
    }

    // Remove navigation and footer
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }

    // Remove ads and comments
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

`ContentNode` is the node abstraction used by the `Scorer` interface, shielding from the underlying HTML parser's concrete types:

```go
type ContentNode interface {
    Type() string                        // "element", "text", "comment", etc.
    Data() string                        // Tag name or text content
    AttrValue(key string) string         // Get attribute value
    Attrs() []NodeAttr                   // Get all attributes
    FirstChild() ContentNode             // First child node
    NextSibling() ContentNode            // Next sibling node
    Parent() ContentNode                 // Parent node
}
```

### Traversing Nodes

```go
func (s myScorer) Score(root html.ContentNode) int {
    score := 0
    // Traverse child nodes
    for child := root.FirstChild(); child != nil; child = child.NextSibling() {
        if child.Type() == "element" {
            // Check nested text density
            textLen := countTextLength(child)
            if textLen > 200 {
                score += 10
            }
        }
    }
    return score
}
```

## Test Mode

### Disable Cache

Tests typically don't need caching. Disabling it ensures each call is "clean":

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // Disable cache
```

### Disable Sanitization

For trusted input, you can disable security sanitization to ensure test HTML isn't modified:

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning Test Only
Always keep `EnableSanitization = true` in production.
:::

### Use TextOnlyConfig

When testing text extraction logic, use `TextOnlyConfig` to reduce noise:

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

### Site-Specific Extraction

```go
func newSiteScorer(site string) html.Scorer {
    switch site {
    case "github.com":
        return githubScorer{}
    case "medium.com":
        return mediumScorer{}
    default:
        return nil // Use default scorer
    }
}
```

### Analyzing Node Attribute Distribution

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

## Next Steps

- [API Reference: Interfaces](../api-reference/interfaces) - Scorer and ContentNode complete definitions
- [API Reference: Config](../api-reference/config) - Scorer config field
- [FAQ](../faq) - Frequently asked questions
