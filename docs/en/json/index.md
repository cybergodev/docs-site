---
sidebar_label: "Overview"
title: "JSON Library - CyberGo JSON | JSONPath Queries & Streaming"
description: "CyberGo JSON is a Go JSON library: Get/Set path queries, StreamJSONL streaming, generic GetTyped, and default input validation. Signatures match encoding/json."
---

# JSON Library

`github.com/cybergodev/json` is a Go JSON library for parsing, path queries, modification, validation, formatting, and streaming of large files and JSONL. Function signatures match `encoding/json`, so existing code compiles after swapping the import; input is validated by default, which introduces a few behavioral differences from the standard library (see [Comparison with the Standard Library](#comparison-with-the-standard-library)).

## Core Features

- **Signature-compatible with encoding/json** — `Marshal`/`Unmarshal`/`Valid`/`Compact`/`Indent` and the `Encoder`/`Decoder` methods share names and signatures with the standard library; swapping the import is enough to compile. Default input validation introduces a few behavioral differences.
- **Thread-safe** — one `Processor` can be shared across goroutines; every public method is protected internally.
- **Path queries** — dot notation, array indices, slices, wildcards, and JSON Pointer each express a lookup in one path string.
- **Type-safe access** — `GetTyped[T]` for generic decoding; `SafeGet` returns an `AccessResult` you can chain conversions on.
- **Streaming** — `StreamIterator`/`StreamObjectIterator` decode element by element; the JSONL family processes line by line.
- **Security** — input size, nesting depth, invalid UTF-8, and dangerous patterns are validated by default.
- **Caching** — parse and result caches are on by default; `WarmupCache` pre-fills hot paths.
- **Extensible** — `Hook` intercepts `Get`/`Set`/`Delete`; custom encoding goes through `MarshalJSON`, `MarshalText`, or `CustomEscapes`.

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
| Encode | `Marshal`, `MarshalIndent` | Output bytes match the standard library (typical values) |
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
| [Large File Handling](./streaming/large-files) | Item-by-item file iteration, streaming iterators, read caps |
| [Extension Interfaces](./extensions/) | Hooks intercept the full Get/Set/Delete flow; custom encoding via `MarshalJSON`, `MarshalText`, or `CustomEscapes` |
| [Security](./security/) | Input validation on by default (size/depth/UTF-8/dangerous patterns); `SecurityConfig()` preset for untrusted input, with a production checklist |
| [Examples](./examples/) | Runnable examples for paths, codecs, iteration, and JSONL |
| [Advanced Examples](./examples/examples-advanced) | Batch encoding, field selection, pre-parsing, compiled paths, cache warm-up |

## Performance Characteristics

- **Zero-allocation fast paths** — cache keys are comparable structs, so no string is concatenated per operation; with the cache off, single-key property access reads the root object directly and bypasses the recursive processor
- **Caching** — parse results and query results are cached by default (`EnableCache`/`CacheResults`); `WarmupCache` pre-fills hot paths
- **Object pools** — `IterableValue`, encoder buffers, and sorted-key slices are reused to reduce GC pressure
- **Parallel streaming** — JSONL streaming supports multiple parallel workers (`StreamJSONLParallel`)
- **Pre-parsing** — `PreParse` parses one JSON document once and shares the parse tree across paths

## Comparison with the Standard Library

| Feature | encoding/json | cybergodev/json |
|---------|---------------|-----------------|
| Basic encoding/decoding | ✅ | ✅ same signatures, plus default input validation |
| Path queries | ❌ | ✅ dot/bracket syntax |
| Type-safe access | ❌ | ✅ generic API |
| Streaming | basic streaming decoder | ✅ element/line iterators |
| JSONL support | ❌ | ✅ native support |
| Security validation | ❌ | ✅ on by default |
| Hook system | ❌ | ✅ extensible |
| Cache optimization | ❌ | ✅ parse and result caches |

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

- [Quick Start](./getting-started/) — installation and a minimal example
- [Processor Guide](./getting-started/processor-guide) — when to use a processor
- [Path Expression Syntax](./getting-started/path-syntax) — the complete path syntax
- [Examples](./examples/) — more runnable examples
- [Security](./security/) — built-in input validation and untrusted-input hardening
