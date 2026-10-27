---
sidebar_label: "Iteration Methods"
title: "Processor Iteration Methods - CyberGo JSON | Foreach Family"
description: "Processor iteration: eight Foreach variants including ForeachWithPath and ForeachWithError, IteratorControl flow, and the ForeachFile family with Break."
sidebar_position: 100
---

# Iteration Methods

Iteration methods walk a JSON array or object and invoke a callback per element; the callback reads values through `IterableValue` and controls flow with `Break()` or `IteratorControl`.

:::tip Mirror of the package-level iteration functions
The eight `Foreach*` methods below share their source with the [package-level iteration functions](../functions/iterate); callback signatures and iteration semantics match. Three Processor-side differences:

- **cfg semantics**: the optional trailing `cfg` controls that call's security validation (size, depth, dangerous patterns); when omitted, the processor configuration applies.
- **Cache protection**: the iteration root is `Get`-ed and then **deep-copied** into a working copy, so a callback mutating the container returned by `item.GetData()` pollutes neither the parse cache nor the input.
- **Lifecycle**: once the processor is closed, the iteration methods that return `error` give `ErrProcessorClosed`; the deprecated `Foreach` / `ForeachNested` return nothing and can only skip the callback silently.

Two more semantics match the package-level functions: a root that is neither an array nor an object runs no callback and returns no error (`ForeachWithError` likewise returns `nil`), and objects iterate in lexicographic key order while arrays follow index order.
:::

## Foreach

<Badge type="danger" text="Deprecated" />

Signature: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Iterates a JSON array or object.

::: warning Deprecated
`Foreach` **silently drops errors**: when the document is invalid, the path fails to resolve, or the processor is closed, the callback is skipped entirely and no error is returned. Use [`ForeachWithError`](#foreachwitherror) instead — it returns the error, and its callback returns `nil` to continue. `Foreach` is kept for the lifetime of v1 and will not be removed.
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

Iterates at a given path and returns an error. The callback returns nothing: parse or path-resolution failures are returned rather than silently skipped as in the deprecated `Foreach`. Use it for nested arrays or for the object at a specific path.

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

## ForeachNested

<Badge type="danger" text="Deprecated" />

Signature: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Recursively iterates all nested levels.

::: warning Deprecated
`ForeachNested` **silently drops errors** just like `Foreach`: on a failed parse, a failed path resolution or a closed processor the callback is skipped entirely, with no error returned. Use [`ForeachNestedWithError`](#foreachnestedwitherror) instead — it returns the error, and its callback returns `nil` to continue. `ForeachNested` is kept for the lifetime of v1 and will not be removed.
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

Iterates JSON data and returns the re-serialized JSON string. The callback **may modify** the iterated containers: `item.GetData()` returns a reference to the working copy (a deep copy), so additions, deletions and changes to maps or slices appear in the final serialized result; scalars cannot be replaced in place. Modifications never affect the input or the processor cache. The re-encoded output is also bounded by `MaxJSONSize`, returning `ErrSizeLimit` when exceeded.

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

Useful when you keep processing the result after iteration.

## ForeachWithError

Signature: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Iterates at a given path with an error-returning callback: return `nil` to continue, any other error to interrupt and propagate verbatim.

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

Recursively iterates all nesting levels with an error-returning callback.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Signature: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

Iterates at a given path and passes each element's path relative to the iterated collection. `currentPath` looks like `[0]` for an array element or `.name` for an object member, without the `path` prefix. Return `json.IteratorBreak` to stop, `json.IteratorNormal` to continue.

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

Iterates raw values at a given path (the callback gets `any`, not `IterableValue`), steering with `IteratorControl`. A panic in the callback is caught and returned as an error.

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Key: %v, Value: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

The `IterableValue` in iteration callbacks provides type-safe access: `Get`, `GetString`, `GetInt`, `GetFloat64`, `GetBool`, `GetArray`, `GetObject`, plus default-value variants (`GetWithDefault`, `GetStringWithDefault`, `GetIntWithDefault`, and so on), state checks (`Exists`, `IsNull`, `IsNullData`, `IsEmpty`, `IsEmptyData`), nested iteration via `ForeachNested`, and the `Break()` stop signal. For the full method list see [IterableValue type](../iterator).

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

File iteration methods are equivalent to `LoadFromFile` plus the matching `Foreach` method: path security validation, the `MaxJSONSize` read limit and per-call `cfg` forwarding behave as in file loading. The file is **fully loaded into memory** before iterating (bounded by `MaxJSONSize`, 100MB by default); for constant-memory scenarios see [Large File Handling](../../streaming/large-files#streaming-and-parallel-iterators).

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
