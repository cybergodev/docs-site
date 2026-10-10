---
sidebar_label: "Large Files Guide"
title: "Large File Handling - CyberGo JSON | Stream & Memory Control"
description: "CyberGo JSON offers large-file handling with ForeachFile, StreamIterator and StreamJSONL streaming, ChunkSize batching and MaxMemory caps for logs and ETL."
sidebar_position: 10
---

# Large File Handling

For large JSON files (logs, configurations, data exports), loading everything into memory can cause OOM. The json library provides several efficient approaches.

::: tip
For the type-level API reference of the streaming and parallel iterators (StreamIterator, StreamObjectIterator, BatchIterator, ParallelIterator) see [Iterators](../api-reference/iterator); for parallel-processing practices see [Concurrency & Parallelism](../advanced/concurrency).
:::

::: warning
`ForeachFile` and `ForeachFileChunked` load the entire file into memory before iterating. The "chunked" behavior only affects how the in-memory data is iterated, not how the file is read. For truly memory-bounded processing of very large files, use the `StreamJSONL` family with the JSONL format, or use `StreamIterator`.
:::

## Available Options

| Option | Fits | Memory footprint |
|--------|------|------------------|
| **Processor.ForeachFile** | Structured iteration over a file | Loads the whole file, iterates item by item |
| **Processor.ForeachFileChunked** | Batched, chunked iteration | Loads the whole file, iterates in chunks |
| **StreamJSONL family** | Line-by-line JSONL file processing | Bounded memory, true streaming |
| **StreamIterator** | Element-by-element streaming decode of large arrays | Independent of array length |

### The Four ForeachFile Variants

The `ForeachFile` family has four variants, all accepting an optional `Config` (for per-call parsing and security-validation options); they differ in traversal target and grouping:

| Variant | Traversal target | Typical scenario |
|---------|------------------|------------------|
| `ForeachFile` | Root array elements / root object key-values | Logs and exports whose top level is the data collection |
| `ForeachFileWithPath` | The array/object at a given path | Sub-collections such as `users`, `orders` inside a file |
| `ForeachFileChunked` | Root array elements, batched by `chunkSize` | Bulk database writes, batched dispatch |
| `ForeachFileNested` | Recursively traverses all nested structures | Multi-level configs of unknown depth, structural statistics |

All four support returning `item.Break()` from the callback for early stopping; `ForeachFileChunked` requires the root to be a JSON array (otherwise `ErrTypeMismatch`), and `chunkSize <= 0` is treated as 100.

## The Unified API: Processor

### Configuration Options

Large-file handling configuration is integrated into `Config`:

```go
type Config struct {
    // ... other configuration ...

    // Large-file handling configuration
    ChunkSize       int64 // Chunk size (default 1MB)
    MaxMemory       int64 // Maximum memory usage (default 100MB)
    BufferSize      int   // Read buffer size (default 64KB)
    SamplingEnabled bool  // Whether sampling is enabled (default true)
    SampleSize      int   // Sample count (default 1000)
}
```

::: tip Don't confuse the two "chunk sizes"
`Config.ChunkSize` (`int64`, in bytes) is the chunk size for large-file reads, while the `chunkSize` parameter (`int`) of [`ForeachFileChunked`](#batch-processing) is the **number of elements per batch** — the two do not affect each other; the batching granularity of `ForeachFileChunked` is decided solely by its own parameter (treated as 100 when ≤0).
:::

### Basic Usage

```go
package main

import (
	"github.com/cybergodev/json"
	"log"
)

func main() {
	// Create a Processor (default configuration)
	processor, err := json.New()
	if err != nil {
		log.Fatal(err)
	}
	defer processor.Close()

	// Option 1: item by item (recommended)
	count := 0
	err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
		count++

		// Convenient field access with IterableValue
		id := item.GetInt("id")
		name := item.GetString("name")
		email := item.GetString("email")

		// Path access to nested properties is supported
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
	log.Printf("Done, %d records in total", count)
}
```

### Batch Processing

```go
// Option 2: batched (good for bulk database writes)
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("Processing batch: %d records", len(chunk))

    // Bulk write to the database
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... process the data
    }
    return nil
})
```

### Interruptible Processing

```go
// Option 3: interruptible (stop after finding specific data)
// Return item.Break() to stop iterating, nil to continue
targetID := 42 // the ID of the target record to find (a business variable)
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // Target found, stop iterating
        fmt.Printf("Found target: ID=%d, Name=%s\n", id, item.GetString("name"))
        return item.Break() // stop iterating (returns the break signal)
    }

    return nil // continue iterating
})
```

### Processing Object Files

```go
// Option 4: process a JSON object file (key-value structure)
// File format: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %s, Name: %s\n", key, item.GetString("name"))
    return nil
})
```

### Custom Configuration

```go
// Custom large-file configuration
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB chunks
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB memory cap
cfg.BufferSize = 128 * 1024        // 128KB buffer

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## IterableValue Convenience Methods

The `ForeachFile*` family provides the `IterableValue` interface with convenient data access:

| Method | Description | Example |
|--------|-------------|---------|
| `Get(path)` | Get a value | `item.Get("field")` |
| `GetString(path)` | Get a string | `item.GetString("name")` |
| `GetInt(path)` | Get an integer | `item.GetInt("id")` |
| `GetFloat64(path)` | Get a float | `item.GetFloat64("score")` |
| `GetBool(path)` | Get a boolean | `item.GetBool("active")` |
| `GetArray(path)` | Get an array | `item.GetArray("tags")` |
| `GetObject(path)` | Get an object | `item.GetObject("profile")` |
| `Exists(path)` | Check a field exists | `item.Exists("email")` |
| `IsNull(path)` | Check for null | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | Check for empty | `item.IsEmpty("notes")` |
| `Break()` | Return the break signal | `return item.Break()` |

**Path navigation supported**

```go
city := item.GetString("profile.address.city")      // nested object
firstTag := item.GetString("tags[0]")               // array index
lastTag := item.GetString("tags[-1]")               // negative index (last)
nested := item.GetString("data.items[0].name")      // complex path
```

::: warning Do not hold IterableValue references after the callback returns
The `ForeachFile*` (and in-memory `Foreach*`) families use an object pool to cut allocation overhead: **after the callback returns**, the `IterableValue` goes back to the pool with its internal data nulled. Extract the values you need inside the callback (e.g. the result of `GetString`); do not stash `item` itself or the reference from `item.GetData()` beyond the callback.
:::

## Streaming Configuration

Configure streaming parameters via `Config`. The fields directly relevant to streaming reads and their actual behavior:

| Field | Default (`DefaultConfig`) | Behavior |
|-------|---------------------------|----------|
| `MaxJSONSize` | 100MB (`DefaultMaxJSONSize`) | Total byte cap for file/Reader reads. `LoadFromFile`/`UnmarshalFromFile`/`LoadFromReader` enforce it **during the read** with `io.LimitReader` (reading cap+1 bytes to detect truncation, avoiding TOCTOU races); the `ForeachFile*` family inherits it via `LoadFromFile`; a `cfg.MaxJSONSize > 0` passed to streaming iterator constructors caps the whole stream |
| `BufferSize` | 64KB | Read buffer for `StreamIterator`/`StreamObjectIterator`; falls back to 32KB when `cfg` is passed with `BufferSize <= 0` |
| `ChunkSize` | 1MB | Large-file chunk size (validation range 64KB–100MB) |
| `MaxMemory` | 100MB | Total memory cap (validation range 10MB–1GB); the JSONL streaming memory fallback chain is `JSONLMaxMemory` -> `MaxMemory` |
| `MaxNestingDepthSecurity` | 200 (`DefaultMaxNestingDepth`) | Per-line nesting depth cap for JSONL, checked line by line before parsing |
| `ValidateFilePath` | `true` | Declared but currently **not a switch**: file-path security validation (traversal, symlinks, platform restrictions) runs unconditionally at read/write time |

`Config.Validate`/`ValidateWithWarnings` silently clamp out-of-range values back into the legal ranges (e.g. `BufferSize` clamped to 4KB–1MB); use `ValidateWithWarnings` to see the adjustments.

```go
cfg := json.DefaultConfig()

// Large-file configuration
cfg.ChunkSize = 10 * 1024 * 1024   // 10MB chunks
cfg.MaxMemory = 500 * 1024 * 1024  // 500MB memory cap
cfg.BufferSize = 128 * 1024        // 128KB buffer

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Using the StreamLinesInto Generic Function

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

For parallelizable tasks, use multiple goroutines:

```go
package main

import (
	"github.com/cybergodev/json"
	"sync"
)

func main() {
	processor, err := json.New()
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// Use a worker pool
	workers := 4
	items := make(chan any, 100)
	var wg sync.WaitGroup

	// Start the workers
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

	// Stream-read and dispatch
	processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
		items <- item.GetData()
		return nil
	})

	close(items)
	wg.Wait()
}
```

If the data is already in memory (`[]any`), you can use the library's built-in [ParallelIterator](../api-reference/iterator#the-paralleliterator-type) directly, skipping the hand-written worker pool.

## Streaming and Parallel Iterators

`ForeachFile*` loads the whole file first; when a file is too big for a full in-memory load, switch to this section's iterators: `StreamIterator`/`StreamObjectIterator` decode directly from an `io.Reader` while reading, with memory independent of data size. For the complete type-level API see [Iterators](../api-reference/iterator).

### StreamIterator: element-by-element streaming decode of large arrays

```go
package main

import (
	"fmt"
	"io"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// Small data for the demo; replace with os.Open("large-array.json") in practice
	var src io.Reader = strings.NewReader(`[
		{"id": 1, "name": "Alice"},
		{"id": 2, "name": "Bob"},
		{"id": 3, "name": "Carol"}
	]`)

	iter := json.NewStreamIterator(src)
	count := 0
	for iter.Next() {
		if obj, ok := iter.Value().(map[string]any); ok {
			fmt.Printf("index=%d id=%.0f name=%s\n", iter.Index(), obj["id"], obj["name"])
		}
		count++
	}
	if err := iter.Err(); err != nil {
		fmt.Println("Iteration error:", err)
		return
	}
	fmt.Println("Elements iterated:", count)
	// Output:
	// index=0 id=1 name=Alice
	// index=1 id=2 name=Bob
	// index=2 id=3 name=Carol
	// Elements iterated: 3
}
```

Key points:

- The top level must be a JSON array; a top-level scalar is yielded once as a single element, and a top-level object is rejected (`iter.Err()` returns an error).
- A passed `cfg.MaxJSONSize > 0` caps the **entire stream's** total bytes (default fallback 100MB); exceeding it errors during iteration.
- Elements are decoded one at a time — only the current element is in memory at any moment.

### StreamObjectIterator: key-by-key streaming decode of large objects

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	src := strings.NewReader(`{
		"users":  {"count": 3},
		"orders": {"count": 128},
		"events": {"count": 9001}
	}`)

	iter := json.NewStreamObjectIterator(src)
	for iter.Next() {
		if obj, ok := iter.Value().(map[string]any); ok {
			fmt.Printf("%s: count=%.0f\n", iter.Key(), obj["count"])
		}
	}
	if err := iter.Err(); err != nil {
		fmt.Println("Iteration error:", err)
		return
	}
	// Output (in document order, not random map order):
	// users: count=3
	// orders: count=128
	// events: count=9001
}
```

Suited to scenarios where the top level is one enormous object (config tables, partition indexes), processed key-value by key-value.

### BatchIterator: batched consumption of in-memory arrays

`BatchIterator` operates on an already-loaded `[]any`, returning sliced batches — good for feeding medium-sized arrays downstream in fixed batches (bulk DB loads, paginated computation):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := []any{
		map[string]any{"id": 1},
		map[string]any{"id": 2},
		map[string]any{"id": 3},
		map[string]any{"id": 4},
		map[string]any{"id": 5},
	}

	// Batch size comes from Config.MaxBatchSize; 2000 under the default configuration
	cfg := json.DefaultConfig()
	cfg.MaxBatchSize = 2

	iter := json.NewBatchIterator(data, cfg)
	fmt.Println("Total batches:", iter.TotalBatches())
	for iter.HasNext() {
		batch := iter.NextBatch()
		fmt.Printf("Batch [%d:%d), elements=%d\n", iter.CurrentIndex()-len(batch), iter.CurrentIndex(), len(batch))
	}
	// Output:
	// Total batches: 3
	// Batch [0:2), elements=2
	// Batch [2:4), elements=2
	// Batch [4:5), elements=1
}
```

For very large bulk loads use [`ForeachFileChunked`](#batch-processing) (file source) or [`StreamJSONLChunked`](./jsonl#streamjsonlchunked) (JSONL source) instead; both also return `IterableValue` to the pool after the chunk callback returns, so finish persisting inside the callback.

### ParallelIterator: CPU-bound parallel processing

`ParallelIterator` processes an in-memory array with a worker pool; the worker count comes from `Config.MaxConcurrency` (50 by default) and narrows automatically to the data length. `Map` results are written by index, preserving input order:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	nums := []any{1, 2, 3, 4}

	iter := json.NewParallelIterator(nums)
	defer iter.Close()

	squares, err := iter.Map(func(idx int, val any) (any, error) {
		n, ok := val.(int)
		if !ok {
			return nil, fmt.Errorf("element %d is not an integer", idx)
		}
		return n * n, nil
	})
	if err != nil {
		fmt.Println("Processing error:", err)
		return
	}
	fmt.Println("Squares:", squares)
	// Output: Squares: [1 4 9 16]
}
```

In `ForEach`/`ForEachWithContext`, any callback error stops dispatching new tasks and returns that error; callback panics are recovered into errors instead of taking down the process; `Close` signals all workers to finish and is safe to call concurrently. For cancellation/timeout scenarios use the `ForEachWithContext`/`ForEachBatchWithContext` variants.

## Performance Optimization Advice

### Memory Control

```go
// Configure per available memory
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

1. **Estimate file size**: check the file size before processing and choose the right strategy
2. **Set memory limits**: use `MaxMemory` to prevent OOM
3. **Batch commits**: accumulate a fixed count before bulk database writes
4. **Error handling**: enable `JSONLContinueOnErr` or record failed entries
5. **Progress monitoring**: log processing progress periodically

## Selection Guide

| File size | Recommended option | Example |
|-----------|--------------------|---------|
| < 10MB | Load directly | `json.ParseAny` + `Get` |
| 10-100MB | Processor.ForeachFile | Full in-memory load, then item-by-item iteration |
| 100MB-1GB | StreamIterator / StreamObjectIterator (or convert to JSONL lines) | Constant memory, decoding while reading |
| > 1GB | JSONL format + StreamJSONL family | True streaming with bounded memory |

::: warning Do not use ForeachFile* for files over 100MB
The `ForeachFile*` family (including `ForeachFileChunked`) reads the **entire file into memory** before iterating (see the warning at the top of this page), and is bounded by the `MaxJSONSize` read cap: the default is 100MB (`DefaultMaxJSONSize`), and `Config.Validate` clamps any larger value back down to 100MB — so files over 100MB fail outright with `ErrSizeLimit`; raising the config cannot make `ForeachFile*` handle them. For such inputs use `StreamIterator` / `StreamObjectIterator` (constant memory; when `cfg.MaxJSONSize > 0` is passed, the whole stream is capped at that value, which may exceed 100MB — raise it explicitly when constructing the iterator) or convert the data to JSONL and use the `StreamJSONL` family.
:::

## API Reference

This section summarizes the signatures and parameter tables of large-file APIs for quick lookup.

### Processor Methods

**ForeachFile**

Signature: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Processes the elements of a large JSON file one by one. Full usage in [Basic Usage](#basic-usage) and [Interruptible Processing](#interruptible-processing).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the JSON file |
| `fn` | `func(key any, item *IterableValue) error` | Processing callback |

**Callback return values**

| Return value | Description |
|--------------|-------------|
| `nil` | Continue with the next item |
| `item.Break()` | Stop iterating without an error |
| Other `error` | Stop iterating and return the error |

**ForeachFileChunked**

Signature: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) (err error)`

Processes a large file in batches of a given element count. Usage in [Batch Processing](#batch-processing).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the JSON file |
| `chunkSize` | `int` | Elements per batch |
| `fn` | `func(chunk []*IterableValue) error` | Batch callback |

**ForeachFileWithPath**

Signature: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Processes the JSON array or object at a given path inside a file.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the JSON file |
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

Besides the Processor methods, the following functions can be called directly without creating a Processor instance. They use the global processor internally.

### ForeachFile (Package-Level Function)

Signature: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates it.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (Package-Level Function)

Signature: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates at a given path.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("User: %s\n", name)
    return nil
})
```

### ForeachFileChunked (Package-Level Function)

Signature: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Iterates a JSON array from a file in chunks.

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

- [JSONL Streaming](./jsonl) — the StreamJSONL family and JSONLWriter in practice
- [JSONLWriter](./jsonl#jsonlwriter) — The JSONL writer

## Next Steps

- [API Reference](../api-reference/) — The complete API reference
