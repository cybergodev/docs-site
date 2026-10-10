---
sidebar_label: "Overview"
title: "JSON Library - CyberGo JSON | JSONPath Queries & Streaming"
description: "CyberGo JSON: high-performance, thread-safe Go JSON with JSONPath queries, streaming, generics, Schema validation, hooks, and 100% encoding/json compatibility."
---

# JSON Library

`github.com/cybergodev/json` is a high-performance, thread-safe Go JSON processing library. It provides a rich set of JSON operations — parsing, querying, modifying, validating, and formatting — while maintaining 100% compatibility with the standard library `encoding/json`.

## Core Features

- **100% encoding/json compatible** — a drop-in replacement for the standard library, no changes to existing code required
- **Thread-safe** — all operations are concurrency-safe, suited to high-concurrency workloads
- **Path queries** — JSONPath-style path expressions, including wildcards and slices
- **Type-safe access** — generic API (`GetTyped[T]`) and type-assertion methods (`SafeGet`)
- **Streaming** — streaming processing for large files and the JSONL/NDJSON format
- **Security hardening** — built-in input validation, depth limits, and dangerous-pattern detection
- **High-performance caching** — smart caching, pre-parse optimization, object-pool reuse
- **Extensible** — hook system, custom encoders, validators

## Installation

```bash
go get github.com/cybergodev/json
```

**Requires Go 1.25+** (the source `go.mod` declares `go 1.25.0`; examples use generics and the `slices` standard library).

## 30-Second Quick Tour

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"name": "CyberGo", "version": 1, "tags": ["json", "go"]}`

	// 1. Get by path
	name := json.GetString(data, "name")
	fmt.Println("Name:", name)

	// 2. Modify a value
	updated, _ := json.Set(data, "version", 2)
	fmt.Println("Updated:", updated)

	// 3. Validate
	if json.Valid([]byte(data)) {
		fmt.Println("Valid JSON")
	}

	// 4. Get with a default value
	desc := json.GetString(data, "description", "Default description")
	fmt.Println("Description:", desc)

	// 5. Decode into a struct
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
| Get values | `Get`, `GetString`, `GetInt`... | Nested paths and array indices supported |
| Batch get | `GetMultiple` | Retrieve values at multiple paths with a single parse |
| Get with default | `GetString`, `GetInt`, etc. | Pass a defaultValue argument |
| Set values | `Set` | Automatically creates missing paths by default (Config.CreatePaths) |
| Delete values | `Delete` | Deletes the specified path |

### Encoding & Decoding

| Feature | Functions | Description |
|---------|-----------|-------------|
| Encode | `Marshal`, `MarshalIndent` | 100% encoding/json compatible |
| Decode | `Unmarshal`, `Parse`, `ParseAny` | Generics and type safety supported |
| Format | `Prettify`, `Compact` | JSON pretty-print / compaction |

### Advanced Features

| Feature | Functions/Types | Description |
|---------|-----------------|-------------|
| Generic API | `GetTyped[T]` | Type-safe generic get |
| Pre-parsing | `Processor.PreParse`, `Processor.GetFromParsed` | Parse once, query many times |
| Path pre-compilation | `Processor.CompilePath`, `Processor.GetCompiled` | Zero repeated parsing for high-frequency identical paths |
| Parallel iteration | `NewParallelIterator` | Parallel Map/Filter/ForEach with a built-in worker pool |
| Safe access | `SafeGet` → `AccessResult` | Chained type conversion |
| Streaming | `StreamJSONL` family | Line-by-line streaming with bounded memory |
| JSONL processing | `StreamLinesInto[T]` | Log/data pipelines |
| Schema validation | `ValidateSchema` | JSON Schema validation |

## Module Navigation

| Module | Description |
|--------|-------------|
| [Quick Start](./getting-started/) | Installation, basic usage, core concepts |
| [Path Expression Syntax](./getting-started/path-syntax) | Path queries, slices, wildcards, field extraction |
| [Processor Guide](./getting-started/processor-guide) | When to use a Processor, pre-parse optimization, lifecycle |
| [API Reference](./api-reference/) | Complete API reference |
| [Large File Handling](./streaming/large-files) | Item-by-item file iteration, streaming iterators, memory optimization |
| [Extension Interfaces](./extensions/) | Hook system intercepting the full Get/Set/Delete flow; custom encoding via `json.Marshaler`/`CustomEscapes` |
| [Security](./security/) | Input validation on by default (size/depth/UTF-8/dangerous patterns); `SecurityConfig()` preset for untrusted input, with a production checklist |
| [Examples](./examples/) | Real-world code examples |
| [Advanced Examples](./examples/examples-advanced) | Batch encoding, pre-parsing, hook system |

## Performance Characteristics

- **Zero-allocation fast paths** — single-key access and cache-key building use on-stack buffers to reduce heap allocations
- **Smart caching** — hot paths are cached automatically, with cache warm-up support
- **Object pools** — reuse of intermediate objects to reduce GC pressure
- **Parallel streaming** — JSONL streaming supports multiple parallel workers (`StreamJSONLParallel`)
- **Pre-parse optimization** — parse large JSON once, query many times

## Comparison with the Standard Library

| Feature | encoding/json | cybergodev/json |
|---------|---------------|-----------------|
| Basic encoding/decoding | ✅ | ✅ 100% compatible |
| Path queries | ❌ | ✅ dot/bracket syntax |
| Type-safe access | ❌ | ✅ generic API |
| Streaming | Basic | ✅ enhanced |
| JSONL support | ❌ | ✅ native support |
| Security validation | ❌ | ✅ built-in protection |
| Hook system | ❌ | ✅ extensible |
| Cache optimization | ❌ | ✅ smart caching |

## Quick Decision Guide

| Scenario | Recommended Approach |
|----------|----------------------|
| Simple query | `GetString(data, "path")` |
| With a default value | `GetString(data, "path", "default")` |
| Type safety | `GetTyped[User](data, "user")` |
| Query many paths on one JSON | `Processor` + `PreParse` |
| Query one path across many JSONs | `Processor` + `CompilePath` |
| Large files | `StreamIterator` (>100MB) / `Processor.ForeachFile` (10-100MB, fully loaded) |
| Process large arrays in parallel | `NewParallelIterator` |
| JSONL pipelines | `StreamLinesInto[T]` |
| Untrusted input | `SecurityConfig()` |

## Next Steps

- [Quick Start](./getting-started/) — up and running in 5 minutes
- [Processor Guide](./getting-started/processor-guide) — when to use a processor
- [Path Expression Syntax](./getting-started/path-syntax) — the complete path syntax
- [Examples](./examples/) — more real-world examples
- [Security](./security/) — built-in input validation and untrusted-input hardening
