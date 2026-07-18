---
title: "Delete Functions - CyberGo JSON | API Reference"
description: "CyberGo JSON delete functions: Delete removes nodes, DeleteClean removes and cleans empty parent nodes, supporting path expressions and auto cleanup."
sidebar_label: "Delete Operations"
sidebar_position: 4
---

# Delete Functions

The json package provides JSON deletion functions to remove nodes at specified paths, with optional cleanup of empty parent nodes resulting from deletion.

## Delete

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

## DeleteClean

Signature: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the specified path and automatically cleans up resulting empty values and empty arrays.

```go
// Original data: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// If the parent object is empty after deletion, cleanup continues
// {"user": {}} -> {}
```

## See Also

- [Modify Operations](./modify) - Set, merge and other modify functions
- [Query & Get Functions](./query) - Get, GetString and other query operations
