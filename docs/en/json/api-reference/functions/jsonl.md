---
sidebar_label: "JSONL"
title: "JSONL Processing Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON JSONL processing functions: ParseJSONL/ToJSONL/ToJSONLString conversion, StreamJSONL/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL streaming, StreamLinesInto[T] generics, and NewJSONLWriter writer."
sidebar_position: 8
---

# JSONL Processing Functions

The json package provides JSONL (JSON Lines) processing functions, supporting parsing, streaming reads, conversion, and writing of newline-delimited JSON data.

## JSONL Processing Functions

JSONL (JSON Lines) is a newline-delimited JSON format where each line is an independent JSON object.

### ParseJSONL

Signature: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Parses JSONL (newline-separated JSON) data.

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

Stream-reads JSONL data from an io.Reader and processes each line through a callback function. This is the recommended way to process JSONL generically.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reader` | `io.Reader` | Yes | Data source |
| `fn` | `func(lineNum int, data T) error` | Yes | Processing callback (receives line number and data) |
| `cfg` | `Config` | No | Optional configuration |

**Return Values**

| Type | Description |
|------|-------------|
| `[]T` | Slice of all processed results |
| `error` | Error information |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
}

func main() {
    src := `{"name":"Alice"}
{"name":"Bob"}`

    // Basic usage
    results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
        fmt.Printf("Line %d: User %s\n", lineNum, user.Name)
        return nil // Return error to interrupt processing
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Total processed %d records\n", len(results))
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

## Package-level JSONL Streaming Functions

The json package provides package-level convenience functions for JSONL streaming. Their signatures match the corresponding Processor methods, with an additional optional `cfg ...Config` variadic parameter at the end. They internally use a global Processor cached per `cfg`, so there is no need to manually create an instance — well suited for one-off processing scenarios. When you need to process data multiple times or share the same configuration, prefer creating an independent Processor via [`json.New(cfg)`](../processor/#new).

For full usage and examples, see the [JSONL Streaming Guide](../../streaming/jsonl#package-level-functions) and the [Processor JSONL Methods](../processor/jsonl).

### StreamJSONL

Signature: `func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams JSONL line by line, parsing each line into an `IterableValue` before invoking the callback.

### StreamJSONLParallel

Signature: `func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Processes JSONL using `workers` parallel goroutines (for CPU-intensive scenarios).

### StreamJSONLParallelWithContext

Signature: `func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Parallel JSONL processing that supports context cancellation / timeout.

### StreamJSONLChunked

Signature: `func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Processes data in batches of `chunkSize`, passing each batch as a `[]*IterableValue` to the callback.

### ForeachJSONL

Signature: `func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Iterates JSONL (an alias with the same behavior as `StreamJSONL`).

### MapJSONL

Signature: `func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

Maps each line to a new value and returns a slice of results.

### ReduceJSONL

Signature: `func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

Reduces JSONL into a single value, where `initial` is the accumulator's starting value.

### FilterJSONL

Signature: `func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

Filters by predicate and returns a slice of matching items.

### StreamJSONLFile

Signature: `func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

Streams an entire JSONL file directly.

### CollectJSONL

Signature: `func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

Reads all JSONL lines and collects them into a slice (note: fully loaded into memory; for large files, prefer `StreamJSONL`).

### FirstJSONL

Signature: `func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

Returns the first element that satisfies the predicate; the second return value indicates whether a match was found.

## JSONL Configuration

::: warning
The standalone JSONLConfig struct and `DefaultJSONLConfig()` function have been removed. JSONL configuration is now unified into the `Config` struct's `JSONL*` fields.
:::

### Configure JSONL via Config

```go
cfg := json.DefaultConfig()

// JSONL configuration
cfg.JSONLBufferSize    = 64 * 1024    // Read buffer size (default: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Maximum single line size (default: 1MB)
cfg.JSONLSkipEmpty     = true         // Skip empty lines (default: true)
cfg.JSONLSkipComments  = false        // Skip comment lines (default: false)
cfg.JSONLContinueOnErr = false        // Continue on error (default: false)
cfg.JSONLWorkers       = 4            // Parallel worker goroutines (default: 4)
cfg.JSONLChunkSize     = 1000         // Lines per batch (default: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Maximum memory (default: 100MB)

processor, err := json.New(cfg)
```

See [Config Configuration](../config#config-struct)

## JSONL Writer

### NewJSONLWriter

Signature: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Creates a JSONL writer.

```go
package main

import (
    "os"
    "github.com/cybergodev/json"
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

**JSONLWriter Methods**

| Method | Signature | Description |
|--------|-----------|-------------|
| `Write` | `(data any) error` | Write a single line |
| `WriteAll` | `(data []any) error` | Write multiple lines |
| `WriteRaw` | `(line []byte) error` | Write a raw byte line |
| `Err` | `() error` | Return accumulated errors |
| `Stats` | `() JSONLStats` | Return write statistics |

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

## See Also

- [File Operation Functions](./file-io) - LoadFromFile, SaveToFile and other file operations
- [Processor JSONL Methods](../processor/jsonl) - Processor-level JSONL methods in detail
- [Stream Processing](../../streaming/large-files) - Stream processor details
