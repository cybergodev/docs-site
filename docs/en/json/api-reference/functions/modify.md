---
sidebar_label: "Modification Operations"
title: "Modification Functions - CyberGo JSON | Set/MergeJSON Usage"
description: "Modifying JSON: Set/SetMultiple create missing nodes, SetCreate forces CreatePaths, MergeJSON deep-merges under MergeMode, and every call returns a new string."
sidebar_position: 30
---

# Modification Functions

The JSON modification functions of the json package: path setting, batch updates, and merging. Every function returns a new string and leaves the input unchanged.

## Set Functions

### Set

Signature: `func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value at the specified path and returns the modified JSON string.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `value` | `any` | Yes | Value to set |
| `cfg` | `Config` | No | Optional configuration |

**Returns and errors**

On success, returns the modified JSON string and `nil`; on failure, returns the **original unmodified** `jsonStr` and an error (the same contract as `Delete`; sentinels are checkable with `errors.Is`):

| Error | Trigger |
|-------|---------|
| `ErrInvalidJSON` | `jsonStr` is not valid JSON |
| `ErrInvalidPath` | The path expression has illegal syntax |
| `ErrPathNotFound` | The path does not exist and `CreatePaths = false` |

When the target location has a type conflict (for example `a` is a number and you write `a.b`), the return is a plain `JsonsError` and `errors.Is(err, ErrTypeMismatch)` is `false`. Judge such failures by the message or `JsonsError.Op`, not by the sentinel.

**Example**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**Missing paths are created automatically**

```go
// Intermediate paths are created automatically
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**Setting values of different types**

```go
data := `{}`

// Set a string
json.Set(data, "user.name", "Alice")

// Set a number
json.Set(data, "user.age", 30)

// Set a boolean
json.Set(data, "user.active", true)

// Set null
json.Set(data, "user.deleted", nil)

// Set a nested object
json.Set(data, "user.address", map[string]any{
    "city": "Beijing",
    "zip":  "100000",
})

// Set an array
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

Signature: `func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch-sets the values of multiple paths.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `updates` | `map[string]any` | Yes | Mapping of path to value |
| `cfg` | `Config` | No | Optional configuration |

**Example**

```go
updates := map[string]any{
    "user.name": "Bob",
    "user.age":  25,
    "user.email": "bob@example.com",
}
result, err := json.SetMultiple(data, updates)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**Performance**: for several modifications, `SetMultiple` parses the document once and writes each path into the same tree; repeated `Set` calls re-parse on every step. Updates are applied in sorted path order, so overlapping paths such as `a` and `a.b` produce a deterministic result (`a` is written first, then `a.b`):

```go
// Recommended: one call
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// Repeated calls parse the document again on every step
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

Signature: `func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value and automatically creates missing intermediate paths. Equivalent to `Set` with `CreatePaths` **forced on**: even with an extra `cfg`, the other fields merge as usual but `CreatePaths` is always `true`. The default `Config.CreatePaths` is already `true`, so without cfg `SetCreate` behaves the same as `Set`; its value is marking the intent ("creating paths is allowed here") and overriding a processor built with `CreatePaths=false`.

```go
// Intermediate paths are created automatically when missing
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

Signature: `func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch-sets multiple values and creates intermediate paths automatically. Its relationship to `SetMultiple` is as above: the other `cfg` fields take effect as usual, while `CreatePaths` is forced to `true`.

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## Modifying Array Paths

The `Set` family has dedicated behavior for array paths; see [Path Expression Syntax](../../getting-started/path-syntax) for the path grammar:

```go
data := `{"items": ["a", "b", "c"]}`

// Index replacement (negative indices included)
r1, _ := json.Set(data, "items[0]", "x")    // {"items":["x","b","c"]}
r2, _ := json.Set(data, "items[-1]", "z")   // {"items":["a","b","z"]}

// Append an element
r3, _ := json.Set(data, "items[+]", "d")    // {"items":["a","b","c","d"]}

// Wildcard: replace every element with the same value
r4, _ := json.Set(data, "items[*]", "-")    // {"items":["-","-","-"]}

// Nesting: a field of an array element (created automatically when missing)
users := `{"users": [{"name": "Alice"}]}`
r5, _ := json.Set(users, "users[0].age", 30)
// {"users":[{"age":30,"name":"Alice"}]}

r6, _ := json.SetCreate(`{}`, "users[0].profile.bio", "Developer")
// {"users":[{"profile":{"bio":"Developer"}}]}
```

::: warning Limitation of slice segments
**Slice segments** like `items[1:3]` are fine for queries (they return a sub-array), but as the **last segment** of a `Set`/`Delete` path the current version returns an error (`distributed set ops on slices not yet supported`) — the "rewrite every element in the range" operation is not supported. When you need that effect, use `ForeachReturn` or a wildcard path instead.
:::

## Merge Functions

### MergeJSON

Signature: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Merges two JSON objects with a deep-merge strategy. Nested objects have their keys merged recursively under the mode given by `Config.MergeMode`; on primitive conflicts the patch value wins, and arrays are merged by element according to the mode (see the table), not overwritten by index.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `json1` | `string` | Yes | Base JSON string |
| `json2` | `string` | Yes | Overriding JSON string |
| `cfg` | `...Config` | No | Optional configuration (sets the merge mode via `MergeMode`) |

**Merge modes** (set via `Config.MergeMode`, default `MergeUnion`):

| Mode | Object behavior | Array behavior |
|------|-----------------|-----------------|
| `MergeUnion` | Merge all keys; on conflict the patch value wins | Merge all elements and deduplicate |
| `MergeIntersection` | Keep only shared keys, values taken from the patch | Keep only shared elements |
| `MergeDifference` | Keep only keys unique to the base | Keep only elements unique to the base |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// Union merge (default)
result, _ := json.MergeJSON(base, override)
// Result: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// Intersection merge - keep only shared keys
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// Result: {"b":3,"nested":{"y":30}}

// Difference merge - keep only keys unique to base
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// Result: {"a":1,"nested":{"x":10}}
```

**Three modes compared on array fields** (arrays are merged by **deduplicating elements**, not overwritten by index):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	base := `{"tags":[1,2,3],"roles":["dev"]}`
	override := `{"tags":[3,4]}`

	// Union: base elements first, then the override's new elements appended, deduplicated
	union, _ := json.MergeJSON(base, override)
	fmt.Println(union)
	// Output: {"roles":["dev"],"tags":[1,2,3,4]}

	// Intersection: keep only elements present on both sides (base order preserved)
	cfg := json.DefaultConfig()
	cfg.MergeMode = json.MergeIntersection
	inter, _ := json.MergeJSON(base, override, cfg)
	fmt.Println(inter)
	// Output: {"tags":[3]}

	// Difference: keep only elements unique to base (the roles key exists only in
	// base, so it is kept)
	cfg.MergeMode = json.MergeDifference
	diff, _ := json.MergeJSON(base, override, cfg)
	fmt.Println(diff)
	// Output: {"roles":["dev"],"tags":[1,2]}
}
```

::: warning Top-level inputs must be JSON objects
`MergeJSON` requires both top-level inputs to be JSON objects (`{...}`); if either side is an array or a scalar, an error is returned (`first JSON is not an object` / `second JSON is not an object`). The "array behavior" in the table applies to **arrays inside object fields**: when the same-named field is an array on both sides, elements are deduplicated, intersected, or differenced (in difference mode the key is kept even if the result is an empty array). When the same-named field has mismatched types (an array on one side, a scalar on the other): union/intersection take the override's value, while difference drops the key entirely.
:::

### MergeMany

Signature: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Merges multiple JSON objects; at least 2 inputs are required. The merge mode is likewise set by `Config.MergeMode`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsons` | `[]string` | Yes | Slice of JSON strings to merge (at least 2) |
| `cfg` | `...Config` | No | Optional configuration (sets the merge mode via `MergeMode`) |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// Default union merge
result, err := json.MergeMany([]string{config1, config2, config3})
// Result: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

**Merge order and errors**: folds left to right, `MergeMany([a, b, c])` equals `MergeJSON(MergeJSON(a, b), c)`, with the right-hand (higher-index) value winning conflicts. Fewer than 2 inputs is an immediate error; if any step fails, an error carrying the failing index is returned (`merge failed at index i: ...`) and no partial result is produced.

## Processor Methods

The Processor provides corresponding modification and merge methods with the same signatures as the package-level functions:

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

**The pre-parsed variant SetFromParsed**: combined with `PreParse`, applies consecutive modifications to the same parsed data, skipping repeated parsing:

```go
parsed, err := p.PreParse(jsonStr) // Parse once
if err != nil {
    panic(err)
}
defer parsed.Release()

// First modification: returns a new ParsedJSON that can keep being modified in a chain
parsed2, err := p.SetFromParsed(parsed, "user.name", "Alice")
if err != nil {
    panic(err)
}
parsed3, err := p.SetFromParsed(parsed2, "user.age", 30)
if err != nil {
    panic(err)
}

// Take the final JSON text
final := parsed3.Data() // any (map[string]any / []any)
```

:::tip
`SetFromParsed` returns a **new** `*ParsedJSON` (intermediate results do not affect each other), which fits consecutive modifications on the same large JSON. Pairs with `GetFromParsed`; see [Processor Parse Methods](../processor/parse#setfromparsed).
:::

`MergeJSON` and `MergeMany` also have Processor counterparts with the same signatures as the package-level functions, convenient for reusing a configured Processor:

```go
result, err := p.MergeJSON(base, override)

merged, err := p.MergeMany([]string{config1, config2, config3})

// CompareJSON also has a Processor method; Processor.CompareJSON always
// runs security validation, unlike the package-level no-cfg path
equal, err := p.CompareJSON(a, b)
```

See [Processor Data Modification](../processor/modify#processor-merge-methods) for details.

## See Also

- [Query & Get](./query) - Get, GetString and other query operations
- [Batch Operation Functions](./batch) - ProcessBatch batch processing
- [Encoding Output](./output) - Marshal, Unmarshal and other serialization operations
- [Utility Functions](../helpers) - CompareJSON and other utilities
