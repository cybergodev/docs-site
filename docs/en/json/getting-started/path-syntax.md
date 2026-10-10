---
sidebar_label: "Path Expression Syntax"
title: "Path Expression Syntax - CyberGo JSON | JSONPath Query Guide"
description: "CyberGo JSON path expressions: property access, array and negative indices, slice steps, wildcards, multi-field and flat extraction, append, and JSON Pointer."
sidebar_position: 20
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

Chain dots to reach deeply nested properties:

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

### Array Indices

Two syntaxes access array elements:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

// Syntax 1: dot + index
first := json.GetString(data, "items.0")   // "a"

// Syntax 2: bracket + index
first2 := json.GetString(data, "items[0]")   // "a"
```

#### Negative Indices

Negative indices count from the end; `-1` is the last element:

```go
data := `{"items": ["a", "b", "c", "d", "e"]}`

val := json.GetString(data, "items[-1]")  // "e"  (last)
val = json.GetString(data, "items[-2]")   // "d"  (second to last)
val = json.GetString(data, "items[-5]")   // "a"  (same as [0])
```

| Index | Meaning | Equivalent positive index |
|-------|---------|---------------------------|
| `[0]` | First element | — |
| `[1]` | Second element | — |
| `[-1]` | Last element | `[len-1]` |
| `[-2]` | Second to last | `[len-2]` |
| `[-N]` | N-th from the end | `[len-N]` |

#### Multidimensional Arrays

Chain indices to reach into nested arrays:

```go
data := `{"matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}`

val := json.GetInt(data, "matrix[0][0]")   // 1
val = json.GetInt(data, "matrix[1][2]")    // 6
val = json.GetInt(data, "matrix[-1][-1]")  // 9
```

#### Boundary Behavior

Out-of-range indices neither panic nor error — type-safe getters return zero values, and `Get` returns a nil result:

```go
data := `{"items": ["a", "b", "c"]}`

// Positive index out of range -> zero value / nil, no error either way
json.GetString(data, "items[10]")   // ""   (empty string)
json.GetInt(data, "items[10]")      // 0
json.Get(data, "items[10]")         // nil, nil (note: err is also nil)

// Negative index out of range -> zero values likewise
json.GetString(data, "items[-10]")  // ""   (empty string)
json.GetInt(data, "items[-10]")     // 0
```

| Function | Out-of-range return |
|----------|---------------------|
| `Get` | `(nil, nil)` — no error |
| `GetString` | `""` |
| `GetInt` | `0` |
| `GetFloat` | `0.0` |
| `GetBool` | `false` |
| `GetArray` | `nil` |

::: tip Index boundaries
- Positive indices must fall in `[0, len)`; negative indices likewise after conversion (`len + index`)
- Out-of-range access returns zero values / nil — no panic, no error
- Only a **missing object key** returns `ErrPathNotFound` (e.g. `json.Get(data, "nosuchkey")`); to decide whether an array element exists, inspect the return value, not just err
:::

---

## Advanced Syntax

### Array Slices `[start:end:step]`

Extract a sub-array using Python-style slice syntax `[start:end:step]`; all three parameters can be omitted:

| Parameter | Description | Default when omitted |
|-----------|-------------|----------------------|
| `start` | Start index (inclusive) | `0` (positive step) or `len-1` (negative step) |
| `end` | End index (exclusive) | `len` (positive step) or `-1` (negative step) |
| `step` | Step | `1` |

#### Slice Syntax Quick Reference

| Syntax | Meaning | Example (`[0,1,2,3,4]`) | Result |
|---------|---------|--------------------------|--------|
| `[:]` | Full copy | `[0,1,2,3,4][:]` | `[0,1,2,3,4]` |
| `[N:]` | From N to the end | `[0,1,2,3,4][2:]` | `[2,3,4]` |
| `[:N]` | From the start to N | `[0,1,2,3,4][:3]` | `[0,1,2]` |
| `[N:M]` | From N to M-1 | `[0,1,2,3,4][1:4]` | `[1,2,3]` |
| `[::S]` | Every S-th element | `[0,1,2,3,4][::2]` | `[0,2,4]` |
| `[N::S]` | From N with step S | `[0,1,2,3,4][1::2]` | `[1,3]` |
| `[:M:S]` | Start to M with step S | `[0,1,2,3,4][:4:2]` | `[0,2]` |
| `[N:M:S]` | Full three-parameter form | `[0,1,2,3,4][0:5:2]` | `[0,2,4]` |
| `[::-1]` | Reverse the array | `[0,1,2,3,4][::-1]` | `[4,3,2,1,0]` |
| `[::-S]` | Negative step | `[0,1,2,3,4][::-2]` | `[4,2,0]` |

#### Forward Slices

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// Basic slice
slice := json.GetArray(data, "numbers[2:5]")    // [2, 3, 4]

// Omit start (from the beginning)
slice2 := json.GetArray(data, "numbers[:3]")      // [0, 1, 2]

// Omit end (to the end)
slice3 := json.GetArray(data, "numbers[7:]")      // [7, 8, 9]

// Step of 2 (even-position elements)
slice4 := json.GetArray(data, "numbers[::2]")     // [0, 2, 4, 6, 8]

// Full parameters
slice5 := json.GetArray(data, "numbers[1:8:3]")   // [1, 4, 7]

// Full copy
slice6 := json.GetArray(data, "numbers[:]")       // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

#### Negative-Index Slices

Slice `start` and `end` both accept negative indices:

```go
data := `{"numbers": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}`

// Take the last 3 elements
json.GetArray(data, "numbers[-3:]")    // [7, 8, 9]

// Drop the last 2 elements
json.GetArray(data, "numbers[:-2]")    // [0, 1, 2, 3, 4, 5, 6, 7]

// From the 5th-to-last to the 2nd-to-last
json.GetArray(data, "numbers[-5:-2]")  // [5, 6, 7]

// From index 2 to the last (excluding the last)
json.GetArray(data, "numbers[2:-1]")   // [2, 3, 4, 5, 6, 7, 8]
```

#### Reverse Slices

A negative step walks the array backwards:

```go
data := `{"letters": ["a", "b", "c", "d", "e"]}`

// Reverse the array
json.GetArray(data, "letters[::-1]")    // ["e", "d", "c", "b", "a"]

// Reverse with step 2
json.GetArray(data, "letters[::-2]")    // ["e", "c", "a"]

// From index 3 down to 1 (backwards)
json.GetArray(data, "letters[3:1:-1]")  // ["d", "c"]

// First 3 elements taken backwards from the end
json.GetArray(data, "letters[2::-1]")   // ["c", "b", "a"]
```

#### Boundary Behavior

Slices clamp out-of-range indices automatically and never return an error:

```go
data := `{"items": [0, 1, 2]}`

// Out-of-range start/end are clamped into the valid range
json.GetArray(data, "items[0:100]")   // [0, 1, 2]  (end clamped to len=3)
json.GetArray(data, "items[10:20]")   // []         (start >= end, empty result)

// start >= end returns an empty array
json.GetArray(data, "items[2:2]")     // []
json.GetArray(data, "items[3:1]")     // []
```

::: warning Slice vs index boundary handling
- **Index out of range** (e.g. `items[10]`) returns the type's zero value, no error
- **Slice out of range** (e.g. `items[10:20]`) is clamped, returning an empty array, no error
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
extracted, err := json.Get(data, "user{id,name}")
if err != nil {
    panic(err)
}
// Result: {"id": 1001, "name": "Alice"}
```

### Flat Extraction `{flat:field}`

When extracting a field from an array of objects, plain extraction nests arrays if the field itself is an array. The `{flat:}` prefix recursively flattens all nested arrays into a single flat result array.

#### Plain vs Flat Extraction

```go
data := `{
    "groups": [
        {"tags": ["go", "json"]},
        {"tags": ["python", "yaml"]}
    ]
}`

// Plain extraction -> nested arrays
json.GetArray(data, "groups{tags}")
// [["go", "json"], ["python", "yaml"]]

// Flat extraction -> flattened into one array
json.GetArray(data, "groups{flat:tags}")
// ["go", "json", "python", "yaml"]
```

#### Chained Flat Extraction

Multiply nested arrays can be flattened level by level with consecutive `{flat:}`:

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

// Three-level flattening: departments -> teams -> members -> name
json.GetArray(data, "departments{flat:teams}{flat:members}{name}")
// ["Alice", "Bob", "Carol"]
```

#### Other Operations After Flat Extraction

Flat-extraction results can continue with slices, indices, and other operations:

```go
data := `{
    "orders": [
        {"items": ["book", "pen"]},
        {"items": ["laptop", "mouse", "keyboard"]},
        {"items": ["cup"]}
    ]
}`

// Slice after flattening
json.GetArray(data, "orders{flat:items}[0:3]")
// ["book", "pen", "laptop"]
```

::: info Limitations
- In multi-field extraction `{flat:field1,field2}` the `flat` flag has no effect, because multi-field extraction produces objects, not arrays
- Flattening recursively expands nested arrays at every level, not just the first
:::

### Append `[+]`

Append an element to the end of an array:

```go
data := `{"items": [1, 2, 3]}`

updated, err := json.Set(data, "items[+]", 4)
if err != nil {
    panic(err)
}
// Result: {"items": [1, 2, 3, 4]}

updated, err = json.Set(updated, "items[+]", 5)
if err != nil {
    panic(err)
}
// Result: {"items": [1, 2, 3, 4, 5]}

// Appending a slice expands into multiple elements instead of nesting
updated, err = json.Set(updated, "items[+]", []any{6, 7})
if err != nil {
    panic(err)
}
// Result: {"items": [1, 2, 3, 4, 5, 6, 7]}
```

::: warning The path before [+] must be an existing array
`items[+]` only appends; it never creates the array. If the target path is missing or not an array, an error is returned ("cannot append to non-array type"); create the array first with `SetCreate(data, "items", []any{})`, then append.
:::

### Wildcard `[*]`

The wildcard matches **all elements** of an array (or object), useful in both queries and modifications:

```go
data := `{"items": [1, 2, 3]}`

updated, err := json.Set(data, "items[*]", 0)
if err != nil {
    panic(err)
}
// Result: {"items": [0, 0, 0]}
```

#### Query Scenario: Collecting a Field

When a property path follows the wildcard, the field's value from each element is **collected into an array**:

```go
users := `{"users": [{"name": "John"}, {"name": "Jane"}]}`

// [*].field -> collect the field value of every element
names, err := json.Get(users, "users[*].name")
if err != nil {
    panic(err)
}
fmt.Println(names) // [John Jane]

// Standing alone as the last segment, [*] equals the array itself
arr, _ := json.GetArray(data, "items[*]") // [1, 2, 3]
```

#### Dot Shorthand `*`

`*` can replace `[*]`; the two spellings are equivalent:

```go
symbols := `[
    {"symbol": "AAPL", "price": 180},
    {"symbol": "GOOG", "price": 140}
]`

// Wildcard at the very start: applies to the root array
a, _ := json.GetArray(symbols, "[*].symbol") // [AAPL GOOG]
b, _ := json.GetArray(symbols, "*.symbol")   // [AAPL GOOG], equivalent to the above
```

::: tip Division of labor with Foreach
`[*].field` suits the "collect a single field" case; for per-element access to several fields, [`ForeachWithPath`](../api-reference/functions/iterate) is more direct.
:::

---

## Path Validation

### Validating Paths via a Processor

Use `Processor.CompilePath` to check that a path's format is correct:

```go
p, err := json.New()
if err != nil {
    panic(err)
}

// Compile the path (format is validated automatically)
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

The empty string `""` or `"."` denotes the root:

```go
data := `{"name": "test"}`

// Get the whole object
root, err := json.Get(data, "") // {"name": "test"}
if err != nil {
    panic(err)
}
root, err = json.Get(data, ".") // Same as above
```

### JSON Pointer (RFC 6901)

Paths starting with `/` are parsed as JSON Pointer syntax (slash-separated) — an independent notation from dot syntax; the two cannot be mixed:

```go
data := `{"user": {"name": "Alice"}, "items": ["a", "b"]}`

name := json.GetString(data, "/user/name") // "Alice"
item := json.GetString(data, "/items/0")   // "a"
```

- Escape `/` or `~` inside key names with `~1` and `~0` (`a~1b` denotes the key `a/b`)
- Array subscripts must be **non-negative** integers: Pointer mode has no negative indices, so `/items/-1` finds nothing; `/items/-` points at the not-yet-existing position past the end and likewise finds nothing
- `Set` cannot grow an array through a JSON Pointer (out-of-range is a hard error); use a dot path for out-of-range writes
- A lone `/` denotes the root, equivalent to `""` and `.`

### Path Escaping

Escape special characters in key names with a backslash. Six characters are escapable:

| Escape | Key-name character matched |
|--------|----------------------------|
| `\\.` | Literal dot `.` |
| `\\\\` | Literal backslash `\` |
| `\\[` / `\\]` | Literal brackets `[` `]` |
| `\\{` / `\\}` | Literal braces `{` `}` |

```go
data := `{
    "user.name": "Alice",
    "a[b]": "bracket",
    "config\\local": "backslash"
}`

// Key name containing a dot
name := json.GetString(data, "user\\.name")    // "Alice"

// Key name containing brackets
bracket := json.GetString(data, "a\\[b\\]")    // "bracket"

// Key name containing a backslash
bs := json.GetString(data, "config\\\\local")  // "backslash"
```

::: warning Go strings and path escaping are two layers
In the example above, Go source shows **double backslashes** (`"user\\.name"`) — the Go string literal consumes one layer, and the path parser receives `user\.name` and consumes the second. If the path comes from a runtime variable (not a literal), only one layer of escaping is needed: the literal `"user\\.name"` equals the runtime `user\.name`.
:::

---

## Path Segment Types

Internally the library parses paths into segments of different types (implementation detail; not exported as public API):

| Type | Syntax example | Description |
|------|----------------|-------------|
| Property access | `user.name` | Access an object property |
| Array index | `items[0]` | Access an array element |
| Array slice | `items[1:5]` | Slice range access |
| Wildcard | `items[*]` | Match all elements |
| Field extraction | `{name,email}` | Extract multiple fields |
| Flat extraction | `{flat:tags}` | Extract and recursively flatten nested arrays |
| Append | `items[+]` | Append to an array |
| JSON Pointer | `/user/name` | RFC 6901 syntax starting with `/` |

---

## Syntax Pitfalls

The behaviors below all come from the actual implementation; knowing them up front saves debugging time.

### Extraction Misses Are Silent

A field-extraction "miss" is silent — `Get` returns `(nil, nil)`: no value and no error:

```go
data := `{"user": {"id": 1}}`

json.Get(data, "user{nonexistent}") // (nil, nil) — no error
json.Get(data, "user{a,b}")         // (nil, nil) — when none of the fields exist
```

So `err != nil` cannot decide whether extraction hit; inspect the return value itself. In multi-field extraction, as long as one field exists, an object containing only the hit fields is returned.

### Single-Field and Multi-Field Extraction Return Different Shapes

| Path | Acts on | Returns |
|------|---------|---------|
| `user{name}` | Object | The field value itself (bare, not an object) |
| `user{id,name}` | Object | A new object containing only the hit fields |
| `users{name}` | Array | An array of each element's field values |
| `users{id,name}` | Array | An array of each element's extraction result object |

```go
data := `{"user": {"id": 1, "name": "Alice", "email": "a@ex.com"}}`

json.Get(data, "user{name}")    // "Alice" (bare value)
json.Get(data, "user{id,name}") // {"id":1,"name":"Alice"}
```

### Property Chains "Through" Scalars Return nil Without Error

When a path hits a string, number, or other scalar mid-way, continuing with a property yields `(nil, nil)`; only a **missing key** returns `ErrPathNotFound` — the two "not found" cases have different error shapes:

```go
data := `{"name": "Alice"}`

json.Get(data, "name.foo")   // (nil, nil) — name is a string; no property to continue with
json.Get(data, "nosuch.foo") // (nil, ErrPathNotFound) — the key nosuch does not exist
```

Using an **array index** on a scalar (e.g. `name[0]` on a string), however, is a hard error, returning a descriptive "cannot access array index..." error.

### Extraction Skips Elements Missing the Field but Keeps null Values

In single-field extraction over an array, elements lacking the field produce no result item; elements with the field present but null produce a null item:

```go
data := `{"users": [{"name": "A"}, {"age": 20}, {"name": null}]}`

json.GetArray(data, "users{name}")
// ["A", null] — elements without a name field are skipped; null values are kept
```

### Index, Slice, and Modification Each Handle Out-of-Range Differently

| Operation | Out-of-range behavior |
|-----------|-----------------------|
| Index query `items[10]` | Returns zero value / `(nil, nil)`, no error |
| Slice query `items[10:20]` | Clamped into the valid range, returns the empty array `[]` |
| Modification `Set(data, "items[5]", v)` (len=3) | Under the default configuration the array is padded with `null` up to index 5 |

### JSON Pointer and Dot Syntax Cannot Be Mixed

Once a path starts with `/`, it is entirely in Pointer mode — `"/user.name"` looks up `user.name` as **a single key name**. Conversely, that is the easiest way to access key names containing dots/brackets (no backslash escaping needed):

```go
data := `{"a.b": 1, "c[0]": 2}`

json.GetInt(data, "/a.b")  // 1 — in Pointer mode the dot is part of the key name
json.GetInt(data, "/c[0]") // 2
```

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

	// 2. Array slice
	books := json.GetArray(data, "store.books[0:2]")
	fmt.Printf("First 2 books: %d items\n", len(books))

	// 3. Slice with a step
	prices := json.GetArray(data, "store.prices[::2]")
	fmt.Println("\nEvery other price:", prices)

	// 4. Field extraction
	extracted, err := json.Get(data, "store.books[0]{title,price}")
	if err != nil {
		panic(err)
	}
	fmt.Println("\nExtracted fields:", extracted)

	// 5. Append an element
	updated, err := json.Set(data, "store.books[+]", map[string]any{
		"title":    "New Book",
		"price":    55,
		"category": "programming",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("\nAfter append:", json.Valid([]byte(updated)))
}
```

## Next Steps

- [API Reference](../api-reference/) — The complete API reference
- [Examples](../examples/) — More real-world examples
