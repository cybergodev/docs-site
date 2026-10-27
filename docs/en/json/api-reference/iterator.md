---
sidebar_label: "Iterators & Streaming Iterators"
title: "Iterators & IterableValue - CyberGo JSON | Stream & Parallel"
description: "CyberGo JSON iterators: Iterator, StreamIterator/StreamObjectIterator streaming reads, BatchIterator batches and ParallelIterator Map/Filter."
sidebar_position: 100
---

# Iterator Types

The iterator objects on this page cover ordered traversal, streaming reads, batching, and parallel execution. For iteration **functions** (`Foreach*`/`ForeachFile*`, etc.) see [Package Iteration Functions](./functions/iterate) and [Processor Iteration Methods](./processor/iterate).

## IteratorControl Constants

`IteratorControl` represents iteration control flags, used by `ForeachWithPathAndControl` and `ForeachWithPathAndIterator` to steer iteration.

| Constant | Description |
|----------|-------------|
| `IteratorNormal` | Continue iterating normally (the default; the zero value) |
| `IteratorContinue` | Continue iterating. An alias of `IteratorNormal`, kept for API symmetry |
| `IteratorBreak` | Stop iterating |

**When to use what**

| Scenario | Recommended return | Notes |
|----------|--------------------|-------|
| Processing elements normally | `IteratorNormal` | Continue with the next element |
| Stating "continue" explicitly in code | `IteratorContinue` | Same behavior as `IteratorNormal`, just more explicit |
| Exit after finding the target | `IteratorBreak` | Stop immediately once the needed data is found |
| Abort on error | `IteratorBreak` | Stop iterating on a serious error |

None of the three constants means "skip the current element": skipping is done by returning without acting in the callback, and iteration still advances.

---

## The Iterator Type

`Iterator` traverses a JSON array or object in order and is created by `NewIterator`. It accepts only an already-parsed `[]any` or `map[string]any`; for any other type `HasNext()` always returns `false`.

### NewIterator

Signature: `func NewIterator(data any, cfg ...Config) *Iterator`

Creates an iterator. The optional `cfg` parameter is kept for API consistency and is never read by the source, so it changes no behavior.

```go
data := []any{"apple", "banana", "cherry"}
it := json.NewIterator(data)
for it.HasNext() {
    val, _ := it.Next()
    fmt.Println(val)
}
```

:::tip Iteration order is deterministic
When traversing an object, keys are yielded in **lexicographic order** (native Go map iteration is random; the iterator sorts and caches the keys on first access); arrays are traversed in index order. For arrays, `Next()` returns the element itself; for objects it returns the **value** of the current key (not the key).
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `HasNext` | `func (it *Iterator) HasNext() bool` | Checks whether another element remains; always `false` when the data is neither `[]any` nor `map[string]any` |
| `Next` | `func (it *Iterator) Next() (any, bool)` | Returns the next element; `(nil, false)` once exhausted |
| `Reset` | `func (it *Iterator) Reset()` | Drops the data reference, position, and cached keys for reuse |
| `ResetWith` | `func (it *Iterator) ResetWith(data any)` | Clears state and switches to new data |

### Reset

Clears iterator state and releases the cached keys and data reference. Afterwards `HasNext()` returns `false`; re-initialize with `ResetWith`.

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

Clears state and switches to new data for reuse; the cached key list is reset, so object keys of the new data are sorted again. Same concurrency constraints as `Reset`.

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

`IterableValue` wraps the current element during iteration so the callback can read values by key or path. Callbacks of the `Foreach*` family receive a `*IterableValue`; instances come from a pool and the iteration loop recycles them after the callback returns.

### Methods

| Category | Methods |
|----------|---------|
| Basic getters | `GetData` / `Get` / `GetString` / `GetInt` / `GetFloat64` / `GetBool` / `GetArray` / `GetObject` |
| Getters with defaults | `GetWithDefault` / `GetStringWithDefault` / `GetIntWithDefault` / `GetFloat64WithDefault` / `GetBoolWithDefault` |
| State checks | `Exists` / `IsNull` / `IsNullData` / `IsEmpty` / `IsEmptyData` |
| Flow control | `Break` / `ForeachNested` / `Release` |

#### GetData

Signature: `func (iv *IterableValue) GetData() any`

Returns the underlying data; `nil` after `Release()` or once the iteration loop has recycled the value.

#### Get

Signature: `func (iv *IterableValue) Get(path string) any`

Gets a value by path, supporting dot notation and array indices. An empty path or `"."` returns the current element; a path that fails to parse or does not exist returns `nil`.

```go
val := iv.Get("user.address.city")
val = iv.Get("users[0].name")
```

#### GetString

Signature: `func (iv *IterableValue) GetString(key string) string`

Gets a string value. A missing key or a `null` value returns an empty string; non-string values are formatted into a string (the number `30` yields `"30"`), which differs from the strict `AccessResult.AsString`.

```go
name := item.GetString("name")
```

#### GetInt

Signature: `func (iv *IterableValue) GetInt(key string) int`

Gets an integer value. A missing key, `null`, or an unconvertible value returns 0. Conversion accepts integers, floats with integral values, and parseable decimal strings, and maps `bool` as `true→1`, `false→0` (more permissive than `AccessResult.AsInt`).

```go
age := item.GetInt("age")
```

#### GetFloat64

Signature: `func (iv *IterableValue) GetFloat64(key string) float64`

Gets a float value; a missing key, `null`, or an unconvertible value returns 0.

```go
price := item.GetFloat64("price")
```

#### GetBool

Signature: `func (iv *IterableValue) GetBool(key string) bool`

Gets a boolean value. A missing key or `null` returns `false`. Conversion accepts `bool`; numbers map 0→`false` and non-zero→`true`; strings go through `strconv.ParseBool` first, with `yes`/`on` → `true` and `no`/`off`/empty → `false` added.

```go
enabled := item.GetBool("enabled")
```

#### GetArray

Signature: `func (iv *IterableValue) GetArray(key string) []any`

Gets an array value. A value that is not `[]any` (missing or `null` included) returns `nil`; no type conversion is attempted.

```go
items := item.GetArray("items")
```

#### GetObject

Signature: `func (iv *IterableValue) GetObject(key string) map[string]any`

Gets an object value. A value that is not `map[string]any` (missing or `null` included) returns `nil`; no type conversion is attempted.

```go
profile := item.GetObject("profile")
```

#### GetWithDefault

Signature: `func (iv *IterableValue) GetWithDefault(key string, defaultValue any) any`

Gets a value; a missing key or path, or a `null` value, returns `defaultValue`.

```go
// Get an optional field, falling back to a default when absent
timeout := item.GetWithDefault("timeout", 30)
mode := item.GetWithDefault("mode", "default")
```

#### GetStringWithDefault

Signature: `func (iv *IterableValue) GetStringWithDefault(key string, defaultValue string) string`

Gets a string value; a missing key, `null`, or a non-string value returns `defaultValue` (no type conversion here).

```go
name := item.GetStringWithDefault("name", "unknown")
```

#### GetIntWithDefault

Signature: `func (iv *IterableValue) GetIntWithDefault(key string, defaultValue int) int`

Gets an integer value; a missing key, `null`, or an unconvertible value returns `defaultValue`.

```go
age := item.GetIntWithDefault("age", 0)
port := item.GetIntWithDefault("port", 8080)
```

#### GetFloat64WithDefault

Signature: `func (iv *IterableValue) GetFloat64WithDefault(key string, defaultValue float64) float64`

Gets a float value; a missing key, `null`, or an unconvertible value returns `defaultValue`.

```go
price := item.GetFloat64WithDefault("price", 0.0)
rate := item.GetFloat64WithDefault("rate", 1.0)
```

#### GetBoolWithDefault

Signature: `func (iv *IterableValue) GetBoolWithDefault(key string, defaultValue bool) bool`

Gets a boolean value; a missing key, `null`, or an unconvertible value returns `defaultValue`.

```go
enabled := item.GetBoolWithDefault("enabled", false)
debug := item.GetBoolWithDefault("debug", true)
```

#### Exists

Signature: `func (iv *IterableValue) Exists(key string) bool`

Checks whether the given key or path exists. For a **simple key** (no `.`, `[`, or `]`) it does a direct map lookup, so an existing key returns `true` even when its value is `null`. For a key containing path syntax the result comes from `Get`, so a path resolving to `null` returns `false`.

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

Checks whether the value of the given key is `null`. A missing key **also returns `true`**: the method treats "absent" and "explicit null" alike, so use `Exists` to tell them apart.

```go
if item.IsNull("optional_field") {
    fmt.Println("Optional field is null")
}
```

#### IsEmptyData

Signature: `func (iv *IterableValue) IsEmptyData() bool`

Checks whether the entire value is empty: `nil`, an empty string, an empty array, or an empty object returns `true`; every other type (numbers, booleans included) returns `false`.

```go
if item.IsEmptyData() {
    fmt.Println("Value is empty")
}
```

#### IsEmpty

Signature: `func (iv *IterableValue) IsEmpty(key string) bool`

Checks whether the value of the given key is empty. A missing key, a `null` value, or a value equal to its type's zero value — empty string, zero-length array/object, numeric 0, `false`, empty `Number` — returns `true`; other types return `false`.

```go
if item.IsEmpty("tags") {
    fmt.Println("Tags list is empty")
}
```

#### Break

Signature: `func (iv *IterableValue) Break() error`

Returns an unexported sentinel error meaning "stop normally". Returning it from a callback that returns `error` ends the traversal early; the `Foreach*WithError` family recognizes the signal and returns `nil` instead of an error.

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

Clears the data reference held by the `IterableValue` immediately (`iv.data = nil`), letting large parsed payloads be collected before iteration ends. It does **not** return the object to the pool — recycling is always done by the iteration loop after the callback returns.

```go
err := json.ForeachWithError(data, ".", func(key any, item *json.IterableValue) error {
    // Process the data...
    fmt.Println(item.GetData())
    // Clear the reference after processing to reduce GC pressure
    item.Release()
    return nil
})
```

:::tip When Release matters
The `Foreach*` family and the chunked JSONL APIs (`StreamJSONLChunked`, `ForeachFileChunked`) recycle every `IterableValue` after its callback returns, so an explicit `Release()` inside the callback is redundant but harmless. The serial JSONL APIs (`StreamJSONL` and friends) do not recycle: the values belong to the caller and are safe to retain — there `Release()` merely clears the data. In both cases do **not** stash the `*IterableValue` beyond a callback that recycles it; copy the data from `GetData()` if you need to keep it.
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

`StreamIterator` decodes a JSON array element by element from an `io.Reader`: a `bufio.Reader` plus `json.Decoder` stream the tokens, so it holds one element at a time instead of loading the whole array.

### NewStreamIterator

Signature: `func NewStreamIterator(reader io.Reader, cfg ...Config) *StreamIterator`

Creates a streaming iterator. The buffer size comes from `Config.BufferSize`: 64KB from `DefaultConfig` when cfg is absent, falling back to 32KB when cfg is passed with `BufferSize <= 0`. `MaxJSONSize` applies to the **total byte count of the whole stream** and caps at `DefaultMaxJSONSize` (100MB) when cfg is absent or the field is non-positive; exceeding it is an error.

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
`StreamIterator` targets JSON **arrays**. If the top level is a single scalar (e.g. `"hello"`, `42`), it is yielded once as the only element; if the top level is an object, or starts with a delimiter other than `[`, `Next()` returns false and `Err()` reports an "expects a JSON array" error. An empty stream is not an error: `Next()` returns false and `Err()` stays `nil`.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Next` | `func (si *StreamIterator) Next() bool` | Advances to the next element; false means the end or an error |
| `Value` | `func (si *StreamIterator) Value() any` | Returns the current element |
| `Index` | `func (si *StreamIterator) Index() int` | Returns the current index, starting at 0; -1 before the first element |
| `Err` | `func (si *StreamIterator) Err() error` | Returns any iteration error |

---

## The StreamObjectIterator Type

`StreamObjectIterator` decodes the key-value pairs of a JSON object one at a time from an `io.Reader`: again a `bufio.Reader` plus `json.Decoder`, holding a single pair at any instant.

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
If the first token is not `{`, `Next()` returns false and `Err()` reports an "expects a JSON object" error; a non-string key likewise ends with an error. Key-value pairs are yielded in **stream order**, with no sorting.
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

`BatchIterator` slices a `[]any` into fixed-size batches yielded in order, for workloads that submit work per batch (bulk database writes, batched requests). It only produces slice views; it neither copies nor re-parses the data.

### NewBatchIterator

Signature: `func NewBatchIterator(data []any, cfg ...Config) *BatchIterator`

Creates a batch iterator. The batch size comes from `Config.MaxBatchSize`: 2000 from `DefaultConfig` when cfg is absent, falling back to 100 elements per batch when cfg is passed with `MaxBatchSize <= 0`.

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

`ParallelIterator` runs a fixed pool of worker goroutines over a `[]any`, for CPU-bound per-element work. The callback itself must be thread-safe (guard shared state with `sync/atomic` or a mutex).

### NewParallelIterator

Signature: `func NewParallelIterator(data []any, cfg ...Config) *ParallelIterator`

Creates a parallel iterator. The worker count comes from `Config.MaxConcurrency`: 50 from `DefaultConfig` when cfg is absent, falling back to 4 when cfg is passed with `MaxConcurrency <= 0`. The effective concurrency never exceeds `len(data)` and is 1 for empty data.

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

Processes every element in parallel and returns the first error encountered. Internally it dispatches elements by index with up to `MaxConcurrency` workers.

```go
err := it.ForEach(func(idx int, val any) error {
    // This function runs in parallel across multiple goroutines
    return nil
})
```

:::tip Error and termination semantics
Once any callback returns an error, dispatch stops, the remaining workers exit as soon as possible, and the **first** error is returned. Calls after `Close` return `nil` without running callbacks. Callback panics are caught and converted into returned errors, so the process is never taken down.
:::

### ForEachWithContext

Signature: `func (it *ParallelIterator) ForEachWithContext(ctx context.Context, fn func(int, any) error) error`

Context-aware parallel processing. Returns `ctx.Err()` when the context is cancelled during dispatch; after `Close` it returns `nil` without running callbacks.

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

Parallel batch processing. Each batch is handled by a single goroutine; `batchSize <= 0` is treated as 100; the callback receives the **batch ordinal** (0-based) and that batch's elements.

```go
err := it.ForEachBatch(100, func(batchIdx int, batch []any) error {
    // Each batch is processed in one goroutine
    return processBatch(batchIdx, batch)
})
```

### ForEachBatchWithContext

Signature: `func (it *ParallelIterator) ForEachBatchWithContext(ctx context.Context, batchSize int, fn func(int, []any) error) error`

Context-aware parallel batch processing. Returns `ctx.Err()` on cancellation; after `Close` it returns `nil` without running callbacks.

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

Filters elements in parallel and returns the slice of matches in **input order** (not completion order). The `predicate` returns no error, so the result carries none; a callback panic is caught internally and logged without aborting the call.

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

Releases the ParallelIterator's resources: it sets the closed flag and closes the `done` channel to notify running goroutines to stop. CAS-based — **safe to call repeatedly and from multiple goroutines**. After `Close`, the `ForEach` family returns `nil` directly without running callbacks.

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

1. **Reuse iterators**: `Reset`/`ResetWith` avoid repeated allocation when traversing more than once
2. **Use streaming iterators for large datasets**: `StreamIterator`/`StreamObjectIterator` hold one element at a time, so memory does not grow with array length
3. **Process per batch to cut per-call overhead**: `BatchIterator` only slices views, which suits batched submissions
4. **Parallelize CPU-bound work**: `ParallelIterator` sizes its worker pool from `Config.MaxConcurrency` (default 50, capped by `len(data)`)
5. **Release large payloads early**: call `Release()` in `Foreach*` callbacks for payloads you no longer need, so the reference is dropped before iteration ends

---

## See Also

- [Package Iteration Functions](./functions/iterate): `Foreach`/`ForeachFile` and other iteration functions
- [Processor Iteration Methods](./processor/iterate): the corresponding processor iteration methods
- [Large File Handling](../streaming/large-files): large-file guide and API reference
- [JSONL Streaming](../streaming/jsonl): JSONL/NDJSON streaming
