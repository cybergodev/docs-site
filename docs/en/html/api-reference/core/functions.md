---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo html | Signatures & Examples"
description: "CyberGo html package functions: signatures, examples, and errors for Extract, ExtractText, ExtractToMarkdown, and ExtractBatch."
sidebar_position: 10
---

# Package Functions

Package functions are the one-off entry points of `github.com/cybergodev/html`: they reuse `Processor` instances internally via `sync.Pool`, so you never manage a lifecycle. Pooled instances have the cache disabled and reset their statistics and audit log on return; for caching, statistics, or audit, create a dedicated `Processor` with [html.New](./processor).

## Internal Mechanism

:::info How the pool works
Package functions keep a `sync.Pool` that reuses `Processor` instances between calls, avoiding repeated allocation. Four rules govern it:

- **Pooled config disables the cache**: `poolCfg` starts from `DefaultConfig()` but zeroes `MaxCacheEntries`, `CacheTTL`, and `CacheCleanup`. A pooled instance calls `ClearCache()` on every return, so its cache is always empty; enabling the cache would only pay hashing and map-write overhead (`Get` always misses) and start a goroutine that sweeps an empty cache.
- **State reset on return**: before returning the instance, `ResetStatistics`, `audit.Wait()`, `ClearAuditLog`, and `ClearCache` run in order, so statistics, audit, and cache state never leak across calls.
- **Closed instances are not returned**: an instance closed during use (a misuse) is discarded instead of going back into the pool; `sync.Pool` tolerates a missing `Put`, and the next `Get` rebuilds via `pool.New`.
- **Panic fallback**: `pool.New` panics only when a library invariant breaks (`poolCfg` derives from `DefaultConfig()` and is valid by construction). `getPooledProcessorSafe` recovers that panic and returns it wrapped as `ErrInternalPanic`, so it never escapes the public API.
:::

## Config Parameter Resolution

The `cfg ...Config` parameter of every package function is optional and variadic, parsed by the internal `resolveConfig`:

| Argument | Behavior | Pooled? |
|----------|----------|:-------:|
| None | Uses `DefaultConfig()` | Yes (`pooled=true`) |
| One | Uses that `Config` on a one-shot Processor | **No** (`pooled=false`) |
| Two or more | Returns `ErrMultipleConfigs` | — |

:::warning A custom Config bypasses the pool
The pool only holds instances built from `DefaultConfig()`, and an instance with a different config cannot be safely reused. When you pass a custom `Config`, each call `New`s a one-shot Processor and `Close`s it when done; `MaxCacheEntries`, `CacheTTL`, and `CacheCleanup` are forced to zero, so that instance has no cache either. To reuse a custom config across high-frequency calls, create a [Processor](./processor) directly.
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

**Error returns**: in addition to `Extract`'s errors, file access may return a `*FileError` wrapping `ErrFileNotFound`, `ErrInvalidFilePath`, or a path-traversal denial (see `AllowedBaseDir` in [Security](../modules/security)).

## Text Extraction

### ExtractText

Extract plain text only.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

The file variant of `ExtractText`: reads an HTML file from disk and returns its plain text. File-access errors are wrapped as `*FileError` (`ErrFileNotFound`, `ErrInvalidFilePath`, or a path-traversal denial).

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
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

## Package Functions vs Processor

Both call into `Processor` underneath; they differ in resource reuse and retained state:

| Dimension | Package functions | [Processor](./processor) |
|-----------|-------------------|---------------------------|
| Cache | **None** (pooled config `MaxCacheEntries=0`) | Yes (deep copy returned on hit) |
| Statistics | Reset each call (`ResetStatistics` on return) | Accumulated; `GetStatistics` anytime |
| Audit log | Cleared each call (`ClearAuditLog` on return) | Accumulated; queryable via `GetAuditLog` |
| Custom `Config` | One-shot Processor created and destroyed per call (cache fields zeroed) | Same instance reused |
| Lifecycle | Automatic (pool or one-shot instance) | Manual `defer Close()` |
| Suited for | One-off calls, scripts, low-frequency requests | High-frequency calls, long-running services, caching |

:::tip When to switch to a Processor
A single or occasional call is fine with package functions. When you extract repeatedly inside loops, HTTP handlers, or batch jobs, create one long-lived `Processor` and reuse it; only then does the cache pay off.
:::
