---
title: "JSON Library - CyberGo JSON | High-Performance Go Library"
description: "CyberGo JSON: a fast, thread-safe Go JSON library with JSONPath queries, streaming, generic APIs, and Schema validation, compatible with encoding/json."
---

# JSON Library

`github.com/cybergodev/json` is a high-performance, thread-safe Go JSON processing library. It provides rich JSON operations including parsing, querying, modifying, validating, and formatting, while maintaining 100% compatibility with the standard library `encoding/json`.

## Core Features

- **100% encoding/json Compatible** — Seamless replacement for the standard library with no code changes required
- **Thread-Safe** — All operations are concurrency-safe, supporting high-concurrency scenarios
- **Path Queries** — JSONPath-style path expressions, including wildcards and slicing
- **Type-Safe Getters** — Generic API (`GetTyped[T]`) and type assertion methods (`SafeGet`)
- **Stream Processing** — Large file and JSONL/NDJSON streaming support
- **Security Protection** — Built-in input validation, depth limits, and dangerous pattern detection
- **High-Performance Caching** — Smart caching, pre-parse optimization, and object pool reuse
- **Extensible** — Hook system, custom encoders, and validators

## Installation

```bash
go get github.com/cybergodev/json
```

## 30-Second Quick Start

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"name": "CyberGo", "version": 1, "tags": ["json", "go"]}`

    // 1. Path query
    name := json.GetString(data, "name")
    fmt.Println("Name:", name)

    // 2. Modify value
    updated, _ := json.Set(data, "version", 2)
    fmt.Println("Updated:", updated)

    // 3. Validate
    if json.Valid([]byte(data)) {
        fmt.Println("Valid JSON")
    }

    // 4. Get with default value
    desc := json.GetString(data, "description", "Default description")
    fmt.Println("Description:", desc)

    // 5. Decode into struct
    type Config struct {
        Name    string   `json:"name"`
        Version int      `json:"version"`
        Tags    []string `json:"tags"`
    }
    var config Config
    json.Unmarshal([]byte(data), &config)
    fmt.Printf("Config: %+v\n", config)
}
```

## Feature Overview

### Path Operations

| Feature | Functions | Description |
|---------|-----------|-------------|
| Get value | `Get`, `GetString`, `GetInt`... | Supports nested paths, array indices |
| Get with default | `GetString`, `GetInt`, etc. | Pass a defaultValue parameter |
| Set value | `Set` | Automatically creates non-existent paths by default (Config.CreatePaths) |
| Delete value | `Delete` | Remove value at specified path |

### Encoding & Decoding

| Feature | Functions | Description |
|---------|-----------|-------------|
| Encode | `Marshal`, `MarshalIndent` | 100% compatible with encoding/json |
| Decode | `Unmarshal`, `Parse`, `ParseAny` | Supports generics and type safety |
| Format | `Prettify`, `Compact` | JSON pretty-print / compact |

### Advanced Features

| Feature | Functions/Types | Description |
|---------|----------------|-------------|
| Generic API | `GetTyped[T]` | Type-safe generic getter |
| Pre-parse | `Processor.PreParse`, `Processor.GetFromParsed` | Parse once, query many times |
| Safe access | `SafeGet` → `AccessResult` | Chained type conversions |
| Stream processing | `NDJSONProcessor` | Line-by-line streaming, controlled memory |
| JSONL processing | `StreamLinesInto[T]` | Log/data pipeline support |
| Schema validation | `ValidateSchema` | JSON Schema validation |

## Module Navigation

| Module | Description |
|--------|-------------|
| [Getting Started](./getting-started) | Installation, basic usage, core concepts |
| [Path Expression Syntax](./path-syntax) | Path queries, slicing, wildcards, field extraction |
| [API Reference](./api-reference/) | Complete API reference |
| [Large File Processing](./large-files) | Stream processing, chunked read/write, memory optimization |
| [Usage Examples](./examples) | Practical code examples |
| [Advanced Examples](./examples-advanced) | Batch encoding, pre-parsing, hook system |

## Performance Features

- **Zero-Copy Parsing** — Reduced memory allocations
- **Smart Caching** — Automatic caching of hot paths with cache warmup support
- **Object Pool** — Reuse of intermediate objects to reduce GC pressure
- **Parallel Processing** — Automatic parallelization of batch operations
- **Pre-Parse Optimization** — Parse large JSON once, query many times

## Comparison with Standard Library

| Feature | encoding/json | cybergodev/json |
|---------|---------------|-----------------|
| Basic encoding/decoding | ✅ | ✅ 100% compatible |
| Path queries | ❌ | ✅ Dot/bracket syntax |
| Type-safe getters | ❌ | ✅ Generic API |
| Stream processing | Basic | ✅ Enhanced |
| JSONL support | ❌ | ✅ Native support |
| Security validation | ❌ | ✅ Built-in protection |
| Hook system | ❌ | ✅ Extensible |
| Cache optimization | ❌ | ✅ Smart caching |

## Quick Decision Guide

| Scenario | Recommended Approach |
|----------|---------------------|
| Simple query | `GetString(data, "path")` |
| With default value | `GetString(data, "path", "default")` |
| Type safety | `GetTyped[User](data, "user")` |
| High-frequency queries | `Processor` + `PreParse` |
| Large files | `Processor.ForeachFile` |
| Untrusted input | `SecurityConfig()` |

## Next Steps

- [Getting Started](./getting-started) — Get up and running in 5 minutes
- [Path Expression Syntax](./path-syntax) — Complete path syntax reference
- [Usage Examples](./examples) — More practical examples
