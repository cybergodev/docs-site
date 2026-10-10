---
sidebar_label: "JSONL"
title: "JSONL Functions - CyberGo JSON | ParseJSONL & ToJSONL Usage"
description: "CyberGo JSON is a Go library for JSONL processing, offering ParseJSONL, ToJSONL, StreamLinesInto[T] streaming and NewJSONLWriter to handle NDJSON data."
sidebar_position: 80
---

# JSONL Functions

The json package provides JSONL (JSON Lines) functions for parsing, streaming, converting, and writing newline-delimited JSON data.

:::tip Full tutorial
Want the JSONL/NDJSON concepts, streaming patterns, and real-world usage? See the complete tutorial in [JSONL Streaming](../../streaming/jsonl).
:::

## JSONL Processing Functions

JSONL (JSON Lines) is a newline-delimited JSON format with one independent JSON object per line.

### ParseJSONL

Signature: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Parses JSONL (newline-delimited JSON) data.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]byte` | Yes | JSONL byte data |
| `cfg` | `Config` | No | Optional configuration |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
	results, err := json.ParseJSONL([]byte(jsonl))
	if err != nil {
		panic(err)
	}
	for i, r := range results {
		fmt.Printf("[%d] %v\n", i, r)
	}
}
```

### StreamLinesInto

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Streams JSONL data from an io.Reader and processes each line through a callback. This is the recommended generic way to process JSONL.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `fn` | `func(lineNum int, data T) error` | Yes | Processing callback (receives the line number and data) |
| `cfg` | `Config` | No | Optional configuration |

**Returns**

| Type | Description |
|------|-------------|
| `[]T` | Slice of all processed results |
| `error` | Error information |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"strings"
)

type User struct {
	Name string `json:"name"`
}

func main() {
	src := `{"name":"Alice"}
{"name":"Bob"}`

	// Basic usage
	results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
		fmt.Printf("Line %d: user %s\n", lineNum, user.Name)
		return nil // returning an error interrupts processing
	})
	if err != nil {
		panic(err)
	}
	fmt.Printf("Processed %d records in total\n", len(results))
}
```

### ToJSONL

Signature: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Converts a data slice to JSONL format.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]any` | Yes | Data slice |
| `cfg` | `Config` | No | Optional configuration |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	items := []any{
		map[string]any{"name": "Alice"},
		map[string]any{"name": "Bob"},
	}
	jsonl, err := json.ToJSONL(items)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(jsonl))
	// {"name":"Alice"}
	// {"name":"Bob"}
}
```

### ToJSONLString

Signature: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Converts a data slice to a JSONL string.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]any` | Yes | Data slice |
| `cfg` | `Config` | No | Optional configuration |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	items := []any{
		map[string]any{"name": "Alice"},
		map[string]any{"name": "Bob"},
	}
	jsonlStr, err := json.ToJSONLString(items)
	if err != nil {
		panic(err)
	}
	fmt.Println(jsonlStr)
}
```

## JSONL Streaming Functions (Package-Level)

Convenience package-level JSONL streaming functions of the json package. Their signatures match the corresponding Processor methods (likewise accepting an optional trailing `cfg ...Config` argument); internally they use a global Processor cached per `cfg`, so no manual instance is needed — a good fit for one-shot processing. When processing repeatedly or sharing one configuration, prefer creating a standalone Processor with [`json.New(cfg)`](../processor/#new).

For full usage and examples see the [JSONL Streaming Guide](../../streaming/jsonl#package-level-functions) and [Processor JSONL Methods](../processor/jsonl).

**Choosing one**

| Scenario | Recommended |
|----------|-------------|
| Line-by-line processing (order-sensitive) | `StreamJSONL` / `ForeachJSONL` |
| CPU-heavy line processing (order-insensitive) | `StreamJSONLParallel` |
| Mid-flight cancel / timeout | `StreamJSONLParallelWithContext` |
| Chunked consumption (e.g. batch DB writes) | `StreamJSONLChunked` |
| Decoding into a concrete struct `T` | `StreamLinesInto[T]` |
| Transform / aggregate / filter / find first | `MapJSONL` / `ReduceJSONL` / `FilterJSONL` / `FirstJSONL` |
| Collect everything | `CollectJSONL` (loads all into memory — careful with large files) |

**Behavior highlights**

- **Bad-line handling**: by default (`JSONLContinueOnErr=false`) an unparseable line **aborts immediately** with an error of the form `line N: ...`; with `JSONLContinueOnErr=true`, every JSONL engine (the `StreamJSONL` family, `StreamLinesInto`, `NDJSONProcessor`) skips bad lines and continues.
- **Depth guard**: before parsing each line, a nesting-depth check runs (`MaxNestingDepthSecurity`, default 200) to prevent stack overflow from deeply nested lines.
- **Parallel semantics**: `StreamJSONLParallel` treats `workers <= 0` as 4; callbacks run concurrently on multiple goroutines, so you must ensure concurrency safety yourself. A callback returning `item.Break()` is a **normal** early exit (returns `nil`); returning any other error cancels the remaining tasks and becomes the function's return value.
- **Memory guard**: `JSONLMaxMemory` (falling back to `MaxMemory` when unset) bounds the total processed bytes; exceeding it aborts processing.

### StreamJSONL

Signature: `func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL line by line, invoking the callback after parsing each line into an `IterableValue`.

### StreamJSONLParallel

Signature: `func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes JSONL with `workers` parallel goroutines (CPU-bound scenarios).

### StreamJSONLParallelWithContext

Signature: `func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Parallel JSONL processing with context cancellation/timeout support.

### StreamJSONLChunked

Signature: `func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Processes in batches of `chunkSize`, with each batch passed to the callback as `[]*IterableValue`.

### ForeachJSONL

Signature: `func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Iterates JSONL (an alias behaving identically to `StreamJSONL`).

### MapJSONL

Signature: `func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps each line to a new value and returns the result slice.

### ReduceJSONL

Signature: `func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

Reduces JSONL to a single value; `initial` is the accumulator's starting value.

### FilterJSONL

Signature: `func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

Filters by predicate and returns the slice of matches.

### StreamJSONLFile

Signature: `func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams an entire JSONL file directly.

### CollectJSONL

Signature: `func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

Reads all JSONL lines and collects them into a slice (note: everything is loaded into memory; prefer `StreamJSONL` for large files).

### FirstJSONL

Signature: `func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Returns the first element satisfying the predicate; the second return value reports whether one was found.

## JSONL Configuration

::: warning
The standalone JSONLConfig struct and the `DefaultJSONLConfig()` function have been removed. JSONL configuration is now integrated into the `JSONL*` fields of `Config`.
:::

### Configuring JSONL via Config

```go
cfg := json.DefaultConfig()

// JSONL configuration
cfg.JSONLBufferSize    = 64 * 1024    // Read buffer size (default: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Maximum single-line size (default: 1MB)
cfg.JSONLSkipEmpty     = true         // Skip empty lines (default: true)
cfg.JSONLSkipComments  = false        // Skip comment lines (default: false)
cfg.JSONLContinueOnErr = false        // Continue on errors (default: false)
cfg.JSONLWorkers       = 4            // Parallel worker goroutines (default: 4)
cfg.JSONLChunkSize     = 1000         // Lines per batch (default: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Maximum memory (default: 100MB)

processor, err := json.New(cfg)
```

See [Config](../config#the-config-struct)

## JSONL Writer

### NewJSONLWriter

Signature: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Creates a JSONL writer.

```go
package main

import (
	"github.com/cybergodev/json"
	"os"
)

func main() {
	file, err := os.Create("output.jsonl")
	if err != nil {
		panic(err)
	}
	defer file.Close()
	jw := json.NewJSONLWriter(file)
	jw.Write(map[string]any{"id": 1, "name": "Alice"})
	jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
```

### JSONLWriter Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `func (w *JSONLWriter) Write(data any) error` | Encode a single value as one JSON line and write it |
| `WriteAll` | `func (w *JSONLWriter) WriteAll(data []any) error` | Write multiple values in order; stops at the first error |
| `WriteRaw` | `func (w *JSONLWriter) WriteRaw(line []byte) error` | Write an already-encoded raw JSON line |
| `Err` | `func (w *JSONLWriter) Err() error` | Return the first cached write error |
| `Stats` | `func (w *JSONLWriter) Stats() JSONLStats` | Return write statistics |

#### Write

Signature: `func (w *JSONLWriter) Write(data any) error`

Encodes a single JSON value as one line and writes it to the underlying writer; a `\n` is appended automatically.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any` | Yes | The value to encode and write |

**Returns**

| Type | Description |
|------|-------------|
| `error` | Encoding or write error; once an error occurs it is cached on the writer (see "Behavior details" below) |

#### WriteAll

Signature: `func (w *JSONLWriter) WriteAll(data []any) error`

Encodes multiple values as multiple lines in order; stops immediately and returns on the first error.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `[]any` | Yes | The slice of values to write |

**Returns**

| Type | Description |
|------|-------------|
| `error` | The first error returned by `Write` (`nil` when everything succeeds) |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

#### WriteRaw

Signature: `func (w *JSONLWriter) WriteRaw(line []byte) error`

Writes an **already-encoded** raw JSON line, avoiding double-encoding overhead; a `\n` is appended automatically when absent.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `line` | `[]byte` | Yes | The encoded JSON line (no trailing newline needed) |

**Returns**

| Type | Description |
|------|-------------|
| `error` | Write error; once an error occurs it is cached on the writer |

#### Err

Signature: `func (w *JSONLWriter) Err() error`

Returns the first cached write/encode error (`nil` when none) — well suited to a single check after a batch of writes.

**Returns**

| Type | Description |
|------|-------------|
| `error` | The first cached error; `nil` when no error has ever occurred |

#### Stats

Signature: `func (w *JSONLWriter) Stats() JSONLStats`

Returns the write statistics (lines and bytes successfully written).

**Returns**

| Type | Description |
|------|-------------|
| `JSONLStats` | Write statistics; fields in [JSONLStats](#jsonlstats) below |

### JSONLStats

The write-statistics type returned by `Stats()`.

```go
type JSONLStats struct {
    LinesProcessed int64 // Lines successfully written
    BytesWritten   int64 // Total bytes written (including trailing newlines)
}
```

| Field | Type | Description |
|-------|------|-------------|
| `LinesProcessed` | `int64` | Lines successfully written (failed lines not counted) |
| `BytesWritten` | `int64` | Total bytes written to the underlying writer (including automatically appended newlines) |

**Behavior details**

- `Write`: encodes the value as a single-line JSON and appends `\n`; whether `<`/`>`/`&` are escaped is decided by `Config.EscapeHTML` (default `true`)
- `WriteRaw`: writes an **already-encoded** raw line to avoid double-encoding overhead; a trailing `\n` is appended automatically if absent
- **Sticky errors**: after any write or encoding fails, the error is cached on the writer and subsequent `Write`/`WriteRaw` calls skip the underlying writer and return that error directly — avoiding appends on top of a half-written state
- `Err()` reads the cached error (`nil` when none); `Stats()` returns `JSONLStats` with the fields in the table above

### Usage Example

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

func main() {
	jw := json.NewJSONLWriter(os.Stdout)

	// Write 3 records, one per line
	for i := 1; i <= 3; i++ {
		if err := jw.Write(map[string]int{"id": i}); err != nil {
			panic(err)
		}
	}

	stats := jw.Stats()
	if err := jw.Err(); err != nil {
		panic(err)
	}
	fmt.Printf("Wrote %d lines, %d bytes in total\n", stats.LinesProcessed, stats.BytesWritten)
	// {"id":1}
	// {"id":2}
	// {"id":3}
	// Wrote 3 lines, 27 bytes in total
}
```

## See Also

- [File Operation Functions](./file-io) - LoadFromFile, SaveToFile and other file operations
- [Processor JSONL Methods](../processor/jsonl) - Processor-level JSONL methods in detail
- [JSONL Streaming](../../streaming/jsonl#jsonlwriter) - JSONL/NDJSON concepts and hands-on streaming tutorial
- [Streaming](../../streaming/large-files) - Streaming processors in detail
