---
title: "JSONL Processor - CyberGo JSON | API Reference"
description: "CyberGo JSON JSONL/NDJSON processor reference: including StreamJSONL stream processing, JSONLWriter writing, StreamLinesInto[T] generic streaming, ParseJSONL parsing, ToJSONL conversion and configuration options, supporting JSON Lines format read/write operations."
---

# JSONL Processor

JSONL (JSON Lines) or NDJSON (Newline Delimited JSON) is a format with one JSON object per line. This library provides complete JSONL processing capabilities through `Processor` methods and package-level functions.

## Format Specification

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- Each line is a valid JSON value
- Lines are separated by `\n`
- The last line may or may not have a trailing newline

---

## Processor JSONL Methods

JSONL processing functionality is provided through `Processor` methods.

### StreamJSONL

Signature: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Stream-processes JSONL data, returning one `IterableValue` per line.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | Data source |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing callback |

**Callback Return Values**

| Return Value | Description |
|--------------|-------------|
| `nil` | Continue to next line |
| `item.Break()` | Stop iteration without returning an error |
| other `error` | Stop iteration and return the error |

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
    return nil // Continue processing
    // return item.Break() // Stop iteration
})
```

### StreamJSONLParallel

Signature: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Parallel-processes JSONL data using a worker pool pattern.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | Data source |
| `workers` | `int` | Number of worker goroutines (defaults to 4 when <=0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing callback |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU-intensive processing
    return processItem(item)
})
```

::: tip Performance Tip
For CPU-intensive operations (such as data transformation and computation), parallel processing can significantly improve performance. For I/O-intensive operations, single-threaded processing is recommended.
:::


### StreamJSONLParallelWithContext

Signature: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Parallel processing of JSONL data with context. Supports timeout and cancellation.

**Parameters**

| Name | Type | Description |
|------|------|------|
| `ctx` | `context.Context` | Context for cancellation and timeout |
| `reader` | `io.Reader` | Data source |
| `workers` | `int` | Number of worker goroutines (defaults to 4 when <=0) |
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
    // Parallel processing with cancellation support
    return processItem(item)
})
```

### StreamJSONLChunked

Signature: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

Batch-processes JSONL data, processing the specified number of elements each time.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 1000 per batch
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // Batch insert into database
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### StreamJSONLFile

Signature: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Directly processes a JSONL file.

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

Signature: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

Maps JSONL data to a new format.

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

Signature: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

Aggregates JSONL data into a single result.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Calculate total age
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

Signature: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

Filters JSONL data, returning elements that satisfy the condition.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Filter adults
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

Signature: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

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

Signature: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

Returns the first element that satisfies the condition.

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

Signature: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Iterates JSONL data (alias for StreamJSONL).

---

## JSONL Configuration

JSONL configuration is integrated into the `Config` struct:

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // Buffer size (default 64KB)
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // Maximum line size (default 1MB)
cfg.JSONLSkipEmpty = true           // Skip empty lines (default true)
cfg.JSONLSkipComments = true        // Skip comment lines (default false)
cfg.JSONLContinueOnErr = true       // Continue on parse error (default false)
cfg.JSONLWorkers = 8                // Parallel workers (default 4)
cfg.JSONLChunkSize = 500            // Chunk size (default 1000)
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // Maximum memory (default 100MB)

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

---

## JSONLWriter

The JSONL writer is used to write data in JSON Lines format.

### NewJSONLWriter

Signature: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Creates a JSONL writer. Supports optional configuration parameters.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// Use default configuration
writer := json.NewJSONLWriter(file)

// Use custom configuration
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

Signature: `func (w *JSONLWriter) Write(data any) error`

Writes a single JSON value as one line.

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

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

Writes a raw JSON line (without JSON encoding).

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
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

**JSONLStats Structure**:

```go
type JSONLStats struct {
    LinesProcessed int64 // Number of lines processed
    BytesWritten   int64 // Number of bytes written
}
```

---

## NDJSONProcessor

A specialized processor for `map[string]any` type NDJSON files.

### NewNDJSONProcessor

Signature: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

Creates an NDJSON processor. Supports optional configuration parameters.

```go
// Use default configuration
np := json.NewNDJSONProcessor()

// Use custom configuration
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

### StreamJSONLFile

Signature: `func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Package-level function that stream-processes JSONL data directly from a file without creating a Processor.

```go
err := json.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

### StreamLinesInto[T]

Signature: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Stream-reads JSONL and processes line by line.

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// Use default configuration
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Processing: %s\n", user.Name)
    return nil
})

// Use custom configuration
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

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
    "os"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

func main() {
    file, _ := os.Open("logs.jsonl")
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

    fmt.Printf("Total processed %d lines\n", count)
}
```

### Writing a JSONL File

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Create("output.jsonl")
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    for i := 0; i < 10; i++ {
        writer.Write(map[string]any{
            "id":    i,
            "value": fmt.Sprintf("item-%d", i),
        })
    }

    stats := writer.Stats()
    fmt.Printf("Wrote %d bytes\n", stats.BytesWritten)
}
```

### Parallel Processing of Large Files

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Open("large.jsonl")
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

    fmt.Printf("Parallel processed %d lines\n", count)
}
```

---

## See Also

- [Large File Processing API](./large-file) - ForeachFile series methods
- [Large File Processing Guide](../large-files) - Large file processing guide
- [Iterator](./iterator) - Iteration API
