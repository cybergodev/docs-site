---
sidebar_label: "Advanced Usage"
title: "Advanced Usage - CyberGo html | Advanced Scenarios"
description: "CyberGo html advanced examples: custom Scorer, multi-sink audit pipeline, batch file processing, Processor reuse, graceful HTTP shutdown, and encodings."
sidebar_position: 20
---

# Advanced Usage

Advanced patterns for production use: custom scoring, audit pipelines, batch file processing, server-side reuse, and safe file handling.

## Custom Scorer

Tailor content recognition to a specific site structure. The full implementation lives in [Testing & Custom Extensions](../guides/integration/testing-custom); the core usage follows.

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// myScorer scores nodes by their class attribute
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

// ShouldRemove is a reserved interface method: the current version never calls
// it, so the logic below has no effect
func (s myScorer) ShouldRemove(node html.ContentNode) bool {
	if node == nil {
		return false
	}
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
	// Output: Text: Understanding Go Concurrency
	//
	// Goroutines are Go's lightweight threads.
}
```

The navigation and sidebar are removed by the library's default cleaning and scorer candidate filtering, not by the `ShouldRemove` above.

## Multi-Sink Audit Pipeline

Build a tiered audit pipeline: critical events go to a dedicated file while every event also reaches the log.

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/cybergodev/html"
)

func main() {
	allFile, err := os.Create("audit-all.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	criticalFile, err := os.Create("audit-critical.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	defer allFile.Close()
	defer criticalFile.Close()

	// Pipeline: all events to allFile, critical ones to a second file, everything to stderr
	allSink := html.NewWriterAuditSink(allFile)
	criticalSink := html.NewFilteredSink(
		html.NewWriterAuditSink(criticalFile),
		func(e html.AuditEntry) bool {
			return e.Level == html.AuditLevelCritical
		},
	)
	loggerSink := html.NewLoggerAuditSink()
	pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

	cfg := html.HighSecurityConfig() // already enables HighSecurityAuditConfig
	cfg.Audit.Sink = pipeline

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>Safe content</p></article>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Text:", result.Text)
	// Output: Text: Safe content
}
```

## Batch File Processing

Process every HTML file under a directory, collecting results and errors separately:

```go
package main

import (
	"fmt"
	"io/fs"
	"log"
	"path/filepath"

	"github.com/cybergodev/html"
)

func main() {
	// Collect file paths
	var files []string
	err := filepath.WalkDir("./pages", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip entries that cannot be read
		}
		if d.IsDir() {
			return nil
		}
		switch filepath.Ext(path) {
		case ".html", ".htm":
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Found %d files\n", len(files))

	p, err := html.New(html.TextOnlyConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// One call handles up to 10000 items; above that the whole batch fails, so chunk it yourself
	batch := p.ExtractBatchFiles(files)
	fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
		batch.Success, batch.Failed, batch.Cancelled)

	for i, result := range batch.Results {
		if result != nil {
			fmt.Printf("[%d] %s (words: %d)\n", i, result.Title, result.WordCount)
		}
	}

	for i, err := range batch.Errors {
		if err != nil {
			fmt.Printf("[%d] Error: %v\n", i, err)
		}
	}
}
```

## Processor Reuse with Timeout

A Processor singleton for a web service: created once at startup, shared by every request.

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

Convert a batch of HTML files into Markdown files:

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
	p, err := html.New(html.DefaultConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	paths := []string{
		"downloaded/page1.html",
		"downloaded/page2.html",
		"downloaded/page3.html",
	}

	for _, path := range paths {
		md, err := p.ExtractToMarkdownFromFile(path)
		if err != nil {
			log.Printf("Failed to process %s: %v", path, err)
			continue
		}

		outPath := strings.Replace(path, ".html", ".md", 1)
		if err := os.WriteFile(outPath, []byte(md), 0o644); err != nil {
			log.Printf("Failed to write %s: %v", outPath, err)
			continue
		}
		fmt.Printf("✓ %s → %s\n", path, outPath)
	}
}
```

## Context Cancellation & Graceful Shutdown

Control extraction timeouts with a context in an HTTP service, with request-level cancellation and signal-driven graceful shutdown:

```go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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
	// Request timeout of 5s: when it fires before ProcessingTimeout (10s) the
	// error is context.DeadlineExceeded
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 10*1024*1024))
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}

	result, err := processor.ExtractWithContext(ctx, body)
	if err != nil {
		switch {
		case errors.Is(err, html.ErrProcessingTimeout):
			http.Error(w, "processing timeout", http.StatusGatewayTimeout)
		case errors.Is(err, context.DeadlineExceeded):
			http.Error(w, "request timeout", http.StatusGatewayTimeout)
		case errors.Is(err, html.ErrInputTooLarge):
			http.Error(w, "input too large", http.StatusRequestEntityTooLarge)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"title":      result.Title,
		"word_count": result.WordCount,
	})
}

func main() {
	server := &http.Server{Addr: ":8080"}
	http.HandleFunc("/extract", extractHandler)

	// On a signal, close the Processor first, then the HTTP server
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

Use the `AllowedBaseDir` sandbox for user-supplied file paths:

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
	// Restrict file reads to this directory and its subdirectories
	// The real path is resolved from the opened file handle, blocking symlink/junction escapes
	cfg.AllowedBaseDir = "/var/www/uploads"

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Simulated user-supplied paths
	userFiles := []string{
		"/var/www/uploads/article1.html", // ✅ Allowed
		"/var/www/uploads/sub/page.html", // ✅ Allowed (subdirectory)
		"../../../etc/passwd",            // ❌ Path traversal
		"/etc/shadow",                    // ❌ Outside the directory
	}

	for _, file := range userFiles {
		_, err := p.ExtractFromFile(file)
		if err != nil {
			var fileErr *html.FileError
			if errors.As(err, &fileErr) {
				// SafePath returns only the filename, never the full path
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

## Specifying the Encoding by Source

GBK or Shift_JIS bytes with no `<meta charset>` do not raise an error; they are decoded as windows-1252 and come out garbled. So the encoding must come from the source: an HTTP `Content-Type` header, a site convention, or a detection result. The example below shows how to catch the error from a wrong forced encoding and retry with the right one:

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// extractWithEncoding extracts with a forced encoding, so different encodings
// can be compared
func extractWithEncoding(data []byte, encoding string) (*html.Result, error) {
	cfg := html.DefaultConfig()
	cfg.Encoding = encoding
	return html.Extract(data, cfg)
}

func main() {
	// GBK-encoded HTML with no <meta charset>
	data := []byte("<html><body><h1>" + string([]byte{0xc4, 0xe3, 0xba, 0xc3}) + "</h1></body></html>")

	// Wrongly decoding as utf-8 fails
	_, err := extractWithEncoding(data, "utf-8")
	if err == nil {
		log.Fatal("expected an encoding error")
	}
	fmt.Println("First attempt failed:", strings.HasPrefix(err.Error(), "encoding detection failed"))
	// Output: First attempt failed: true

	// Retry with gbk, the encoding of the source
	result, err := extractWithEncoding(data, "gbk")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Title:", result.Title)
	// Output: Title: 你好
}
```

Encoding errors have no sentinel, so `errors.Is` cannot detect them; check whether `err.Error()` starts with `encoding detection failed`.

## Next Steps

- [FAQ](../faq/) - Common questions and troubleshooting
- [Production Checklist](../guides/security/production-checklist) - Pre-deployment security checks
- [API Reference: Interfaces](../api-reference/types/interfaces) - Extension interfaces such as Scorer and AuditSink
