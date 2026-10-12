---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo JSON | Get Started in 5 Minutes"
description: "CyberGo JSON quick start: install, path queries GetString/GetInt, Set/Delete, Marshal/Unmarshal, iteration, error handling, plus first-hour FAQs."
sidebar_position: 10
---

# Quick Start

This guide helps you get started quickly with the `github.com/cybergodev/json` library.

## Installation

```bash
go get github.com/cybergodev/json
```

**Requires Go 1.25+** (the source `go.mod` declares `go 1.25.0`; examples use generics and the `slices` standard library).

## Basic Usage

### Package-Level Functions

The library provides a set of convenient package-level functions that require no processor instance:

#### Getting Values

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

	// Generic get
	val, err := json.Get(data, "name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val) // CyberGo

	// Type-safe getters
	name := json.GetString(data, "name")
	version := json.GetInt(data, "version")
	active := json.GetBool(data, "active")
	price := json.GetFloat(data, "price")
	tags := json.GetArray(data, "tags")
	meta := json.GetObject(data, "meta")

	fmt.Println(name, version, active, price)
	fmt.Println(tags) // [json go fast]
	fmt.Println(meta) // map[author:dev]

	// Get with default values
	desc := json.GetString(data, "description", "N/A")
	count := json.GetInt(data, "count", 0)
	fmt.Println(desc, count) // N/A 0
}
```

#### Nested Paths

Dot-separated nested paths are supported:

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### Array Indices

Access by array index is supported:

```go
data := `{"items": ["a", "b", "c"]}`

// Both syntaxes are supported
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// Bracket syntax
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// Range access (returns an array)
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

:::tip More path syntax
Beyond basic properties and array indices, advanced syntax such as **array slices** `[1:5]`, **wildcards** `[*]`, and **field extraction** `{name,email}` is also supported. See [Path Expression Syntax](./path-syntax).
:::

#### Setting Values

```go
data := `{"name": "old"}`

// Set a new value
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"new"}

// Add a new field
updated, err = json.Set(data, "version", 1)
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"old","version":1}

// Set multiple fields one at a time (each call returns new JSON; check err)
updated, err = json.Set(data, "name", "updated")
updated, err = json.Set(updated, "version", 2)
updated, err = json.Set(updated, "active", true)
if err != nil {
    panic(err)
}
```

#### Deleting Values

```go
data := `{"name": "test", "temp": "remove"}`

// Delete a field
updated, err := json.Delete(data, "temp")
if err != nil {
    panic(err)
}
fmt.Println(updated) // {"name":"test"}
```

### Encoding and Decoding

Fully compatible with the standard library:

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// Encode
user := User{Name: "Alice", Age: 30}
bytes, err := json.Marshal(user)
if err != nil {
    panic(err)
}
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// Indented encoding
pretty, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// Decode
var u User
if err := json.Unmarshal(bytes, &u); err != nil {
    panic(err)
}
fmt.Println(u.Name, u.Age) // Alice 30
```

### Validation

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### Formatting

```go
// Fragments in this section rely on the imports below (likewise for other sections)
import (
    "bytes"
    "fmt"

    "github.com/cybergodev/json"
)

compact := `{"name":"test","nested":{"key":"value"}}`

// Pretty-print
pretty, err := json.Prettify(compact)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// Compact output
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Using a Processor

For frequent operations, use a `Processor` for better performance and caching:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	// Create a processor with the default configuration
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close() // Remember to close it to release resources

	data := `{"name": "test", "value": 42}`

	// Operate via the processor
	name := p.GetString(data, "name")
	value := p.GetInt(data, "value")

	fmt.Println(name, value)
}
```

## Configuration Options

```go
// Default configuration
cfg := json.DefaultConfig()

// Security-hardened configuration (for untrusted input)
// cfg = json.SecurityConfig()

// Pretty-print configuration
// cfg = json.PrettyConfig()

// Custom configuration
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50MB
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// Create a processor with the custom configuration
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Iteration and Traversal

Iterate over array elements and safely access their fields, without writing a full path for every element:

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
if err != nil {
    panic(err)
}
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

:::tip
The `Foreach` family has 12 functions in total (including 4 file variants, `ForeachFile*`; see the full list in the [Cheat Sheet · Iteration Function Family](./cheatsheet#iteration-function-family)): use `ForeachWithError` when you need **early termination** (the callback returns an `error`; return `item.Break()` to stop). Deep nested traversal, carrying the current path, and other variants are covered in the same cheat-sheet section.
:::

## Error Handling

Common errors from path operations are **sentinel errors** — tell them apart precisely with `errors.Is`:

```go
val, err := json.Get(data, "user.profile.email")
if err != nil {
    switch {
    case errors.Is(err, json.ErrPathNotFound):
        // Key does not exist — common in practice; fall back to a default value
    case errors.Is(err, json.ErrInvalidJSON):
        // The JSON itself is malformed
    default:
        // Other errors (limit exceeded, type conflicts, etc.): JsonsError already
        // carries the operation name and path, so logging it is enough — no need
        // to enumerate every category
        fmt.Println(err)
    }
}
```

If you would rather not check each case, typed functions with default values (`GetString`/`GetInt`, etc.) silently return the zero value or the default, which suits non-critical reads.

:::tip Where does ErrTypeMismatch apply?
When a plain `Get` hits a type conflict (e.g. an array index applied to a string path), it returns a descriptive error carrying context, **not** the `ErrTypeMismatch` sentinel. `ErrTypeMismatch` mainly appears in three places: the `AsString()`/`AsInt()` conversion methods on `SafeGet` results, navigation of pre-compiled paths in `GetCompiled`, and calling the `Foreach` family on non-iterable values.
:::

## Common First-Hour Questions

The questions most often hit during the first hours, answered in one place; for path-syntax details see [Path Expression Syntax](./path-syntax).

**Q: What exactly is returned when a path is not found?**

It depends on the call, and "missing key" and "out-of-range index" behave differently:

| Call | Object key missing | Array index out of range |
|------|--------------------|--------------------------|
| `json.Get` | `(nil, ErrPathNotFound)` | `(nil, nil)`, **no error** |
| `json.GetString` and other typed functions | Zero value or the passed default | Zero value or the passed default |
| `json.SafeGet` | `Exists: false` | `Exists: true` but the value is nil |

When an array index is out of range, `Get` does not error (the result is nil), so to decide "does this element exist" you must look at the return value, not just err. Full rules in [Syntax Pitfalls](./path-syntax#what-are-the-syntax-pitfalls).

**Q: Why is the number I got back a float64?**

`Get` returns `any`, and JSON numbers always come out of the standard decoder as `float64`:

```go
data := `{"version": 1}`

val, _ := json.Get(data, "version") // val is float64(1), not int
i := json.GetInt(data, "version")   // use a typed function when you need int
```

Large integers beyond `float64` precision (e.g. snowflake IDs) get rounded — use `Config.PreserveNumbers` to keep the original number text, or `Decoder.UseNumber()` to get `json.Number`.

**Q: Why didn't the original JSON change after calling `Set`?**

`Set`/`Delete` follow a pure-function style: they return a **new string** carrying the modification, leaving the original untouched. Discarding the return value is the most common beginner bug:

```go
data := `{"name": "old"}`

// ✗ result discarded, data unchanged
_, _ = json.Set(data, "name", "new")

// ✓ capture the return value
updated, err := json.Set(data, "name", "new")
if err != nil {
    panic(err)
}
```

When modifying multiple places, use `SetMultiple` to do it in one shot — clearer than chained `Set` calls.

**Q: What happens if `Set` uses an out-of-range index?**

Unlike the query side's "zero value, no error" — under the default configuration (`CreatePaths: true`), `Set` pads the array with `null` up to the target index:

```go
updated, err := json.Set(`{"items":[1,2,3]}`, "items[5]", "x")
// {"items":[1,2,3,null,null,"x"]}
```

To append at the end, use `items[+]` instead of relying on out-of-range indices.

**Q: Why is `defer p.Close()` needed everywhere?**

A `Processor` internally holds a cache and a background cleanup goroutine; `Close` drains in-flight operations and releases these resources — creating processors at high frequency without closing them will keep accumulating. Package-level functions rely on a global processor whose lifecycle is managed for you, so you neither need to nor should call `Close` manually. See [Processor Guide](./processor-guide#lifecycle-management).

## Next Steps

- [Path Expression Syntax](./path-syntax) — learn the complete path query syntax
- [Processor Guide](./processor-guide) — when to use a processor, pre-parse optimization
- [Formatted Output](./print) — pretty-print and compact JSON
- [Migrating from the Standard Library](./migration) — zero-cost encoding/json replacement
- [Cheat Sheet](./cheatsheet) — quick API reference
- [Large File Handling](../streaming/large-files) — processing large JSON files
- [API Reference](../api-reference/) — the complete API reference
- [Examples](../examples/) — browse more real-world examples
