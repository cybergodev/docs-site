---
sidebar_label: "Advanced Usage"
title: "Advanced Usage - CyberGo html | Advanced Scenarios"
description: "CyberGo html advanced examples: custom Scorer, multi-Sink audit pipeline, batch concurrency, Processor pooling, cache hit-rate, and web-service singletons."
sidebar_position: 20
---

# Advanced Usage

## Custom Scorer

Customize content recognition logic for specific website structures. See [Testing & Custom Extensions](../guides/integration/testing-custom) for the full implementation. Here's the core usage:

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// Implement custom Scorer (full example in guides/integration/testing-custom)
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

// ShouldRemove is not called by the library in the current version (implemented to satisfy the interface)
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

	// single batch limit 10000; exceeding it fails the whole batch — caller must chunk
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

## Context Cancellation & Graceful Shutdown

Use context to control extraction timeouts in an HTTP service, supporting request-level cancellation:

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 10 * time.Second
	cfg.MaxCacheEntries = 5000
	var err error
	processor, err = html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
	// Request-level timeout (5s), stacked with ProcessingTimeout (10s); whichever fires first wins
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	body := make([]byte, 0)
	buf := make([]byte, 4096)
	for {
		n, err := r.Body.Read(buf)
		body = append(body, buf[:n]...)
		if err != nil {
			break
		}
		if len(body) > 10*1024*1024 {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			return
		}
	}

	result, err := processor.ExtractWithContext(ctx, body)
	if err != nil {
		switch {
		case errors.Is(err, html.ErrProcessingTimeout):
			http.Error(w, "processing timeout", http.StatusGatewayTimeout)
		case errors.Is(err, html.ErrInputTooLarge):
			http.Error(w, "input too large", http.StatusRequestEntityTooLarge)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"title":"%s","word_count":%d}`, result.Title, result.WordCount)
}

func main() {
	defer processor.Close()

	server := &http.Server{Addr: ":8080"}
	http.HandleFunc("/extract", extractHandler)

	// Graceful shutdown: close the Processor and HTTP server on signal
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("Shutting down...")
		processor.Close()
		server.Shutdown(context.Background())
	}()

	log.Println("Server started on :8080")
	log.Fatal(server.ListenAndServe())
}
```

## Secure File Processing

Use the `AllowedBaseDir` sandbox to process user-supplied file paths:

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()
	// Restrict file reading to this directory and its subdirectories
	// Resolves real paths via OS file handle, preventing symlink/junction bypass
	cfg.AllowedBaseDir = "/var/www/uploads"

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Simulated user-supplied file paths
	userFiles := []string{
		"/var/www/uploads/article1.html", // ✅ Allowed
		"/var/www/uploads/sub/page.html", // ✅ Allowed (subdirectory)
		"../../../etc/passwd",            // ❌ Path traversal
		"/etc/shadow",                    // ❌ Outside directory
	}

	for _, file := range userFiles {
		_, err := p.ExtractFromFile(file)
		if err != nil {
			var fileErr *html.FileError
			if errors.As(err, &fileErr) {
				// SafePath returns only the file name, not the full path
				fmt.Printf("❌ Rejected %s: %s\n", fileErr.SafePath(), fileErr.FileErr)
			} else {
				fmt.Printf("❌ Error: %v\n", err)
			}
			continue
		}
		fmt.Printf("✅ Processed successfully: %s\n", file)
	}
}
```

## Encoding Detection Fallback

Fall back to a manually specified encoding when auto-detection fails:

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// extractWithFallback tries auto-detection first, then retries with a specified encoding on failure
func extractWithFallback(data []byte, fallback string) (*html.Result, error) {
	result, err := html.Extract(data)
	if err == nil {
		return result, nil
	}
	if strings.Contains(err.Error(), "encoding detection failed") {
		cfg := html.DefaultConfig()
		cfg.Encoding = fallback
		return html.Extract(data, cfg)
	}
	return nil, err
}

func main() {
	// Simulate GBK-encoded HTML of unknown origin (no meta charset)
	data := []byte{0xbb, 0xb9, 0xca, 0xc7, 0xd3, 0xd0, 0xd2, 0xbb, 0xb8, 0xf6}

	result, err := extractWithFallback(data, "gbk")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Title: %s\nText length: %d\n", result.Title, len(result.Text))
}
```

## Next Steps

- [FAQ](../faq/) - Common questions and troubleshooting
- [Production Checklist](../guides/security/production-checklist) - Pre-deployment security checks
- [API Reference: Interfaces](../api-reference/types/interfaces) - Extension interfaces such as Scorer and AuditSink
