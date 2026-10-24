---
sidebar_label: "Iteration Methods"
title: "Package Iteration Functions - CyberGo JSON | Foreach Usage"
description: "Package iteration: ForeachWithError returns errors, ForeachNestedWithError recurses, ForeachFile reads a file, and object keys iterate in lexicographic order."
sidebar_position: 100
---

# Package Iteration Functions

Iteration functions callable directly, without creating a Processor instance. They map one-to-one with the [Processor iteration methods](../processor/iterate) (two-layer design).

:::tip Iteration order is deterministic
Object iteration follows **lexicographic** key order and arrays follow natural order. Go map iteration is random by default, but the library sorts internally, so callback order is reproducible for the same input and outputs are testable.
:::

## Foreach

<Badge type="danger" text="Deprecated" />

Signature: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Iterates a JSON array or object.

::: warning Deprecated
`Foreach` **silently drops errors**: when the document is invalid, or the processor is unavailable or closed, the callback is **skipped entirely** with no error returned, so the caller cannot find out. Use [`ForeachWithError`](#foreachwitherror) instead: it returns the error, and its callback returns `nil` to continue. `Foreach` will not be removed within v1.
:::

```go
// Deprecated: errors are silently dropped; new code should use ForeachWithError (below)
json.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**Iterating an array**: key is the index (int)
**Iterating an object**: key is the key name (string)

## ForeachWithPath

Signature: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

Iterates at a path; the callback returns nothing and errors come back from the function.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Good for:
- Iterating nested arrays
- Iterating the object at a given path

## ForeachNested

<Badge type="danger" text="Deprecated" />

Signature: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Recursively iterates all nested levels. The recursion depth cap is 200; subtrees beyond it are not descended into (the void variant stops silently, the error variant returns an error).

::: warning Deprecated
`ForeachNested` **silently drops errors** just like `Foreach`: on a failed parse or a closed processor the callback is skipped entirely with no error returned. Use [`ForeachNestedWithError`](#foreachnestedwitherror) instead: it returns the error, and its callback returns `nil` to continue. `ForeachNested` will not be removed within v1.
:::

```go
// Deprecated: errors are silently dropped; new code should use ForeachNestedWithError (below)
json.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

Sample data:

```json
{
  "user": {
    "name": "test",
    "profile": {
      "age": 25,
      "tags": ["a", "b"]
    }
  }
}
```

Output:

```text
Key: user, Value: map[string]any{...}
Key: name, Value: test
Key: profile, Value: map[string]any{...}
Key: age, Value: 25
Key: tags, Value: []any{...}
...
```

## ForeachReturn

Signature: `func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

Iterates JSON data, visiting each element through the callback, and returns the re-serialized JSON string. The callback can modify maps and slices via `GetData()`, and those modifications appear in the return value. Two limits: you can only mutate **inside containers** (add or remove keys on a map, change elements of a slice) — scalar elements cannot be replaced in place through `IterableValue`; and iteration runs on a **deep copy** of the parse result, so the processor cache is never polluted.

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Access/modify the element via item.GetData()
})
```

Good for keeping chained operations after iteration.

## ForeachWithError

Signature: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Iterates at a given path, with an error-returning callback.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // continue iterating
})
```

## ForeachNestedWithError

Signature: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Recursively iterates all nested levels, with an error-returning callback.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Signature: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

Iterates at a given path and provides the current path. Uses `IteratorControl` to steer iteration.

```go
err := json.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Path: %s, Key: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // stop iterating
    }
    return json.IteratorNormal // continue iterating
})
```

## ForeachWithPathAndControl

Signature: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

Iterates raw values at a given path, using `IteratorControl` to steer the flow.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Key: %v, Value: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

The `IterableValue` in iteration callbacks provides convenient value access; for the full method definitions see [Iterator Types](../iterator#iterablevalue-type).

| Method | Description |
|--------|-------------|
| `GetData() any` | Get the current value |
| `Get(path string) any` | Get a value by path |
| `GetString(key string) string` | Get a string value |
| `GetInt(key string) int` | Get an integer value |
| `GetFloat64(key string) float64` | Get a float value |
| `GetBool(key string) bool` | Get a boolean value |
| `GetArray(key string) []any` | Get an array value |
| `GetObject(key string) map[string]any` | Get an object value |
| `Exists(key string) bool` | Check whether a field exists |
| `IsNull(key string) bool` / `IsNullData() bool` | Check whether it is null |
| `IsEmpty(key string) bool` / `IsEmptyData() bool` | Check whether it is empty |
| `Break() error` | Return the break-iteration error signal |
| `Release()` | Release resources back to the object pool |

## Method Comparison

| Method | Path parameter | Recursive | Returns | Error callback |
|---------|:--------------:|:---------:|---------|:--------------:|
| `Foreach` | No | No | None | No |
| `ForeachWithPath` | Yes | No | error | No |
| `ForeachNested` | No | Yes | None | No |
| `ForeachReturn` | No | No | (string, error) | No |
| `ForeachWithError` | Yes | No | error | Yes |
| `ForeachNestedWithError` | No | Yes | error | Yes |
| `ForeachWithPathAndIterator` | Yes | No | error | IteratorControl |
| `ForeachWithPathAndControl` | Yes | No | error | IteratorControl |

::: warning Void variants do not report errors
`Foreach` / `ForeachNested` return nothing: setup errors such as an unavailable processor are silently ignored, and a callback panic is caught, logged, and stops iteration (the process survives). The error-returning variants (the `*WithError` series) turn a callback panic into a returned error. Whenever you need error information, use a variant that returns `error`.
:::

---

## File Iteration Functions

The package level provides functions that iterate directly from a file, mirroring the [Processor file iteration methods](../processor/iterate#file-iteration-methods). Note that they all load the **entire file into memory** first and then run per-item or batched callbacks (bounded by `MaxJSONSize`, 100MB by default); for constant-memory processing of large files use the [streaming iterators such as StreamIterator](../../streaming/large-files#streaming-and-parallel-iterators).

### ForeachFile

Signature: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates it.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the JSON file |
| `fn` | `func(key any, item *IterableValue) error` | Iteration callback |

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // continue iterating
})
```

---

### ForeachFileWithPath

Signature: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates at a given path.

```go
// Iterate only the users array
err := json.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("User: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

Signature: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Iterates a JSON array from a file in chunks — suited to batch-processing large datasets. `chunkSize <= 0` is treated as 100; a root that is not an array returns an error wrapping `ErrTypeMismatch`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the JSON file |
| `chunkSize` | `int` | Items per batch (defaults to 100 when ≤0) |
| `fn` | `func(chunk []*IterableValue) error` | Batch callback |

```go
// Process 100 records per batch
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // Batch insert into the database
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:   item.GetInt("id"),
            Name: item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

:::tip Use cases
- Batch database inserts
- Batched API calls
- Chunking does not save memory: the file is fully loaded before batched callbacks; for constant-memory processing use [StreamIterator](../../streaming/large-files)
:::

---

### ForeachFileNested

Signature: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and recursively iterates all nested structures.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // Walk every key-value pair at every level
    fmt.Printf("Path: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

**Sample data**:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}
```

**Output**:

```text
Path: database, Type: map[string]any
Path: host, Type: string
Path: port, Type: float64
Path: pool, Type: map[string]any
Path: min, Type: float64
Path: max, Type: float64
```

---

## File Iteration Method Comparison

| Method | Path parameter | Recursive | Chunked | Good for |
|---------|:--------------:|:---------:|:-------:|----------|
| `ForeachFile` | No | No | No | Simple file traversal |
| `ForeachFileWithPath` | Yes | No | No | Targeted traversal |
| `ForeachFileChunked` | No | No | **Yes** | Bulk loads, batched callbacks (file still fully loaded) |
| `ForeachFileNested` | No | **Yes** | No | Deep traversal of all nodes |

---

## Iteration Control

### IteratorControl Constants

`ForeachWithPathAndControl` and `ForeachWithPathAndIterator` steer iteration by returning `IteratorControl` (constant definitions in [Iterator Types](../iterator#iteratorcontrol-constants)):

| Constant | Description |
|----------|-------------|
| `IteratorNormal` | Continue iterating normally |
| `IteratorContinue` | A no-op alias of `IteratorNormal` (kept for API symmetry): no side effect, iteration continues |
| `IteratorBreak` | Stop iterating |

### Breaking iteration

Returning `item.Break()` from an error callback breaks the iteration:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // Target found, stop iterating
        return item.Break()
    }
    return nil // continue iterating
})
```

### Error handling

Returning any other error breaks the iteration and propagates that error:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("found an error record: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("Iteration interrupted: %v", err)
}
```

---

## See Also

- [Processor Iteration Methods](../processor/iterate) - The corresponding processor methods
- [Iterator Types](../iterator) - Iterator/IterableValue/Stream/Batch/Parallel type definitions
- [Path Queries](./query) - The Get family
- [Batch Operations](./batch) - ProcessBatch batch processing
- [File I/O](./file-io) - LoadFromFile/SaveToFile
- [Large File Handling Guide](../../streaming/large-files) - Streaming practices
