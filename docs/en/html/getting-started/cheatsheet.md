---
sidebar_label: "Cheat Sheet"
title: "Cheat Sheet - CyberGo html | API at a Glance"
description: "CyberGo html API cheat sheet: Extract and ReadPage functions, Processor methods and lifecycle, Config presets and options, encoding, media, audit, errors."
sidebar_position: 20
---

# Cheat Sheet

Common APIs at a glance; full signatures and parameter descriptions are in the [API Reference](../api-reference/).

## Package Functions

### Extract Content

```go
// Extract full result from bytes
result, err := html.Extract(data)

// Extract from file
result, err := html.ExtractFromFile("page.html")

// Extract text only
text, err := html.ExtractText(data)
text, err = html.ExtractTextFromFile("page.html")
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

### Reader Mode

```go
// Whole page as Markdown (with inline links)
md, err := html.ReadPageToMarkdown(pageBytes)

// Whole page as Markdown without links (link text stays as plain words)
plain, err := html.ReadPageToMarkdownText(pageBytes)

// Sectioned result: filter ReadResult.Sections by Kind, then reassemble
read, err := html.ReadPage(pageBytes)
md = read.Render()        // with links
plain = read.RenderText() // without links
```

### Batch Processing

```go
batch := html.ExtractBatch(pages)
// or
batch := html.ExtractBatchFiles(paths)
```

### Context Variants

Extraction functions have `*WithContext` variants (`GroupLinksByType` is an in-memory grouping helper and has none):

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

// Reader mode
md, err = p.ReadPageToMarkdown(pageBytes)
read, err := p.ReadPage(pageBytes)

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
html.TextOnlyConfig()      // Keeps no images, links, videos, or audio
html.MarkdownConfig()      // Renders inline images and links as Markdown
html.HighSecurityConfig()  // Tightened limits with full audit
```

## Common Configuration Options

```go
cfg := html.DefaultConfig()

// Resource limits
cfg.MaxInputSize = 10 * 1024 * 1024  // Max input bytes; default and ceiling are both 50MB
cfg.ProcessingTimeout = time.Minute  // Per-document processing timeout; default 30s, 0 means no limit
cfg.MaxDepth = 200                   // Max DOM nesting depth; default 500

// Content control
cfg.ExtractArticle = true            // Article detection; default true
cfg.ExtractMetadata = true           // Structured metadata (author, publish time, description, ...); default true
cfg.PreserveImages = true            // Preserve images; default true
cfg.PreserveLinks = true             // Preserve links; default true
cfg.PreserveVideos = false           // Preserve videos; default true, shown here turned off
cfg.PreserveAudios = false           // Preserve audio; default true, shown here turned off

// Output formats
cfg.InlineImageFormat = "markdown"   // none/markdown/html/placeholder; default none; exported constants like html.FormatMarkdown are available
cfg.InlineLinkFormat = "markdown"    // none/markdown/html; default none
cfg.TableFormat = "markdown"         // markdown/html; default markdown

// Link filtering
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// Cache
cfg.MaxCacheEntries = 1000           // default 2000; 0 disables the cache
cfg.CacheTTL = 30 * time.Minute      // default 1 hour
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
        // Library ProcessingTimeout expired
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

An expired caller context returns `context.DeadlineExceeded` and a manual `cancel()` returns `context.Canceled`; neither is normalized to `ErrProcessingTimeout`.

## Encoding Detection

```go
// Auto-detect encoding (default, supports 30+ encodings)
result, err := html.Extract(pageData)

// Manually specify encoding
cfg := html.DefaultConfig()
cfg.Encoding = "shift_jis"
```

Supported encodings include UTF-8, GBK, Shift_JIS, EUC-JP, Windows-1252, and 30+ others. Legacy pages without a `<meta charset>` declaration fall back to windows-1252, so set the encoding explicitly when the source is known.

## Media Extraction

```go
result, err := html.Extract(data)

// Videos
for _, v := range result.Videos {
    fmt.Println(v.URL, v.Type)
}

// Audio
for _, a := range result.Audios {
    fmt.Println(a.URL, a.Type)
}

// Turn off media only (images and links are still kept)
cfg := html.DefaultConfig()
cfg.PreserveVideos = false
cfg.PreserveAudios = false
```

## Audit System

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// Use a custom Sink
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// Get the audit log after processing
entries := p.GetAuditLog()
```

### Audit Sink Quick Reference

```go
// Built-in Sink constructors
html.NewLoggerAuditSink()                   // stderr, [AUDIT] prefix
html.NewLoggerAuditSinkWithWriter(w)        // custom Writer
html.NewWriterAuditSink(w)                  // JSON Lines to io.Writer
html.NewChannelAuditSink(bufSize)           // buffered channel
html.NewMultiSink(sinks...)                 // fan-out to multiple Sinks
html.NewFilteredSink(sink, filterFunc)      // predicate filtering
html.NewLevelFilteredSink(sink, minLevel)   // filter by level

// Channel Sink helper methods
sink.Channel()       // <-chan AuditEntry, consume events
sink.DroppedCount()  // int64, number of dropped events
sink.Close()         // idempotent channel close
```

## Processor Lifecycle

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()               // release resources (idempotent)

stats := p.GetStatistics()    // Statistics{TotalProcessed, CacheHits, ...}
entries := p.GetAuditLog()    // []AuditEntry
p.ClearAuditLog()             // clear in-memory audit log
p.ClearCache()                // clear cache (preserves statistics)
p.ResetStatistics()           // reset stat counters (preserves cache)
```

## Next Steps

- [Content Extraction](../guides/core-features/content-extraction) - Extraction pipeline and article detection
- [Reader Mode](../guides/core-features/reader-mode) - Sectioned whole-page output and Render
- [Processor & Cache](../guides/performance/processor-cache) - Lifecycle and cache tuning
- [API Reference](../api-reference/) - Complete API documentation
