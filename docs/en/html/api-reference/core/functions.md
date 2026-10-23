---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo html | Usage & Examples"
description: "CyberGo html package-level functions: Extract, ExtractText, ExtractToMarkdown, ExtractToJSON, ExtractBatch; sync.Pool reuse, cache disabled, one-off calls."
sidebar_position: 10
---

# Package Functions

Package-level functions are suited for one-off call scenarios; they reuse `Processor` instances internally via `sync.Pool` and require no manual lifecycle management. Note: pooled Processors have cache and audit retention disabled; for caching/statistics/audit, use [html.New](./processor) to create a dedicated Processor.

## Internal Mechanism

:::info
Package functions maintain a `sync.Pool` underneath that reuses `Processor` instances between calls to avoid repeated allocation. Key implementation details:

- **Pooled config disables the cache**: the pooled config (`poolCfg`) is based on `DefaultConfig()` but explicitly zeroes three cache-related fields — `MaxCacheEntries=0`, `CacheTTL=0`, `CacheCleanup=0`. As a result, **package functions cannot leverage the cache**; every call is a full processing pass. This is by design, because the pooled Processor clears its cache on every return; enabling the cache would only pay hashing and map-write overhead that could never hit.
- **State reset on return**: before returning the Processor at the end of each call, `ResetStatistics`, `audit.Wait()`, `ClearAuditLog`, and `ClearCache` are executed in turn, preventing cross-call leakage of statistics, audit, and cache state.
- **Closed Processors are not returned**: if a Processor is closed during use (a misuse), the return logic discards it instead of putting it back in the pool (`sync.Pool` tolerates a missing `Put`; the next `Get` rebuilds via `pool.New`).
- **Panic fallback**: `pool.New` only panics when a library invariant is broken (`poolCfg` is derived from `DefaultConfig()` and is valid by construction); this panic is caught by `getPooledProcessorSafe`, wrapped into `ErrInternalPanic`, and returned — it never escapes to the public API.
:::

## Config Parameter Resolution

The `cfg ...Config` of all package functions is an optional variadic parameter, parsed by the internal `resolveConfig`:

| Argument | Behavior | Pooled? |
|----------|----------|:-------:|
| None | Uses `DefaultConfig()` | Yes (`pooled=true`) |
| One | Uses that `Config` | **No** (`pooled=false`) |
| Two or more | Returns `ErrMultipleConfigs` | — |

:::warning
When a custom `Config` is passed, the call does **not** go through `sync.Pool` — the pool only stores Processors based on `DefaultConfig()` and cannot safely reuse instances with different configs. In this case each call `New`s a temporary Processor and `Close`s it when done. If you need to reuse a custom config across high-frequency calls, create a [Processor](./processor) directly.
:::

## Constructors

### New

Creates a dedicated `Processor` instance — the sole entry point for caching, statistics, and audit capabilities.

```go
func New(cfg ...Config) (*Processor, error)
```

`cfg ...Config` follows the same resolution rules as the table above (omitted uses `DefaultConfig()`; two or more return `ErrMultipleConfigs`), followed by `Config.Validate()`. Unlike the pooled/temporary instances of package functions, the instance returned by `New` **holds a long-lived cache and cumulative statistics**. For the full method list and lifecycle see [Processor](./processor).

## Content Extraction

### Extract

Extract content from HTML bytes, returning the full `Result`.

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `htmlBytes` | `[]byte` | HTML content |
| `cfg` | `...Config` | optional config, at most one |

**Example**:

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

Full runnable example (demonstrates field access and error handling):

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

	// No Config passed — goes through the pooled path
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

**Error returns**: `Extract` returns the same errors as [Processor.Extract](./processor#error-returns) and may additionally return:

| Error | Condition |
|-------|-----------|
| `ErrMultipleConfigs` | Two or more `Config` arguments passed |
| `ErrInvalidConfig` (wrapped in `*ConfigError`) | The passed `Config` fails validation (e.g. `MaxInputSize<=0`) |

### ExtractFromFile

Extract content from an HTML file.

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

**Error returns**: in addition to `Extract`'s errors, file access may return a `*FileError` wrapping `ErrFileNotFound`, `ErrInvalidFilePath`, or a path-traversal denial (see [Security](../modules/security) for `AllowedBaseDir`).

## Text Extraction

### ExtractText

Extract only the plain text content.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

`ExtractTextFromFile` is the file-based variant of `ExtractText`, extracting plain text from an HTML file on disk; file-access errors are likewise wrapped into a `*FileError` (`ErrFileNotFound`, `ErrInvalidFilePath`, or a path-traversal denial).

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## Context Variants

All functions have variants that take a `context.Context` for cancellation and timeout control:

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

For detailed usage and examples see [Output Formats](../modules/output).

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

Groups link resources into a `map[string][]LinkResource` keyed by the `LinkResource.Type` field (`link`/`image`/`css`, etc.).

For detailed usage and examples see [Link Extraction](../modules/links).

## Batch Processing

| Function | Signature | Description |
|----------|-----------|-------------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | Batch extraction |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | With context |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | Batch file extraction |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | Files + context |

For detailed usage and examples see [Batch Processing](../modules/batch).

## Package Functions vs Processor

Both ultimately call `Processor` underneath, but they differ markedly in resource reuse and state retention:

| Dimension | Package functions | [Processor](./processor) |
|-----------|-------------------|---------------------------|
| Cache | **None** (pooled config `MaxCacheEntries=0`) | Yes (returns a deep copy on hit) |
| Statistics | Reset each call (`ResetStatistics` on return) | Accumulated; `GetStatistics` anytime |
| Audit log | Cleared each call (`ClearAuditLog` on return) | Accumulated; queryable via `GetAuditLog` |
| Custom `Config` | Creates + destroys a temporary Processor each call | Reuses the same instance |
| Lifecycle | Auto-managed (pool / temporary instance) | Requires manual `defer Close()` |
| Suited for | One-off calls, scripts, low-frequency requests | High-frequency calls, long-running services, cache-needing |

:::tip
For a single extraction or an occasional call, package functions are the easiest. If you need to extract repeatedly inside loops, HTTP handlers, or batch jobs, create a long-lived `Processor` and reuse it; the cache can then substantially reduce overhead.
:::
