---
title: "Processor JSONL Methods - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor JSONL: StreamJSONL streaming, ForeachJSONL iteration, MapJSONL mapping, ReduceJSONL reduction, and FilterJSONL filtering."
---

# Processor JSONL Methods

Processor provides complete JSONL (JSON Lines) stream processing capabilities, supporting line-by-line processing, parallel processing, batch processing, and functional operations.

## Stream Read Methods

### StreamJSONL

Signature: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Stream-processes JSONL data, reading line by line and calling the callback function.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing function, returning an error stops processing |

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

Signature: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Parallel-processes JSONL data using multiple worker goroutines to accelerate processing.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `workers` | `int` | Number of worker goroutines (defaults to 4 when <=0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing function |

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

::: tip Performance Tips
- Suitable for CPU-intensive operations (data transformation, computation)
- For I/O-intensive operations, use single-threaded `StreamJSONL`
- Workers count should be set to the number of CPU cores
:::

### StreamJSONLParallelWithContext

Signature: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Parallel-processes JSONL data with context, supporting cancellation and timeout control.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `ctx` | `context.Context` | Context for cancellation or timeout |
| `reader` | `io.Reader` | JSONL data source |
| `workers` | `int` | Number of worker goroutines (defaults to 4 when <=0) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Processing function |

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

Signature: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

Chunk-processes JSONL data, processing a batch of elements each time.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `reader` | `io.Reader` | JSONL data source |
| `chunkSize` | `int` | Number of elements per batch |
| `fn` | `func(chunk []*IterableValue) error` | Batch processing function |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // Batch insert into database
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

Signature: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Stream-processes JSONL data directly from a file.

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

Signature: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

An alias method for iterating JSONL data, behaving identically to `StreamJSONL`.

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Line %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

Signature: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

Maps JSONL data to a new format, returning the converted slice.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Extract all usernames
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

Signature: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

Reduces JSONL data to a single value.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// Calculate total sales
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("Total sales: %.2f\n", total.(float64))
```

---

### FilterJSONL

Signature: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

Filters JSONL data, returning elements that satisfy the condition.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// Filter error logs
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("Found %d error log entries\n", len(errors))
```

---

### CollectJSONL

Signature: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

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

::: warning Memory Note
This method loads all data into memory and is not suitable for very large files. For large files, use `StreamJSONL` for line-by-line processing.
:::

---

### FirstJSONL

Signature: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

Finds the first element that satisfies the condition.

**Return Values**

| Type | Description |
|------|-------------|
| `*IterableValue` | Found element (if exists) |
| `bool` | Whether found |
| `error` | Error information |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Find the first admin
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

## Configuration Options

JSONL processing behavior can be configured through the following `Config` fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | Read buffer size |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | Maximum bytes per line |
| `JSONLSkipEmpty` | `bool` | `true` | Skip empty lines |
| `JSONLSkipComments` | `bool` | `false` | Skip `#` or `//` comments |
| `JSONLContinueOnErr` | `bool` | `false` | Continue on parse error |
| `JSONLWorkers` | `int` | 4 | Parallel worker goroutines |
| `JSONLChunkSize` | `int` | 1000 | Batch size for chunk processing |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | Maximum memory usage |

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // Skip comment lines
cfg.JSONLContinueOnErr = true    // Continue on parse error
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
    "os"
    "github.com/cybergodev/json"
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

    fmt.Printf("Statistics: %d errors, %d warnings\n", errorCount, warningCount)
}
```

### Parallel Data Processing

```go
package main

import (
    "fmt"
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
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

    fmt.Printf("Parallel processed %d records\n", processed)
}
```

---

## See Also

- [JSONL Processor](../jsonl) - Package-level JSONL functions
- [Large File Processing](../../large-files) - Large file processing guide
- [Iterator](../iterator) - IterableValue type details
