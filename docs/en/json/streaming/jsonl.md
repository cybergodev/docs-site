---
sidebar_label: "JSONL Streaming"
title: "JSONL Streaming - CyberGo JSON | NDJSON Stream Read/Write"
description: "CyberGo JSON offers JSONL streaming with StreamJSONL, StreamJSONLParallel, MapJSONL and JSONLWriter writing to process large NDJSON under bounded memory."
sidebar_position: 20
---

# JSONL Streaming

JSONL (JSON Lines) or NDJSON (Newline Delimited JSON) is a format with one JSON object per line. The library provides complete JSONL processing through both `Processor` methods and package-level functions.

## Format Specification

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- Each line is a valid JSON value
- Lines are separated by `\n`
- The last line may or may not end with a newline

---

## Processor JSONL Methods

JSONL processing is exposed through `Processor` methods — 11 streaming/functional methods in total; how to choose:

| Method | Shape | Fits |
|---------|-------|------|
| `StreamJSONL` | Per-line callback | Basic streaming, consuming `IterableValue` line by line |
| `StreamJSONLParallel` | Parallel callbacks | CPU-bound transforms with multiple workers |
| `StreamJSONLParallelWithContext` | Parallel + ctx | Parallel processing needing timeout/cancellation |
| `StreamJSONLChunked` | Batch callbacks | Chunked consumption such as bulk database loads |
| `StreamJSONLFile` | Per-line callback (file) | Reading `.jsonl` files directly (incl. path security validation) |
| `ForeachJSONL` | Per-line callback | An alias of `StreamJSONL` |
| `MapJSONL` | Transform + collect | Maps each line to a new value, returns `[]any` |
| `FilterJSONL` | Predicate + collect | Keeps the lines satisfying a condition |
| `ReduceJSONL` | Aggregate | Folding computations such as sums and statistics |
| `CollectJSONL` | Collect all | Takes out every line at once |
| `FirstJSONL` | Predicate + short-circuit | Stops at the first match (internally equivalent to `Break`) |

### StreamJSONL

Signature: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL data, returning one `IterableValue` per line.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | Data source |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing callback |

**Callback return values**

| Return value | Description |
|--------------|-------------|
| `nil` | Continue with the next line |
| `item.Break()` | Stop iterating without an error |
| Other `error` | Stop iterating and return the error |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("Line %d: name=%s, age=%d\n", lineNum, name, age)
    return nil // continue processing
    // return item.Break() // stop iterating
})
```

### StreamJSONLParallel

Signature: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes JSONL data in parallel using a worker pool.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | Data source |
| `workers` | `int` | Worker goroutine count (defaults to 4 when <=0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing callback |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// file is an opened *os.File (as returned by os.Open in the StreamJSONL example above)
err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU-intensive processing
    return processItem(item)
})
```

::: tip Performance hint
For CPU-bound work (data transformation, computation), parallel processing improves performance significantly. For I/O-bound work, prefer single-threaded processing.
:::

A callback returning `item.Break()` is a clean stop: scanning and the workers wind down early and the method returns `nil`; returning any other error ends the method with that error. Callback panics are recovered into errors and never take down the process.

### StreamJSONLParallelWithContext

Signature: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Context-aware parallel JSONL processing. Supports timeout and cancellation.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `ctx` | `context.Context` | Context for cancellation and timeout |
| `reader` | `io.Reader` | Data source |
| `workers` | `int` | Worker goroutine count (defaults to 4 when <=0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing callback |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err = p.StreamJSONLParallelWithContext(ctx, file, 8, func(lineNum int, item *json.IterableValue) error {
    // Cancellable parallel processing
    return processItem(item)
})
```

### StreamJSONLChunked

Signature: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Processes JSONL data in batches of a given element count.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 1000 records per batch
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // Bulk write to the database
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

::: warning Returned to the object pool after the callback
`StreamJSONLChunked` returns that batch's `IterableValue`s to the object pool **after each batch callback returns** (internal data nulled). Finish persisting or extracting the fields you need inside the callback; do not hold elements of `chunk` across callbacks. `StreamJSONL` (and the collect methods built on it — `CollectJSONL`/`FilterJSONL`/`FirstJSONL`) performs no such return; their elements can be kept safely.
:::

### StreamJSONLFile

Signature: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes a JSONL file directly.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

## Advanced JSONL Operations

### MapJSONL

Signature: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps JSONL data into a new format.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return map[string]any{
        "name": item.GetString("name"),
        "age":  item.GetInt("age"),
    }, nil
})
```

### ReduceJSONL

Signature: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

Aggregates JSONL data into a single result.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Compute the total age
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

Signature: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

Filters JSONL data, returning the elements that satisfy the predicate.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Keep adults
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

Signature: `func (p *Processor) CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

Collects all JSONL elements into a slice.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

items, err := p.CollectJSONL(file)
for _, item := range items {
    fmt.Println(item.GetString("name"))
}
```

### FirstJSONL

Signature: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Returns the first element satisfying the predicate.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

user, found, err := p.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("name") == "Alice"
})
if found {
    fmt.Println("Found:", user.GetString("name"))
}
```

### ForeachJSONL

Signature: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Iterates JSONL data (an alias of StreamJSONL).

---

## JSONL Configuration

JSONL configuration is integrated into the `Config` struct:

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // Buffer size (default 64KB)
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // Maximum line size (default 1MB)
cfg.JSONLSkipEmpty = true           // Skip empty lines (default true)
cfg.JSONLSkipComments = true        // Skip comment lines (default false)
cfg.JSONLContinueOnErr = true       // Continue on parse errors (default false)
cfg.JSONLWorkers = 8                // Parallel workers (default 4)
cfg.JSONLChunkSize = 500            // Chunk size (default 1000)
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // Maximum memory (default 100MB)

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

Field scope and precedence:

- **`JSONLMaxLineSize`**: per-line byte cap. The `StreamJSONL` family, `NDJSONProcessor`, and `StreamLinesInto` all use it to bound the scanner; exceeding it returns a `bufio.ErrTooLong`-style error. When `JSONLMaxLineSize` is ≤0 it uniformly falls back to 1MB (all JSONL engines share one set of scan limits).
- **`JSONLMaxMemory`**: total byte cap for streaming (exceeding it errors and stops); fallback chain: `JSONLMaxMemory` -> `MaxMemory`.
- **`MaxNestingDepthSecurity`**: every JSONL streaming entry checks nesting depth line by line **before** parsing, preventing stack overflow from deep nesting.
- **`JSONLContinueOnErr`**: effective across all JSONL engines — when `true`, the `StreamJSONL` family, `NDJSONProcessor` (`ProcessFile`/`ProcessReader`), and `StreamLinesInto` all skip bad lines and continue; the default `false` aborts immediately on a parse error.
- **`JSONLWorkers`/`JSONLChunkSize`**: take part in config validation (clamped to 1–64 / 100–10000), but the explicit `workers` parameter of `StreamJSONLParallel` and `chunkSize` parameter of `StreamJSONLChunked` take precedence.
- `Config.Validate` clamps out-of-range values back into the legal ranges; use `ValidateWithWarnings` to see the adjustments.

---

## JSONLWriter

The JSONL writer writes data in JSON Lines format.

### NewJSONLWriter

Signature: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Creates a JSONL writer. Supports an optional configuration parameter.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// With the default configuration
writer := json.NewJSONLWriter(file)

// With a custom configuration
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

Signature: `func (w *JSONLWriter) Write(data any) error`

Writes a single JSON value as one line (encoded result + `\n`). HTML escaping follows the `Config.EscapeHTML` from construction (default `true`).

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
// Written: {"id":1,"name":"Alice"}\n
```

::: tip Errors are cached
Once a `Write`/`WriteRaw` fails, the error is cached on the writer and **all subsequent write calls return that same error directly**. After a bulk write, check once via [`Err`](#err) instead of judging every call.
:::

### WriteAll

Signature: `func (w *JSONLWriter) WriteAll(data []any) error`

Writes multiple JSON values, each as one line.

```go
items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
    map[string]any{"id": 3, "name": "Charlie"},
}

err := writer.WriteAll(items)
```

### WriteRaw

Signature: `func (w *JSONLWriter) WriteRaw(line []byte) error`

Writes an already-encoded raw JSON line, skipping re-encoding. A trailing newline is appended when **absent**; an existing one is written as-is.

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
// Written: {"id":1,"name":"raw"}\n
```

### Err

Signature: `func (w *JSONLWriter) Err() error`

Returns errors that occurred during writing.

```go
if err := writer.Err(); err != nil {
    fmt.Printf("Write error: %v\n", err)
}
```

### Stats

Signature: `func (w *JSONLWriter) Stats() JSONLStats`

Gets write statistics.

```go
stats := writer.Stats()
fmt.Printf("Wrote %d lines, %d bytes\n", stats.LinesProcessed, stats.BytesWritten)
```

**JSONLStats struct**:

```go
type JSONLStats struct {
    LinesProcessed int64 // Lines processed
    BytesWritten   int64 // Bytes written
}
```

| Field | Meaning |
|-------|---------|
| `LinesProcessed` | Lines successfully written via `Write`/`WriteAll`/`WriteRaw` |
| `BytesWritten` | Cumulative bytes written, **including each line's trailing newline** |

For example, after `Write` of the line `{"id":1}` (9 bytes), `Stats()` gives `LinesProcessed=1`, `BytesWritten=10`.

---

## NDJSONProcessor

<Badge type="danger" text="Deprecated" />

::: warning Deprecated (permanent deprecated alias)
`NDJSONProcessor` / `NewNDJSONProcessor` is a **permanently deprecated alias**: in new code create a `Processor` with `json.New(cfg)` and use the [`StreamJSONL`](#streamjsonl) family ([`StreamJSONL`](#streamjsonl), [`StreamJSONLFile`](#streamjsonlfile), and the parallel/chunked variants) — both are driven by the same engine, governed by the same security limits, and the StreamJSONL side adds `IterableValue` typed getters. `NDJSONProcessor` will not be removed within v1. For the API-level details see the [NDJSONProcessor deprecation note](../api-reference/processor/jsonl#the-ndjsonprocessor-standalone-processor).
:::

`NDJSONProcessor` is a standalone NDJSON (newline-delimited JSON) line-by-line processor, independent of `Processor`: the callback receives a `map[string]any` directly (instead of an `IterableValue`), no `Processor` instance is needed, and empty lines are **always** skipped. It is retained as a **legacy API** — new code should use the `StreamJSONL` family above (typed getters, parallel workers, chunking, and Map/Reduce/Filter functional composition are all provided there). The reference below remains useful for existing code.

Both entry points have built-in protections:

- **Per-line nesting depth check**: before parsing, checked against `MaxNestingDepthSecurity` (default 200) to prevent stack overflow from deep nesting;
- **Per-line size cap**: `JSONLMaxLineSize` (falls back to 1MB when ≤0);
- **Total cap**: `JSONLMaxMemory` (fallback `MaxMemory`); exceeding it stops processing;
- **Fault tolerance**: with `JSONLContinueOnErr=true`, lines failing to parse are skipped and processing continues;
- **Path validation**: `ProcessFile` runs path traversal and other security checks on the file path;
- **Callback panic recovery**: callback panics become returned errors and never take down the process.

### NewNDJSONProcessor

<Badge type="danger" text="Deprecated" />

Signature: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

Creates an NDJSON processor (deprecated, see the warning above; use `json.New(cfg)` plus the `StreamJSONL` family in new code). Supports an optional configuration parameter.

```go
// With the default configuration
np := json.NewNDJSONProcessor()

// With a custom configuration
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024
np = json.NewNDJSONProcessor(cfg)
```

### ProcessFile

Signature: `func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

Processes an NDJSON file.

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

Signature: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

Processes NDJSON from a Reader.

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## Package-Level Functions

Every JSONL processing function has a package-level convenience version with the same signature as the corresponding [Processor method](../api-reference/processor/jsonl); internally they use the default global Processor — no manual instance needed.

::: tip
Package-level functions suit one-shot processing. For repeated calls in a loop or shared configuration, create a dedicated `Processor` ([`json.New()`](../api-reference/processor/)) to reuse the cache.
:::

### StreamJSONL

Signature: `func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL line by line, invoking the callback after parsing each line into an `IterableValue`.

### StreamJSONLParallel

Signature: `func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes JSONL with `workers` parallel goroutines.

### StreamJSONLParallelWithContext

Signature: `func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Parallel JSONL processing with context cancellation.

### StreamJSONLChunked

Signature: `func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Processes JSONL in batches of `chunkSize`, with each batch passed to the callback as `[]*IterableValue`.

### ForeachJSONL

Signature: `func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Iterates JSONL, invoking the callback per line.

### MapJSONL

Signature: `func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps each line to a new value and returns the result slice.

### ReduceJSONL

Signature: `func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

Reduces JSONL; `initial` is the accumulator's starting value.

### FilterJSONL

Signature: `func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

Filters JSONL by predicate and returns the matches.

### StreamJSONLFile

Signature: `func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams an entire JSONL file.

```go
err := json.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

### CollectJSONL

Signature: `func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

Reads all JSONL lines and collects them into a slice.

### FirstJSONL

Signature: `func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Returns the first element satisfying the predicate; the second return value reports whether one was found.

### StreamLinesInto[T]

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Streams JSONL and processes it line by line.

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// With the default configuration
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Processing: %s\n", user.Name)
    return nil
})

// With a custom configuration
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

Return value semantics:

- The returned `[]T` **accumulates only successfully parsed lines** — lines processed by `fn` are appended to the result slice;
- When a line fails to parse and `JSONLContinueOnErr` is off, processing stops immediately, returning a nil result and a line-numbered error (`line N: ...`);
- With `JSONLContinueOnErr=true`, bad lines are skipped (not in the result, `fn` not called) and later lines keep processing;
- When `fn` returns an error, processing stops immediately and the error is returned verbatim;
- A line exceeding `JSONLMaxLineSize` ends with `bufio.ErrTooLong`.

### ParseJSONL

Signature: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Parses a JSONL byte slice.

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

Signature: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Converts to a JSONL byte slice.

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

Signature: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Converts to a JSONL string.

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## Complete Examples

### Reading a Large JSONL File

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

func main() {
	file, err := os.Open("logs.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	count := 0
	err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
		count++
		if item.GetString("level") == "error" {
			fmt.Printf("Error: %s\n", item.GetString("message"))
		}
		return nil
	})

	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	fmt.Printf("Processed %d lines in total\n", count)
}
```

### Writing a JSONL File

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
)

func main() {
	file, err := os.Create("output.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	writer := json.NewJSONLWriter(file)

	for i := 0; i < 10; i++ {
		if err := writer.Write(map[string]any{
			"id":    i,
			"value": fmt.Sprintf("item-%d", i),
		}); err != nil {
			panic(err)
		}
	}

	stats := writer.Stats()
	fmt.Printf("Wrote %d bytes\n", stats.BytesWritten)
}
```

### Processing a Large File in Parallel

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
	"sync/atomic"
)

func main() {
	file, err := os.Open("large.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	var count int64
	err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
		atomic.AddInt64(&count, 1)
		return nil
	})

	if err != nil {
		panic(err)
	}

	fmt.Printf("Processed %d lines in parallel\n", count)
}
```

---

## See Also

- [Large File Handling](./large-files) - Large-file guide and API reference
- [Iterators](../api-reference/iterator) - Iteration APIs
