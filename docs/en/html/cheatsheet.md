---
title: "Cheat Sheet - CyberGo HTML | API at a Glance"
description: "CyberGo HTML API cheat sheet on one page: package functions, Processor methods, config presets, key options, error matching, and audit setup."
---

# Cheat Sheet

## Package Functions

### Extract Content

```go
// Extract full result from bytes
result, err := html.Extract(data)

// Extract from file
result, err := html.ExtractFromFile("page.html")

// Extract text only
text, err := html.ExtractText(data)
text, err := html.ExtractTextFromFile("page.html")
```

### Output Formats

```go
md, err := html.ExtractToMarkdown(data)
jsonBytes, err := html.ExtractToJSON(data)
```

### Link Extraction

```go
links, err := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)
```

### Batch Processing

```go
batch := html.ExtractBatch(pages)
// or
batch := html.ExtractBatchFiles(paths)
```

### Context Variants

All functions have `WithContext` variants:

```go
result, err := html.ExtractWithContext(ctx, data)
result, err = html.ExtractFromFileWithContext(ctx, path)
text, err := html.ExtractTextWithContext(ctx, data)
md, err := html.ExtractToMarkdownWithContext(ctx, data)
links, err := html.ExtractAllLinksWithContext(ctx, data)
batch := html.ExtractBatchWithContext(ctx, pages)
```

## Processor

```go
// Create
p, err := html.New(html.DefaultConfig())
defer p.Close()

// Extract
result, err := p.Extract(data)
result, err = p.ExtractFromFile(path)
text, err := p.ExtractText(data)

// Output
md, err := p.ExtractToMarkdown(data)
jsonBytes, err := p.ExtractToJSON(data)

// Links
links, err := p.ExtractAllLinks(data)

// Batch
batch := p.ExtractBatch(pages)

// Statistics
stats := p.GetStatistics()
p.ClearCache()
p.ResetStatistics()

// Audit
entries := p.GetAuditLog()
p.ClearAuditLog()
```

## Configuration Presets

```go
html.DefaultConfig()       // Default configuration
html.TextOnlyConfig()      // Text only
html.MarkdownConfig()      // Markdown output
html.HighSecurityConfig()  // High security
```

## Common Configuration Options

```go
cfg := html.DefaultConfig()

// Resource limits
cfg.MaxInputSize = 10 * 1024 * 1024  // Max input 10MB
cfg.ProcessingTimeout = time.Minute   // Processing timeout
cfg.MaxDepth = 200                    // Max DOM depth

// Content control
cfg.ExtractArticle = true             // Intelligent article recognition
cfg.PreserveImages = true             // Preserve images
cfg.PreserveLinks = true              // Preserve links
cfg.PreserveVideos = false            // Don't preserve videos
cfg.PreserveAudios = false            // Don't preserve audio

// Output formats
cfg.InlineImageFormat = "markdown"    // none/markdown/html/placeholder
cfg.InlineLinkFormat = "markdown"     // none/markdown/html
cfg.TableFormat = "markdown"          // markdown/html

// Link filtering
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// Cache
cfg.MaxCacheEntries = 1000
cfg.CacheTTL = 30 * time.Minute
```

## Error Handling

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // Input too large
    case errors.Is(err, html.ErrInvalidHTML):
        // Invalid HTML
    case errors.Is(err, html.ErrProcessingTimeout):
        // Processing timeout
    case errors.Is(err, html.ErrFileNotFound):
        // File not found
    case errors.Is(err, html.ErrInvalidConfig):
        // Invalid config
    case errors.Is(err, html.ErrProcessorClosed):
        // Processor closed
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // DOM depth exceeded
    case errors.Is(err, html.ErrInvalidFilePath):
        // Invalid file path
    default:
        // Other errors
    }
}
```

## Audit System

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// Use custom Sink
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// Get audit log after processing
entries := p.GetAuditLog()
```
