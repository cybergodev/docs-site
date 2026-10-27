---
sidebar_label: "Modification Operations"
title: "Processor Data Modification - CyberGo JSON | Set/SetMultiple"
description: "Processor modification methods: Set/SetMultiple writes, SetCreate automatic path creation, [+] array append, and MergeJSON/MergeMany/CompareJSON merges."
sidebar_position: 30
---

# Data Modification Methods

Modification methods return a **new JSON string containing the change** (the original string is untouched), and each result feeds the next call. For deletion see [Delete Operations](./delete). Behavior matches the [package-level modification functions](../functions/modify); the difference is where configuration comes from. Without `cfg` the processor's baked configuration applies; with `cfg` that call's configuration applies. Two Processor-specific semantics are the `CreatePaths` precedence and the scope of `ContinueOnError`.

## Immutable Semantics

All modification methods return a **new JSON string**; the input string is never modified (Go strings are immutable anyway). On failure the original string and the error are returned — except for `SetMultiple` with `ContinueOnError=true` and a partial failure (see below):

```go
original := `{"user":{"name":"Alice"}}`

// Set returns a new string; original is unchanged
modified, err := p.Set(original, "user.name", "Bob")
// original is still {"user":{"name":"Alice"}}
// modified is {"user":{"name":"Bob"}}

// On failure: original string + error
result, err := p.Set(original, "nonexistent.deep.path", "x")
// result == original (when CreatePaths=false and the path is missing)
```

**Complete example**

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

	original := `{"user":{"name":"Alice"}}`
	modified, err := p.Set(original, "user.name", "Bob")
	if err != nil {
		panic(err)
	}
	fmt.Println(original) // Output: {"user":{"name":"Alice"}}
	fmt.Println(modified) // Output: {"user":{"name":"Bob"}}
}
```

## Set

Signature: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

Sets the value at the specified path and returns the modified JSON string. Whether missing intermediate paths are created automatically depends on `Config.CreatePaths` (see [CreatePaths and SetCreate](#createpaths-and-setcreate)).

```go
result, err := p.Set(data, "user.name", "NewName")
```

Value types that can be set:

```go
// String
result, _ := p.Set(data, "user.name", "CyberGo")

// Number
result, _ = p.Set(data, "user.age", 25)

// Boolean
result, _ = p.Set(data, "user.active", true)

// Object
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio":      "Developer",
    "location": "China",
})

// Array
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

**Complete example: modifying a nested path**

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

	data := `{"user":{"name":"Alice","address":{"city":"Beijing"}}}`
	result, err := p.Set(data, "user.address.city", "Shanghai")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"address":{"city":"Shanghai"},"name":"Alice"}}
}
```

## SetMultiple

Signature: `func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch-sets the values at multiple paths and returns the modified JSON string. Compared with repeated `Set` calls, `SetMultiple` parses the JSON only once and applies all updates in a single traversal. Whether paths are created depends on `Config.CreatePaths`.

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name":   "CyberGo",
    "user.age":    25,
    "user.active": true,
})
```

**Complete example: batch-updating existing fields**

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

	data := `{"user":{"name":"Alice","age":25,"email":"a@x.com"}}`
	result, err := p.SetMultiple(data, map[string]any{
		"user.name":  "Bob",
		"user.age":   26,
		"user.email": "b@x.com",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"age":26,"email":"b@x.com","name":"Bob"}}
}
```

:::tip ContinueOnError and deterministic ordering
- By default (`ContinueOnError=false`) the first failing path returns the original string and that error. When enabled, failing paths are skipped and the rest still written: if everything fails you get the original string plus a joined summary error; on a partial failure you get the **document with the successful updates applied**, together with the per-path errors joined by `errors.Join`. This field applies only to `SetMultiple` and is unrelated to the built-in per-operation isolation of [`ProcessBatch`](./batch).
- Updates are applied in **lexicographic path order**, so overlapping paths (e.g. `a` and `a.b`) have deterministic results: `a` lands first, and `a.b` always writes into the newly created container — unaffected by random map iteration order.
:::

## SetCreate

Signature: `func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Sets a value and **automatically creates missing intermediate paths**. Equivalent to `Set` with `CreatePaths=true`: paths are created regardless of the processor's own configuration. See [CreatePaths and SetCreate](#createpaths-and-setcreate).

**Creating intermediate objects**

```go
// user.profile is created as an object when missing
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

**Complete example: auto-creating intermediate objects and arrays**

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

	data := `{"user":{"name":"Alice"}}`

	// Create a nested object: user.profile.bio
	result, err := p.SetCreate(data, "user.profile.bio", "Developer")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"name":"Alice","profile":{"bio":"Developer"}}}

	// Create an array: when user.tags[0] is missing, the array is created and index 0 filled
	result, err = p.SetCreate(data, "user.tags[0]", "admin")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"name":"Alice","tags":["admin"]}}
}
```

## SetMultipleCreate

Signature: `func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Batch-sets multiple values and creates intermediate paths automatically. Equivalent to `SetMultiple` with `CreatePaths=true`.

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

**Complete example: batch-creating nested structure from an empty object**

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

	data := `{}`
	result, err := p.SetMultipleCreate(data, map[string]any{
		"user.name":        "Alice",
		"user.profile.bio": "Developer",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"user":{"name":"Alice","profile":{"bio":"Developer"}}}
}
```

## Appending Array Elements

The `[+]` syntax in a path appends an element to the end of an array without knowing its length up front. `[+]` must follow an existing array path (e.g. `items[+]`).

```go
data := `{"items":["a","b"]}`

// Append a single element
result, err := p.Set(data, "items[+]", "c")
// {"items":["a","b","c"]}

// Append multiple elements (a passed slice is expanded)
result, err = p.Set(data, "items[+]", []any{"c", "d"})
// {"items":["a","b","c","d"]}
```

**Complete example**

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

	data := `{"items":["a","b"]}`
	result, err := p.Set(data, "items[+]", "c")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// Output: {"items":["a","b","c"]}
}
```

## CreatePaths and SetCreate

Path auto-creation has two control entry points that differ in scope:

| Approach | Behavior | Good for |
|----------|----------|----------|
| `Config.CreatePaths` (default `true`) | Processor-level switch affecting `Set` / `SetMultiple` | Building a **dedicated** processor with path creation uniformly on or off |
| `SetCreate` / `SetMultipleCreate` | Forces `CreatePaths=true`, **overriding** the processor configuration | Occasionally creating paths without changing the processor configuration |

**Configuration precedence** (highest to lowest):

1. **`SetCreate` / `SetMultipleCreate`** — always force `CreatePaths=true`.
2. **Per-call `cfg`** — an explicitly passed `cfg` fully overrides the processor setting (including turning it off).
3. **Processor `Config.CreatePaths`** — applies when `cfg` is omitted.

```go
// Build a processor with path creation disabled
cfg := json.DefaultConfig()
cfg.CreatePaths = false
p, _ := json.New(cfg)

// Set follows the processor configuration: errors on a missing path
_, err := p.Set(`{"user":{}}`, "user.profile.bio", "x") // err is non-nil

// SetCreate forces creation: regardless of the processor configuration
result, _ := p.SetCreate(`{"user":{}}`, "user.profile.bio", "x")
// {"user":{"profile":{"bio":"x"}}}

// Per-call cfg overrides the processor setting (re-enabled here)
result, _ = p.Set(`{"user":{}}`, "user.profile.bio", "x", json.DefaultConfig())
// {"user":{"profile":{"bio":"x"}}}
```

## Chained Modification

Modification methods return new strings, so each step's result can feed the next to build a chain:

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Processor Merge Methods

The Processor also provides instance methods corresponding to the package-level [MergeJSON](../functions/modify#mergejson), [MergeMany](../functions/modify#mergemany) and [CompareJSON](../helpers#comparejson).

### Processor.MergeJSON

Signature: `func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Deep-merges the two objects per `Config.MergeMode`, then re-encodes the result with this processor. **When cfg is omitted, the processor's own configuration is used**: the `MergeMode` and encoding options baked in at `New(cfg)` apply directly. When cfg is passed, the merge follows cfg's `MergeMode`.

Like the package-level function, `Processor.MergeJSON` runs no security validation: it only decodes, deep-merges and re-encodes. When security validation is needed, use `CompareJSON` (which always validates; per cfg when passed, otherwise per the processor's own configuration).

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Union merge (default)
result, err := p.MergeJSON(base, override)

// Intersection merge
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

Signature: `func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

Folds the slice left to right via `MergeJSON`; the strategy comes from `Config.MergeMode` (default `MergeUnion`). Fewer than 2 JSON strings returns an error; a failing merge step returns an error carrying that step's index.

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

Signature: `func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

Compares two JSON strings for equality (numbers normalized, key order irrelevant).

::: warning Difference from the package-level CompareJSON
The package-level `CompareJSON` runs no security validation without cfg and marshals both sides with `encoding/json`; the Processor method **always** runs security validation (per cfg when passed, otherwise per the processor's own configuration) and symmetrically marshals both sides with the library encoder, so configured encoding (e.g. `EscapeHTML`) applies symmetrically.
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## See Also

- [Path Queries](./query) - The Get family of methods
- [Delete Operations](./delete) - Delete/DeleteClean methods
- [Batch Operations](./batch) - ProcessBatch batch processing
- [Modification Functions](../functions/modify) - Package-level Set/SetMultiple/MergeJSON functions
