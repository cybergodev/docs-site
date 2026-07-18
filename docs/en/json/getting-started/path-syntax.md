---
sidebar_label: "Path Syntax"
title: "Path Expression Syntax - CyberGo JSON | JSONPath Guide"
description: "CyberGo JSON path syntax guide: user.name, items[0], slicing, wildcards, and multi-field extraction to target any node in Go JSON data."
sidebar_position: 2
---

# Path Expression Syntax

The json library supports a rich path expression syntax for locating and manipulating any node in JSON data.

## Basic Syntax

### Property Access

Use the dot `.` to access object properties:

```go
data := `{"user": {"name": "Alice", "age": 30}}`

name := json.GetString(data, "user.name")    // "Alice"
age := json.GetInt(data, "user.age")         // 30
```

### Nested Paths

Chain dots to access deeply nested properties:

```go
data := `{
    "company": {
        "department": {
            "team": {
                "lead": "Bob"
            }
        }
    }
}`

lead := json.GetString(data, "company.department.team.lead")  // "Bob"
```

### Array Indexing

Two syntaxes for accessing array elements:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

// Syntax 1: dot + index
first := json.GetString(data, "items.0")   // "a"

// Syntax 2: brackets + index
first2 := json.GetString(data, "items[0]")   // "a"
```

#### Negative Indices

Negative indices count from the end of the array; `-1` means the last element:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

val := json.GetString(data, "items[-1]")  // "e"  (last element)
val = json.GetString(data, "items[-2]")   // "d"  (second from last)
val = json.GetString(data, "items[-5]")   // "a"  (equivalent to [0])
```

| Index | Meaning | Equivalent Positive Index |
|-------|---------|--------------------------|
| `[0]` | First element | — |
| `[1]` | Second element | — |
| `[-1]` | Last element | `[len-1]` |
| `[-2]` | Second from last | `[len-2]` |
| `[-N]` | Nth from last | `[len-N]` |

#### Multi-Dimensional Arrays

Chain indices to access nested arrays:

```go
data := `{"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}`

val := json.GetInt(data, "matrix[0][0]")   // 1
val = json.GetInt(data, "matrix[1][2]")    // 6
val = json.GetInt(data, "matrix[-1][-1]")  // 9
```

#### Boundary Behavior

Out-of-bounds indices do not panic. Type-safe getter functions (GetString, GetInt, etc.) return zero values, while the Get function returns an error:

```go
data := `{"items": ["a", "b", "c"]}`

// Positive index out of bounds → returns zero value, no error
json.GetString(data, "items[10]")   // ""   (empty string)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, ErrPathNotFound

// Negative index out of bounds → also returns zero value
json.GetString(data, "items[-10]")  // ""   (empty string)
json.GetInt(data, "items[-10]")     // 0
```

| Function | Out-of-Bounds Return Value |
|----------|---------------------------|
| `Get` | `(nil, ErrPathNotFound)` |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

::: tip Index Boundaries
- Positive indices must be within `[0, len)` range; negative indices follow the same rule after conversion (`len + index`)
- Out-of-bounds access returns the zero value for the corresponding type; it does not panic or return an error
- To check if a path exists, use `Get` and check whether the error is `json.ErrPathNotFound`
:::

---

## Advanced Syntax

### Array Slicing `[start:end:step]`

Extract sub-arrays using Python-style slice syntax `[start:end:step]`. All three parameters are optional:

| Parameter | Description | Default When Omitted |
|-----------|-------------|---------------------|
| `start` | Start index (inclusive) | `0` (positive step) or `len-1` (negative step) |
| `end` | End index (exclusive) | `len` (positive step) or `-1` (negative step) |
| `step` | Step size | `1` |

#### Slice Syntax Quick Reference

| Syntax | Meaning | Example (`[0,1,2,3,4]`) | Result |
|--------|---------|------------------------|--------|
| `[:]` | Full copy | `[0,1,2,3,4][:]` | `[0,1,2,3,4]` |
| `[N:]` | From N to end | `[0,1,2,3,4][2:]` | `[2,3,4]` |
| `[:N]` | From beginning to N | `[0,1,2,3,4][:3]` | `[0,1,2]` |
| `[N:M]` | From N to M-1 | `[0,1,2,3,4][1:4]` | `[1,2,3]` |
| `[::S]` | Every S-th element | `[0,1,2,3,4][::2]` | `[0,2,4]` |
| `[N::S]` | From N, step S | `[0,1,2,3,4][1::2]` | `[1,3]` |
| `[:M:S]` | From start to M, step S | `[0,1,2,3,4][:4:2]` | `[0,2]` |
| `[N:M:S]` | Full three-parameter | `[0,1,2,3,4][0:5:2]` | `[0,2,4]` |
| `[::-1]` | Reverse array | `[0,1,2,3,4][::-1]` | `[4,3,2,1,0]` |
| `[::-S]` | Reverse step | `[0,1,2,3,4][::-2]` | `[4,2,0]` |

#### Forward Slicing

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// Basic slice
slice := json.GetArray(data, "numbers[2:5]")    // [2, 3, 4]

// Omit start (from beginning)
slice2 := json.GetArray(data, "numbers[:3]")      // [0, 1, 2]

// Omit end (to end)
slice3 := json.GetArray(data, "numbers[7:]")      // [7, 8, 9]

// Step of 2 (even-positioned elements)
slice4 := json.GetArray(data, "numbers[::2]")     // [0, 2, 4, 6, 8]

// Full parameters
slice5 := json.GetArray(data, "numbers[1:8:3]")   // [1, 4, 7]

// Full copy
slice6 := json.GetArray(data, "numbers[:]")       // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

#### Negative Index Slicing

The `start` and `end` of slices both support negative indices:

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// Get the last 3 elements
json.GetArray(data, "numbers[-3:]")    // [7, 8, 9]

// Remove the last 2 elements
json.GetArray(data, "numbers[:-2]")    // [0, 1, 2, 3, 4, 5, 6, 7]

// From 5th from last to 2nd from last
json.GetArray(data, "numbers[-5:-2]")  // [5, 6, 7]

// From index 2 to 1st from last (excluding the last)
json.GetArray(data, "numbers[2:-1]")   // [2, 3, 4, 5, 6, 7, 8]
```

#### Reverse Slicing

Negative step enables reverse traversal:

```go
data := `{"letters": ["a", "b", "c", "d", "e"]}`

// Reverse array
json.GetArray(data, "letters[::-1]")    // ["e", "d", "c", "b", "a"]

// Reverse step of 2
json.GetArray(data, "letters[::-2]")    // ["e", "c", "a"]

// From index 3 to 1 (reverse)
json.GetArray(data, "letters[3:1:-1]")  // ["d", "c"]

// From end, reverse first 3
json.GetArray(data, "letters[2::-1]")   // ["c", "b", "a"]
```

#### Boundary Behavior

Slicing automatically clamps out-of-bounds indices without returning errors:

```go
data := `{"items": [0, 1, 2]}`

// Out-of-bounds start/end are automatically clamped to valid range
json.GetArray(data, "items[0:100]")   // [0, 1, 2]  (end clamped to len=3)
json.GetArray(data, "items[10:20]")   // []         (start >= end, empty result)

// start >= end returns empty array
json.GetArray(data, "items[2:2]")     // []
json.GetArray(data, "items[3:1]")     // []
```

::: warning Slice vs Index Boundary Handling
- **Index out of bounds** (e.g., `items[10]`) returns the zero value for the corresponding type, no error
- **Slice out of bounds** (e.g., `items[10:20]`) auto-clamps and returns an empty array, no error
:::

### Field Extraction `{field1,field2}`

Extract only specific fields from an object:

```go
data := `{
    "user": {
        "id": 1001,
        "name": "Alice",
        "email": "alice@example.com",
        "password": "secret",
        "age": 25
    }
}`

// Extract only id and name
extracted, _ := json.Get(data, "user{id,name}")
// Result: {"id": 1001, "name": "Alice"}
```

### Flat Extraction `{flat:field}`

When extracting values from fields of array objects, if the field itself is also an array, regular extraction produces nested arrays. Using the `{flat:}` prefix recursively flattens all nested arrays into a single flat result array.

#### Regular Extraction vs Flat Extraction

```go
data := `{
    "groups": [
        {"tags": ["go", "json"]},
        {"tags": ["python", "yaml"]}
    ]
}`

// Regular extraction → nested array
json.GetArray(data, "groups{tags}")
// [["go", "json"], ["python", "yaml"]]

// Flat extraction → flattened to a single array
json.GetArray(data, "groups{flat:tags}")
// ["go", "json", "python", "yaml"]
```

#### Chained Flat Extraction

Multi-level nested arrays can use `{flat:}` consecutively to flatten each level:

```go
data := `{
    "departments": [
        {
            "teams": [
                {"members": [{"name": "Alice"}, {"name": "Bob"}]}
            ]
        },
        {
            "teams": [
                {"members": [{"name": "Carol"}]}
            ]
        }
    ]
}`

// Three-level flattening: departments → teams → members → name
json.GetArray(data, "departments{flat:teams}{flat:members}{name}")
// ["Alice", "Bob", "Carol"]
```

#### Flat Extraction Followed by Other Operations

The result of flat extraction can be further operated on with slicing, indexing, etc.:

```go
data := `{
    "orders": [
        {"items": ["book", "pen"]},
        {"items": ["laptop", "mouse", "keyboard"]},
        {"items": ["cup"]}
    ]
}`

// Flat then slice
json.GetArray(data, "orders{flat:items}[0:3]")
// ["book", "pen", "laptop"]
```

::: info Limitations
- `{flat:field1,field2}` multi-field extraction does not apply the `flat` flag because multi-field extraction produces objects, not arrays
- Flattening recursively expands all levels of nested arrays, not just the first level
:::

### Append Operation `[+]`

Append elements to the end of an array:

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[+]", 4)
// Result: {"items": [1, 2, 3, 4]}

updated, _ = json.Set(updated, "items[+]", 5)
// Result: {"items": [1, 2, 3, 4, 5]}
```

### Wildcard `[*]`

```go
data := `{"items": [1, 2, 3]}`

updated, _ := json.Set(data, "items[*]", 0)
// Result: {"items": [0, 0, 0]}
```

---

## Path Validation

### Validating Paths via Processor

Use `Processor.CompilePath` to validate path format:

```go
p, err := json.New()
if err != nil {
    panic(err)
}

// Compile path (automatically validates format)
cp, err := p.CompilePath("user.profile.name")
if err != nil {
    fmt.Println("Invalid path:", err)
}

cp, err = p.CompilePath("items[0:10:2]")
if err != nil {
    fmt.Println("Invalid path:", err)
}
```

---

## Special Paths

### Root Path

An empty string `""` or `"."` represents the root:

```go
data := `{"name": "test"}`

// Get the entire object
root, _ := json.Get(data, "")     // {"name": "test"}
root, _ = json.Get(data, ".")     // Same as above
```

### Path Escaping

If a key name contains special characters, use escaping:

```go
data := `{"user.name": "Alice"}`

// Key name containing a dot
name := json.GetString(data, "user\\.name")  // "Alice"
```

---

## Path Segment Types

The library internally parses paths into different types of segments (these are internal implementation details, not exported as public API):

| Type | Syntax Example | Description |
|------|---------------|-------------|
| Property access | `user.name` | Access object properties |
| Array index | `items[0]` | Access array elements |
| Array slice | `items[1:5]` | Slice range access |
| Wildcard | `items[*]` | Match all elements |
| Field extraction | `{name,email}` | Extract multiple fields |
| Flat extraction | `{flat:tags}` | Extract and recursively flatten nested arrays |
| Append operation | `items[+]` | Append to array |

---

## Complete Example

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "store": {
            "books": [
                {"title": "Go 101", "price": 25, "category": "programming"},
                {"title": "JSON Guide", "price": 35, "category": "programming"},
                {"title": "Clean Code", "price": 45, "category": "programming"}
            ],
            "prices": [10, 20, 30, 40, 50]
        }
    }`

    // 1. Basic access
    title := json.GetString(data, "store.books.0.title")
    fmt.Println("First book:", title)

    // 2. Array slicing
    books := json.GetArray(data, "store.books[0:2]")
    fmt.Printf("First 2 books: %d items\n", len(books))

    // 3. Slice with step
    prices := json.GetArray(data, "store.prices[::2]")
    fmt.Println("\nEvery other price:", prices)

    // 4. Field extraction
    extracted, _ := json.Get(data, "store.books[0]{title,price}")
    fmt.Println("\nExtracted fields:", extracted)

    // 5. Append element
    updated, _ := json.Set(data, "store.books[+]", map[string]any{
        "title":    "New Book",
        "price":    55,
        "category": "programming",
    })
    fmt.Println("\nAfter append:", json.Valid([]byte(updated)))
}
```

## Next Steps

- [API Reference](../api-reference/) — View the complete API reference
- [Usage Examples](../examples/) — More practical examples
