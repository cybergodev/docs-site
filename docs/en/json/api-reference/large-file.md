---
title: "Large File Processing - CyberGo JSON | API Reference"
description: "CyberGo JSON large-file API: ForeachFile streaming, ForeachFileChunked batching, ForeachFileWithPath, ForeachFileNested, and memory control config."
---

# Large File Processing


## Configuration Options

Large file processing configuration is integrated into the `Config` struct:

```go
type Config struct {
    // ... other configuration ...

    // Large file processing configuration
    ChunkSize       int64 // Chunk size (default 1MB)
    MaxMemory       int64 // Maximum memory usage (default 100MB)
    BufferSize      int   // Read buffer size (default 64KB)
    SamplingEnabled bool  // Whether sampling is enabled (default true)
    SampleSize      int   // Sample count (default 1000)
}
```

### Custom Configuration

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB chunks
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB memory limit
cfg.BufferSize = 128 * 1024        // 128KB buffer

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

Signature: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Processes JSON array elements in a large file one by one.

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

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // Use IterableValue convenience methods to access fields
    id := item.GetInt("id")
    name := item.GetString("name")

    if count%10000 == 0 {
        log.Printf("Processed %d records", count)
    }
    return nil
})
```

**Breaking Iteration Example**

```go
err := p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // Found target, stop iteration
        return item.Break() // Stop without error
    }
    return nil // Continue iteration
})
```

---

## ForeachFileChunked

Signature: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Processes a large file in batches, processing the specified number of elements each time.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | JSON file path |
| `chunkSize` | `int` | Number of elements per batch |
| `fn` | `func(chunk []*IterableValue) error` | Batch processing callback |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Process 1000 records at a time
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // Batch insert into database
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... process data
    }
    return nil
})
```

---

## ForeachFileWithPath

Signature: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

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

---

## ForeachFileNested

Signature: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Recursively traverses all nested JSON structures in a file.

```go
// Recursively traverse all nested elements
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

---

## IterableValue Convenience Methods

The `ForeachFile*` methods provide an `IterableValue` interface supporting convenient data access:

| Method | Description | Example |
|--------|-------------|---------|
| `GetInt(path)` | Get integer | `item.GetInt("id")` |
| `GetString(path)` | Get string | `item.GetString("name")` |
| `GetFloat64(path)` | Get float | `item.GetFloat64("score")` |
| `GetBool(path)` | Get boolean | `item.GetBool("active")` |
| `GetArray(path)` | Get array | `item.GetArray("tags")` |
| `GetObject(path)` | Get object | `item.GetObject("profile")` |
| `Exists(path)` | Check if field exists | `item.Exists("email")` |
| `IsNull(path)` | Check if null | `item.IsNull("deleted_at")` |
| `GetData()` | Get raw data | `item.GetData()` |
| `Break()` | Return break signal | `return item.Break()` |

**Path Navigation Support**

```go
city := item.GetString("profile.address.city")      // Nested object
firstTag := item.GetString("tags[0]")               // Array index
lastTag := item.GetString("tags[-1]")               // Negative index (last element)
nested := item.GetString("data.items[0].name")      // Complex path
```

---

## Complete Example

### Processing Large Log Files

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Create processor
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // 10MB chunks
    cfg.MaxMemory = 500 * 1024 * 1024 // 500MB memory limit

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Count error logs
    errorCount := 0
    err = p.ForeachFile("logs.json", func(key any, item *json.IterableValue) error {
        level := item.GetString("level")
        if level == "error" {
            message := item.GetString("message")
            fmt.Printf("Error: %s\n", message)
            errorCount++
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found %d errors\n", errorCount)
}
```

### Batch Database Import

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

// User represents a user record (sample data model)
type User struct {
    ID    int
    Name  string
    Email string
}

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Write to database in batches of 500
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // Batch insert
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("Batch inserted %d records", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## Package-Level File Iteration Functions

In addition to Processor methods, the following functions can be called directly without creating a Processor instance. They use the global processor internally.

### ForeachFile (Package-Level Function)

Signature: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and iterates.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (Package-Level Function)

Signature: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and iterates by path.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("User: %s\n", name)
    return nil
})
```

### ForeachFileChunked (Package-Level Function)

Signature: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

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

Signature: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and recursively iterates all nested structures.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Path: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

---

## See Also

- [Large File Processing Guide](../large-files) - Complete usage guide
- [NDJSON Processor](./jsonl) - JSONL/NDJSON processing
- [JSONLWriter](./jsonl#jsonlwriter) - JSONL writer
