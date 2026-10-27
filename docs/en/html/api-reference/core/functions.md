---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo html | Signatures & Examples"
description: "CyberGo html package functions: signatures, errors, and sync.Pool reuse for Extract, ExtractText, ExtractToMarkdown, ExtractBatch, and ReadPage."
sidebar_position: 10
---

# Package Functions

Package functions are the one-off entry points of `github.com/cybergodev/html`: they reuse `Processor` instances internally via `sync.Pool`, so you never manage a lifecycle. Pooled instances have the cache disabled and reset their statistics and audit log on return; for caching, statistics, or audit, create a dedicated `Processor` with [html.New](./processor).

## Internal Mechanism

:::info Two conclusions
- **A pooled instance has no cache.** Package functions reuse `Processor` instances through a `sync.Pool`. A pooled instance starts from `DefaultConfig()` with caching turned off (`MaxCacheEntries`, `CacheTTL`, and `CacheCleanup` zeroed), and it resets statistics and audit state on return. Package-function calls therefore never reuse results across calls.
- **Passing a custom `Config` switches to a one-shot instance.** A pooled instance has a fixed config, which cannot be reused safely with a different one. Each call with a custom `Config` therefore creates a new `Processor` and `Close`s it before returning; its cache fields are zeroed as well.

When you need caching, accumulated statistics, or an audit log, create a long-lived `Processor` with [html.New](./processor).
:::

## Config Parameter Resolution

Apart from the `GroupLinksByType` helper, the `cfg ...Config` parameter of every package function is optional and variadic, parsed by the internal `resolveConfig`:

| Argument | Behavior | Pooled? |
|----------|----------|:-------:|
| None | Uses `DefaultConfig()` | Yes (`pooled=true`) |
| One | Uses that `Config` on a one-shot Processor | **No** (`pooled=false`) |
| Two or more | Returns `ErrMultipleConfigs` | — |

:::warning Switch to a Processor when you need caching or accumulated statistics
Neither the pooled path nor the one-shot instance has a cache, and neither retains statistics or audit entries across calls. When you need to reuse a custom config across loops, HTTP handlers, or batch jobs and want the cache to pay off, create a [Processor](./processor) directly.
:::

## Constructors

### New

Creates a dedicated `Processor` instance. The cache, accumulated statistics, and audit log live on the instance and stay queryable.

```go
func New(cfg ...Config) (*Processor, error)
```

`cfg ...Config` follows the resolution rules above (omitted uses `DefaultConfig()`; two or more return `ErrMultipleConfigs`), then `Config.Validate()` runs. Unlike the pooled and one-shot instances behind package functions, the instance from `New` holds a long-lived cache and cumulative statistics. See [Processor](./processor) for the method list and lifecycle.

## Content Extraction

### Extract

Extract content from HTML bytes and return the full `Result`.

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `htmlBytes` | `[]byte` | HTML content |
| `cfg` | `...Config` | Optional config, at most one |

**Example**:

```go
result, err := html.Extract(data)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

Full example with field access and error handling:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	data := []byte(`<html><head><title>Example Page</title></head>
<body><h1>Welcome</h1><p>Body content <a href="https://example.com">link</a>.</p></body></html>`)

	// No Config passed: uses the pooled path
	result, err := html.Extract(data)
	if err != nil {
		log.Fatalf("extraction failed: %v", err)
	}

	fmt.Println("Title:", result.Title)
	fmt.Println("Words:", result.WordCount)
	fmt.Println("Links:", len(result.Links))
	// Output:
	// Title: Example Page
	// Words: 5
	// Links: 1
}
```

**Error returns**: `Extract` returns the same errors as [Processor.Extract](./processor#error-returns), plus two that are specific to package functions:

| Error | Condition |
|-------|-----------|
| `ErrMultipleConfigs` | Two or more `Config` arguments passed |
| `ErrInvalidConfig` (wrapped in `*ConfigError`) | The passed `Config` fails validation (e.g. `MaxInputSize<=0`) |

### ExtractFromFile

Extract content from an HTML file.

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

**Error returns**: in addition to `Extract`'s errors, file access may return a `*FileError`: `FileErr` wraps `ErrFileNotFound` (file does not exist) or `ErrInvalidFilePath` (empty path; a path-traversal denial for paths containing `..` components also wraps the latter, so `errors.Is` matches). When `AllowedBaseDir` is configured and the path escapes it, `FileErr` is `path outside allowed directory`, which matches no sentinel error (see [Security](../modules/security)). A file larger than `MaxInputSize` is rejected before it is read, returning an `*InputError` wrapping `ErrInputTooLarge`.

## Text Extraction

### ExtractText

Extract plain text only.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

`ExtractTextFromFile` is the file variant of `ExtractText`: it reads an HTML file from disk and returns its plain text. File-access errors are the same as [`ExtractFromFile`](#extractfromfile).

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

```go
text, err := html.ExtractTextFromFile("page.html")
if err != nil {
	log.Fatal(err)
}
```

## Context Variants

Every extraction, output, link, and batch function has a `context.Context` variant for cancellation and timeout control; `New` and `GroupLinksByType` have none.

| Function | Signature |
|----------|-----------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## Output Formats

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | File → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | With context |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | File + context |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | File → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | With context |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | File + context |

For usage and examples see [Output Formats](../modules/output).

## Link Extraction

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | Extract all links |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | Extract links from a file |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | With context |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | File + context |

Companion grouping helper:

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

Groups link resources into a `map[type][]LinkResource` keyed by `LinkResource.Type` (`link`/`image`/`css`, etc.).

For usage and examples see [Link Extraction](../modules/links).

## Batch Processing

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | Batch extraction |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | With context |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | Batch file extraction |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | Files + context |

For usage and examples see [Batch Processing](../modules/batch).

## Reader Mode

Reader mode returns a whole-page sectioned view (`*ReadResult`) instead of picking a single article: links are always preserved, and navigation and footer blocks are labeled by kind. There are 12 package functions; signatures, the `ReadResult`/`PageSection`/`SectionKind` structures, and the key semantics are in [Reader Mode](./reader).

| Function | Description |
|----------|-------------|
| `ReadPage` | Whole-page sections |
| `ReadPageWithContext` | With context |
| `ReadPageFromFile` | Read from a file |
| `ReadPageFromFileWithContext` | File + context |
| `ReadPageToMarkdown` | Whole-page Markdown (with links) |
| `ReadPageToMarkdownWithContext` | With context |
| `ReadPageToMarkdownText` | Whole-page Markdown (no links) |
| `ReadPageToMarkdownTextWithContext` | With context |
| `ReadPageFromFileToMarkdown` | File → Markdown (with links) |
| `ReadPageFromFileToMarkdownWithContext` | File + context |
| `ReadPageFromFileToMarkdownText` | File → Markdown (no links) |
| `ReadPageFromFileToMarkdownTextWithContext` | File + context |

`ReadPage*` **does not participate in the extraction cache**; `ReadPage*ToMarkdown*` uses a temporary Processor internally and never pollutes the main cache. See [Reader Mode](./reader).

## Package Functions vs Processor

Both call into `Processor` underneath; they differ in resource reuse and retained state:

| Dimension | Package functions | [Processor](./processor) |
|-----------|-------------------|---------------------------|
| Cache | **None** (pooled config `MaxCacheEntries=0`) | Yes (deep copy returned on hit) |
| Statistics | Not retained across calls (`ResetStatistics` on pooled return; the custom-`Config` path discards the instance) | Accumulated; `GetStatistics` anytime |
| Audit log | Not retained across calls (`ClearAuditLog` on pooled return; the custom-`Config` path discards the instance) | Accumulated; queryable via `GetAuditLog` |
| Custom `Config` | One-shot Processor created and destroyed per call (cache fields zeroed) | Same instance reused |
| Lifecycle | Automatic (pool or one-shot instance) | Manual `defer Close()` |
| Suited for | One-off calls, scripts, low-frequency requests | High-frequency calls, long-running services, caching |

:::tip When to switch to a Processor
A single or occasional call is fine with package functions. When you extract repeatedly inside loops, HTTP handlers, or batch jobs, create one long-lived `Processor` and reuse it; only then does the cache pay off.
:::
