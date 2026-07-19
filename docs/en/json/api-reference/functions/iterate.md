---
sidebar_label: "Iteration Methods"
title: "Package Iteration Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON package-level iteration functions: Foreach, ForeachWithPath, ForeachNested recursion, ForeachWithError error handling, IterableValue data access, and ForeachFile file iteration."
sidebar_position: 10
---

# Package-Level Iteration Functions

Iteration functions that can be called directly without creating a Processor instance. They correspond one-to-one with the [Processor iteration methods](../processor/iterate) (dual-layer design).

## Foreach

Signature: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Iterates over a JSON array or object.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**When iterating an array**: key is the index (int)
**When iterating an object**: key is the key name (string)

## ForeachWithPath

Signature: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

Iterates by path, returns an error.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Suitable for:
- Iterating nested arrays
- Iterating objects at a specified path

## ForeachNested

Signature: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Recursively iterates through all nested levels.

```go
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

Iterates over JSON data, accessing each element via the callback, and returns the re-serialized JSON string. The callback can modify map/slice via `GetData()`, and modifications are reflected in the returned value.

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Access/modify element via item.GetData()
})
```

Suitable for scenarios that require chained operations after iteration.

## ForeachWithError

Signature: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Iterates by path; the callback can return an error.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // continue iteration
})
```

## ForeachNestedWithError

Signature: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Recursively iterates through all nested levels; the callback can return an error.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Signature: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

Iterates by path and provides current path information. Uses `IteratorControl` to control the iteration flow.

```go
err := json.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Path: %s, Key: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // stop iteration
    }
    return json.IteratorNormal // continue iteration
})
```

## ForeachWithPathAndControl

Signature: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

Iterates over raw values by path, using `IteratorControl` to control the flow.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Key: %v, Value: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

The `IterableValue` in the iteration callback provides convenient value access capabilities. See [Iterator Types](../iterator#iterablevalue-type) for the complete method definitions.

| Method | Description |
|------|------|
| `GetData() any` | Get the current value |
| `Get(path string) any` | Get a value by path |
| `GetString(key string) string` | Get a string value |
| `GetInt(key string) int` | Get an integer value |
| `GetFloat64(key string) float64` | Get a float64 value |
| `GetBool(key string) bool` | Get a boolean value |
| `GetArray(key string) []any` | Get an array value |
| `GetObject(key string) map[string]any` | Get an object value |
| `Exists(key string) bool` | Check whether a field exists |
| `IsNull(key string) bool` / `IsNullData() bool` | Check whether the value is null |
| `IsEmpty(key string) bool` / `IsEmptyData() bool` | Check whether the value is empty |
| `Break() error` | Return an error signal to break iteration |
| `Release()` | Release resources back to the object pool |

## Method Comparison

| Method | Path arg | Recursive | Return value | Error callback |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | No | No | none | No |
| `ForeachWithPath` | Yes | No | error | No |
| `ForeachNested` | No | Yes | none | No |
| `ForeachReturn` | No | No | (string, error) | No |
| `ForeachWithError` | Yes | No | error | Yes |
| `ForeachNestedWithError` | No | Yes | error | Yes |
| `ForeachWithPathAndIterator` | Yes | No | error | IteratorControl |
| `ForeachWithPathAndControl` | Yes | No | error | IteratorControl |

---

## File Iteration Functions

The package provides functions that iterate directly from a file, suitable for processing large JSON files. They correspond to the [Processor file iteration methods](../processor/iterate#file-iteration-methods).

### ForeachFile

Signature: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates.

**Parameters**

| Name | Type | Description |
|------|------|------|
| `filePath` | `string` | JSON file path |
| `fn` | `func(key any, item *IterableValue) error` | Iteration callback |

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // continue iteration
})
```

---

### ForeachFileWithPath

Signature: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and iterates by path.

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

Iterates a JSON array in a file in chunks, suitable for batch processing of large datasets.

**Parameters**

| Name | Type | Description |
|------|------|------|
| `filePath` | `string` | JSON file path |
| `chunkSize` | `int` | Number of items per batch (defaults to 100 when ≤0) |
| `fn` | `func(chunk []*IterableValue) error` | Batch callback |

```go
// Process 100 records per batch
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // Batch insert into database
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

::: tip Use Cases
- Batch database inserts
- Batched API calls
- Memory-constrained large-file processing
:::

---

### ForeachFileNested

Signature: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Loads JSON from a file and recursively iterates through all nested structures.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // Traverse every key-value pair at every level
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

| Method | Path arg | Recursive | Chunked | Suitable for |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | No | No | No | Simple file traversal |
| `ForeachFileWithPath` | Yes | No | No | Targeted traversal |
| `ForeachFileChunked` | No | No | **Yes** | Batch processing, memory-constrained |
| `ForeachFileNested` | No | **Yes** | No | Deep traversal of all nodes |

---

## Iteration Control

### IteratorControl Constants

`ForeachWithPathAndControl` and `ForeachWithPathAndIterator` control the iteration flow by returning `IteratorControl` (constant definitions in [Iterator Types](../iterator#iteratorcontrol-constants)):

| Constant | Description |
|------|------|
| `IteratorNormal` | Continue iteration normally |
| `IteratorContinue` | Skip the current item and continue iteration |
| `IteratorBreak` | Stop iteration |

### Breaking Iteration

Returning `item.Break()` from an error callback breaks iteration:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // Found target, stop iteration
        return item.Break()
    }
    return nil // continue iteration
})
```

### Error Handling

Returning any other error breaks iteration and returns that error:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("found error record: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("iteration broken: %v", err)
}
```

---

## Related

- [Processor Iteration Methods](../processor/iterate) - The corresponding Processor methods
- [Iterator Types](../iterator) - Iterator/IterableValue/Stream/Batch/Parallel type definitions
- [Query & Get](./query) - Get family of methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [File I/O](./file-io) - LoadFromFile/SaveToFile
- [Large File Processing Guide](../../streaming/large-files) - Streaming processing practices
