---
title: "Modify Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON modify functions: Set/SetMultiple, Delete, MergeJSON/MergeMany with auto path creation, atomic ops, and multiple MergeMode strategies."
---

# Modify Functions

The json package provides JSON modification functions supporting path setting, batch updates, and delete operations.

## Set Functions

### Set

Signature: `func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value at the specified path, returning the modified JSON string.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `value` | `any` | Yes | Value to set |
| `cfg` | `Config` | No | Optional configuration |

**Example**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**Auto-create When Path Does Not Exist**

```go
// Automatically create intermediate paths
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**Setting Different Value Types**

```go
data := `{}`

// Set string
json.Set(data, "user.name", "Alice")

// Set number
json.Set(data, "user.age", 30)

// Set boolean
json.Set(data, "user.active", true)

// Set null
json.Set(data, "user.deleted", nil)

// Set nested object
json.Set(data, "user.address", map[string]any{
    "city": "Beijing",
    "zip":  "100000",
})

// Set array
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

Signature: `func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch sets values at multiple paths.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `updates` | `map[string]any` | Yes | Path-to-value mapping |
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

**Performance Advantage**

For multiple modifications, `SetMultiple` is more efficient than calling `Set` multiple times:

```go
// Recommended: single call
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// Not recommended: multiple calls
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

Signature: `func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value and automatically creates non-existent intermediate paths. Equivalent to `Set` with `Config.CreatePaths = true`.

```go
// Automatically create intermediate paths when they don't exist
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

Signature: `func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch sets multiple values and automatically creates intermediate paths.

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## Delete Functions

### Delete

Signature: `func Delete(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the value at the specified path.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression |
| `cfg` | `Config` | No | Optional configuration |

**Example**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**Delete Object Properties**

```go
// Delete a single property
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**Delete Array Elements**

```go
// Delete an element from an array (0-based index)
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**Path Does Not Exist**

```go
// When path does not exist, returns original JSON and an error
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err contains JsonsError wrapping ErrPathNotFound
    fmt.Println("Delete failed:", err)
}
// result is still the original JSON: {"a":1}
```

### DeleteClean

Signature: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the specified path and automatically cleans up resulting empty values and empty arrays.

```go
// Original data: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// If the parent object is empty after deletion, cleanup continues
// {"user": {}} -> {}
```

## Merge Functions

### MergeJSON

Signature: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Merges two JSON objects using a deep merge strategy. For nested objects, keys are recursively merged according to the mode specified by `Config.MergeMode`. For primitive values and arrays, the patch value takes precedence.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `json1` | `string` | Yes | Base JSON string |
| `json2` | `string` | Yes | Override JSON string |
| `cfg` | `...Config` | No | Optional configuration (set merge mode via `MergeMode`) |

**Merge Modes** (set via `Config.MergeMode`, default is `MergeUnion`):

| Mode | Object Behavior | Array Behavior |
|------|-----------------|----------------|
| `MergeUnion` | Merge all keys, use patch value for conflicts | Merge all elements and deduplicate |
| `MergeIntersection` | Only keep common keys, values from patch | Only keep common elements |
| `MergeDifference` | Only keep keys unique to base | Only keep elements unique to base |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// Union merge (default)
result, _ := json.MergeJSON(base, override)
// Result: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// Intersection merge - only keep common keys
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// Result: {"b":3,"nested":{"y":30}}

// Difference merge - only keep keys unique to base
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// Result: {"a":1,"nested":{"x":10}}
```

### MergeMany

Signature: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Merges multiple JSON objects. Requires at least 2 JSON strings. Supports setting the merge mode via `Config.MergeMode`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsons` | `[]string` | Yes | JSON strings to merge (at least 2) |
| `cfg` | `...Config` | No | Optional configuration (set merge mode via `MergeMode`) |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// Default union merge
result, err := json.MergeMany([]string{config1, config2, config3})
// Result: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

## Batch Operations

### ProcessBatch

Signature: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Batch processes multiple JSON operations (package-level function, no Processor required).

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := json.ProcessBatch(operations)
if err != nil {
    panic(err)
}
for _, r := range results {
    if r.Error != nil {
        fmt.Printf("Operation %s failed: %v\n", r.ID, r.Error)
    } else {
        fmt.Printf("Operation %s result: %v\n", r.ID, r.Result)
    }
}
```

### BatchOperation

Batch operation descriptor structure.

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Operation type: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // Target JSON string
    Path    string `json:"path"`     // Path expression
    Value   any    `json:"value"`    // Operation value (used for set operations)
    ID      string `json:"id"`       // Operation identifier
}
```

### BatchResult

Batch operation result structure.

```go
type BatchResult struct {
    ID     string `json:"id"`     // Operation identifier
    Result any    `json:"result"` // Operation result
    Error  error  `json:"error"`  // Error information
}
```

## Processor Methods

Processor provides corresponding modify methods with signatures matching the package-level functions:

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

## See Also

- [Query and Get Functions](./get) - Get, GetString and other query operations
- [Encode and Decode Functions](./encode-decode) - Marshal, Unmarshal and other serialization operations
- [Helper Functions](../helpers) - CompareJSON and other utility functions
