---
sidebar_label: "JSONL"
title: "Processor JSONL Methods - CyberGo JSON | StreamJSONL Usage"
description: "Processor JSONL methods: StreamJSONL plus parallel, chunked and file variants, MapJSONL/ReduceJSONL/FilterJSONL transforms and JSONL conversion helpers."
sidebar_position: 80
---

# Processor JSONL Methods

JSONL (JSON Lines) handling spans four groups: streaming reads, functional transforms, JSONL encode/decode helpers, and the legacy `NDJSONProcessor`. Every engine shares the same `JSONL*` configuration fields and security limits.

:::tip Full tutorial
For JSONL/NDJSON concepts and streaming practice, see [JSONL Processors](../../streaming/jsonl).
:::

## Streaming Read Methods

### StreamJSONL

Signature: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL data, reading line by line and invoking the callback. The callback returns `nil` to continue with the next line, `item.Break()` for a clean early termination (overall return `nil`), or any other error to stop immediately and return it. A panic inside the callback is caught and converted into a returned error.

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

Processes JSONL data in parallel across worker goroutines. Suits CPU-heavy callbacks (transformation, aggregation); for I/O-bound work the single-threaded `StreamJSONL` costs less.

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

:::tip Worker count
An explicit `workers` argument wins; a value ≤0 falls back to 4. Keep the count near the number of CPU cores.
:::

### StreamJSONLParallelWithContext

Signature: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Parallel processing with cancellation and timeout control. The feed loop checks `ctx.Done()` per scanned line and each worker per job; once cancelled, no new lines are dispatched and `ctx.Err()` is returned (unless a callback or read error was recorded first, which takes precedence).

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

Processes JSONL data in chunks, invoking the callback once per accumulated batch. `chunkSize` sets the batch size; values ≤0 are treated as 1000.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `chunkSize` | `int` | Elements per batch; `≤0` is treated as 1000 |
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

Opens the file at `filename`, validates the path and streams it, equivalent to calling `StreamJSONL` on the opened file.

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

An alias for `StreamJSONL`; behaves the same.

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

Signature: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps JSONL data into a new format and returns the transformed slice. Each `(value, nil)` pair from the callback is appended; a non-nil error aborts immediately and is returned.

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

Reduces JSONL data to a single value by folding the accumulator, starting from `initial`.

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

Filters JSONL data, returning the elements for which the predicate is true. The slice keeps every match, so memory grows with the number of matches.

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

Collects all JSONL records into a slice. Every record stays resident in memory, so use `StreamJSONL` for large files.

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
This method loads all data into memory, so it is unsuitable for very large files. Use line-by-line `StreamJSONL` instead.
:::

---

### FirstJSONL

Signature: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Finds the first element satisfying the predicate and stops reading further lines. Returns `(nil, false, nil)` when nothing matches.

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

Three more methods mirror the [package-level JSONL conversion functions](../functions/jsonl#jsonl-processing-functions): `ParseJSONL`, `ToJSONL` and `ToJSONLString`. Their signatures match the package-level versions, including the trailing `cfg ...Config`, so an already-configured processor can be reused:

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
`NDJSONProcessor` / `NewNDJSONProcessor` is a **permanently deprecated alias**. In new code create a `Processor` with `json.New(cfg)` and use the [`StreamJSONL`](#streamjsonl) family ([`StreamJSONL`](#streamjsonl), [`StreamJSONLFile`](#streamjsonlfile), and the parallel/chunked variants): the two are driven by the same engine under the same security limits, and the StreamJSONL side adds `IterableValue` typed getters. `NDJSONProcessor` is kept for the lifetime of v1 and will not be removed.
:::

`NDJSONProcessor` is a standalone line-by-line NDJSON (newline-delimited JSON) processor, independent of `Processor`: the callback receives a `map[string]any` instead of an `IterableValue`, and no `Processor` instance is needed. Line-skipping rules, per-line size limits, memory limits and nesting-depth checks are the same as in the `StreamJSONL` family.

It is retained as a legacy API for existing code only. New code uses the `StreamJSONL` family: typed getters, parallel processing and Map/Reduce/Filter composition are all available there.

### NewNDJSONProcessor

<Badge type="danger" text="Deprecated" />

Signature: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

`NewNDJSONProcessor` takes an optional cfg and falls back to `DefaultConfig()` when omitted. Deprecated (see the warning above); new code uses `json.New(cfg)` plus the `StreamJSONL` family.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `cfg` | `...Config` | Optional configuration. The constructor runs `Validate` (discarding its error) to clamp fields, so a non-positive `JSONLBufferSize` is raised to 4KB and used as the read buffer |

The other JSONL fields (`JSONLMaxLineSize`, `JSONLMaxMemory`, `JSONLSkipComments`, `JSONLContinueOnErr`, `MaxNestingDepthSecurity`) take effect during processing; see [Configuration Options](#configuration-options).

### ProcessFile

Signature: `func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

`ProcessFile` processes an NDJSON file line by line. The path first passes security validation such as path-traversal checks (an illegal path returns `ErrSecurityViolation`), then behaves like calling `ProcessReader` on the opened file; errors such as open failures are wrapped into `JsonsError`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filename` | `string` | NDJSON file path (security-validated first) |
| `fn` | `func(lineNum int, obj map[string]any) error` | Per-line callback; returning an error terminates immediately and propagates verbatim |

### ProcessReader

Signature: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

`ProcessReader` processes NDJSON from an `io.Reader` line by line: each line is parsed into a `map[string]any` before the callback runs, and callback panics are caught and converted into returned errors. Security limits match the `StreamJSONL` family: per-line size is bounded by `JSONLMaxLineSize` (default 1MB; `Validate` clamps non-positive values to the 1KB floor), accumulated bytes by `JSONLMaxMemory`, and nesting depth is checked against `MaxNestingDepthSecurity` before each line is parsed. With `JSONLContinueOnErr=true`, lines that fail to parse are skipped.

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

**Complete example** (whitespace-only lines are always skipped; line numbers keep the original physical numbering):

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

JSONL behavior is controlled by these `Config` fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | Initial read-buffer capacity; `Validate` clamps non-positive values to the 4KB floor, capped at 1MB |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | Maximum bytes per line; `Validate` clamps it to 1KB–100MB, exceeding it returns `bufio.ErrTooLong` |
| `JSONLSkipEmpty` | `bool` | `true` | Skip empty lines. Every engine currently always skips whitespace-only lines, so setting it to `false` changes nothing |
| `JSONLSkipComments` | `bool` | `false` | Skip lines starting with `#` or `//` |
| `JSONLContinueOnErr` | `bool` | `false` | Continue on parse errors. When `true`, every JSONL engine (`StreamJSONL` family, `NDJSONProcessor`, `StreamLinesInto`) skips bad lines; when `false`, processing aborts with a line-numbered error |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | Accumulated byte cap, exceeding it returns `ErrSizeLimit`; `Validate` clamps it to 10MB–1GB |
| `JSONLWorkers` | `int` | 4 | No code reads this field to change behavior today; concurrency comes from the `workers` argument of `StreamJSONLParallel` (`≤0` falls back to 4) |
| `JSONLChunkSize` | `int` | 1000 | No code reads this field to change behavior today; the batch size comes from the `chunkSize` argument of `StreamJSONLChunked` (`≤0` falls back to 1000) |

:::tip Per-call cfg applies only to that call
The optional `cfg ...Config` at the end of a method replaces the processor's baked JSONL settings (buffer, per-line limit, memory limit, `JSONLSkipComments`, `JSONLContinueOnErr`, and so on); when omitted, the configuration fixed at `New(cfg)` applies.
:::

Each line is also depth-checked against `MaxNestingDepthSecurity` before parsing.

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // Skip comment lines
cfg.JSONLContinueOnErr = true    // Continue on parse errors
cfg.JSONLMaxLineSize = 4 << 20   // Raise the per-line limit to 4MB

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
	processor, _ := json.New()
	defer processor.Close()

	file, _ := os.Open("large_data.jsonl")
	defer file.Close()

	var processed int64

	// The second argument, 16, is the worker count
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
