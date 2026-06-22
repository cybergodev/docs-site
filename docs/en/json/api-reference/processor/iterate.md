---
title: "Processor Iteration Methods - CyberGo JSON | API Reference"
description: "CyberGo JSON Processor iteration: Foreach, ForeachWithPath, ForeachNested, IterableValue data access, and IteratorControl flow for batch iteration."
---

# Iteration Methods

Processor provides multiple methods for iterating over JSON arrays and objects.

## Foreach

Signature: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

Iterates over a JSON array or object.

```go
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**When iterating an array**: key is the index (int)
**When iterating an object**: key is the key name (string)

## ForeachWithPath

Signature: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

Iterates by path, returns an error.

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Useful for:
- Iterating nested arrays
- Iterating objects at a specified path

## ForeachNested

Signature: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

Recursively iterates through all nested levels.

```go
p.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

Example data:

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

Signature: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

Iterates the JSON data and returns the re-serialized JSON string. The callback is read-only.

```go
result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Read-only processing
})
```

Useful for scenarios where you need to continue chained operations after iteration.

## ForeachWithError

Signature: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

Iterates by path, callback supports returning errors.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // Continue iteration
})
```

## ForeachNestedWithError

Signature: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

Recursively iterates through all nested levels, callback supports returning errors.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Signature: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

Iterates by path and provides current path information. Use `IteratorControl` to control the iteration flow.

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Path: %s, Key: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // Stop iteration
    }
    return json.IteratorNormal // Continue iteration
})
```

## ForeachWithPathAndControl

Signature: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

Iterates raw values by path, using `IteratorControl` for flow control.

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Key: %v, Value: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

The `IterableValue` in iteration callbacks provides the following capabilities:

| Method | Description |
|------|------|
| `GetData() any` | Get current value |
| `Get(path string) any` | Get value by path |
| `GetString(key string) string` | Get string value |
| `GetInt(key string) int` | Get integer value |
| `GetFloat64(key string) float64` | Get float64 value |
| `GetBool(key string) bool` | Get boolean value |
| `GetArray(key string) []any` | Get array value |
| `GetObject(key string) map[string]any` | Get object value |
| `GetWithDefault(key string, defaultValue any) any` | Get value (with default) |
| `GetStringWithDefault(key string, defaultValue string) string` | Get string (with default) |
| `GetIntWithDefault(key string, defaultValue int) int` | Get integer (with default) |
| `GetFloat64WithDefault(key string, defaultValue float64) float64` | Get float64 (with default) |
| `GetBoolWithDefault(key string, defaultValue bool) bool` | Get boolean (with default) |
| `Exists(key string) bool` | Check if field exists |
| `IsNull(key string) bool` | Check if field is null |
| `IsNullData() bool` | Check if current value is null |
| `IsEmpty(key string) bool` | Check if field is empty |
| `IsEmptyData() bool` | Check if current value is empty |
| `Break() error` | Return break signal to stop iteration |
| `Release()` | Release resources back to object pool |
| `ForeachNested(path string, fn func(key any, item *IterableValue))` | Recursively iterate nested structures |

## Method Comparison

| Method | Path Parameter | Recursive | Return Value | Error Callback |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | No | No | None | No |
| `ForeachWithPath` | Yes | No | error | No |
| `ForeachNested` | No | Yes | None | No |
| `ForeachReturn` | No | No | (string, error) | No |
| `ForeachWithError` | Yes | No | error | Yes |
| `ForeachNestedWithError` | No | Yes | error | Yes |
| `ForeachWithPathAndIterator` | Yes | No | error | IteratorControl |
| `ForeachWithPathAndControl` | Yes | No | error | IteratorControl |

---

## File Iteration Methods

Processor provides methods for iterating directly from files, suitable for processing large JSON files.

### ForeachFile

Signature: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and iterates over it.

**Parameters**

| Name | Type | Description |
|------|------|------|
| `filePath` | `string` | JSON file path |
| `fn` | `func(key any, item *IterableValue) error` | Iteration callback |

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // Continue iteration
})
```

---

### ForeachFileWithPath

Signature: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and iterates by path.

```go
// Only iterate the users array
err := p.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("User: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

Signature: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Iterates a JSON array from a file in chunks, suitable for batch processing large datasets.

**Parameters**

| Name | Type | Description |
|------|------|------|
| `filePath` | `string` | JSON file path |
| `chunkSize` | `int` | Number of items per batch (defaults to 100 when <=0) |
| `fn` | `func(chunk []*IterableValue) error` | Batch processing callback |

```go
// Process 100 records per batch
err := p.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
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
- Batch database insertion
- Batched API calls
- Memory-constrained large file processing
:::

---

### ForeachFileNested

Signature: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Loads JSON from a file and recursively iterates through all nested structures.

```go
err := p.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // Traverse all key-value pairs at all levels
    fmt.Printf("Path: %v, Type: %T\n", key, item.GetData())
    return nil
})
```

**Example Data**:

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

| Method | Path Parameter | Recursive | Chunked | Suitable For |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | No | No | No | Simple file traversal |
| `ForeachFileWithPath` | Yes | No | No | Targeted traversal |
| `ForeachFileChunked` | No | No | **Yes** | Batch processing, memory-constrained |
| `ForeachFileNested` | No | **Yes** | No | Deep traversal of all nodes |

---

## Iteration Control

### Breaking Iteration

Returning `item.Break()` in the callback function breaks the iteration:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // Found target, stop iteration
        return item.Break()
    }
    return nil // Continue iteration
})
```

### Error Handling

Returning other errors breaks the iteration and returns that error:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("found error record: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("Iteration interrupted: %v", err)
}
```

---

## Related

- [Path Queries](./query) - Get family of methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [File Operations](../functions/file-io) - LoadFromFile/SaveToFile
