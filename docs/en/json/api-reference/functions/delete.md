---
title: "Delete Functions - CyberGo JSON | Delete Usage & Examples"
description: "CyberGo JSON is a Go library for path deletion, offering Delete removal and DeleteClean cascade cleanup to help developers drop fields and empty parents."
sidebar_label: "Delete Operations"
sidebar_position: 40
---

# Delete Functions

The JSON delete functions of the json package remove the node at a given path and optionally clean up the empty parents the deletion leaves behind. All delete functions are **immutable** — they return a new JSON string with the modification while the original stays unchanged; on error they return the original input.

## Delete

Signature: `func Delete(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the value at the specified path and returns the modified JSON string.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonStr` | `string` | Yes | JSON string |
| `path` | `string` | Yes | Path expression (dot, index, wildcard, slice, multi-field) |
| `cfg` | `Config` | No | Optional configuration (affects cleanup and validation behavior) |

**Returns**

| Return value | Description |
|--------------|-------------|
| `result string` | The modified JSON string (on success); the original `jsonStr` on error |
| `err error` | `nil` on success; a `*JsonsError` wrapping an underlying sentinel error on failure |

### Deleting an Object Property

Deletes a single nested property and returns the new object without that key.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"name":"Alice","temp":"value","age":30}}`

	result, err := json.Delete(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"age":30,"name":"Alice"}}
}
```

### Deleting an Array Element

Deletes an element of an array (indices start at 0). The element is **removed**, not blanked — subsequent elements shift forward, indices are renumbered, and no holes remain.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d"]}`

	// Delete element "b" at index 1; "c"/"d" shift forward automatically
	result, err := json.Delete(data, "items[1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"items":["a","c","d"]}
}
```

Negative indices are supported (counting from the end, `-1` is the last element):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d"]}`

	// -1 points at the last element "d"
	result, err := json.Delete(data, "items[-1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"items":["a","b","c"]}
}
```

### Nested Path Deletion

Dot paths reach into nested structures and delete nodes at any depth.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"config":{"database":{"host":"localhost","port":5432,"password":"secret"}}}`

	result, err := json.Delete(data, "config.database.password")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"config":{"database":{"host":"localhost","port":5432}}}
}
```

### Immutable Semantics

`Delete` returns a new string; **the original `jsonStr` is never modified**. You can safely reuse the same input in multiple places:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"a":1,"b":2,"c":3}`

	r1, _ := json.Delete(data, "a")
	r2, _ := json.Delete(data, "b")

	fmt.Println(data) // Original unchanged: {"a":1,"b":2,"c":3}
	fmt.Println(r1)   // Output: {"b":2,"c":3}
	fmt.Println(r2)   // Output: {"a":1,"c":3}
}
```

## Advanced Path Deletion

`Delete` reuses the same recursive path engine as Get/Set, supporting batch semantics such as wildcards, slice ranges, and multi-field extraction. **Batch paths (containing `*`, `{}`, `:`) are fault-tolerant toward missing targets — delete what matches, silently skip what is missing, and return no error**.

### Wildcard Deletion

`items[*]` deletes all elements of an array; `[*].field` deletes the given property of every element.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"users":[{"name":"Alice","temp":"x"},{"name":"Bob","temp":"y"}]}`

	// Delete the temp property of every user object
	result, err := json.Delete(data, "users[*].temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"users":[{"name":"Alice"},{"name":"Bob"}]}
}
```

No error is raised either when some elements lack the target property (idempotent semantics, consistent with Go's native `delete()` on an absent key):

<!-- check-code: skip -->
```go
// data = `[{"a":1},{"b":2}]` — the second element has no "a", yet the call succeeds
result, err := json.Delete(data, "[*].a")
// err == nil, result: [{"b":2}]
```

### Slice Range Deletion

`items[0:2]` deletes a contiguous range of elements (half-open: left-closed, right-open).

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"items":["a","b","c","d","e"]}`

	// Delete "a" and "b" at indices 0 and 1 (not 2)
	result, err := json.Delete(data, "items[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"items":["c","d","e"]}
}
```

### Multi-Field Extraction Deletion

`[*].{a,b}` deletes several named properties of every element in one shot.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `[{"name":"Alice","pwd":"x","token":"y"},{"name":"Bob","pwd":"z"}]`

	// Delete both pwd and token at once
	result, err := json.Delete(data, "[*].{pwd,token}")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: [{"name":"Alice"},{"name":"Bob"}]
}
```

### JSON Pointer Path Deletion

When a path starts with `/`, `Delete` parses it with **RFC 6901 JSON Pointer** semantics (dot syntax no longer applies): segments are separated by `/`, and `~0`/`~1` escape `~` and `/` respectively. This provides an escape hatch for deleting **keys whose names contain special characters such as dots** (dot syntax cannot express such key names):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// The key "a.b" itself contains a dot; the dot path "a.b" parses as two
	// levels and cannot hit it
	data := `{"a.b": 1, "user": {"name": "Alice"}}`

	r1, err := json.Delete(data, "/a.b")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1) // Output: {"user":{"name":"Alice"}}

	// /user/name is equivalent to the dot path user.name
	r2, err := json.Delete(data, "/user/name")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // Output: {"a.b":1}
}
```

::: warning The root node cannot be deleted
The JSON Pointer `/` refers to the document root; deleting the root is meaningless — an error is returned (`cannot delete root`). Missing segments in a pointer path return `ErrPathNotFound`, just like exact dot paths.
:::

:::tip Exact paths vs batch paths
- **Exact paths** (property names/indices only, e.g. `user.temp`, `items[1]`): return an `ErrPathNotFound` error when the target does not exist.
- **Batch paths** (containing `*`, `{}`, `:`, e.g. `items[*]`, `[*].{a,b}`, `items[0:2]`): silently skip missing targets without error. Use exact paths when strict validation matters; use batch paths for "best-effort deletion".
:::

## Error Handling

When the target of an exact path does not exist, `Delete` returns a `*JsonsError` wrapping `ErrPathNotFound`, and the returned input is unchanged. Use `errors.Is` to determine the specific error type:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"a":1}`

	result, err := json.Delete(data, "nonexistent.path")
	if err != nil {
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("Path not found, skipped")
		} else {
			fmt.Println("Other error:", err)
		}
	}
	// result is still the original JSON: {"a":1}
	fmt.Println(result)
	// Output:
	// Path not found, skipped
	// {"a":1}
}
```

Common sentinel errors for deletion:

| Error | Trigger |
|-------|---------|
| `ErrPathNotFound` | An intermediate segment or the target key/index of an exact path does not exist |
| `ErrInvalidJSON` | `jsonStr` is not valid JSON |
| `ErrInvalidPath` | The path expression has illegal syntax (e.g. an unclosed bracket) |

## DeleteClean

Signature: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the specified path and **recursively cleans up** the `null` values and empty objects/empty arrays produced by the deletion. Equivalent to `Delete(jsonStr, path, cfg)` with `CleanupNulls: true` + `CompactArrays: true` forcibly enabled.

### Cascade Cleanup Example

When a parent object becomes empty after the deletion, `DeleteClean` removes the empty parent as well, cascading upward level by level:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// temp is the only property of user
	data := `{"user":{"temp":"value"}}`

	// Plain delete: user becomes {}, but is retained
	r1, _ := json.Delete(data, "user.temp")
	fmt.Println(r1) // Output: {"user":{}}

	// DeleteClean: after user becomes empty, the user key is cleaned up too
	r2, err := json.DeleteClean(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // Output: {}
}
```

### Cleaning Temporary Fields from API Responses

`DeleteClean` is a good fit for cleaning API responses: while deleting the target field, it also sweeps other `null` values and residual empty containers, so no "hollow" objects leak to the frontend.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	apiResp := `{"data":{"id":1,"name":"Product","desc":null,"price":29.99,"note":null}}`

	// One DeleteClean removes desc and sweeps the other nulls in the tree (note)
	cleaned, err := json.DeleteClean(apiResp, "data.desc")
	if err != nil {
		panic(err)
	}
	fmt.Println(cleaned)
	// Output: {"data":{"id":1,"name":"Product","price":29.99}}
}
```

::: warning DeleteClean sweeps nulls across the entire tree
`DeleteClean` cleanup is **global**: it recursively runs cleanup across the entire JSON tree, so it removes **all** pre-existing `null` values and empty containers, not just the one produced at the deletion point. Use plain `Delete` when you only want to remove a specific field and keep other `null`s.
:::

## DeleteClean and Config

`DeleteClean` is essentially syntactic sugar over `Delete` plus two config options. You can equally pass the same options to plain `Delete` for a fully equivalent effect:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"temp":"value"}}`

	// Option 1: DeleteClean
	r1, _ := json.DeleteClean(data, "user.temp")

	// Option 2: Delete + explicit config (fully equivalent)
	cfg := json.DefaultConfig()
	cfg.CleanupNulls = true
	cfg.CompactArrays = true
	r2, _ := json.Delete(data, "user.temp", cfg)

	fmt.Println(r1) // Output: {}
	fmt.Println(r2) // Output: {}
}
```

`Config` fields that affect deletion:

| Field | Default | Effect on deletion |
|-------|---------|--------------------|
| `CleanupNulls` | `false` | Recursively removes `null` values and empty objects/empty arrays from the result (cascade cleanup) |
| `CompactArrays` | `false` | Removes `null`/empty elements from arrays; enabling implies `CleanupNulls` |
| `CreatePaths` | `true` | **Does not affect deletion** (deletion never creates paths; listed for contrast only) |

## Delete vs DeleteClean Comparison

| Feature | Delete | DeleteClean |
|---------|--------|-------------|
| Deletes the target node | Yes | Yes |
| Array elements removed and reordered (no holes) | Yes | Yes |
| Errors on missing exact path | Yes (`ErrPathNotFound`) | Yes (`ErrPathNotFound`) |
| Cleans `null` produced by deletion | No | Yes |
| Cleans empty objects/empty arrays (cascade) | No | Yes (upward level by level) |
| Sweeps pre-existing `null` across the tree | No | Yes (global cleanup) |
| Equivalent configuration | Default | `CleanupNulls+CompactArrays` |
| Relative overhead | Lower | Slightly higher (one extra full-tree cleanup traversal) |

## Common Pitfalls

::: warning Array deletion leaves no holes
When `Delete` removes an array element, the element is **entirely removed** and subsequent elements shift forward automatically — no `null` placeholder or hole remains. If you expect indices to stay unchanged after deletion (leaving gaps), CyberGo's delete semantics do not provide that — use `Set` to write `null` into the position instead.
:::

::: warning DeleteClean may remove legitimately empty data
`DeleteClean` cascade cleanup treats all empty objects `{}` and empty arrays `[]` as things to clean up. If in your business an "empty array" or "empty object" is a meaningful state (e.g. `"tags":[]` means "no tags" rather than "field missing"), `DeleteClean` will remove it along with its key. Use plain `Delete` when you need to keep such fields.
:::

::: warning Batch deletion is fault-tolerant
Wildcard/slice/multi-field paths **silently skip** missing targets without returning an error. When you rely on "target must exist" strict validation semantics, use an exact path instead (e.g. `items[1]` rather than `items[*]`).
:::

## Deleting Multiple Fields in a Batch

To delete several unrelated fields at once, simply loop over plain `Delete` (each iteration building on the previous result):

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user":{"id":1,"name":"Alice","password":"secret","ssn":"123-45-6789"}}`

	sensitive := []string{"user.password", "user.ssn"}
	result := data
	for _, field := range sensitive {
		var err error
		result, err = json.Delete(result, field)
		if err != nil {
			fmt.Printf("Deleting %s failed: %v\n", field, err)
		}
	}
	fmt.Println(result)
	// Output: {"user":{"id":1,"name":"Alice"}}
}
```

## See Also

- [Modification Operations](./modify) - Set, merge, and other modification functions
- [Query & Get](./query) - Get, GetString and other query operations
- [Processor Delete Methods](../processor/delete) - Instance-method versions, chaining-friendly
- [Config Reference](../config) - Details on CleanupNulls / CompactArrays and other fields
