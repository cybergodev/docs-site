---
sidebar_label: "Large Files Guide"
title: "Large File Processing - CyberGo JSON | Guide"
description: "CyberGo JSON large-file guide and API reference: ForeachFile* method signatures, parameter tables, memory control, and NDJSONProcessor streaming for Go ETL."
sidebar_position: 1
---

# Large File Processing

For large JSON files (such as logs, configurations, data exports), loading them directly into memory may cause out-of-memory errors. The json library provides multiple efficient processing methods.

::: warning
`ForeachFile` and `ForeachFileChunked` load the entire file into memory before iterating. The "chunked" behavior only affects how data in memory is iterated, not how the file is read. For truly memory-controlled processing of very large files, use `NDJSONProcessor` with JSONL format, or use `StreamIterator`.
:::

## Available Approaches

| Approach | Use Case | Memory Usage |
|----------|----------|--------------|
| **Processor.ForeachFile** | Structured iteration over file contents | Loads complete file, iterates item by item |
| **Processor.ForeachFileChunked** | Batch chunked iteration | Loads complete file, iterates in chunks |
| **NDJSONProcessor** | Line-by-line JSONL file processing | Memory-controllable, true streaming |

## Unified API: Processor

### Configuration Options

Large file processing configuration is integrated into `Config`:

```go
type Config struct {
    // ... other configuration ...

    // Large file processing configuration
    ChunkSize       int64 // Chunk size (default 1MB)
    MaxMemory       int64 // Maximum memory usage (default 100MB)
    BufferSize      int   // Read buffer size (default 64KB)
    SamplingEnabled bool  // Whether to enable sampling (default true)
    SampleSize      int   // Sample count (default 1000)
}
```

### Basic Usage

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Create Processor (with default configuration)
    processor, err := json.New()
    if err != nil {
        log.Fatal(err)
    }
    defer processor.Close()

    // Method 1: Item-by-item processing (recommended)
    count := 0
    err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        count++

        // Use IterableValue convenience methods to access fields
        id := item.GetInt("id")
        name := item.GetString("name")
        email := item.GetString("email")

        // Supports path access for nested properties
        city := item.GetString("profile.city")
        interests := item.GetArray("profile.interests")

        if count%10000 == 0 {
            log.Printf("Processed %d records, sample: id=%d name=%s email=%s city=%s interests=%d",
                count, id, name, email, city, len(interests))
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Processing complete, %d records total", count)
}
```

### Batch Processing

```go
// Method 2: Batch processing (suitable for batch database writes)
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("Processing batch: %d records", len(chunk))

    // Batch write to database
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... process data
    }
    return nil
})
```

### With Interrupt Control
```go
// Method 3: With interrupt control (stop after finding specific data)
// Return item.Break() to stop iteration, return nil to continue
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // Found target, stop iteration
        fmt.Printf("Found target: ID=%d, Name=%s\n", id, item.GetString("name"))
        return item.Break() // Stop iteration (return break signal)
    }

    return nil // Continue iteration
})
```

### Processing Object Files
```go
// Method 4: Process JSON object files (key-value structure)
// File format: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### Custom Configuration
```go
// Custom large file processing configuration
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB chunks
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB memory limit
cfg.BufferSize = 128 * 1024        // 128KB buffer

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## IterableValue Convenience Methods

The `ForeachFile*` family of methods provides an `IterableValue` interface that supports convenient data access:

| Method | Description | Example |
|--------|-------------|---------|
| `Get(path)` | Get value | `item.Get("field")` |
| `GetString(path)` | Get string | `item.GetString("name")` |
| `GetInt(path)` | Get integer | `item.GetInt("id")` |
| `GetFloat64(path)` | Get float | `item.GetFloat64("score")` |
| `GetBool(path)` | Get boolean | `item.GetBool("active")` |
| `GetArray(path)` | Get array | `item.GetArray("tags")` |
| `GetObject(path)` | Get object | `item.GetObject("profile")` |
| `Exists(path)` | Check if field exists | `item.Exists("email")` |
| `IsNull(path)` | Check if null | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | Check if empty | `item.IsEmpty("notes")` |
| `Break()` | Return break signal | `return item.Break()` |

**Supports Path Navigation**
```go
city := item.GetString("profile.address.city")      // Nested object
firstTag := item.GetString("tags[0]")               // Array index
lastTag := item.GetString("tags[-1]")               // Negative index (last)
nested := item.GetString("data.items[0].name")      // Complex path
```

## Stream Processing Configuration

Configure stream processing parameters through `Config`:

```go
cfg := json.DefaultConfig()

// Large file processing configuration
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB chunks
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB memory limit
cfg.BufferSize = 128 * 1024        // 128KB buffer

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Using StreamLinesInto Generic Function

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

_, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Processing: %s\n", user.Name)
    return nil
})
```

### Parallel Processing

For tasks that can be parallelized, you can use multiple goroutines:

```go
package main

import (
    "sync"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Use worker pool
    workers := 4
    items := make(chan any, 100)
    var wg sync.WaitGroup

    // Start workers
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for item := range items {
                // Process item (replace with your business logic)
                _ = item
            }
        }(i)
    }

    // Stream read and dispatch
    processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        items <- item.Get("")
        return nil
    })

    close(items)
    wg.Wait()
}
```

## Performance Optimization Tips

### Memory Control
```go
// Configure based on available memory
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500MB
cfg.ChunkSize = 10 * 1024 * 1024  // 10MB

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Best Practices
1. **Estimate file size**: Check file size before processing to choose an appropriate strategy
2. **Set memory limits**: Use `MaxMemory` to prevent OOM
3. **Batch commits**: Accumulate a certain number of records before batch writing to database
4. **Error handling**: Implement `JSONLContinueOnErr` or log failed entries
5. **Progress monitoring**: Periodically output processing progress

## Selection Guide

| File Size | Recommended Approach | Example |
|-----------|---------------------|---------|
| < 10MB | Load directly | `json.ParseAny` + `Get` |
| 10-100MB | Processor.ForeachFile | Item-by-item processing |
| 100MB-1GB | Processor.ForeachFileChunked | Chunked iteration |
| > 1GB | NDJSONProcessor / JSONL format | True streaming, memory-controllable |


## API Reference

This section summarizes the function signatures and parameter tables for the large-file processing API for quick lookup.

### Processor Methods

**ForeachFile**

Signature: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Processes JSON array elements in a large file one by one. See [Basic Usage](#basic-usage) and [Interrupt Control](#with-interrupt-control).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | JSON file path |
| `fn` | `func(key any, item *IterableValue) error` | Processing callback |

**Callback Return Values**

| Return Value | Description |
|--------------|-------------|
| `nil` | Continue to next item |
| `item.Break()` | Stop iteration without returning an error |
| other `error` | Stop iteration and return the error |

**ForeachFileChunked**

Signature: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) (err error)`

Processes a large file in batches, processing the specified number of elements each time. See [Batch Processing](#batch-processing).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | JSON file path |
| `chunkSize` | `int` | Number of elements per batch |
| `fn` | `func(chunk []*IterableValue) error` | Batch processing callback |

**ForeachFileWithPath**

Signature: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Processes JSON arrays or objects at a specified path within a file.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | JSON file path |
| `path` | `string` | JSON path expression |
| `fn` | `func(key any, item *IterableValue) error` | Processing callback |

```go
// Process each element of the users array in the file
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Name: %s\n", item.GetString("name"))
    return nil
})
```

**ForeachFileNested**

Signature: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Recursively traverses all nested JSON structures in a file.

```go
// Recursively traverse all nested elements
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

## Package-Level Functions

In addition to Processor methods, the following functions can be called directly without creating a Processor instance. They use the global processor internally.

### ForeachFile (Package-Level Function)

Signature: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (Package-Level Function)

Signature: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates by path.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("User: %s\n", name)
    return nil
})
```

### ForeachFileChunked (Package-Level Function)

Signature: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Chunk-iterates JSON arrays in a file.

```go
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### ForeachFileNested (Package-Level Function)

Signature: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and recursively iterates all nested structures.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Path: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

## See Also

- [NDJSON Processor](./jsonl) — JSONL/NDJSON streaming
- [JSONLWriter](./jsonl#jsonlwriter) — JSONL writer

## Next Steps
- [API Reference](../api-reference/) — Complete API reference
