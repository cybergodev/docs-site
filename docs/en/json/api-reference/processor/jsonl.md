---
sidebar_label: "JSONL"
title: "Processor JSONL Methods - CyberGo JSON | StreamJSONL Usage"
description: "CyberGo JSON Processor JSONL methods: StreamJSONL line-by-line, StreamJSONLParallel workers, and MapJSONL/ReduceJSONL/FilterJSONL — ideal for log analysis."
sidebar_position: 80
---

# Processor JSONL Methods

The Processor provides complete JSONL (JSON Lines) streaming capabilities: line-by-line processing, parallel processing, batch processing, and functional operations.

:::tip Full tutorial
Want the JSONL/NDJSON concepts and streaming practices? See the complete tutorial in [JSONL Processors](../../streaming/jsonl).
:::

## Streaming Read Methods

### StreamJSONL

Signature: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL data, reading line by line and invoking the callback. The callback returns `nil` to continue with the next line, `item.Break()` for a clean early termination (overall return `nil`), or any other error to stop immediately and return it. Panics inside the callback are caught and converted into returned errors — the process is never taken down.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `fn` | `func(lineNum int, item *IterableValue) error` | Handler: `nil` continue / `item.Break()` stop / other error interrupts |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    level := item.GetString("level")
    msg := item.GetString("message")
    fmt.Printf("[%d] %s: %s\n", lineNum, level, msg)
    return nil
})
```

---

### StreamJSONLParallel

Signature: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes JSONL data in parallel with multiple worker goroutines.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `workers` | `int` | Worker goroutine count (defaults to 4 when ≤0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Handler |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("large.jsonl")
defer file.Close()

var count int64
err := processor.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    atomic.AddInt64(&count, 1)
    // CPU-intensive processing...
    return nil
})
fmt.Printf("Processed %d lines\n", count)
```

:::tip Performance advice
- Best for CPU-bound work (data transformation, computation)
- For I/O-bound work, prefer single-threaded `StreamJSONL`
- Set workers to the number of CPU cores
:::

### StreamJSONLParallelWithContext

Signature: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Context-aware parallel JSONL processing with cancellation and timeout control.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `ctx` | `context.Context` | Context for cancellation or timeout |
| `reader` | `io.Reader` | JSONL data source |
| `workers` | `int` | Worker goroutine count (defaults to 4 when ≤0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Handler |

```go
processor, _ := json.New()
defer processor.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := processor.StreamJSONLParallelWithContext(ctx, reader, 8, func(lineNum int, item *json.IterableValue) error {
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

---

### StreamJSONLChunked

Signature: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Processes JSONL data in chunks, handling a batch of elements at a time.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `chunkSize` | `int` | Elements per batch |
| `fn` | `func(chunk []*IterableValue) error` | Batch handler |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // Batch insert into the database
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:    item.GetInt("id"),
            Name:  item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

---

### StreamJSONLFile

Signature: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams a JSONL file directly.

```go
processor, _ := json.New()
defer processor.Close()

err := processor.StreamJSONLFile("logs.jsonl", func(lineNum int, item *json.IterableValue) error {
    if item.GetString("level") == "error" {
        logErrors(item)
    }
    return nil
})
```

---

## Functional Operation Methods

### ForeachJSONL

Signature: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

An alias method for iterating JSONL data; behaves identically to `StreamJSONL`.

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

Signature: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps JSONL data into a new format, returning the transformed slice.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Extract all user names
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

Signature: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

Reduces JSONL data to a single value.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// Compute total sales
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("Total sales: %.2f\n", total.(float64))
```

---

### FilterJSONL

Signature: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

Filters JSONL data, returning the elements that satisfy the predicate.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// Filter error logs
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("Found %d error logs\n", len(errors))
```

---

### CollectJSONL

Signature: `func (p *Processor) CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

Collects all JSONL data into a slice.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

items, err := processor.CollectJSONL(file)
if err != nil {
    panic(err)
}
fmt.Printf("Collected %d records\n", len(items))
```

::: warning Memory note
This method loads all data into memory — unsuitable for very large files. Prefer line-by-line `StreamJSONL` for large files.
:::

---

### FirstJSONL

Signature: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Finds the first element satisfying the predicate.

**Returns**

| Type | Description |
|------|-------------|
| `*IterableValue` | The found element, if any |
| `bool` | Whether one was found |
| `error` | Error information |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Find the first administrator
admin, found, err := processor.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetBool("is_admin")
})
if err != nil {
    panic(err)
}
if found {
    fmt.Printf("Admin: %s\n", admin.GetString("name"))
}
```

---

## JSONL Conversion Methods

The Processor also provides three methods corresponding to the [package-level JSONL conversion functions](../functions/jsonl#jsonl-processing-functions) — `ParseJSONL`, `ToJSONL`, and `ToJSONLString`. Their signatures match the package-level versions (including the trailing `cfg ...Config`), a natural fit for reusing an already-configured processor:

### ParseJSONL

Signature: `func (p *Processor) ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Parses a JSONL byte slice into `[]any`, where each element is the parse result of one line.

### ToJSONL

Signature: `func (p *Processor) ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Encodes a slice of values into JSONL bytes (one JSON value per line).

### ToJSONLString

Signature: `func (p *Processor) ToJSONLString(data []any, cfg ...Config) (string, error)`

Encodes a slice of values into a JSONL string — the same output as `ToJSONL`, returned as a `string`.

---

## The NDJSONProcessor Standalone Processor

<Badge type="danger" text="Deprecated" />

::: warning Deprecated (permanent deprecated alias)
`NDJSONProcessor` / `NewNDJSONProcessor` is a **permanently deprecated alias**: in new code create a `Processor` with `json.New(cfg)` and use the [`StreamJSONL`](#streamjsonl) family ([`StreamJSONL`](#streamjsonl), [`StreamJSONLFile`](#streamjsonlfile), and the parallel/chunked variants) — both are driven by the same engine, governed by the same security limits, and the StreamJSONL side adds `IterableValue` typed getters. `NDJSONProcessor` will not be removed within v1.
:::

`NDJSONProcessor` is a standalone NDJSON (newline-delimited JSON) line-by-line processor, independent of `Processor`: the callback receives a `map[string]any` directly (instead of an `IterableValue`), no `Processor` instance is needed, and empty lines are **always** skipped. It is retained as a **legacy API** (new code should use the `StreamJSONL` family); when you need typed getters, parallel processing, or Map/Reduce/Filter functional composition, likewise use the `StreamJSONL` family above. The API reference below remains useful for existing code.

### NewNDJSONProcessor

<Badge type="danger" text="Deprecated" />

Signature: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

`NewNDJSONProcessor` takes an optional cfg, following the unified Config pattern. Deprecated (see the warning in the section above): use `json.New(cfg)` plus the `StreamJSONL` family in new code.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `cfg` | `...Config` | Optional configuration; `DefaultConfig()` when omitted; the read buffer comes from `JSONLBufferSize` (falls back to 64KB when ≤0) |

The other JSONL fields (`JSONLMaxLineSize`, `JSONLMaxMemory`, `JSONLSkipComments`, `JSONLContinueOnErr`, `MaxNestingDepthSecurity`) take effect during processing; see [Configuration Options](#configuration-options).

### ProcessFile

Signature: `func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

`ProcessFile` processes an NDJSON file line by line. The file path first passes security validation such as path-traversal checks (an illegal path returns `ErrSecurityViolation`), then behaves like calling `ProcessReader` on the opened file; errors such as file-open failures are wrapped into `JsonsError`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filename` | `string` | NDJSON file path (security-validated first) |
| `fn` | `func(lineNum int, obj map[string]any) error` | Per-line callback; returning an error terminates immediately and propagates verbatim |

### ProcessReader

Signature: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

`ProcessReader` processes NDJSON from an `io.Reader` line by line: each line is parsed into a `map[string]any` before the callback runs, and callback panics are caught and converted into returned errors. Security limits match the `StreamJSONL` family — per-line size bounded by `JSONLMaxLineSize` (falls back to 1MB when ≤0), total processing bounded by `JSONLMaxMemory` (fallback `MaxMemory`), and nesting depth checked per line against `MaxNestingDepthSecurity` before parsing; with `JSONLContinueOnErr=true`, lines that fail to parse are skipped and processing continues.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | NDJSON data source |
| `fn` | `func(lineNum int, obj map[string]any) error` | Per-line callback; returning an error terminates immediately and propagates verbatim |

<!-- check-code: skip -->
```go
np := json.NewNDJSONProcessor()

err := np.ProcessReader(strings.NewReader(`{"id":1}`), func(lineNum int, obj map[string]any) error {
    fmt.Printf("Line %d: id=%v\n", lineNum, obj["id"])
    return nil
})
```

**Complete example** (empty lines always skipped; line numbers keep the original physical numbering):

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	np := json.NewNDJSONProcessor()

	data := "{\"id\":1}\n\n{\"id\":2}\n"
	var count int

	err := np.ProcessReader(strings.NewReader(data), func(lineNum int, obj map[string]any) error {
		count++
		fmt.Printf("Line %d: id=%v\n", lineNum, obj["id"])
		return nil
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d lines in total\n", count)
	// Output:
	// Line 1: id=1
	// Line 3: id=2
	// Processed 2 lines in total
}
```

:::tip Choosing between this and StreamJSONL
`NDJSONProcessor` is retained for legacy compatibility; new code should always use the `StreamJSONL` family (typed getters `GetInt`/`GetString`, parallel workers, chunking, and functional pipelines are all provided there). Both are governed by the same set of JSONL security limits.
:::

---

## Configuration Options

JSONL processing behavior is configurable through these `Config` fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | Read buffer size |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | Maximum bytes per line |
| `JSONLSkipEmpty` | `bool` | `true` | Skip empty lines |
| `JSONLSkipComments` | `bool` | `false` | Skip `#` or `//` comments |
| `JSONLContinueOnErr` | `bool` | `false` | Continue on parse errors (when `true`, every JSONL engine — the `StreamJSONL` family on this page, `NDJSONProcessor`, and `StreamLinesInto` — skips bad lines and continues; when `false`, processing aborts immediately with a line-numbered error) |
| `JSONLWorkers` | `int` | 4 | Parallel worker goroutine count |
| `JSONLChunkSize` | `int` | 1000 | Batch size for chunked processing |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | Maximum memory usage |

:::tip Per-call cfg overrides the processor's fixed configuration
The optional `cfg ...Config` at the end of the methods on this page takes effect **for that call only**: the provided cfg wholly replaces the processor's JSONL-related settings (buffer/per-line limits, memory limit, nesting depth, `JSONLSkipComments`, `JSONLContinueOnErr`, etc.); when omitted, the configuration fixed at `New(cfg)` is used. Also note: the explicit `workers` parameter of `StreamJSONLParallel` and the explicit `chunkSize` parameter of `StreamJSONLChunked` take **precedence over** the `JSONLWorkers` / `JSONLChunkSize` fields. Additionally, each line is depth-checked against `MaxNestingDepthSecurity` before parsing, protecting the stack from deeply nested payloads.
:::

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // Skip comment lines
cfg.JSONLContinueOnErr = true    // Continue on parse errors
cfg.JSONLWorkers = 8             // 8 parallel workers

processor, _ := json.New(cfg)
defer processor.Close()
```

---

## Complete Examples

### Log Analysis

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

func main() {
	processor, _ := json.New()
	defer processor.Close()

	file, _ := os.Open("app.log.jsonl")
	defer file.Close()

	var errorCount, warningCount int

	err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
		level := item.GetString("level")
		switch level {
		case "error":
			errorCount++
			fmt.Printf("[ERROR] %s\n", item.GetString("message"))
		case "warning":
			warningCount++
		}
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("Summary: %d errors, %d warnings\n", errorCount, warningCount)
}
```

### Parallel Data Processing

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
	"sync/atomic"
)

func main() {
	cfg := json.DefaultConfig()
	cfg.JSONLWorkers = 16 // 16 parallel workers

	processor, _ := json.New(cfg)
	defer processor.Close()

	file, _ := os.Open("large_data.jsonl")
	defer file.Close()

	var processed int64

	err := processor.StreamJSONLParallel(file, 16, func(lineNum int, item *json.IterableValue) error {
		// CPU-intensive processing (replace with your business logic)
		_ = item
		atomic.AddInt64(&processed, 1)
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("Processed %d records in parallel\n", processed)
}
```

---

## See Also

- [JSONL Processors](../../streaming/jsonl) - Package-level JSONL functions
- [Large File Handling](../../streaming/large-files) - Large-file guide
- [Iterators](../iterator) - The IterableValue type in detail
