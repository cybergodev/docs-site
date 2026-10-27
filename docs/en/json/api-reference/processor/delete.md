---
sidebar_label: "Delete Operations"
title: "Processor Delete Methods - CyberGo JSON | Delete Examples"
description: "Processor delete methods: Delete removes a path, DeleteClean prunes empty values and parents; both support wildcards and slices and return a new string."
sidebar_position: 40
---

# Delete Methods

Delete methods remove the value at a path and return the modified JSON string. All methods are **immutable**: they return a new string and leave the input unchanged; on error they return the input. Behavior matches the [package-level delete functions](../functions/delete); the difference is that instance methods work with the processor's own configuration, cache and hooks.

## Delete

Signature: `func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (result string, err error)`

Deletes the value at the specified path and returns the modified JSON string.

<!-- check-code: skip -->
```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.Delete(data, "user.temporary")
```

### Full Example: Object Properties, Array Elements, and Nested Paths

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

	// Delete an object property
	r1, err := p.Delete(`{"user":{"name":"Alice","temp":"x"}}`, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1)
	// Output: {"user":{"name":"Alice"}}

	// Delete an array element (removed and reordered, no gaps)
	r2, err := p.Delete(`{"items":["a","b","c"]}`, "items[1]")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2)
	// Output: {"items":["a","c"]}

	// Nested path deletion
	r3, err := p.Delete(`{"a":{"b":{"c":1,"d":2}}}`, "a.b.c")
	if err != nil {
		panic(err)
	}
	fmt.Println(r3)
	// Output: {"a":{"b":{"d":2}}}
}
```

### Advanced Paths: Wildcards and Slices

`Delete` reuses the same path engine as `Get`/`Set`, supporting wildcards, slice ranges and multi-field extraction. Batch paths (containing `*`, `{}` or `:`) silently skip missing targets without an error. For the full path-syntax reference — wildcards, slices, multi-field, and **JSON Pointer** (RFC 6901 paths starting with `/`, which can delete keys whose names contain dots and other special characters) — see [Delete Functions - Advanced Path Deletion](../functions/delete#advanced-path-deletion).

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

	data := `{"users":[{"name":"Alice","pwd":"x"},{"name":"Bob","pwd":"y"}],"tags":[1,2,3,4]}`

	// Wildcard: delete each user's pwd
	r1, err := p.Delete(data, "users[*].pwd")
	if err != nil {
		panic(err)
	}
	fmt.Println(r1)
	// Output: {"tags":[1,2,3,4],"users":[{"name":"Alice"},{"name":"Bob"}]}

	// Slice range: delete tags[0:2] (half-open interval, left-closed right-open)
	r2, err := p.Delete(data, "tags[0:2]")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2)
	// Output: {"tags":[3,4],"users":[{"name":"Alice","pwd":"x"},{"name":"Bob","pwd":"y"}]}
}
```

### Error Handling

When the target of an exact path does not exist, an error wrapping `ErrPathNotFound` is returned and the input is unchanged. Test it with `errors.Is`:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	result, err := p.Delete(`{"a":1}`, "nonexistent.path")
	if err != nil {
		if errors.Is(err, json.ErrPathNotFound) {
			fmt.Println("Path not found, skipped")
		}
	}
	fmt.Println(result) // Original data unchanged: {"a":1}
	// Output:
	// Path not found, skipped
	// {"a":1}
}
```

## DeleteClean

Signature: `func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Deletes the specified path and **recursively cleans up** `null` values and empty objects/empty arrays produced by the deletion. Equivalent to `Delete` with `CleanupNulls: true` and `CompactArrays: true` forced on.

### Cascade Cleanup: Empty Parent Objects Removed Automatically

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	// temp is the only property of user
	data := `{"user":{"temp":"value"}}`

	// Plain delete: user becomes {}, but is retained
	r1, _ := p.Delete(data, "user.temp")
	fmt.Println(r1) // Output: {"user":{}}

	// DeleteClean: after user becomes empty, the user key is cleaned up too, cascading upward
	r2, err := p.DeleteClean(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(r2) // Output: {}
}
```

### Cleaning API Responses

Delete the target field and also sweep other `null` values and residual empty containers across the tree:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	apiResp := `{"data":{"id":1,"name":"Product","desc":null,"price":29.99}}`

	cleaned, err := p.DeleteClean(apiResp, "data.desc")
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

## Delete vs DeleteClean Comparison

The behavior comparison (cleanup scope, cascade semantics, equivalent configuration and overhead) is in [Delete Functions - Delete vs DeleteClean Comparison](../functions/delete#delete-vs-deleteclean-comparison). The Processor-side difference is only how configuration takes effect: cleanup is decided by the **union of the call argument `cfg` and the processor's own configuration** (next section).

## Effect of Config on Deletion Behavior

Cleanup is decided by the **union of the call argument `cfg` and the processor's own configuration**: either source enabling it is enough. If the processor was created with `CleanupNulls` enabled, plain `p.Delete(...)` calls clean up too:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	// Create a processor with cleanup enabled by default
	cfg := json.DefaultConfig()
	cfg.CleanupNulls = true
	cfg.CompactArrays = true
	p, err := json.New(cfg)
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"temp":"value"}}`

	// Plain Delete also cleans up, because the processor's own config has it enabled
	result, err := p.Delete(data, "user.temp")
	if err != nil {
		panic(err)
	}
	fmt.Println(result) // Output: {}
}
```

`Config` fields that affect deletion behavior:

| Field | Default | Effect on deletion |
|-------|---------|--------------------|
| `CleanupNulls` | `false` | Recursively removes `null` values and empty objects/empty arrays from the result (cascade) |
| `CompactArrays` | `false` | Removes `null`/empty elements from arrays; enabling implies `CleanupNulls` |
| `CreatePaths` | `true` | **Does not affect deletion** (deletion never creates paths) |

> So `DeleteClean` is equivalent to calling `Delete` on a processor with `CleanupNulls+CompactArrays`; pick whichever reads more clearly.

## Chained Deletion

Delete methods return a new string that can be passed straight into the next call:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, _ := json.New()
	defer p.Close()

	data := `{"user":{"name":"Alice","temp":"x","version":"1.0.0"}}`

	// Chain: first set, then delete, each step based on the previous result
	r1, _ := p.Set(data, "user.name", "CyberGo")
	r2, _ := p.Delete(r1, "user.temp")
	final, _ := p.Delete(r2, "user.version")

	fmt.Println(final)
	// Output: {"user":{"name":"CyberGo"}}
}
```

## Common Pitfalls

Three caveats apply equally to the Processor methods: array deletion leaves no gaps, `DeleteClean` also removes legitimately empty data, and batch deletion skips missing targets without error. Full explanations and examples are in [Delete Functions - Common Pitfalls](../functions/delete#common-pitfalls).

## See Also

- [Modify Operations](./modify) - Set/SetCreate chained modification
- [Delete Functions](../functions/delete) - Package-level Delete/DeleteClean functions (with full path syntax reference)
- [Config Reference](../config) - Details on CleanupNulls / CompactArrays and other fields
