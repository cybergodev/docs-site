---
title: "Advanced Usage - HTML"
description: "Advanced usage examples for CyberGo HTML, demonstrating custom Scorer, multi-Sink audit pipelines, batch processing, and Processor pooling patterns."
---

# Advanced Usage

## Custom Scorer

Customize content recognition logic for specific website structures. See [Testing & Custom Extensions](../guides/testing-custom) for the full implementation. Here's the core usage:

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// Implement custom Scorer (full example in guides/testing-custom)
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = myScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">Home</a></nav>
        <article class="post-content">
            <h1>Understanding Go Concurrency</h1>
            <p>Goroutines are Go's lightweight threads.</p>
        </article>
        <aside class="sidebar">Recommended Reading</aside>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Text:", result.Text)
    // Text: Understanding Go Concurrency
    //
    // Goroutines are Go's lightweight threads.
}
```

## Multi-Sink Audit Pipeline

Build a tiered audit pipeline: critical events go to a separate file, all events also output to logs.

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/html"
)

func main() {
    // Create output destinations
    allFile, _ := os.Create("audit-all.jsonl")
    criticalFile, _ := os.Create("audit-critical.jsonl")
    defer allFile.Close()
    defer criticalFile.Close()

    // Build multi-tier pipeline
    allSink := html.NewWriterAuditSink(allFile)
    criticalSink := html.NewFilteredSink(
        html.NewWriterAuditSink(criticalFile),
        func(e html.AuditEntry) bool {
            return e.Level == html.AuditLevelCritical
        },
    )
    loggerSink := html.NewLoggerAuditSink()

    pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

    // Configuration
    cfg := html.HighSecurityConfig()
    cfg.Audit = html.HighSecurityAuditConfig()
    cfg.Audit.Sink = pipeline

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    // Process content
    data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>Safe content</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Text:", result.Text)
    // Audit logs automatically recorded to files and stderr
}
```

## Batch File Processing

Process HTML files in a directory, collecting results and errors:

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/cybergodev/html"
)

func main() {
    // Collect file paths
    var files []string
    filepath.Walk("./pages", func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        if filepath.Ext(path) == ".html" || filepath.Ext(path) == ".htm" {
            files = append(files, path)
        }
        return nil
    })

    fmt.Printf("Found %d files\n", len(files))

    // Batch process
    p, _ := html.New(html.TextOnlyConfig())
    defer p.Close()

    // Up to 10000 files per batch
    batch := p.ExtractBatchFiles(files)

    fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)

    // Process results
    for i, result := range batch.Results {
        if result != nil {
            fmt.Printf("[%d] %s (words: %d)\n", i, result.Title, result.WordCount)
        }
    }

    // Check errors
    for i, err := range batch.Errors {
        if err != nil {
            fmt.Printf("[%d] Error: %v\n", i, err)
        }
    }
}
```

## Processor Reuse with Timeout

Processor singleton pattern for web service scenarios:

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    data := []byte(r.FormValue("html"))
    if len(data) == 0 {
        http.Error(w, "html field required", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, data)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
    stats := processor.GetStatistics()
    fmt.Fprintf(w, "Processed: %d\nCache hits: %d\nErrors: %d\n",
        stats.TotalProcessed, stats.CacheHits, stats.ErrorCount)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    http.HandleFunc("/stats", statsHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## Extract and Generate Markdown Files

Extract content from HTML pages and save as Markdown:

```go
package main

import (
    "fmt"
    "log"
    "os"
    "strings"

    "github.com/cybergodev/html"
)

func main() {
    p, err := html.New(html.MarkdownConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    urls := []string{
        "downloaded/page1.html",
        "downloaded/page2.html",
        "downloaded/page3.html",
    }

    for _, path := range urls {
        md, err := p.ExtractToMarkdownFromFile(path)
        if err != nil {
            log.Printf("Failed to process %s: %v", path, err)
            continue
        }

        // Generate output filename
        outPath := strings.Replace(path, ".html", ".md", 1)
        if err := os.WriteFile(outPath, []byte(md), 0644); err != nil {
            log.Printf("Failed to write %s: %v", outPath, err)
            continue
        }
        fmt.Printf("✓ %s → %s\n", path, outPath)
    }
}
```
