---
sidebar_label: "Iteration Methods"
title: "Processor Iteration Methods - CyberGo JSON | Foreach Family"
description: "CyberGo JSON Processor iteration: Foreach, ForeachWithPath, ForeachWithError, IterableValue access and IteratorControl flow for array and object traversal."
sidebar_position: 100
---

# Iteration Methods

The Processor provides multiple methods for iterating JSON arrays and objects.

:::tip Mirror of the package-level iteration functions
The 8 `Foreach*` methods on this page share their source with the [package-level iteration functions](../functions/iterate) one by one — callback signatures and iteration semantics are identical; see the package-level page for complete examples. The Processor-side differences:

- **cfg semantics**: the optional trailing `cfg` controls that call's security validation (size, depth, dangerous patterns) etc.; when omitted, the processor's own configuration applies.
- **Cache protection**: the iteration root is first `Get`-ed and then **deep-copied** into a working copy — even if the callback mutates the container returned by `item.GetData()`, neither the processor's parse cache nor the original input is polluted.
- **Lifecycle**: after the processor is closed, all iteration methods return `ErrProcessorClosed`.
:::

## Foreach

<Badge type="danger" text="Deprecated" />

Signature: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Iterates a JSON array or object.

::: warning Deprecated
`Foreach` **silently drops errors**: when the document is invalid or the processor is closed, the callback is **skipped entirely** with no error returned — the caller cannot find out. Use [`ForeachWithError`](#foreachwitherror) instead — it returns the error, and its callback returns `nil` to continue iteration. `Foreach` will not be removed within v1.
:::

```go
// Deprecated: errors are silently dropped; new code should use ForeachWithError (below)
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**Iterating an array**: key is the index (int)
**Iterating an object**: key is the key name (string)

## ForeachWithPath

Signature: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

Iterates at a given path and returns an error.

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Good for:
- Iterating nested arrays
- Iterating the object at a given path

## ForeachNested

<Badge type="danger" text="Deprecated" />

Signature: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Recursively iterates all nested levels.

::: warning Deprecated
`ForeachNested` **silently drops errors** just like `Foreach`: on a failed parse or a closed processor the callback is skipped entirely, with no error returned. Use [`ForeachNestedWithError`](#foreachnestedwitherror) instead — it returns the error, and its callback returns `nil` to continue iteration. `ForeachNested` will not be removed within v1.
:::

```go
// Deprecated: errors are silently dropped; new code should use ForeachNestedWithError (below)
p.ForeachNested(data, func(key any, item *json.IterableValue) {
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

Signature: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

Iterates JSON data and returns the re-serialized JSON string. The callback **may modify** the iterated containers: `item.GetData()` returns a reference to the working copy (deep copy), and additions/deletions/changes to maps / slices are reflected in the final serialized result; scalars cannot be replaced in place. Modifications do not affect the original input or the processor cache.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `[{"id":1,"internal":"x"},{"id":2,"internal":"y"}]`
	result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
		if obj, ok := item.GetData().(map[string]any); ok {
			delete(obj, "internal") // Modify the working copy; written into the result
		}
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: [{"id":1},{"id":2}]
}
```

Good for scenarios where you keep chaining operations after iteration.

## ForeachWithError

Signature: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Iterates at a given path, with an error-returning callback.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // continue iterating
})
```

## ForeachNestedWithError

Signature: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Recursively iterates all nested levels, with an error-returning callback.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Signature: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

Iterates at a given path and provides the current path. Uses `IteratorControl` to steer iteration.

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Path: %s, Key: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // stop iterating
    }
    return json.IteratorNormal // continue iterating
})
```

## ForeachWithPathAndControl

Signature: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

Iterates raw values at a given path, using `IteratorControl` to steer the flow.

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Key: %v, Value: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

The `IterableValue` in iteration callbacks provides type-safe value access: `Get` / `GetString` / `GetInt` / `GetFloat64` / `GetBool` / `GetArray` / `GetObject` plus default-value variants (`GetWithDefault`, `GetStringWithDefault`, `GetIntWithDefault`, etc.), state checks (`Exists` / `IsNull` / `IsNullData` / `IsEmpty` / `IsEmptyData`), nested iteration via `ForeachNested`, and the `Break()` stop signal. For the full method list and per-method notes see the [IterableValue type](../iterator) — identical to this page's callback usage.

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

---

## File Iteration Methods

The Processor provides methods that iterate directly from a file — a convenience combo of `LoadFromFile` + the `Foreach` family: path security validation, the `MaxJSONSize` read limit, and per-call `cfg` forwarding all behave the same as file loading; the file is likewise **fully loaded into memory** before iterating (bounded by the `MaxJSONSize` cap, 100MB by default); for constant-memory scenarios see [Large File Handling](../../streaming/large-files#streaming-and-parallel-iterators).

| Method | Signature essentials | Semantics |
|--------|----------------------|-----------|
| `ForeachFile` | `(filePath, fn, cfg...)` | Iterate the file's top-level array / object |
| `ForeachFileWithPath` | `(filePath, path, fn, cfg...)` | Iterate the collection at a given path inside the file |
| `ForeachFileChunked` | `(filePath, chunkSize, fn, cfg...)` | Iterate the top-level **array** in batches (default 100 when `chunkSize` ≤0); `ErrTypeMismatch` when the root is not an array |
| `ForeachFileNested` | `(filePath, fn, cfg...)` | Recursively iterate all nested structures |

All callbacks are `func(key any, item *json.IterableValue) error`: return `nil` to continue, `item.Break()` for a clean stop, any other error to interrupt and return. Per-method examples are in the [package-level iteration page](../functions/iterate#file-iteration-functions) (only an extra trailing `cfg`; behavior identical); the method-choice table is in [File I/O](./file-io#choosing-a-method).

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // continue iterating
})
```

## File Iteration Method Comparison

| Method | Path parameter | Recursive | Chunked | Good for |
|---------|:--------------:|:---------:|:-------:|----------|
| `ForeachFile` | No | No | No | Simple file traversal |
| `ForeachFileWithPath` | Yes | No | No | Targeted traversal |
| `ForeachFileChunked` | No | No | **Yes** | Bulk loads, batched callbacks (file still fully loaded) |
| `ForeachFileNested` | No | **Yes** | No | Deep traversal of all nodes |

---

## Iteration Control

A callback returning `item.Break()` cleanly interrupts iteration (overall return `nil`); returning any other error interrupts immediately and propagates it verbatim. The two path-aware variants (`ForeachWithPathAndIterator` / `ForeachWithPathAndControl`) steer via the `IteratorControl` constants (`json.IteratorNormal` / `json.IteratorBreak`) — prefer `item.Break()` for everyday cases. For examples and constant descriptions see the [package-level iteration page](../functions/iterate#iteration-control).

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        return item.Break() // Target found, clean stop
    }
    return nil // continue iterating
})
```

---

## See Also

- [Path Queries](./query) - The Get family of methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [File I/O](../functions/file-io) - LoadFromFile/SaveToFile
