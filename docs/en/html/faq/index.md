---
sidebar_label: "FAQ"
title: "FAQ - CyberGo html | Common Answers"
description: "CyberGo html FAQ: choosing package functions vs Processor, encoding detection, input limits, batch caps, empty-text debugging, and statistics monitoring."
sidebar_position: 1
---

# FAQ

## What's the difference between package functions and Processor?

**Package functions** (e.g., `html.Extract`) use `sync.Pool` internally to reuse Processors, suitable for low-frequency, one-time calls. The Processor is returned to the pool after each call.

**Processor** (e.g., `p := html.New()`) is suited for high-frequency calls, reusing cache and internal resources. It also supports statistics collection and audit logging.

```go
// Low frequency: package functions
result, _ := html.Extract(data)

// High frequency: Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## How to handle encoding issues?

The HTML library auto-detects 15+ encodings (UTF-8, GBK, Shift_JIS, Windows-1252, etc.). Manual specification is usually not needed.

To force a specific encoding:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## What's the input size limit?

Default maximum is 50MB (`DefaultMaxInputSize = 52428800`). Adjustable via config:

```go
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB
```

## How to get Markdown output?

```go
md, err := html.ExtractToMarkdown(data)
```

Or using Processor:

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## What's the batch processing limit?

A single batch supports up to 10000 items. For larger datasets, process in multiple batches.

## Why is the extracted text empty?

Possible causes:

1. **HTML structure issue** - Content is inside `<script>` or `<style>` tags
2. **Content empty after sanitization** - If the body text only exists inside tags removed by sanitization (e.g., `<iframe>`, `<object>`), the result may be empty; for trusted input you can temporarily set `EnableSanitization = false` to investigate
3. **Empty input** - Check whether the input byte array is empty (blank content returns an empty `Result`)
4. **Article detection** - Try disabling `ExtractArticle` to see whether content can be extracted

:::tip Distinguish errors from empty results
DOM nesting that exceeds `MaxDepth` does not produce empty text — it returns the `ErrMaxDepthExceeded` error. If a call returns an `error`, prefer using `errors.Is` to determine the error type rather than checking whether the text is empty.
:::

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // Disable article recognition
```

## How to monitor processing statistics?

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// After processing some content
stats := p.GetStatistics()
fmt.Printf("Processed: %d\n", stats.TotalProcessed)
fmt.Printf("Cache hits: %d\n", stats.CacheHits)
fmt.Printf("Avg duration: %v\n", stats.AverageProcessTime)
fmt.Printf("Errors: %d\n", stats.ErrorCount)
```

## How to enable auditing?

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

See [Audit System](../api-reference/modules/audit) for details.

## Are file paths secure?

`FileError` automatically truncates full paths to prevent server path leakage in error messages:

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // Filename only, not full path
}
```

## How to implement custom content scoring?

Implement the `Scorer` interface:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // Custom scoring logic
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // Custom removal logic
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

See [Interfaces](../api-reference/types/interfaces) for details.
