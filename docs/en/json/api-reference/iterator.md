---
sidebar_label: "Iterator Types"
title: "Iterator Types - CyberGo JSON | API Reference"
description: "CyberGo JSON iterator types: Iterator sequential traversal, IterableValue data access, StreamIterator/StreamObjectIterator streaming, BatchIterator batch, and ParallelIterator parallel iterator constructors and methods."
sidebar_position: 9
---

# Iterator Types

The json package provides a variety of iterator types, covering sequential traversal, stream processing, batch processing, and parallel processing scenarios. The iteration **functions** (`Foreach`, `ForeachFile`, etc.) are documented in [Package-Level Iteration Functions](./functions/iterate) and [Processor Iteration Methods](./processor/iterate).

## IteratorControl Constants

`IteratorControl` represents an iteration control flag, used by `ForeachWithPathAndControl` and `ForeachWithPathAndIterator` to control the iteration flow.

| Constant | Description |
|------|------|
| `IteratorNormal` | Continue iteration normally (the default) |
| `IteratorContinue` | Skip the current item and continue iteration |
| `IteratorBreak` | Stop iteration |

**Use Cases**

| Scenario | Recommended Return Value | Description |
|------|------------|------|
| Normal element processing | `IteratorNormal` | Continue processing the next element |
| Filter invalid data | `IteratorContinue` | Skip the current element without breaking iteration |
| Exit after finding target | `IteratorBreak` | Stop immediately after finding the required data |
| Break on error | `IteratorBreak` | Stop iteration when a critical error is encountered |

---

## Iterator Type

Iterator is a low-level iterator for traversing JSON arrays or objects.

### NewIterator

Signature: `func NewIterator(data any, cfg ...Config) *Iterator`

Creates an iterator instance.

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | Check if there are more elements |
| `Next` | `func (it *Iterator) Next() (any, bool)` | Get the next element |
| `Reset` | `func (it *Iterator) Reset()` | Clear iterator state and cache, ready for reuse |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | Clear state and initialize with new data |

### Reset

Clears the iterator state and releases cached keys. After calling, use `ResetWith` to reinitialize.

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // Clear cache
```

### ResetWith

Clears the iterator state and initializes with new data, enabling iterator reuse.

```go
it := json.NewIterator(data1)
// ... iterate data1 ...

it.ResetWith(data2) // Reuse iterator for new data
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## IterableValue Type

IterableValue wraps the current element during iteration, providing convenient value access methods. The callback of the `Foreach` family of functions receives `*IterableValue`.

### Methods

#### GetData

Signature: `func (iv *IterableValue) GetData() any`

Returns the underlying data.

#### Get

Signature: `func (iv *IterableValue) Get(path string) any`

Gets a value by path (supports dot notation and array indexing).

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

Signature: `func (iv *IterableValue) GetString(key string) string`

Gets a string value.

```go
name := item.GetString("name")
```

#### GetInt

Signature: `func (iv *IterableValue) GetInt(key string) int`

Gets an integer value.

```go
age := item.GetInt("age")
```

#### GetFloat64

Signature: `func (iv *IterableValue) GetFloat64(key string) float64`

Gets a float64 value.

```go
price := item.GetFloat64("price")
```

#### GetBool

Signature: `func (iv *IterableValue) GetBool(key string) bool`

Gets a boolean value.

```go
enabled := item.GetBool("enabled")
```

#### GetArray

Signature: `func (iv *IterableValue) GetArray(key string) []any`

Gets an array value.

```go
items := item.GetArray("items")
```

#### GetObject

Signature: `func (iv *IterableValue) GetObject(key string) map[string]any`

Gets an object value.

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

Signature: `func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

Gets a value, returning the default value if the key does not exist.

```go
// Get optional field, use default when missing
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

Signature: `func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

Gets a string value, returning the default value if the key does not exist.

```go
name := item.GetStringWithDefault("name", "unknown")
```

#### GetIntWithDefault

Signature: `func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

Gets an integer value, returning the default value if the key does not exist.

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

Signature: `func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

Gets a float64 value, returning the default value if the key does not exist.

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

Signature: `func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

Gets a boolean value, returning the default value if the key does not exist.

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

Signature: `func (iv *IterableValue) Exists(key string) bool`

Checks whether the specified key exists.

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("Email: %s\n", email)
}
```

#### ForeachNested

Signature: `func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

Recursively iterates through the nested structure at the specified path.

#### IsNullData

Signature: `func (iv *IterableValue) IsNullData() bool`

Checks whether the entire value is null.

```go
if item.IsNullData() {
    fmt.Println("Value is null")
}
```

#### IsNull

Signature: `func (iv *IterableValue) IsNull(key string) bool`

Checks whether the value of the specified key is null.

```go
if item.IsNull("optional_field") {
    fmt.Println("Optional field is null")
}
```

#### IsEmptyData

Signature: `func (iv *IterableValue) IsEmptyData() bool`

Checks whether the entire value is empty (nil, empty string, empty array, or empty object).

```go
if item.IsEmptyData() {
    fmt.Println("Value is empty")
}
```

#### IsEmpty

Signature: `func (iv *IterableValue) IsEmpty(key string) bool`

Checks whether the value of the specified key is empty.

```go
if item.IsEmpty("tags") {
    fmt.Println("Tag list is empty")
}
```

#### Break

Signature: `func (iv *IterableValue) Break() error`

Returns a signal to stop iteration. Calling this within an iteration callback terminates the traversal early.

```go
// Note: Break() only takes effect in iteration functions whose callback returns an error
// (such as ForeachWithError, ForeachNestedWithError, etc.). Regular Foreach callbacks do
// not return an error, so calling item.Break() inside them does not stop iteration.
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // Stop iteration after finding the target
        return item.Break()
    }
    // Continue processing
    return nil
})
```

#### Release

Signature: `func (iv *IterableValue) Release()`

Returns the IterableValue to the object pool, releasing internal data references.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // Process data...
    fmt.Println(item.GetData())
    // Release after processing to reduce GC pressure
    item.Release()
})
```

---

## StreamIterator Type

StreamIterator provides memory-efficient stream iteration, suitable for large JSON arrays. Elements are processed one by one without loading the entire array into memory.

### NewStreamIterator

Signature: `func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

Creates a stream iterator. Set buffer size via `Config.BufferSize`.

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// Without config
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("Index %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// With config
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // 64KB buffer
it2 := json.NewStreamIterator(file, cfg)
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `Next` | `func (si *StreamIterator) Next() bool` | Advance to the next element |
| `Value` | `func (si *StreamIterator) Value() any` | Return the current element |
| `Index` | `func (si *StreamIterator) Index() int` | Return the current index |
| `Err` | `func (si *StreamIterator) Err() error` | Return any iteration error |

---

## StreamObjectIterator Type

StreamObjectIterator provides memory-efficient stream iteration, suitable for large JSON objects.

### NewStreamObjectIterator

Signature: `func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

Creates a stream object iterator.

```go
file, _ := os.Open("large-object.json")
defer file.Close()

it := json.NewStreamObjectIterator(file)
for it.Next() {
    fmt.Printf("Key: %s, Value: %v\n", it.Key(), it.Value())
}
if err := it.Err(); err != nil {
    panic(err)
}
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | Advance to the next key-value pair |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | Return the current key |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | Return the current value |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | Return any iteration error |

---

## BatchIterator Type

BatchIterator is used for efficient batch processing of large arrays, reducing per-element processing overhead.

### NewBatchIterator

Signature: `func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

Creates a batch iterator. Set batch size via `Config.MaxBatchSize`.

```go
data := make([]any, 10000)
// Fill data...

cfg := json.DefaultConfig()
cfg.MaxBatchSize = 100 // 100 elements per batch
it := json.NewBatchIterator(data, cfg)
for it.HasNext() {
    batch := it.NextBatch()
    // Batch processing
    processBatch(batch)
    fmt.Printf("Processed %d elements, %d remaining\n", len(batch), it.Remaining())
}
```

### Methods

| Method | Signature | Description |
|------|------|------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | Return the next batch of elements |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | Check if there are more batches |
| `Reset` | `func (it *BatchIterator) Reset()` | Reset iterator to starting position |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | Return total number of batches |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | Return current position |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | Return remaining element count |

---

## ParallelIterator Type

ParallelIterator is used for parallel processing of arrays, leveraging multi-core CPUs to accelerate processing.

### NewParallelIterator

Signature: `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

Creates a parallel iterator. Set the number of worker goroutines via `Config.MaxConcurrency`.

```go
data := make([]any, 10000)
// Fill data...

cfg := json.DefaultConfig()
cfg.MaxConcurrency = 8 // 8 worker goroutines
it := json.NewParallelIterator(data, cfg)
err := it.ForEach(func(idx int, val any) error {
    // Process each element in parallel
    return processItem(idx, val)
})
if err != nil {
    panic(err)
}
```

### ForEach

Signature: `func (it *ParallelIterator) ForEach(fn func(int, any) error) error`

Processes each element in parallel, returning the first error encountered.

```go
err := it.ForEach(func(idx int, val any) error {
    // This function executes in parallel across multiple goroutines
    return nil
})
```

### ForEachWithContext

Signature: `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

Parallel processing with context, supporting cancellation.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := it.ForEachWithContext(ctx, func(idx int, val any) error {
    select {
    case <-ctx.Done():
        return ctx.Err()
    default:
        return processItem(idx, val)
    }
})
```

### ForEachBatch

Signature: `func (it *ParallelIterator) ForEachBatch(batchSize int, fn func(int, []any) error) error`

Parallel batch processing.

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // Each batch is processed in a single goroutine
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

Signature: `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

Parallel batch processing with context.

### Map

Signature: `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

Transforms each element in parallel, returning a new slice.

```go
results, err := it.Map(func(idx int, val any) (any, error) {
    if num, ok := val.(float64); ok {
        return num * 2, nil
    }
    return nil, fmt.Errorf("unexpected type at index %d", idx)
})
```

### Filter

Signature: `func (it *ParallelIterator) Filter(predicate func(int, any) bool) []any`

Filters elements in parallel, returning a slice of elements that satisfy the condition.

```go
even := it.Filter(func(idx int, val any) bool {
    if num, ok := val.(float64); ok {
        return int(num)%2 == 0
    }
    return false
})
```

### Close

Signature: `func (it *ParallelIterator) Close()`

Releases ParallelIterator resources.

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## Complete Examples

### Stream Processing Large Files

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Open("large-array.json")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    it := json.NewStreamIterator(file)
    count := 0

    for it.Next() {
        val := it.Value()
        // Process element by element, memory-friendly
        count++
        if count%1000 == 0 {
            fmt.Printf("Processed %d elements, current value: %v\n", count, val)
        }
    }

    if err := it.Err(); err != nil {
        panic(err)
    }

    fmt.Printf("Total processed %d elements\n", count)
}
```

### Parallel Processing

```go
package main

import (
    "fmt"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    // Parse JSON array
    data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
    var arr []any
    json.Unmarshal([]byte(data), &arr)

    // Create parallel iterator (4 worker goroutines)
    cfg := json.DefaultConfig()
    cfg.MaxConcurrency = 4
    it := json.NewParallelIterator(arr, cfg)

    var sum int64

    err := it.ForEach(func(idx int, val any) error {
        if num, ok := val.(float64); ok {
            atomic.AddInt64(&sum, int64(num))
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Sum: %d\n", sum) // Output: Sum: 55
}
```

### Batch Processing

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Create a large dataset
    data := make([]any, 1000)
    for i := range data {
        data[i] = map[string]any{"id": i, "value": i * 10}
    }

    // 100 elements per batch
    cfg := json.DefaultConfig()
    cfg.MaxBatchSize = 100
    it := json.NewBatchIterator(data, cfg)
    batchNum := 0

    for it.HasNext() {
        batch := it.NextBatch()
        batchNum++

        // Batch processing (e.g., bulk database write)
        fmt.Printf("Batch %d: processing %d elements\n", batchNum, len(batch))
    }

    fmt.Printf("Total batches: %d\n", it.TotalBatches())
}
```

### Iterator Reuse

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // First traversal
    it := json.NewIterator([]any{"a", "b", "c"})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }

    // Reuse the same iterator for new data, avoiding reallocation
    it.ResetWith([]any{1, 2, 3, 4})
    for it.HasNext() {
        val, _ := it.Next()
        fmt.Println(val)
    }
}
```

---

## Performance Tips

1. **Reuse Iterator** - Use `Reset`/`ResetWith` to avoid repeated allocation, suitable for multi-pass traversal scenarios
2. **Use stream iterators for large datasets** - `StreamIterator`/`StreamObjectIterator` process elements one by one, memory-friendly
3. **Reduce overhead with batch processing** - `BatchIterator` processes in batches, lowering per-element overhead
4. **Parallel processing for CPU-intensive tasks** - `ParallelIterator` leverages multi-core acceleration
5. **Release IterableValue** - Call `Release()` after processing in `Foreach` callbacks to reduce GC pressure

---

## Related

- [Package-Level Iteration Functions](./functions/iterate) - Foreach/ForeachFile and other iteration functions
- [Processor Iteration Methods](./processor/iterate) - The corresponding Processor iteration methods
- [Large File Processing](../streaming/large-files) - Large file guide and API reference
- [NDJSON Processor](../streaming/jsonl) - JSONL processing
