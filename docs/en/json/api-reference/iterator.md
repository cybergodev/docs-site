---
sidebar_label: "Iterators & Streaming Iterators"
title: "Iterators & IterableValue - CyberGo JSON | Stream & Parallel"
description: "CyberGo JSON iterators: Iterator, StreamIterator, BatchIterator, ParallelIterator and IterableValue with Map/Filter for arrays, objects and large files."
sidebar_position: 100
---

# Iterator Types

The json package provides a variety of iterator types covering sequential traversal, streaming, batch processing, and parallel processing. For iteration **functions** (`Foreach`/`ForeachFile`, etc.) see [Package Iteration Functions](./functions/iterate) and [Processor Iteration Methods](./processor/iterate).

## IteratorControl Constants

`IteratorControl` represents iteration control flags, used by `ForeachWithPathAndControl` and `ForeachWithPathAndIterator` to steer iteration.

| Constant | Description |
|----------|-------------|
| `IteratorNormal` | Continue iterating normally (the default; the zero value) |
| `IteratorContinue` | Continue iterating. Equivalent to `IteratorNormal` (an alias kept for API symmetry) — "skip the current item" is implicit; iteration always continues |
| `IteratorBreak` | Stop iterating |

**When to use what**

| Scenario | Recommended return | Notes |
|----------|--------------------|-------|
| Processing elements normally | `IteratorNormal` | Continue with the next element |
| Filtering invalid data | `IteratorContinue` | Skip the current element without interrupting iteration |
| Exit after finding the target | `IteratorBreak` | Stop immediately once the needed data is found |
| Abort on error | `IteratorBreak` | Stop iterating on a serious error |

---

## The Iterator Type

`Iterator` is the low-level iterator for traversing JSON arrays or objects, created by `NewIterator`.

### NewIterator

Signature: `func NewIterator(data any, cfg ...Config) *Iterator`

Creates an iterator instance. The optional `cfg` parameter is kept for API consistency and does not currently affect iterator behavior.

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

:::tip Iteration order is deterministic
When traversing an object, keys are yielded in **sorted** order (native Go map iteration is random; determinism is enforced here); arrays are traversed in index order. For arrays, `Next()` returns the element itself; for objects it returns the **value** of the current key (not the key).
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | Checks whether more elements remain |
| `Next` | `func (it *Iterator) Next() (any, bool)` | Gets the next element |
| `Reset` | `func (it *Iterator) Reset()` | Clears iterator state and cache for reuse |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | Clears state and re-initializes with new data |

### Reset

Clears iterator state and releases cached keys. Afterwards, re-initialize with `ResetWith`.

```go
it := json.NewIterator(data1)
for it.HasNext() {
    it.Next()
}

it.Reset() // Clear the cache
```

::: warning Not concurrency-safe
`Reset`/`ResetWith` must not run concurrently with `HasNext()`/`Next()` in progress on another goroutine; for concurrent traversal, create an independent iterator per goroutine.
:::

### ResetWith

Clears iterator state and re-initializes with new data, enabling iterator reuse. Same concurrency constraints as `Reset`.

```go
it := json.NewIterator(data1)
// ... traverse data1 ...

it.ResetWith(data2) // Reuse the iterator for new data
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

---

## IterableValue Type

IterableValue wraps the current element during iteration and provides convenient value-access methods. Callbacks of the `Foreach` family receive a `*IterableValue`.

### Methods

| Category | Methods |
|----------|---------|
| Basic getters | `GetData` / `Get` / `GetString` / `GetInt` / `GetFloat64` / `GetBool` / `GetArray` / `GetObject` |
| Getters with defaults | `GetWithDefault` / `GetStringWithDefault` / `GetIntWithDefault` / `GetFloat64WithDefault` / `GetBoolWithDefault` |
| State checks | `Exists` / `IsNull` / `IsNullData` / `IsEmpty` / `IsEmptyData` |
| Flow control | `Break` / `ForeachNested` / `Release` |

#### GetData

Signature: `func (iv *IterableValue) GetData() any`

Returns the underlying data.

#### Get

Signature: `func (iv *IterableValue) Get(path string) any`

Gets a value by path (dot notation and array indices supported).

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

Gets a float value.

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

Gets a value, returning the default when the key does not exist.

```go
// Get an optional field, falling back to a default when absent
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

Signature: `func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

Gets a string value, returning the default when the key does not exist.

```go
name := item.GetStringWithDefault("name", "unknown")
```

#### GetIntWithDefault

Signature: `func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

Gets an integer value, returning the default when the key does not exist.

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

Signature: `func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

Gets a float value, returning the default when the key does not exist.

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

Signature: `func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

Gets a boolean value, returning the default when the key does not exist.

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

Signature: `func (iv *IterableValue) Exists(key string) bool`

Checks whether the given key exists.

```go
if item.Exists("email") {
    email := item.GetString("email")
    fmt.Printf("Email: %s\n", email)
}
```

#### ForeachNested

Signature: `func (iv *IterableValue) ForeachNested(path string, fn func(key any, item *IterableValue))`

Recursively traverses the nested structure at the given path.

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

Checks whether the value of the given key is null.

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

Checks whether the value of the given key is empty.

```go
if item.IsEmpty("tags") {
    fmt.Println("Tags list is empty")
}
```

#### Break

Signature: `func (iv *IterableValue) Break() error`

Returns the stop-iteration signal. Calling it inside an iteration callback terminates the traversal early.

```go
// Note: Break() takes effect only in iteration functions whose callbacks
// return an error (e.g. ForeachWithError, ForeachNestedWithError). Plain
// Foreach callbacks return no error, so calling item.Break() there does
// not stop iteration.
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "stop" {
        // Stop iterating once the target is found
        return item.Break()
    }
    // Keep processing
    return nil
})
```

#### Release

Signature: `func (iv *IterableValue) Release()`

Returns the IterableValue to the object pool, releasing internal data references.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    // Process the data...
    fmt.Println(item.GetData())
    // Release after processing to reduce GC pressure
    item.Release()
})
```

:::tip Release is optional
Iteration functions **automatically** return every `IterableValue` to the object pool after the callback returns; an explicit `Release()` inside the callback is redundant but harmless (double-return protection is built in). Note that the internal data is cleared once the callback returns, so do **not** stash the `*IterableValue` for use beyond the callback — copy the data from `GetData()` if you need to keep it.
:::

### Complete IterableValue Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{"users": [
        {"name": "Alice", "age": 30, "email": null},
        {"name": "Bob", "tags": []}
    ]}`

	err := json.ForeachWithError(data, "users", func(key any, item *json.IterableValue) error {
		idx, _ := key.(int)

		// Get with defaults
		name := item.GetStringWithDefault("name", "unknown")
		age := item.GetIntWithDefault("age", 0)

		// Existence / null / emptiness checks
		hasEmail := item.Exists("email")
		emailNull := item.IsNull("email")
		tagsEmpty := item.IsEmpty("tags")

		fmt.Printf("[%d] name=%s age=%d emailExists=%v emailIsNull=%v tagsIsEmpty=%v\n",
			idx, name, age, hasEmail, emailNull, tagsEmpty)

		// Terminate early after finding Alice
		if name == "Alice" {
			return item.Break()
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
	// Output:
	// [0] name=Alice age=30 emailExists=true emailIsNull=true tagsIsEmpty=true
}
```

---

## The StreamIterator Type

StreamIterator provides memory-efficient streaming iteration for large JSON arrays. Elements are processed one by one, without loading the entire array into memory.

### NewStreamIterator

Signature: `func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

Creates a streaming iterator. The buffer comes from `Config.BufferSize` (64KB from `DefaultConfig` when cfg is absent; falls back to 32KB when cfg is passed with `BufferSize <= 0`); `MaxJSONSize` always applies to the **total byte count of the whole stream** (capped at `DefaultMaxJSONSize` = 100MB when cfg is absent) and errors when exceeded.

```go
file, _ := os.Open("large-array.json")
defer file.Close()

// Without configuration
it := json.NewStreamIterator(file)
for it.Next() {
    val := it.Value()
    fmt.Printf("Index %d: %v\n", it.Index(), val)
}
if err := it.Err(); err != nil {
    panic(err)
}

// With configuration
cfg := json.DefaultConfig()
cfg.BufferSize = 64 * 1024 // 64KB buffer
it2 := json.NewStreamIterator(file, cfg)
```

:::tip Top-level input shape
`StreamIterator` targets JSON **arrays**. If the top level is a single scalar (e.g. `"hello"`, `42`), it is yielded once as the only element; if the top level is an object or starts with another delimiter, `Next()` returns false and `Err()` reports an "expects a JSON array" error.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Next` | `func (si *StreamIterator) Next() bool` | Advances to the next element |
| `Value` | `func (si *StreamIterator) Value() any` | Returns the current element |
| `Index` | `func (si *StreamIterator) Index() int` | Returns the current index (starting at 0) |
| `Err` | `func (si *StreamIterator) Err() error` | Returns any iteration error |

---

## The StreamObjectIterator Type

StreamObjectIterator provides memory-efficient streaming iteration for large JSON objects.

### NewStreamObjectIterator

Signature: `func NewStreamObjectIterator(reader io.Reader, cfg ...Config) *StreamObjectIterator`

Creates a streaming object iterator. `Config.BufferSize` and `MaxJSONSize` (total stream byte cap) have the same semantics as in `NewStreamIterator`.

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

:::tip Accepts only top-level objects
If the first token is not `{`, `Next()` returns false and `Err()` reports an "expects a JSON object" error; non-string keys likewise end with an error (no longer silently). Key-value pairs are yielded in **stream order** (no sorting).
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Next` | `func (soi *StreamObjectIterator) Next() bool` | Advances to the next key-value pair |
| `Key` | `func (soi *StreamObjectIterator) Key() string` | Returns the current key |
| `Value` | `func (soi *StreamObjectIterator) Value() any` | Returns the current value |
| `Err` | `func (soi *StreamObjectIterator) Err() error` | Returns any iteration error |

---

## The BatchIterator Type

BatchIterator enables efficient batch processing of large arrays, cutting per-element overhead; created by `NewBatchIterator`.

### NewBatchIterator

Signature: `func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

Creates a batch iterator. `Config.MaxBatchSize` sets the batch size (2000 from `DefaultConfig` when cfg is absent; falls back to 100 elements per batch when cfg is passed with `MaxBatchSize <= 0`).

:::tip How batches are sliced
`NextBatch` returns a **view** of the underlying array slice (`data[current:end]`) — no copy; the last batch may be shorter than batchSize, and modifying view elements affects the original array.
:::

```go
data := make([]any, 10000)
// Fill in data...

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
|--------|-----------|-------------|
| `NextBatch` | `func (it *BatchIterator) NextBatch() []any` | Returns the next batch; nil when no batches remain |
| `HasNext` | `func (it *BatchIterator) HasNext() bool` | Checks whether more batches remain |
| `Reset` | `func (it *BatchIterator) Reset()` | Resets the iterator to the start |
| `TotalBatches` | `func (it *BatchIterator) TotalBatches() int` | Returns the total batch count (`ceil(len/batchSize)` rounded up; 0 for a non-positive batchSize) |
| `CurrentIndex` | `func (it *BatchIterator) CurrentIndex() int` | Returns the array position consumed so far |
| `Remaining` | `func (it *BatchIterator) Remaining() int` | Returns the remaining element count (0 once consumed) |

---

## The ParallelIterator Type

ParallelIterator processes arrays in parallel, exploiting multi-core CPUs for speed.

### NewParallelIterator

Signature: `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

Creates a parallel iterator. `Config.MaxConcurrency` sets the worker goroutine count (50 from `DefaultConfig` when cfg is absent; falls back to 4 when cfg is passed with `MaxConcurrency <= 0`; the actual count never exceeds `len(data)`, and is 1 for empty data).

```go
data := make([]any, 10000)
// Fill in data...

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

Processes every element in parallel and returns the first error encountered.

```go
err := it.ForEach(func(idx int, val any) error {
    // This function runs in parallel across multiple goroutines
    return nil
})
```

:::tip Error and termination semantics
After any callback returns an error, the remaining workers stop dispatching as soon as possible and the **first** error is returned; calls after `Close` return nil directly (callbacks not executed); callback panics are caught and converted into returned errors — the process is never taken down.
:::

### ForEachWithContext

Signature: `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

Context-aware parallel processing with cancellation support. Returns `ctx.Err()` when the context is cancelled.

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

Parallel batch processing. Each batch is handled by a single goroutine; `batchSize <= 0` is treated as 100; the callback receives the **batch ordinal** (which batch) and that batch's elements.

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // Each batch is processed in one goroutine
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

Signature: `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

Context-aware parallel batch processing. Returns `ctx.Err()` on cancellation; nil after Close.

### Map

Signature: `func (it *ParallelIterator) Map(transform func(int, any) (any, error)) ([]any, error)`

Transforms every element in parallel and returns a new slice. Each worker goroutine writes to the position matching the element index, so **result order matches input order**; any transform error returns `(nil, err)`.

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

Filters elements in parallel and returns the slice of matches. **Input order is preserved** (not completion order); the predicate returns no error, and callback panics are logged rather than aborting.

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

Releases the ParallelIterator's resources: notifies running goroutines to stop and waits for them to exit. CAS-based — **safe to call repeatedly and from multiple goroutines**.

```go
it := json.NewParallelIterator(data, cfg)
defer it.Close()
```

---

## Complete Examples

### Streaming a Large File

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"os"
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

	fmt.Printf("Processed %d elements in total\n", count)
}
```

### Parallel Processing

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"sync/atomic"
)

func main() {
	// Parse a JSON array
	data := `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
	var arr []any
	json.Unmarshal([]byte(data), &arr)

	// Create a parallel iterator (4 worker goroutines)
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

		// Batch processing (e.g. bulk database writes)
		fmt.Printf("Batch %d: processed %d elements\n", batchNum, len(batch))
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

	// Reuse the same iterator for new data, avoiding re-allocation
	it.ResetWith([]any{1, 2, 3, 4})
	for it.HasNext() {
		val, _ := it.Next()
		fmt.Println(val)
	}
}
```

---

## Performance Recommendations

1. **Reuse iterators** - Use `Reset`/`ResetWith` to avoid repeated allocation in multi-pass scenarios
2. **Use streaming iterators for large datasets** - `StreamIterator`/`StreamObjectIterator` process element by element, memory-friendly
3. **Reduce overhead with batching** - `BatchIterator` processes per batch, lowering per-element overhead
4. **Parallelize CPU-bound tasks** - `ParallelIterator` exploits multiple cores
5. **Release IterableValue** - Call `Release()` after processing in `Foreach` callbacks to reduce GC pressure

---

## See Also

- [Package Iteration Functions](./functions/iterate) - Foreach/ForeachFile and other iteration functions
- [Processor Iteration Methods](./processor/iterate) - The corresponding processor iteration methods
- [Large File Handling](../streaming/large-files) - Large-file guide and API reference
- [JSONL Streaming](../streaming/jsonl) - JSONL/NDJSON streaming
